use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
  env,
  fs,
  path::{Path, PathBuf},
  process::Command,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSettings {
  pub background_color: String,
  pub ring_color: String,
  pub ring_glow: bool,
  pub sensitivity: f64,
  pub smoothing: f64,
  pub logo_scale: f64,
  pub logo_opacity: f64,
  pub logo: Option<super::presets::LogoAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBeginArgs {
  pub audio_filename: String,
  pub audio_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBeginResult {
  pub session_id: String,
  pub session_dir: String,
  pub audio_path: String,
  pub frames_dir: String,
}

fn export_root(app: &AppHandle) -> Result<PathBuf, String> {
  let base = app
    .path()
    .app_cache_dir()
    .map_err(|e| format!("app_cache_dir error: {e}"))?;
  Ok(base.join("exports"))
}

fn ensure_dir(p: &Path) -> Result<(), String> {
  fs::create_dir_all(p).map_err(|e| format!("create_dir_all error: {e}"))
}

#[tauri::command]
pub fn export_begin(app: AppHandle, args: ExportBeginArgs) -> Result<ExportBeginResult, String> {
  let root = export_root(&app)?;
  ensure_dir(&root)?;

  let session_id = Uuid::new_v4().to_string();
  let session_dir = root.join(&session_id);
  let frames_dir = session_dir.join("frames");
  ensure_dir(&frames_dir)?;

  let audio_path = session_dir.join(sanitize_filename(&args.audio_filename));
  let audio_bytes = general_purpose::STANDARD
    .decode(args.audio_base64.as_bytes())
    .map_err(|e| format!("base64 decode error: {e}"))?;
  fs::write(&audio_path, audio_bytes).map_err(|e| format!("write audio error: {e}"))?;

  Ok(ExportBeginResult {
    session_id,
    session_dir: session_dir.to_string_lossy().to_string(),
    audio_path: audio_path.to_string_lossy().to_string(),
    frames_dir: frames_dir.to_string_lossy().to_string(),
  })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFrameArgs {
  pub session_id: String,
  pub frame_index: u32,
  pub png_base64: String,
}

#[tauri::command]
pub fn export_write_frame(app: AppHandle, args: WriteFrameArgs) -> Result<(), String> {
  let root = export_root(&app)?;
  let session_dir = root.join(&args.session_id);
  let frames_dir = session_dir.join("frames");
  ensure_dir(&frames_dir)?;

  let filename = format!("{:06}.png", args.frame_index);
  let path = frames_dir.join(filename);
  let bytes = general_purpose::STANDARD
    .decode(args.png_base64.as_bytes())
    .map_err(|e| format!("base64 decode error: {e}"))?;
  fs::write(path, bytes).map_err(|e| format!("write frame error: {e}"))?;
  Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodeArgs {
  pub session_id: String,
  pub audio_path: String,
  pub output_path: String,
  pub fps: u32,
  pub use_videotoolbox: bool,
}

#[tauri::command]
pub fn export_encode(app: AppHandle, args: EncodeArgs) -> Result<(), String> {
  let root = export_root(&app)?;
  let session_dir = root.join(&args.session_id);
  let frames_glob = session_dir.join("frames").join("%06d.png");

  let ffmpeg = resolve_ffmpeg(&app).unwrap_or_else(|| "ffmpeg".to_string());

  let mut cmd = Command::new(ffmpeg);
  cmd.arg("-y")
    .arg("-hide_banner")
    .arg("-loglevel")
    .arg("error")
    .arg("-framerate")
    .arg(args.fps.to_string())
    .arg("-i")
    .arg(frames_glob.to_string_lossy().to_string())
    .arg("-i")
    .arg(args.audio_path)
    .arg("-shortest")
    .arg("-pix_fmt")
    .arg("yuv420p");

  if args.use_videotoolbox {
    cmd.arg("-c:v").arg("h264_videotoolbox").arg("-b:v").arg("8000k");
  } else {
    cmd.arg("-c:v")
      .arg("libx264")
      .arg("-preset")
      .arg("medium")
      .arg("-crf")
      .arg("20");
  }

  cmd.arg("-c:a").arg("aac").arg("-b:a").arg("320k").arg(args.output_path);

  let out = cmd.output().map_err(|e| format!("spawn ffmpeg error: {e}"))?;
  if !out.status.success() {
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    return Err(format!("ffmpeg failed: {}", stderr.trim()));
  }
  Ok(())
}

#[tauri::command]
pub fn export_cleanup(app: AppHandle, session_id: String) -> Result<(), String> {
  let root = export_root(&app)?;
  let session_dir = root.join(session_id);
  if session_dir.exists() {
    fs::remove_dir_all(session_dir).map_err(|e| format!("cleanup error: {e}"))?;
  }
  Ok(())
}

fn sanitize_filename(name: &str) -> String {
  let mut out = String::with_capacity(name.len());
  for ch in name.chars() {
    let ok = ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' || ch == ' ';
    out.push(if ok { ch } else { '_' });
  }
  let trimmed = out.trim();
  if trimmed.is_empty() {
    "audio".to_string()
  } else {
    trimmed.to_string()
  }
}

fn resolve_ffmpeg(app: &AppHandle) -> Option<String> {
  if let Ok(p) = env::var("AUDIOVIZ_FFMPEG_PATH") {
    if !p.trim().is_empty() {
      return Some(p);
    }
  }

  let mut dirs: Vec<PathBuf> = vec![];

  if let Ok(exe) = env::current_exe() {
    if let Some(parent) = exe.parent() {
      dirs.push(parent.to_path_buf());
    }
  }

  if let Ok(resource_dir) = app.path().resource_dir() {
    dirs.push(resource_dir);
  }

  let candidates = ["ffmpeg", "ffmpeg-aarch64-apple-darwin", "ffmpeg-x86_64-apple-darwin"];
  for d in dirs {
    for c in candidates {
      let p = d.join(c);
      if p.exists() {
        return Some(p.to_string_lossy().to_string());
      }
    }
  }
  None
}

