'use client';

import { useEffect, useState } from 'react';

export interface ChatEntry {
  /** Unix ms. */
  ts: number;
  role: 'visitor' | 'face';
  text: string;
}

const MAX_ENTRIES = 200;
const KEY = (visitorId: string): string => `templeChatHistory.${visitorId}`;

/** Load + persist history to localStorage. The hook is single-source-of-
 *  truth: TempleExperience pushes via append(); the panel reads via the
 *  returned `entries`. */
export function useChatHistory(visitorId: string): {
  entries: ChatEntry[];
  append: (role: ChatEntry['role'], text: string) => void;
  clear: () => void;
} {
  const [entries, setEntries] = useState<ChatEntry[]>(() => {
    if (typeof window === 'undefined' || !visitorId) return [];
    try {
      const raw = window.localStorage.getItem(KEY(visitorId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ChatEntry[];
      return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !visitorId) return;
    try {
      window.localStorage.setItem(KEY(visitorId), JSON.stringify(entries));
    } catch {/* quota / disabled — silent */}
  }, [entries, visitorId]);

  const append = (role: ChatEntry['role'], text: string): void => {
    const t = text.trim();
    if (!t) return;
    setEntries((prev) => {
      const next = [...prev, { ts: Date.now(), role, text: t }];
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
    });
  };

  const clear = (): void => setEntries([]);

  return { entries, append, clear };
}

export interface TempleChatHistoryProps {
  open: boolean;
  onClose: () => void;
  entries: ChatEntry[];
  visitorId: string;
  onClear: () => void;
}

export function TempleChatHistory({
  open,
  onClose,
  entries,
  visitorId,
  onClear,
}: TempleChatHistoryProps): React.JSX.Element | null {
  // Auto-scroll to bottom when entries change while open.
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById('temple-history-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, entries]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        right: 24,
        top: 80,
        bottom: 100,
        width: 380,
        maxWidth: '40vw',
        background: 'rgba(8, 6, 18, 0.84)',
        border: '1px solid rgba(180, 200, 255, 0.18)',
        borderRadius: 16,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 18px 60px rgba(0, 0, 0, 0.55)',
        color: '#e2e8f0',
        fontFamily: 'ui-serif, "Iowan Old Style", Palatino, serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(180, 200, 255, 0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#fbe9c4',
        }}
      >
        <span>visit log · {visitorId}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClear}
            title="forget everything"
            style={{
              background: 'transparent',
              border: '1px solid rgba(180, 200, 255, 0.22)',
              borderRadius: 999,
              color: 'rgba(232, 237, 246, 0.65)',
              padding: '2px 10px',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            clear
          </button>
          <button
            onClick={onClose}
            title="close (L)"
            style={{
              background: 'transparent',
              border: '1px solid rgba(180, 200, 255, 0.22)',
              borderRadius: 999,
              color: 'rgba(232, 237, 246, 0.65)',
              padding: '2px 10px',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            close
          </button>
        </div>
      </div>

      <div
        id="temple-history-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              opacity: 0.45,
              fontSize: 13,
              fontStyle: 'italic',
              padding: '24px 0',
              textAlign: 'center',
            }}
          >
            nothing has been said yet.
            <br />
            press <kbd style={kbd}>T</kbd> to speak.
          </div>
        ) : (
          entries.map((e, i) => (
            <div
              key={i}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: e.role === 'visitor' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: e.role === 'visitor'
                    ? 'rgba(120, 160, 240, 0.16)'
                    : 'linear-gradient(180deg, rgba(40, 18, 8, 0.88), rgba(20, 8, 4, 0.92))',
                  border: e.role === 'visitor'
                    ? '1px solid rgba(180, 200, 255, 0.22)'
                    : '1px solid rgba(255, 215, 150, 0.32)',
                  color: e.role === 'visitor' ? '#dbe6ff' : '#ffe7c0',
                  fontFamily: e.role === 'visitor'
                    ? 'ui-sans-serif, system-ui, "Helvetica Neue", sans-serif'
                    : 'inherit',
                  fontStyle: e.role === 'face' ? 'italic' : 'normal',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {e.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block',
  padding: '0 5px',
  border: '1px solid rgba(251, 233, 196, 0.35)',
  borderRadius: 4,
  fontSize: 10,
  fontFamily: 'inherit',
  color: '#fbe9c4',
};
