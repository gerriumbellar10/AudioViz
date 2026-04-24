import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { deletePreset, listPresets, loadPreset, savePreset } from "../state/presets";

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setLogo = useAppStore((s) => s.setLogo);

  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const ringGlowLabel = useMemo(() => (settings.ringGlow ? "On" : "Off"), [settings.ringGlow]);

  const [bgHex, setBgHex] = useState(settings.backgroundColor);
  const [ringHex, setRingHex] = useState(settings.ringColor);

  const [presetName, setPresetName] = useState("default");
  const [presetList, setPresetList] = useState<string[]>([]);
  const [presetStatus, setPresetStatus] = useState<string>("");

  async function refreshPresets() {
    try {
      setPresetList(await listPresets());
    } catch (e) {
      setPresetStatus(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void refreshPresets();
  }, []);

  useEffect(() => setBgHex(settings.backgroundColor), [settings.backgroundColor]);
  useEffect(() => setRingHex(settings.ringColor), [settings.ringColor]);

  return (
    <div className="panel panelSub">
      <div className="panelHeader">
        <h2>Visualizer</h2>
      </div>
      <div className="panelBody">
        <div className="stack">
          <details open>
            <summary className="label" style={{ cursor: "pointer", userSelect: "none" }}>
              Colors & Motion
            </summary>

            <div className="stack" style={{ marginTop: 8 }}>
              <div className="row">
                <div>
                  <div className="label">Background</div>
                  <div className="row">
                    <input
                      className="control"
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) => updateSettings({ backgroundColor: e.target.value })}
                      style={{ flex: "0 0 54px", padding: 0, height: 40 }}
                    />
                    <input
                      className="control"
                      type="text"
                      value={bgHex}
                      spellCheck={false}
                      onChange={(e) => setBgHex(e.target.value)}
                      onBlur={() => {
                        const normalized = normalizeHex(bgHex);
                        setBgHex(normalized ?? settings.backgroundColor);
                        if (normalized) updateSettings({ backgroundColor: normalized });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="label">Ring</div>
                  <div className="row">
                    <input
                      className="control"
                      type="color"
                      value={settings.ringColor}
                      onChange={(e) => updateSettings({ ringColor: e.target.value })}
                      style={{ flex: "0 0 54px", padding: 0, height: 40 }}
                    />
                    <input
                      className="control"
                      type="text"
                      value={ringHex}
                      spellCheck={false}
                      onChange={(e) => setRingHex(e.target.value)}
                      onBlur={() => {
                        const normalized = normalizeHex(ringHex);
                        setRingHex(normalized ?? settings.ringColor);
                        if (normalized) updateSettings({ ringColor: normalized });
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Sensitivity ({settings.sensitivity.toFixed(2)})</div>
                  <input
                    className="control"
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.01}
                    value={settings.sensitivity}
                    onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="label">Smoothing ({settings.smoothing.toFixed(2)})</div>
                  <input
                    className="control"
                    type="range"
                    min={0.0}
                    max={0.95}
                    step={0.01}
                    value={settings.smoothing}
                    onChange={(e) => updateSettings({ smoothing: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Glow</div>
                  <button className="btn" onClick={() => updateSettings({ ringGlow: !settings.ringGlow })}>
                    {settings.ringGlow ? "On" : "Off"}
                  </button>
                </div>
                <div className="muted" style={{ alignSelf: "end" }}>
                  {ringGlowLabel}
                </div>
              </div>
            </div>
          </details>

          <details>
            <summary className="label" style={{ cursor: "pointer", userSelect: "none" }}>
              Logo
            </summary>

            <div className="stack" style={{ marginTop: 8 }}>
              <div className="row">
                <div>
                  <div className="label">Scale ({settings.logoScale.toFixed(2)})</div>
                  <input
                    className="control"
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.01}
                    value={settings.logoScale}
                    onChange={(e) => updateSettings({ logoScale: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <div className="label">Opacity ({settings.logoOpacity.toFixed(2)})</div>
                  <input
                    className="control"
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    value={settings.logoOpacity}
                    onChange={(e) => updateSettings({ logoOpacity: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="row">
                <button className="btn btnPrimary" onClick={() => logoInputRef.current?.click()}>
                  Choose logo
                </button>
                <button className="btn btnDanger" onClick={() => setLogo(null)} disabled={!settings.logo}>
                  Clear
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await readAsDataUrl(file);
                    setLogo({ name: file.name, dataUrl });
                  }}
                />
              </div>
              <div className="muted">{settings.logo ? settings.logo.name : "No logo selected."}</div>
            </div>
          </details>

          <details>
            <summary className="label" style={{ cursor: "pointer", userSelect: "none" }}>
              Presets
            </summary>

            <div className="stack" style={{ marginTop: 8 }}>
              <div className="row">
                <input
                  className="control"
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="preset name"
                />
                <button
                  className="btn btnPrimary"
                  onClick={async () => {
                    try {
                      setPresetStatus("Saving…");
                      await savePreset(presetName, settings);
                      await refreshPresets();
                      setPresetStatus("Saved");
                      setTimeout(() => setPresetStatus(""), 1200);
                    } catch (e) {
                      setPresetStatus(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Save
                </button>
              </div>
              <div className="row">
                <select
                  className="control"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  style={{ appearance: "none" }}
                >
                  <option value={presetName}>{presetName}</option>
                  {presetList
                    .filter((n) => n !== presetName)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      setPresetStatus("Loading…");
                      const loaded = await loadPreset(presetName);
                      updateSettings(loaded);
                      await refreshPresets();
                      setPresetStatus("Loaded");
                      setTimeout(() => setPresetStatus(""), 1200);
                    } catch (e) {
                      setPresetStatus(e instanceof Error ? e.message : String(e));
                    }
                  }}
                >
                  Load
                </button>
                <button
                  className="btn btnDanger"
                  onClick={async () => {
                    try {
                      setPresetStatus("Deleting…");
                      await deletePreset(presetName);
                      await refreshPresets();
                      setPresetStatus("Deleted");
                      setTimeout(() => setPresetStatus(""), 1200);
                    } catch (e) {
                      setPresetStatus(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  disabled={!presetName.trim()}
                >
                  Delete
                </button>
              </div>
              <div className="muted">{presetStatus || "Saved locally (Tauri app config dir when in desktop mode)."}</div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function normalizeHex(input: string): string | null {
  const raw = input.trim().toUpperCase();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9A-F]{6}$/.test(withHash)) return withHash;
  if (/^#[0-9A-F]{3}$/.test(withHash)) {
    const r = withHash[1];
    const g = withHash[2];
    const b = withHash[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

