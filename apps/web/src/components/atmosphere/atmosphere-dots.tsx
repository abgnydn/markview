// SPDX-License-Identifier: Apache-2.0

import { useThemeStore, type Atmosphere } from '@/stores/theme-store';

const OPTIONS: Array<{ id: Atmosphere; label: string }> = [
  { id: 'none',   label: 'Paper · no atmosphere' },
  { id: 'fuji',   label: 'Fuji · pink petals + temple bell' },
  { id: 'wave',   label: 'Wave · ocean swell + spray' },
  { id: 'snow',   label: 'Snow · falling snow + bells' },
  { id: 'fields', label: 'Fields · warm pad + motes' },
];

/**
 * AtmosphereDots — five floating dots bottom-left, one per atmosphere.
 * Quietly hidden until the user moves the mouse anywhere on the page,
 * then fades in. Click any dot to swap the atmosphere without opening
 * the sidebar. The active one fills in its mood color with a soft glow.
 *
 * Sits at z:4, pointer-events on, picks up the same view-transition
 * cross-fade as the sidebar atmosphere picker.
 */
export function AtmosphereDots() {
  const atmosphere = useThemeStore((s) => s.atmosphere);
  const setAtmosphere = useThemeStore((s) => s.setAtmosphere);

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
            void import('@/lib/atmosphere/audio').then(({ playUiSound }) => playUiSound('tick'));
          }}
        />
      ))}
    </div>
  );
}
