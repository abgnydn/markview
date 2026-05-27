// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';

interface ActivityEvent {
  id: string;
  type: 'save' | 'switch' | 'export' | 'share' | 'atmosphere';
  label: string;
  at: number; // epoch ms
}

const STORAGE_KEY = 'markview-activity-log';
const MAX_EVENTS = 50;

function loadLog(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ActivityEvent[];
  } catch { /* ignore */ }
  return [];
}

function saveLog(events: ActivityEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch { /* ignore */ }
}

function relTime(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h`;
  return `${Math.round(d / 86_400_000)}d`;
}

/**
 * ActivityLog (N18) — flush-right drawer of recent events. ⌘⇧H toggles.
 * Listens for known window events (file-saved, etc.) and append to a
 * localStorage-backed ring buffer. Lighter than toasts; auditable.
 */
export function ActivityLog() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>(() => loadLog());

  // ⌘⇧H toggles, Esc closes, custom event from palette also toggles.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    const onCustom = () => setOpen((o) => !o);
    window.addEventListener('keydown', onKey);
    window.addEventListener('markview:activity-toggle', onCustom as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('markview:activity-toggle', onCustom as EventListener);
    };
  }, [open]);

  // Listen for activity-producing events and append to the log.
  useEffect(() => {
    const append = (ev: ActivityEvent) => {
      setEvents((prev) => {
        const next = [ev, ...prev].slice(0, MAX_EVENTS);
        saveLog(next);
        return next;
      });
    };
    const onSaved = () => append({
      id: `${Date.now()}-save`,
      type: 'save',
      label: 'file saved',
      at: Date.now(),
    });
    window.addEventListener('markview:file-saved', onSaved);
    return () => {
      window.removeEventListener('markview:file-saved', onSaved);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="mv-activity mv-activity-show" role="dialog" aria-label="Activity log">
      <div className="mv-activity-header">Activity · last {events.length}</div>
      {events.length === 0 ? (
        <div style={{ fontFamily: 'var(--zen-serif)', color: 'var(--zen-muted)', fontStyle: 'italic', fontSize: 13 }}>
          nothing here yet
        </div>
      ) : (
        events.map((e) => (
          <div key={e.id} className="mv-activity-item">
            <span className="mv-activity-time">{relTime(e.at)}</span>
            <span>{e.label}</span>
          </div>
        ))
      )}
    </div>
  );
}
