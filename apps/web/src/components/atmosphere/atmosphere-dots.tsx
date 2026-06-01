// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Volume2, VolumeX, RefreshCw, Shuffle, Sun, Footprints } from 'lucide-react';
import { useThemeStore, type Atmosphere } from '@/stores/theme-store';
import {
  isAtmosphereMuted, setAtmosphereMuted,
  setAtmosphereAudio, unlockAtmosphereAudio,
} from '@/lib/atmosphere/audio';
import { nextPaintingFor, shufflePaintingFor, paintingPositionFor } from '@/components/atmosphere/atmospheres';
import { getTimeTintMode, setTimeTintMode } from '@/lib/atmosphere/time-of-day';

const OPTIONS: Array<{ id: Atmosphere; label: string }> = [
  { id: 'none',   label: 'Paper · no atmosphere' },
  { id: 'fuji',   label: 'Fuji · pink petals + temple bell' },
  { id: 'wave',   label: 'Wave · ocean swell + spray' },
  { id: 'snow',   label: 'Snow · falling snow + bells' },
  { id: 'fields', label: 'Fields · warm pad + motes' },
];

/**
 * AtmosphereDots — the entire atmosphere control surface lives here,
 * bottom-left of the viewport. Sidebar no longer carries any of it.
 *
 *   [ ° ° ° ° ° ]   | [🔊]  [↻]  [⇄]  [☀]
 *    mood dots        sound  next shuffle time-of-day toggle
 *
 * The four icon buttons are hidden while atmosphere === 'none' (no
 * audio/painting to control, no point in the time-of-day tint).
 *
 * The whole strip fades in only when the user moves the mouse, so it
 * stays out of the way during reading.
 */
export function AtmosphereDots() {
  const atmosphere = useThemeStore((s) => s.atmosphere);
  const setAtmosphere = useThemeStore((s) => s.setAtmosphere);
  const isLive = atmosphere !== 'none';

  const [muted, setMuted] = useState(() => isAtmosphereMuted());
  const [tintOn, setTintOn] = useState(() => getTimeTintMode() !== 'off');

  // "k / n" gallery position — shows how deep the current pack is and
  // which painting you're on. Refreshes on cycle events + atmosphere
  // change so next/shuffle visibly advance the counter.
  const [pos, setPos] = useState<{ index: number; total: number } | null>(null);
  useEffect(() => {
    if (!isLive) { setPos(null); return; }
    const refresh = () => setPos(paintingPositionFor(atmosphere as Exclude<Atmosphere, 'none'>));
    refresh();
    window.addEventListener('markview:cycle-painting', refresh);
    return () => window.removeEventListener('markview:cycle-painting', refresh);
  }, [atmosphere, isLive]);

  // Keep local state in sync if some other surface changes the audio
  // mute (e.g., a future settings panel).
  useEffect(() => {
    const sync = () => setMuted(isAtmosphereMuted());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAtmosphereMuted(next);
    if (!next && isLive) {
      unlockAtmosphereAudio();
      setAtmosphereAudio(atmosphere);
    }
  };

  const toggleTint = () => {
    const next = !tintOn;
    setTintOn(next);
    setTimeTintMode(next ? 'auto' : 'off');
  };

  const cycleNext = () => {
    if (!isLive) return;
    nextPaintingFor(atmosphere as Exclude<Atmosphere, 'none'>);
    window.dispatchEvent(new Event('markview:cycle-painting'));
  };
  const cycleShuffle = () => {
    if (!isLive) return;
    shufflePaintingFor(atmosphere as Exclude<Atmosphere, 'none'>);
    window.dispatchEvent(new Event('markview:cycle-painting'));
  };

  const playTick = () => {
    void import('@/lib/atmosphere/audio').then(({ playUiSound }) => playUiSound('tick'));
  };

  return (
    <div className="mv-atm-dots" role="group" aria-label="Atmosphere">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-label={opt.label}
          title={opt.label}
          className={`mv-atm-dot mv-atm-dot-${opt.id}${atmosphere === opt.id ? ' mv-atm-dot-active' : ''}`}
          onClick={() => {
            setAtmosphere(opt.id);
            playTick();
          }}
        />
      ))}

      {/* Divider — only when there's something to control. */}
      {isLive && <span className="mv-atm-sep" aria-hidden="true" />}

      {isLive && (
        <>
          <button
            type="button"
            className="mv-atm-icon"
            onClick={toggleMute}
            title={muted ? 'Unmute ambient audio' : 'Mute ambient audio'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <button
            type="button"
            className="mv-atm-icon"
            onClick={cycleNext}
            title="Next painting"
            aria-label="Next painting"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            className="mv-atm-icon"
            onClick={cycleShuffle}
            title="Shuffle painting"
            aria-label="Shuffle painting"
          >
            <Shuffle size={12} />
          </button>
          {pos && (
            <span className="mv-atm-count" title={`Painting ${pos.index + 1} of ${pos.total} in this pack`}>
              {pos.index + 1}<span className="mv-atm-count-sep">/</span>{pos.total}
            </span>
          )}
          <button
            type="button"
            className="mv-atm-enter"
            onClick={() => window.dispatchEvent(new CustomEvent('markview:enter-painting'))}
            title="Go inside the painting — walk through it (WASD)"
            aria-label="Go inside the painting"
          >
            <Footprints size={13} />
          </button>
        </>
      )}

      {/* Time-of-day toggle — always available, even with no atmosphere,
          since the tint applies to the page background too. */}
      <button
        type="button"
        className={`mv-atm-icon${tintOn ? ' is-on' : ''}`}
        onClick={toggleTint}
        title={tintOn ? 'Time-of-day tint · on (auto)' : 'Time-of-day tint · off'}
        aria-label="Toggle time-of-day tint"
      >
        <Sun size={12} />
      </button>
    </div>
  );
}
