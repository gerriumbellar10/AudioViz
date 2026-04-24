import type { AppSettings } from "../ui/state/types";

type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  tSec: number;
  dtSec: number;
  settings: AppSettings;
  frequencyData: Uint8Array;
  logo: HTMLImageElement | null;
};

const smoothByCtx = new WeakMap<CanvasRenderingContext2D, number>();

export function renderFrame({ ctx, width, height, settings, frequencyData, logo, dtSec }: RenderArgs) {
  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const target = clamp01(computeEnergy(frequencyData) * settings.sensitivity);
  const prev = smoothByCtx.get(ctx) ?? 0;
  const blend = 1 - Math.pow(clamp01(settings.smoothing), Math.max(0.001, dtSec) * 60);
  const amp = prev + (target - prev) * blend;
  smoothByCtx.set(ctx, amp);

  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) * 0.22;
  const r = baseR + baseR * (0.10 + 0.42 * amp);

  ctx.save();
  ctx.translate(cx, cy);
  if (settings.ringGlow) {
    ctx.shadowColor = settings.ringColor;
    ctx.shadowBlur = Math.max(10, r * 0.16);
  }
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = settings.ringColor;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (logo) {
    const maxLogoSize = Math.min(width, height) * settings.logoScale;
    const scale = Math.min(maxLogoSize / logo.width, maxLogoSize / logo.height);
    const dw = logo.width * scale;
    const dh = logo.height * scale;
    ctx.save();
    ctx.globalAlpha = clamp01(settings.logoOpacity);
    ctx.drawImage(logo, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }
}

function computeEnergy(freq: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < freq.length; i++) {
    const v = freq[i] / 255;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, freq.length));
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

