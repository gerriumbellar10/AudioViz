import fs from "node:fs";
import path from "node:path";
import * as ff from "ffmpeg-ffprobe-static";

const root = process.cwd();
const binsDir = path.join(root, "src-tauri", "binaries");

const triple = targetTriple();
const outFfmpeg = path.join(binsDir, `ffmpeg-${triple}`);
const outFfprobe = path.join(binsDir, `ffprobe-${triple}`);

fs.mkdirSync(binsDir, { recursive: true });

const { ffmpegPath, ffprobePath } = pickBinaryPaths(triple);
copyFile(ffmpegPath, outFfmpeg);
copyFile(ffprobePath, outFfprobe);

chmodX(outFfmpeg);
chmodX(outFfprobe);

console.log(`[sidecar] Prepared ffmpeg/ffprobe for ${triple}`);
console.log(`[sidecar] ${outFfmpeg}`);
console.log(`[sidecar] ${outFfprobe}`);

function copyFile(src, dst) {
  if (!src) throw new Error("ffmpeg-ffprobe-static did not provide a path");
  fs.copyFileSync(src, dst);
}

function chmodX(p) {
  try {
    fs.chmodSync(p, 0o755);
  } catch {}
}

function targetTriple() {
  if (process.platform !== "darwin") throw new Error(`Sidecars are configured for macOS only (got ${process.platform}).`);
  const override = process.env.TAURI_BUILD_TARGET || process.env.TARGET_TRIPLE;
  if (override) return override;
  if (process.arch === "arm64") return "aarch64-apple-darwin";
  if (process.arch === "x64") return "x86_64-apple-darwin";
  throw new Error(`Unsupported macOS arch: ${process.arch}`);
}

function pickBinaryPaths(triple) {
  if (triple === "aarch64-apple-darwin" && ff.ffmpegPathArm64 && ff.ffprobePathArm64) {
    return { ffmpegPath: ff.ffmpegPathArm64, ffprobePath: ff.ffprobePathArm64 };
  }
  if (triple === "x86_64-apple-darwin" && ff.ffmpegPathX64 && ff.ffprobePathX64) {
    return { ffmpegPath: ff.ffmpegPathX64, ffprobePath: ff.ffprobePathX64 };
  }
  return { ffmpegPath: ff.ffmpegPath, ffprobePath: ff.ffprobePath };
}

