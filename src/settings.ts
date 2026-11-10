import { GM_getValue, GM_setValue } from '$';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  enabled: boolean;
  seed: string;
  mode: ThemeMode;
  /** M3 contrast level: 0 standard, 0.5 medium, 1 high */
  contrast: number;
  /** Recolor user-authored content (inline colors in pages/announcements) in dark mode */
  darkUserContent: boolean;
}

export const DEFAULTS: Settings = {
  enabled: true,
  seed: '#C8161E',
  mode: 'system',
  contrast: 0,
  darkUserContent: true,
};

export const PRESETS: { name: string; color: string }[] = [
  { name: '交大红', color: '#C8161E' },
  { name: '海洋蓝', color: '#0B57D0' },
  { name: '森林绿', color: '#146C2E' },
  { name: '紫罗兰', color: '#6750A4' },
  { name: '琥珀橙', color: '#B35A00' },
  { name: '青碧', color: '#006A6A' },
  { name: '樱粉', color: '#B4235B' },
  { name: '石墨', color: '#5B5F63' },
];

const KEY = 'settings';

export function loadSettings(): Settings {
  const saved = GM_getValue<Partial<Settings>>(KEY, {});
  return { ...DEFAULTS, ...saved };
}

export function saveSettings(s: Settings): void {
  GM_setValue(KEY, s);
}
