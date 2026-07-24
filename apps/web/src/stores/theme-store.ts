
import { create } from 'zustand';
import { applyThemePreset } from '@/lib/themes/presets';

// localStorage can throw (private browsing, storage-blocked embeds) — a
// theme preference failing to persist must never break the theme switch
// itself, and initialize() must never abort app boot.
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';
/**
 * Atmosphere — an optional ambient layer painted behind the page that
 * sets a mood without changing palette. Each atmosphere is a real
 * public-domain artwork plus optional CSS animations (petals, rain, etc).
 * Add more by appending to the union + ATMOSPHERES config in
 * `components/atmosphere/atmospheres.ts`.
 */
export type Atmosphere = 'none' | 'fuji' | 'wave' | 'snow' | 'fields';

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  fontSize: number; // 12-24
  focusMode: boolean;
  colorScheme: string; // preset id
  atmosphere: Atmosphere;
  setMode: (mode: ThemeMode) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleFocusMode: () => void;
  setColorScheme: (schemeId: string) => void;
  setAtmosphere: (atmosphere: Atmosphere) => void;
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

function applyAtmosphere(atmosphere: Atmosphere) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-atmosphere', atmosphere);
}

/**
 * Wrap an appearance mutation in `document.startViewTransition()` so the
 * browser snapshots the page, runs the mutation, then cross-fades from
 * the old snapshot to the new in one coordinated repaint. Without this
 * the browser repaints CSS-variable changes top-to-bottom, which the
 * user sees as a cascade (bg image first → particles → markdown last).
 *
 * Falls back to running the mutation synchronously on browsers that
 * don't expose the API (Firefox < 130 as of the cutoff).
 */
function withAppearanceTransition(mutate: () => void): void {
  if (typeof document === 'undefined') {
    mutate();
    return;
  }
  const d = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(mutate);
  } else {
    mutate();
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  resolved: 'dark',
  fontSize: 16,
  focusMode: false,
  colorScheme: 'github',
  atmosphere: 'none',

  setAtmosphere: (atmosphere) => {
    withAppearanceTransition(() => applyAtmosphere(atmosphere));
    try { localStorage.setItem('markview-atmosphere', atmosphere); } catch { /* ignore */ }
    set({ atmosphere });
    // Persist to the active workspace so each workspace remembers its
    // own atmosphere across switches.
    void (async () => {
      try {
        const { useWorkspaceStore } = await import('@/stores/workspace-store');
        const { db } = await import('@/lib/storage/db');
        const wsId = useWorkspaceStore.getState().activeWorkspaceId;
        if (wsId) {
          await db.workspaces.update(wsId, { atmosphere });
        }
      } catch {
        /* best-effort */
      }
    })();
  },

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    withAppearanceTransition(() => {
      applyTheme(resolved);
      applyThemePreset(get().colorScheme, resolved);
    });
    lsSet('markview-theme', mode);
    set({ mode, resolved });
  },

  setFontSize: (size) => {
    const clamped = Math.max(12, Math.min(24, size));
    applyFontSize(clamped);
    lsSet('markview-font-size', String(clamped));
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
    withAppearanceTransition(() => applyThemePreset(schemeId, resolved));
    lsSet('markview-color-scheme', schemeId);
    set({ colorScheme: schemeId });
  },

  initialize: () => {
    // Default to dark — Markview's brand is the cosmic editor surface.
    // Users who switch to light/system get that respected; first-visit
    // default is dark so the editor matches the landing's dark hero.
    const saved = lsGet('markview-theme') as ThemeMode | null;
    const mode = saved || 'dark';
    const resolved = resolveTheme(mode);
    applyTheme(resolved);

    const savedScheme = lsGet('markview-color-scheme') || 'github';
    applyThemePreset(savedScheme, resolved);

    const savedSize = lsGet('markview-font-size');
    const fontSize = savedSize ? parseInt(savedSize, 10) : 16;
    applyFontSize(fontSize);

    const savedAtmosphere = (lsGet('markview-atmosphere') as Atmosphere | null) || 'none';
    applyAtmosphere(savedAtmosphere);

    set({ mode, resolved, fontSize, colorScheme: savedScheme, atmosphere: savedAtmosphere });

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
