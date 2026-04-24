import type { AppSettings } from "../state/types";

export type ExportProgress = {
  phase: "idle" | "preparing" | "rendering" | "encoding" | "done" | "error" | "cancelled";
  message: string;
  renderedFrames?: number;
  totalFrames?: number;
};

export type ExportParams = {
  audioFile: File;
  settings: AppSettings;
  fps: number;
  width: number;
  height: number;
  useVideoToolbox: boolean;
};

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

async function saveDialog(defaultPath: string) {
  const mod = await import("@tauri-apps/plugin-dialog");
  return mod.save({ defaultPath, filters: [{ name: "MP4", extensions: ["mp4"] }] });
}

export async function exportMp4(
  params: ExportParams,
  onProgress: (p: ExportProgress) => void,
  isCancelled: () => boolean
) {
  onProgress({ phase: "preparing", message: "Reading audio…" });
  const audioBytes = new Uint8Array(await params.audioFile.arrayBuffer());
  const audioBase64 = uint8ToBase64(audioBytes);

  let begin: { sessionId: string; audioPath: string };
  try {
    begin = await invoke<{ sessionId: string; audioPath: string }>("export_begin", {
      args: { audioFilename: params.audioFile.name, audioBase64 }
    });
  } catch {
    throw new Error("Export is only available in the desktop app build (.app/.dmg), not in the web preview.");
  }

  const outputPath = await saveDialog("audioviz.mp4");
  if (!outputPath) {
    await invoke<void>("export_cleanup", { sessionId: begin.sessionId });
    onProgress({ phase: "cancelled", message: "Save dialog cancelled" });
    return;
  }

  onProgress({ phase: "preparing", message: "Decoding audio…" });
  const audioBuffer = await decodeAudio(audioBytes);

  onProgress({ phase: "rendering", message: "Rendering frames…" });
  const canvas = document.createElement("canvas");
  canvas.width = params.width;
  canvas.height = params.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const { buildFftTimeline } = await import("../../visualizer/offlineFftTimeline");
  const { renderFrame } = await import("../../visualizer/renderFrame");
  const { loadLogoImage } = await import("../../visualizer/loadLogo");

  const timeline = buildFftTimeline({ audioBuffer, fps: params.fps, fftSize: 2048 });
  const logo = params.settings.logo?.dataUrl ? await loadLogoImage(params.settings.logo.dataUrl) : null;

  for (let i = 0; i < timeline.frameCount; i++) {
    if (isCancelled()) {
      await invoke<void>("export_cleanup", { sessionId: begin.sessionId });
      onProgress({ phase: "cancelled", message: "Cancelled" });
      return;
    }

    const freq = timeline.getFrameBins(i);
    renderFrame({
      ctx,
      width: canvas.width,
      height: canvas.height,
      tSec: i / params.fps,
      dtSec: 1 / params.fps,
      settings: params.settings,
      frequencyData: freq,
      logo
    });

    const pngBytes = await canvasToPngBytes(canvas);
    await invoke<void>("export_write_frame", {
      args: { sessionId: begin.sessionId, frameIndex: i, pngBase64: uint8ToBase64(pngBytes) }
    });

    if (i % 5 === 0) {
      onProgress({ phase: "rendering", message: "Rendering frames…", renderedFrames: i + 1, totalFrames: timeline.frameCount });
      await nextTick();
    }
  }

  onProgress({ phase: "encoding", message: "Encoding MP4 via ffmpeg…" });
  await invoke<void>("export_encode", {
    args: {
      sessionId: begin.sessionId,
      audioPath: begin.audioPath,
      outputPath,
      fps: params.fps,
      useVideotoolbox: params.useVideoToolbox
    }
  });

  await invoke<void>("export_cleanup", { sessionId: begin.sessionId });
  onProgress({ phase: "done", message: `Exported: ${outputPath}` });
}

async function decodeAudio(audioBytes: Uint8Array): Promise<AudioBuffer> {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("WebAudio AudioContext not available");
  const ctx: AudioContext = new AudioContextCtor();
  try {
    return await ctx.decodeAudioData(audioBytes.slice().buffer);
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}

function uint8ToBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function nextTick() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

