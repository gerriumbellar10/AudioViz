import type { AppSettings } from "./types";

const LS_KEY = "audioviz.presets.v1";
type Stored = Record<string, AppSettings>;

async function invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

function isDesktop() {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ != null;
}

export async function listPresets(): Promise<string[]> {
  if (isDesktop()) return await invoke<string[]>("list_presets", {});
  return Object.keys(readLocal()).sort();
}

export async function loadPreset(name: string): Promise<AppSettings> {
  if (isDesktop()) return (await invoke<{ name: string; settings: AppSettings }>("load_preset", { name })).settings;
  const s = readLocal()[name];
  if (!s) throw new Error(`Preset not found: ${name}`);
  return s;
}

export async function savePreset(name: string, settings: AppSettings): Promise<void> {
  if (!name.trim()) throw new Error("Preset name is empty");
  if (isDesktop()) return await invoke<void>("save_preset", { name, settings });
  const stored = readLocal();
  stored[name] = settings;
  localStorage.setItem(LS_KEY, JSON.stringify(stored));
}

export async function deletePreset(name: string): Promise<void> {
  if (isDesktop()) return await invoke<void>("delete_preset", { name });
  const stored = readLocal();
  delete stored[name];
  localStorage.setItem(LS_KEY, JSON.stringify(stored));
}

function readLocal(): Stored {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

