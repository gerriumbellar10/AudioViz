import { create } from "zustand";
import { AppSettings, LogoAsset } from "./types";

type AppState = {
  audioFile: File | null;
  setAudioFile: (file: File | null) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLogo: (logo: LogoAsset | null) => void;
};

const defaultSettings: AppSettings = {
  backgroundColor: "#0b0f17",
  ringColor: "#6ee7ff",
  ringGlow: true,
  sensitivity: 1.25,
  smoothing: 0.75,
  logoScale: 0.42,
  logoOpacity: 1.0,
  logo: null
};

export const useAppStore = create<AppState>((set) => ({
  audioFile: null,
  setAudioFile: (file) => set({ audioFile: file }),
  settings: defaultSettings,
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setLogo: (logo) => set((s) => ({ settings: { ...s.settings, logo } }))
}));

