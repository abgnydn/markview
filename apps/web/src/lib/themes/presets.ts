'use client';

// ---------------------------------------------------------------------------
// Theme Presets — Each preset defines CSS variable overrides for dark & light
// ---------------------------------------------------------------------------

export interface ThemePreset {
  id: string;
  name: string;
  emoji: string;
  dark: Record<string, string>;
  light: Record<string, string>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'github',
    name: 'GitHub',
    emoji: '🐙',
    dark: {}, // default — no overrides
    light: {},
  },
  {
    id: 'dracula',
    name: 'Dracula',
    emoji: '🧛',
    dark: {
      '--bg-primary': '#282a36',
      '--bg-secondary': '#21222c',
      '--bg-tertiary': '#2d2f3d',
      '--bg-elevated': '#343746',
      '--bg-hover': 'rgba(255, 255, 255, 0.06)',
      '--bg-active': 'rgba(189, 147, 249, 0.12)',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#9ea0b0',
      '--text-muted': '#6272a4',
      '--text-link': '#8be9fd',
      '--border-default': '#44475a',
      '--border-muted': '#343746',
      '--border-hover': '#6272a4',
      '--accent-blue': '#8be9fd',
      '--accent-green': '#50fa7b',
      '--accent-purple': '#bd93f9',
      '--accent-orange': '#ffb86c',
      '--accent-red': '#ff5555',
      '--shadow-glow': '0 0 20px rgba(139, 233, 253, 0.15)',
    },
    light: {
      '--bg-primary': '#f8f8f2',
      '--bg-secondary': '#eee8d5',
      '--bg-tertiary': '#e8e2d0',
      '--bg-elevated': '#ffffff',
      '--text-primary': '#282a36',
      '--text-secondary': '#6272a4',
      '--text-muted': '#888daa',
      '--text-link': '#0d6ea1',
      '--border-default': '#d6d0c4',
      '--border-muted': '#e8e2d0',
      '--border-hover': '#b8b2a6',
      '--accent-blue': '#0d6ea1',
      '--accent-green': '#1b8a2e',
      '--accent-purple': '#7c3aed',
      '--accent-orange': '#b35900',
      '--accent-red': '#d32f2f',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    emoji: '🌙',
    dark: {
      '--bg-primary': '#272822',
      '--bg-secondary': '#1e1f1a',
      '--bg-tertiary': '#2d2e27',
      '--bg-elevated': '#3e3d32',
      '--bg-hover': 'rgba(255, 255, 255, 0.05)',
      '--bg-active': 'rgba(166, 226, 46, 0.12)',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#9a9b94',
      '--text-muted': '#75715e',
      '--text-link': '#66d9ef',
      '--border-default': '#464741',
      '--border-muted': '#3e3d32',
      '--border-hover': '#75715e',
      '--accent-blue': '#66d9ef',
      '--accent-green': '#a6e22e',
      '--accent-purple': '#ae81ff',
      '--accent-orange': '#fd971f',
      '--accent-red': '#f92672',
      '--shadow-glow': '0 0 20px rgba(102, 217, 239, 0.15)',
    },
    light: {
      '--bg-primary': '#fafaf8',
      '--bg-secondary': '#f0f0ea',
      '--bg-tertiary': '#e8e8e2',
      '--bg-elevated': '#ffffff',
      '--text-primary': '#272822',
      '--text-secondary': '#75715e',
      '--text-muted': '#9a9b94',
      '--text-link': '#0b7b94',
      '--border-default': '#d4d4ce',
      '--border-muted': '#e8e8e2',
      '--border-hover': '#aeaea8',
      '--accent-blue': '#0b7b94',
      '--accent-green': '#5f8a1e',
      '--accent-purple': '#7b37cc',
      '--accent-orange': '#c47600',
      '--accent-red': '#c41854',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    emoji: '❄️',
    dark: {
      '--bg-primary': '#2e3440',
      '--bg-secondary': '#272c36',
      '--bg-tertiary': '#343a48',
      '--bg-elevated': '#3b4252',
      '--bg-hover': 'rgba(255, 255, 255, 0.04)',
      '--bg-active': 'rgba(136, 192, 208, 0.12)',
      '--text-primary': '#eceff4',
      '--text-secondary': '#9aa5b4',
      '--text-muted': '#6a7a8d',
      '--text-link': '#88c0d0',
      '--border-default': '#434c5e',
      '--border-muted': '#3b4252',
      '--border-hover': '#4c566a',
      '--accent-blue': '#88c0d0',
      '--accent-green': '#a3be8c',
      '--accent-purple': '#b48ead',
      '--accent-orange': '#ebcb8b',
      '--accent-red': '#bf616a',
      '--shadow-glow': '0 0 20px rgba(136, 192, 208, 0.12)',
    },
    light: {
      '--bg-primary': '#eceff4',
      '--bg-secondary': '#e5e9f0',
      '--bg-tertiary': '#d8dee9',
      '--bg-elevated': '#f0f4f8',
      '--text-primary': '#2e3440',
      '--text-secondary': '#4c566a',
      '--text-muted': '#7b88a1',
      '--text-link': '#5e81ac',
      '--border-default': '#c8cdd5',
      '--border-muted': '#d8dee9',
      '--border-hover': '#a3aab5',
      '--accent-blue': '#5e81ac',
      '--accent-green': '#6e8a5c',
      '--accent-purple': '#8e6e8a',
      '--accent-orange': '#c4940a',
      '--accent-red': '#a3434a',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    emoji: '☀️',
    dark: {
      '--bg-primary': '#002b36',
      '--bg-secondary': '#001f27',
      '--bg-tertiary': '#073642',
      '--bg-elevated': '#0a4050',
      '--bg-hover': 'rgba(255, 255, 255, 0.04)',
      '--bg-active': 'rgba(38, 139, 210, 0.15)',
      '--text-primary': '#fdf6e3',
      '--text-secondary': '#93a1a1',
      '--text-muted': '#657b83',
      '--text-link': '#268bd2',
      '--border-default': '#0a4050',
      '--border-muted': '#073642',
      '--border-hover': '#2aa198',
      '--accent-blue': '#268bd2',
      '--accent-green': '#859900',
      '--accent-purple': '#6c71c4',
      '--accent-orange': '#cb4b16',
      '--accent-red': '#dc322f',
      '--shadow-glow': '0 0 20px rgba(38, 139, 210, 0.15)',
    },
    light: {
      '--bg-primary': '#fdf6e3',
      '--bg-secondary': '#eee8d5',
      '--bg-tertiary': '#e7dfcc',
      '--bg-elevated': '#ffffff',
      '--text-primary': '#073642',
      '--text-secondary': '#586e75',
      '--text-muted': '#93a1a1',
      '--text-link': '#268bd2',
      '--border-default': '#d6cdb7',
      '--border-muted': '#e7dfcc',
      '--border-hover': '#b8b0a0',
      '--accent-blue': '#268bd2',
      '--accent-green': '#859900',
      '--accent-purple': '#6c71c4',
      '--accent-orange': '#cb4b16',
      '--accent-red': '#dc322f',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    emoji: '🌸',
    dark: {
      '--bg-primary': '#191724',
      '--bg-secondary': '#1f1d2e',
      '--bg-tertiary': '#26233a',
      '--bg-elevated': '#2a2740',
      '--bg-hover': 'rgba(255, 255, 255, 0.04)',
      '--bg-active': 'rgba(196, 167, 231, 0.12)',
      '--text-primary': '#e0def4',
      '--text-secondary': '#908caa',
      '--text-muted': '#6e6a86',
      '--text-link': '#9ccfd8',
      '--border-default': '#393552',
      '--border-muted': '#2a2740',
      '--border-hover': '#524f67',
      '--accent-blue': '#9ccfd8',
      '--accent-green': '#31748f',
      '--accent-purple': '#c4a7e7',
      '--accent-orange': '#f6c177',
      '--accent-red': '#eb6f92',
      '--shadow-glow': '0 0 20px rgba(196, 167, 231, 0.15)',
    },
    light: {
      '--bg-primary': '#faf4ed',
      '--bg-secondary': '#f2e9e1',
      '--bg-tertiary': '#ebe5dd',
      '--bg-elevated': '#fffaf3',
      '--text-primary': '#575279',
      '--text-secondary': '#797593',
      '--text-muted': '#9893a5',
      '--text-link': '#56949f',
      '--border-default': '#dfdad9',
      '--border-muted': '#ebe5dd',
      '--border-hover': '#c5c0be',
      '--accent-blue': '#56949f',
      '--accent-green': '#286983',
      '--accent-purple': '#907aa9',
      '--accent-orange': '#b4637a',
      '--accent-red': '#d7827e',
    },
  },
];

/** Apply a theme preset's CSS variable overrides to the document */
export function applyThemePreset(presetId: string, resolved: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return;

  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  const root = document.documentElement;

  // First remove any previous custom properties set by themes
  for (const p of THEME_PRESETS) {
    for (const key of Object.keys(p.dark)) {
      root.style.removeProperty(key);
    }
    for (const key of Object.keys(p.light)) {
      root.style.removeProperty(key);
    }
  }

  if (!preset) return;

  // Apply the chosen preset's overrides for the current resolved theme
  const overrides = resolved === 'dark' ? preset.dark : preset.light;
  for (const [key, value] of Object.entries(overrides)) {
    root.style.setProperty(key, value);
  }
}
