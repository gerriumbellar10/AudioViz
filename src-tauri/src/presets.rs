use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoAsset {
  pub name: String,
  pub data_url: String,
  pub width: Option<u32>,
  pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub background_color: String,
  pub ring_color: String,
  pub ring_glow: bool,
  pub sensitivity: f64,
  pub smoothing: f64,
  pub logo_scale: f64,
  pub logo_opacity: f64,
  pub logo: Option<LogoAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
  pub name: String,
  pub settings: AppSettings,
}

fn presets_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let base = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("app_config_dir error: {e}"))?;
  Ok(base.join("presets"))
}

fn sanitize_name(name: &str) -> String {
  let mut out = String::with_capacity(name.len());
  for ch in name.chars() {
    let ok = ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == ' ';
    out.push(if ok { ch } else { '_' });
  }
  out.trim().to_string()
}

fn preset_path(dir: &Path, name: &str) -> PathBuf {
  dir.join(format!("{}.json", sanitize_name(name)))
}

#[tauri::command]
pub fn list_presets(app: AppHandle) -> Result<Vec<String>, String> {
  let dir = presets_dir(&app)?;
  if !dir.exists() {
    return Ok(vec![]);
  }
  let mut names = vec![];
  for entry in fs::read_dir(&dir).map_err(|e| format!("read_dir error: {e}"))? {
    let entry = entry.map_err(|e| format!("dir entry error: {e}"))?;
    let path = entry.path();
    if path.extension().and_then(|s| s.to_str()) != Some("json") {
      continue;
    }
    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
      names.push(stem.to_string());
    }
  }
  names.sort();
  Ok(names)
}

#[tauri::command]
pub fn load_preset(app: AppHandle, name: String) -> Result<Preset, String> {
  let dir = presets_dir(&app)?;
  let path = preset_path(&dir, &name);
  let data = fs::read_to_string(&path).map_err(|e| format!("read preset error: {e}"))?;
  let settings: AppSettings = serde_json::from_str(&data).map_err(|e| format!("parse preset error: {e}"))?;
  Ok(Preset { name, settings })
}

#[tauri::command]
pub fn save_preset(app: AppHandle, name: String, settings: AppSettings) -> Result<(), String> {
  let dir = presets_dir(&app)?;
  fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all error: {e}"))?;
  let path = preset_path(&dir, &name);
  let data = serde_json::to_string_pretty(&settings).map_err(|e| format!("serialize error: {e}"))?;
  fs::write(&path, data).map_err(|e| format!("write preset error: {e}"))?;
  Ok(())
}

#[tauri::command]
pub fn delete_preset(app: AppHandle, name: String) -> Result<(), String> {
  let dir = presets_dir(&app)?;
  let path = preset_path(&dir, &name);
  if path.exists() {
    fs::remove_file(&path).map_err(|e| format!("remove preset error: {e}"))?;
  }
  Ok(())
}

