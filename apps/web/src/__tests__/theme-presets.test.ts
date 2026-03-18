import { describe, it, expect } from 'vitest';
import { THEME_PRESETS } from '@/lib/themes/presets';

describe('Theme Presets', () => {
  it('should have at least 5 preset themes', () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('each preset should have required fields', () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.emoji).toBeTruthy();
      expect(preset.dark).toBeDefined();
      expect(preset.light).toBeDefined();
    }
  });

  it('github preset should have empty overrides (it is the default)', () => {
    const github = THEME_PRESETS.find((p) => p.id === 'github');
    expect(github).toBeDefined();
    expect(Object.keys(github!.dark)).toHaveLength(0);
    expect(Object.keys(github!.light)).toHaveLength(0);
  });

  it('non-default presets should override core CSS variables', () => {
    const nonDefault = THEME_PRESETS.filter((p) => p.id !== 'github');
    for (const preset of nonDefault) {
      expect(Object.keys(preset.dark).length).toBeGreaterThan(0);
      expect(preset.dark['--bg-primary']).toBeTruthy();
      expect(preset.dark['--text-primary']).toBeTruthy();
      expect(preset.dark['--accent-blue']).toBeTruthy();
    }
  });

  it('preset IDs should be unique', () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
