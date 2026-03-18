'use client';

import { create } from 'zustand';
import { applyThemePreset } from '@/lib/themes/presets';

type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  fontSize: number; // 12-24
  focusMode: boolean;
  colorScheme: string; // preset id
  setMode: (mode: ThemeMode) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleFocusMode: () => void;
  setColorScheme: (schemeId: string) => void;
  initialize: () => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('dark', 'light');
  document.documentElement.classList.add(resolved);
  document.documentElement.setAttribute('data-theme', resolved);
}

function applyFontSize(size: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--content-font-size', `${size}px`);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: 'dark',
  fontSize: 16,
  focusMode: false,
  colorScheme: 'github',

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    applyTheme(resolved);
    applyThemePreset(get().colorScheme, resolved);
    localStorage.setItem('markview-theme', mode);
    set({ mode, resolved });
  },

  setFontSize: (size) => {
    const clamped = Math.max(12, Math.min(24, size));
    applyFontSize(clamped);
    localStorage.setItem('markview-font-size', String(clamped));
    set({ fontSize: clamped });
  },

  increaseFontSize: () => {
    const { fontSize, setFontSize } = get();
    setFontSize(fontSize + 1);
  },

  decreaseFontSize: () => {
    const { fontSize, setFontSize } = get();
    setFontSize(fontSize - 1);
  },

  toggleFocusMode: () => {
    set((s) => ({ focusMode: !s.focusMode }));
  },

  setColorScheme: (schemeId) => {
    const { resolved } = get();
    applyThemePreset(schemeId, resolved);
    localStorage.setItem('markview-color-scheme', schemeId);
    set({ colorScheme: schemeId });
  },

  initialize: () => {
    const saved = localStorage.getItem('markview-theme') as ThemeMode | null;
    const mode = saved || 'system';
    const resolved = resolveTheme(mode);
    applyTheme(resolved);

    const savedScheme = localStorage.getItem('markview-color-scheme') || 'github';
    applyThemePreset(savedScheme, resolved);

    const savedSize = localStorage.getItem('markview-font-size');
    const fontSize = savedSize ? parseInt(savedSize, 10) : 16;
    applyFontSize(fontSize);

    set({ mode, resolved, fontSize, colorScheme: savedScheme });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      const { mode: currentMode, colorScheme: scheme } = get();
      if (currentMode === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        applyThemePreset(scheme, newResolved);
        set({ resolved: newResolved });
      }
    });
  },
}));
