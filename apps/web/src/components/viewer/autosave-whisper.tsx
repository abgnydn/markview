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
    const show = (msg: string, age?: { afterMs: number; replaceWith: string }) => {
      setLabel(msg);
      setVisible(true);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (agingTimer !== null) window.clearTimeout(agingTimer);
      if (age) {
        agingTimer = window.setTimeout(() => setLabel(age.replaceWith), age.afterMs);
      }
      hideTimer = window.setTimeout(() => setVisible(false), age ? 12_000 : 2_400);
    };
    const onSaved = () => show('saved · just now', { afterMs: 8_000, replaceWith: 'saved · 8s ago' });
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) show(detail.message);
    };
    window.addEventListener('markview:file-saved', onSaved);
    window.addEventListener('markview:toast', onToast as EventListener);
    return () => {
      window.removeEventListener('markview:file-saved', onSaved);
      window.removeEventListener('markview:toast', onToast as EventListener);
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
