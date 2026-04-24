export type LogoAsset = {
  name: string;
  dataUrl: string;
  width?: number;
  height?: number;
};

export type AppSettings = {
  backgroundColor: string;
  ringColor: string;
  ringGlow: boolean;
  sensitivity: number;
  smoothing: number;
  logoScale: number;
  logoOpacity: number;
  logo: LogoAsset | null;
};

