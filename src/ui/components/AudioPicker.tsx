import { useCallback, useRef, useState } from "react";

const ACCEPT = ["audio/wav", "audio/x-wav", "audio/mpeg"].join(",");

export function AudioPicker({ onPick }: { onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openFile = useCallback(() => inputRef.current?.click(), []);

  return (
    <div
      className="dropzone"
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("audio/")) return;
        onPick(file);
      }}
      style={{ borderColor: isDragging ? "rgba(110,231,255,0.55)" : undefined }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>Drop WAV/MP3 here</div>
      <div className="muted">Or pick a file. Preview analysis runs locally.</div>
      <div className="row">
        <button className="btn btnPrimary" onClick={openFile}>
          Choose audio file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
          }}
        />
      </div>
    </div>
  );
}

