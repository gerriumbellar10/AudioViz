import { useMemo, useState } from "react";
import { AudioPicker } from "./components/AudioPicker";
import { PreviewCanvas } from "./components/PreviewCanvas";
import { SettingsPanel } from "./components/SettingsPanel";
import { ExportPanel } from "./components/ExportPanel";
import { useAppStore } from "./state/store";

export function App() {
  const audioFile = useAppStore((s) => s.audioFile);
  const setAudioFile = useAppStore((s) => s.setAudioFile);
  const settings = useAppStore((s) => s.settings);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioLabel = useMemo(() => {
    if (!audioFile) return "No audio loaded";
    return `${audioFile.name} (${Math.round(audioFile.size / 1024 / 1024)} MB)`;
  }, [audioFile]);

  return (
    <div className="appShell">
      <div className="panel">
        <div className="panelHeader">
          <h2>Controls</h2>
          <div className="mono">{audioLabel}</div>
        </div>
        <div className="panelBody">
          <div className="stack">
            <AudioPicker
              onPick={(file) => {
                setAudioFile(file);
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioUrl(URL.createObjectURL(file));
              }}
            />
            <SettingsPanel />
            <details>
              <summary className="label" style={{ cursor: "pointer", userSelect: "none" }}>
                Export
              </summary>
              <div style={{ marginTop: 8 }}>
                <ExportPanel audioFile={audioFile} settings={settings} />
              </div>
            </details>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panelHeader">
          <h2>Preview</h2>
          <div className="mono">1080p / 30fps export target</div>
        </div>
        <div className="previewWrap">
          <div className="previewCanvasWrap">
            <PreviewCanvas audioUrl={audioUrl} />
          </div>
          <div className="statusBar">
            <div className="mono">
              Ring: <span style={{ color: settings.ringColor }}>{settings.ringColor}</span> • Background:{" "}
              <span style={{ color: settings.backgroundColor }}>{settings.backgroundColor}</span>
            </div>
            <div className="mono">Logo: {settings.logo?.name ?? "none"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

