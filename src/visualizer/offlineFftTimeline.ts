import FFT from "fft.js";

export type FftTimeline = {
  fps: number;
  frameCount: number;
  durationSec: number;
  bins: number;
  getFrameBins: (frameIndex: number) => Uint8Array;
};

export function buildFftTimeline({
  audioBuffer,
  fps,
  fftSize = 2048
}: {
  audioBuffer: AudioBuffer;
  fps: number;
  fftSize?: number;
}): FftTimeline {
  const sampleRate = audioBuffer.sampleRate;
  const durationSec = audioBuffer.duration;
  const frameCount = Math.max(1, Math.ceil(durationSec * fps));

  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

  const hop = Math.max(1, Math.floor(sampleRate / fps));
  const half = fftSize / 2;
  const fft = new FFT(fftSize);

  const input = new Array<number>(fftSize);
  const spectrum = fft.createComplexArray() as number[];
  const mags = new Float32Array(half);

  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  function getFrameBins(frameIndex: number) {
    const center = Math.floor(frameIndex * hop);
    const start = center - Math.floor(fftSize / 2);

    for (let i = 0; i < fftSize; i++) {
      const idx = start + i;
      const v0 = idx >= 0 && idx < ch0.length ? ch0[idx] : 0;
      const v1 = ch1 && idx >= 0 && idx < ch1.length ? ch1[idx] : 0;
      const v = ch1 ? 0.5 * (v0 + v1) : v0;
      input[i] = v * window[i];
    }

    fft.realTransform(spectrum, input);
    fft.completeSpectrum(spectrum);

    let max = 1e-12;
    for (let k = 0; k < half; k++) {
      const re = spectrum[2 * k];
      const im = spectrum[2 * k + 1];
      const m = Math.sqrt(re * re + im * im);
      mags[k] = m;
      if (m > max) max = m;
    }

    const out = new Uint8Array(half);
    const inv = 1 / max;
    for (let k = 0; k < half; k++) {
      const n = mags[k] * inv;
      const c = Math.pow(n, 0.6);
      out[k] = Math.max(0, Math.min(255, Math.round(c * 255)));
    }
    return out;
  }

  return { fps, frameCount, durationSec, bins: half, getFrameBins };
}

