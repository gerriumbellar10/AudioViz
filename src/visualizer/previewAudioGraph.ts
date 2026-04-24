export async function createPreviewAudioGraph(audioEl: HTMLAudioElement) {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("WebAudio AudioContext not available");

  const audioCtx: AudioContext = new AudioContextCtor();
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {}
  }

  const sourceNode = audioCtx.createMediaElementSource(audioEl);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.0;

  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  const buf = new Uint8Array(analyser.frequencyBinCount);
  function getFrequencyData() {
    analyser.getByteFrequencyData(buf);
    return buf;
  }

  return { audioCtx, sourceNode, analyser, getFrequencyData };
}

