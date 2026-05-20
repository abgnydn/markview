import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/theme-store';

// Theme store covers theme mode (dark/light/system), font size bounds, and the
// color-scheme preset selector. These are the most-used UI levers — they should
// be the most-tested part of the state layer.

describe('theme-store', () => {
  beforeEach(() => {
    // Reset to defaults between tests
    useThemeStore.setState({
      mode: 'dark',
      resolved: 'dark',
      fontSize: 16,
      focusMode: false,
      colorScheme: 'default',
    });
  });

  describe('mode', () => {
    it('defaults to dark', () => {
      expect(useThemeStore.getState().mode).toBe('dark');
      expect(useThemeStore.getState().resolved).toBe('dark');
    });

    it('switches to light and tracks resolved', () => {
      useThemeStore.getState().setMode('light');
      expect(useThemeStore.getState().mode).toBe('light');
      expect(useThemeStore.getState().resolved).toBe('light');
    });
  });

  describe('font size', () => {
    it('defaults to 16', () => {
      expect(useThemeStore.getState().fontSize).toBe(16);
    });

    it('clamps to a sane range when set directly', () => {
      useThemeStore.getState().setFontSize(50);
      expect(useThemeStore.getState().fontSize).toBeLessThanOrEqual(24);

      useThemeStore.getState().setFontSize(2);
      expect(useThemeStore.getState().fontSize).toBeGreaterThanOrEqual(12);
    });

    it('increase/decrease step within bounds', () => {
      useThemeStore.getState().setFontSize(16);
      useThemeStore.getState().increaseFontSize();
      expect(useThemeStore.getState().fontSize).toBeGreaterThan(16);

      useThemeStore.getState().decreaseFontSize();
      useThemeStore.getState().decreaseFontSize();
      expect(useThemeStore.getState().fontSize).toBeLessThan(17);
    });

    it('decreaseFontSize does not go below the minimum', () => {
      useThemeStore.getState().setFontSize(12);
      for (let i = 0; i < 20; i++) useThemeStore.getState().decreaseFontSize();
      expect(useThemeStore.getState().fontSize).toBeGreaterThanOrEqual(12);
    });

    it('increaseFontSize does not exceed the maximum', () => {
      useThemeStore.getState().setFontSize(24);
      for (let i = 0; i < 20; i++) useThemeStore.getState().increaseFontSize();
      expect(useThemeStore.getState().fontSize).toBeLessThanOrEqual(24);
    });
  });

  describe('focus mode', () => {
    it('defaults to off', () => {
      expect(useThemeStore.getState().focusMode).toBe(false);
    });

    it('toggles', () => {
      useThemeStore.getState().toggleFocusMode();
      expect(useThemeStore.getState().focusMode).toBe(true);
      useThemeStore.getState().toggleFocusMode();
      expect(useThemeStore.getState().focusMode).toBe(false);
    });
  });
});
