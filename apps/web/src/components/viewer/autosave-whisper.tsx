// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

/**
 * AutosaveWhisper (N9) — a tiny mono "saved · just now" pill bottom-
 * right whenever a file save event fires. Listens for the existing
 * `markview:file-saved` window event (broadcast by use-viewer-state).
 *
 * Replaces the heavier toast pattern. Sits at z:5, pointer-events:none.
 */
export function AutosaveWhisper() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('saved · just now');

  useEffect(() => {
    let hideTimer: number | null = null;
    let agingTimer: number | null = null;
    const onSaved = () => {
      setLabel('saved · just now');
      setVisible(true);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (agingTimer !== null) window.clearTimeout(agingTimer);
      // Age the label after 8s, then hide at 12s, so the whisper
      // reads as a quiet timestamp rather than a flashing toast.
      agingTimer = window.setTimeout(() => setLabel('saved · 8s ago'), 8_000);
      hideTimer = window.setTimeout(() => setVisible(false), 12_000);
    };
    window.addEventListener('markview:file-saved', onSaved);
    return () => {
      window.removeEventListener('markview:file-saved', onSaved);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (agingTimer !== null) window.clearTimeout(agingTimer);
    };
  }, []);

  return (
    <div
      className={`mv-saved-whisper${visible ? ' mv-saved-whisper-show' : ''}`}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
