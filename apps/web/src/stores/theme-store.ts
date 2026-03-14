'use client';

import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  fontSize: number; // 12-24
  focusMode: boolean;
  setMode: (mode: ThemeMode) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleFocusMode: () => void;
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

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    applyTheme(resolved);
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

  initialize: () => {
    const saved = localStorage.getItem('markview-theme') as ThemeMode | null;
    const mode = saved || 'system';
    const resolved = resolveTheme(mode);
    applyTheme(resolved);

    const savedSize = localStorage.getItem('markview-font-size');
    const fontSize = savedSize ? parseInt(savedSize, 10) : 16;
    applyFontSize(fontSize);

    set({ mode, resolved, fontSize });

    // Listen for system theme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      const { mode: currentMode } = get();
      if (currentMode === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  },
}));
