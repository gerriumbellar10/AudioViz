import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { createPreviewAudioGraph } from "../../visualizer/previewAudioGraph";
import { renderFrame } from "../../visualizer/renderFrame";
import { loadLogoImage } from "../../visualizer/loadLogo";

export function PreviewCanvas({ audioUrl }: { audioUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const graphRef = useRef<Awaited<ReturnType<typeof createPreviewAudioGraph>> | null>(null);

  const settings = useAppStore((s) => s.settings);

  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const logoDataUrl = settings.logo?.dataUrl ?? null;
  const logoImage = useMemo(() => (logoDataUrl ? loadLogoImage(logoDataUrl) : Promise.resolve(null)), [logoDataUrl]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    let cleanup: null | (() => void) = null;

    async function setup(el: HTMLAudioElement) {
      setError(null);
      graphRef.current = null;

      if (!audioUrl) {
        el.removeAttribute("src");
        el.load();
        return;
      }

      el.src = audioUrl;
      el.load();

      try {
        cleanup?.();
        const graph = await createPreviewAudioGraph(el);
        graphRef.current = graph;
        cleanup = () => {
          try {
            graph.sourceNode.disconnect();
          } catch {}
          try {
            graph.analyser.disconnect();
          } catch {}
          try {
            void graph.audioCtx.close();
          } catch {}
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    void setup(audioEl);

    return () => {
      graphRef.current = null;
      cleanup?.();
    };
  }, [audioUrl]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(audioEl.duration) ? audioEl.duration : 0);
      setCurrentTime(audioEl.currentTime || 0);
    };
    const onTime = () => setCurrentTime(audioEl.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audioEl.addEventListener("loadedmetadata", onLoaded);
    audioEl.addEventListener("durationchange", onLoaded);
    audioEl.addEventListener("timeupdate", onTime);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("ended", onEnded);

    onLoaded();

    return () => {
      audioEl.removeEventListener("loadedmetadata", onLoaded);
      audioEl.removeEventListener("durationchange", onLoaded);
      audioEl.removeEventListener("timeupdate", onTime);
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const audioEl = audioRef.current;
    if (!canvas || !audioEl) return;

    const canvasEl: HTMLCanvasElement = canvas;
    const audioElement: HTMLAudioElement = audioEl;

    let disposed = false;

    function resizeCanvas(el: HTMLCanvasElement) {
      const dpr = window.devicePixelRatio || 1;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
    }

    const ctxMaybe = canvasEl.getContext("2d");
    if (!ctxMaybe) return;
    const ctx: CanvasRenderingContext2D = ctxMaybe;

    let lastT = performance.now();

    async function tick(t: number) {
      if (disposed) return;
      rafRef.current = requestAnimationFrame(tick);
      resizeCanvas(canvasEl);

      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      const g = graphRef.current;
      const freq = g?.getFrequencyData() ?? new Uint8Array(1024);
      const logo = await logoImage;

      renderFrame({
        ctx,
        width: canvasEl.width,
        height: canvasEl.height,
        tSec: audioElement.currentTime,
        dtSec: dt,
        settings,
        frequencyData: freq,
        logo
      });
    }

    rafRef.current = requestAnimationFrame(tick);
    const onResize = () => resizeCanvas(canvasEl);
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [settings, logoImage]);

  useEffect(() => {
    setIsPlaying(false);
    setError(null);
    setDuration(0);
    setCurrentTime(0);
  }, [audioUrl]);

  return (
    <>
      <canvas ref={canvasRef} className="previewCanvas" />
      <audio ref={audioRef} style={{ display: "none" }} />
      <TransportBar
        disabled={!audioUrl}
        isPlaying={isPlaying}
        duration={duration}
        currentTime={currentTime}
        error={error}
        onTogglePlay={async () => {
          const audioEl = audioRef.current;
          if (!audioEl) return;
          try {
            if (audioEl.paused) {
              await audioEl.play();
              setIsPlaying(true);
            } else {
              audioEl.pause();
              setIsPlaying(false);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        onRestart={() => {
          const audioEl = audioRef.current;
          if (!audioEl) return;
          audioEl.currentTime = 0;
        }}
        onSeek={(t) => {
          const audioEl = audioRef.current;
          if (!audioEl) return;
          audioEl.currentTime = t;
          setCurrentTime(t);
        }}
      />
    </>
  );
}

function TransportBar({
  disabled,
  isPlaying,
  duration,
  currentTime,
  error,
  onTogglePlay,
  onRestart,
  onSeek
}: {
  disabled: boolean;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  error: string | null;
  onTogglePlay: () => void | Promise<void>;
  onRestart: () => void;
  onSeek: (t: number) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: 14,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: 10,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(10,12,18,0.70)",
        backdropFilter: "blur(10px)"
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btnPrimary" disabled={disabled} onClick={onTogglePlay} style={{ padding: "10px 12px" }}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="btn" disabled={disabled} onClick={onRestart} style={{ padding: "10px 12px" }}>
          <RestartIcon />
        </button>
      </div>

      <input
        className="control"
        type="range"
        min={0}
        max={Math.max(0.001, duration)}
        step={0.01}
        value={Math.min(duration || 0, currentTime)}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={disabled}
        style={{ padding: 0, height: 40 }}
      />

      <div className="mono" style={{ textAlign: "right", minWidth: 120 }}>
        {formatTime(currentTime)} / {formatTime(duration)}
        {error ? (
          <div className="mono" style={{ color: "var(--danger)", marginTop: 4 }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatTime(t: number) {
  if (!Number.isFinite(t) || t <= 0) return "0:00";
  const s = Math.floor(t);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 5v14l12-7L8 5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5a7 7 0 1 1-6.32 4H3l3.5-3.5L10 9H7.82A5 5 0 1 0 12 7V5Z"
        fill="currentColor"
      />
    </svg>
  );
}

