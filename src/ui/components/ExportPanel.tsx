import { useMemo, useRef, useState } from "react";
import type { AppSettings } from "../state/types";
import { exportMp4 } from "../export/exportClient";

export function ExportPanel({ audioFile, settings }: { audioFile: File | null; settings: AppSettings }) {
  const [status, setStatus] = useState<string>("Idle");
  const [progressText, setProgressText] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const cancelRef = useRef(false);

  const disabledReason = useMemo(() => {
    if (!audioFile) return "Load an audio file first.";
    return null;
  }, [audioFile]);

  return (
    <div className="panel panelSub">
      <div className="panelHeader">
        <h2>Export</h2>
        <div className="mono">{status}</div>
      </div>
      <div className="panelBody">
        <div className="stack">
          <div className="muted">Export runs locally: offline FFT → render PNG frames → FFmpeg encodes MP4.</div>
          <div className="row">
            <button
              className="btn btnPrimary"
              disabled={!!disabledReason || isExporting}
              onClick={async () => {
                try {
                  if (!audioFile) return;
                  cancelRef.current = false;
                  setIsExporting(true);
                  setStatus("Running");
                  setProgressText("");

                  await exportMp4(
                    { audioFile, settings, fps: 30, width: 1920, height: 1080, useVideoToolbox: true },
                    (p) => {
                      setStatus(p.phase);
                      if (p.totalFrames != null && p.renderedFrames != null) {
                        setProgressText(`${p.message} ${p.renderedFrames}/${p.totalFrames}`);
                      } else {
                        setProgressText(p.message);
                      }
                    },
                    () => cancelRef.current
                  );
                } catch (e) {
                  setStatus("error");
                  setProgressText(e instanceof Error ? e.message : String(e));
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              Export MP4 (1080p/30)
            </button>
            <button
              className="btn btnDanger"
              disabled={!isExporting}
              onClick={() => {
                cancelRef.current = true;
                setProgressText("Cancelling…");
              }}
            >
              Cancel
            </button>
          </div>

          {disabledReason ? <div className="muted">Disabled: {disabledReason}</div> : null}
          {progressText ? <div className="mono">{progressText}</div> : null}
        </div>
      </div>
    </div>
  );
}

