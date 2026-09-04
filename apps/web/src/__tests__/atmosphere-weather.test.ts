import { describe, it, expect } from 'vitest';
import { WeatherClock } from '@/lib/atmosphere/weather';
import { Bank, DUST_LOOK, SNOW_LOOK } from '@/components/atmosphere/accumulation';

const VALID_FRONTS = ['calm', 'building', 'squall', 'clearing'] as const;
const INITIAL_FRONTS = ['calm', 'building', 'clearing'] as const;

function assertWeatherRanges(w: ReturnType<WeatherClock['step']>) {
  expect(VALID_FRONTS).toContain(w.front);
  expect(w.intensity).toBeGreaterThanOrEqual(0.2);
  expect(w.intensity).toBeLessThanOrEqual(1.2);
  expect(w.wind).toBeGreaterThanOrEqual(0.2);
  expect(w.sea).toBeGreaterThanOrEqual(0.3);
  expect(w.visibility).toBeGreaterThan(0);
  expect(w.visibility).toBeLessThanOrEqual(1);
  expect(Number.isFinite(w.intensity)).toBe(true);
  expect(Number.isFinite(w.wind)).toBe(true);
  expect(Number.isFinite(w.sea)).toBe(true);
  expect(Number.isFinite(w.visibility)).toBe(true);
  expect(Number.isFinite(w.onset)).toBe(true);
  expect(Number.isFinite(w.low)).toBe(true);
}

describe('WeatherClock', () => {
  it('snow: initial step returns values inside expected ranges', () => {
    const clock = new WeatherClock('snow');
    const w = clock.step(1);
    expect(INITIAL_FRONTS).toContain(w.front);
    assertWeatherRanges(w);
  });

  it('snow: advancing 1000s keeps values inside ranges with no NaN', () => {
    const clock = new WeatherClock('snow');
    let last = clock.step(0.016);
    for (let i = 0; i < 50; i++) {
      last = clock.step(20);
      assertWeatherRanges(last);
    }
    const final = clock.step(1000);
    assertWeatherRanges(final);
    expect(final.front).not.toBe(last.front === 'calm' ? 'calm' : last.front);
  });

  it('rain: step returns valid ranges and no NaN', () => {
    const clock = new WeatherClock('rain');
    const w = clock.step(0.016);
    assertWeatherRanges(w);
  });

  it('wave: step returns valid ranges and no NaN', () => {
    const clock = new WeatherClock('wave');
    const w = clock.step(0.016);
    assertWeatherRanges(w);
  });
});

describe('Bank', () => {
  it('SNOW_LOOK: construct, resize, deposit, and step run without throwing', () => {
    const bank = new Bank(SNOW_LOOK);
    expect(() => bank.resize(1440)).not.toThrow();
    expect(() => bank.deposit(400, 6, 'ground')).not.toThrow();
    expect(() => bank.deposit(900, 4, 'ground', 0.5)).not.toThrow();
    expect(() => bank.step(0.016)).not.toThrow();
    const h = bank.groundHeightAt(400);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it('DUST_LOOK: construct, resize, deposit, and step run without throwing', () => {
    const bank = new Bank(DUST_LOOK);
    expect(() => bank.resize(1440)).not.toThrow();
    expect(() => bank.deposit(200, 3, 'ground')).not.toThrow();
    expect(() => bank.step(0.016)).not.toThrow();
    const h = bank.groundHeightAt(200);
    expect(Number.isFinite(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});
