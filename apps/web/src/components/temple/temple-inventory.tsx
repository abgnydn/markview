'use client';

import { useEffect, useState } from 'react';

export interface InventoryItem {
  id: string;
  /** Underlying summon kind. */
  obj: 'orb' | 'crystal' | 'rune';
  /** Hex color string. */
  color: string;
  /** Optional human label (e.g. "wings of starlight" once we wire add_part). */
  label?: string;
  createdAt: number;
}

const MAX_ITEMS = 64;
const KEY = (vid: string): string => `templeInventory.${vid}`;

export function useInventory(visitorId: string): {
  items: InventoryItem[];
  add: (item: Omit<InventoryItem, 'id' | 'createdAt'> & { id?: string }) => void;
  remove: (id: string) => void;
  clear: () => void;
} {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    if (typeof window === 'undefined' || !visitorId) return [];
    try {
      const raw = window.localStorage.getItem(KEY(visitorId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as InventoryItem[];
      return Array.isArray(parsed) ? parsed.slice(-MAX_ITEMS) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !visitorId) return;
    try {
      window.localStorage.setItem(KEY(visitorId), JSON.stringify(items));
    } catch {/* quota */}
  }, [items, visitorId]);

  const add: ReturnType<typeof useInventory>['add'] = (incoming) => {
    setItems((prev) => {
      const next = [
        ...prev,
        {
          id: incoming.id ?? `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          obj: incoming.obj,
          color: incoming.color,
          label: incoming.label,
          createdAt: Date.now(),
        },
      ];
      return next.length > MAX_ITEMS ? next.slice(-MAX_ITEMS) : next;
    });
  };

  const remove = (id: string): void => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const clear = (): void => setItems([]);

  return { items, add, remove, clear };
}

export interface TempleInventoryProps {
  open: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onUse: (it: InventoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  visitorId: string;
}

const KIND_GLYPH: Record<InventoryItem['obj'], string> = {
  orb: '●',
  crystal: '◆',
  rune: '○',
};

export function TempleInventory({
  open, onClose, items, onUse, onRemove, onClear, visitorId,
}: TempleInventoryProps): React.JSX.Element | null {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 24,
        top: 80,
        bottom: 100,
        width: 320,
        maxWidth: '36vw',
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
        <span>inventory · {items.length}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClear} title="empty inventory" style={btnStyle}>clear</button>
          <button onClick={onClose} title="close (I)" style={btnStyle}>close</button>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              opacity: 0.45,
              fontSize: 13,
              fontStyle: 'italic',
              padding: '24px 0',
              textAlign: 'center',
            }}
          >
            nothing collected yet.
            <br />
            ask the face to <em>summon</em> something — it lands here too.
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: it.color,
                  textShadow: `0 0 14px ${it.color}`,
                  background: `${it.color}22`,
                  border: `1px solid ${it.color}55`,
                  flexShrink: 0,
                }}
                title={`${it.obj} · ${it.color}`}
              >
                {KIND_GLYPH[it.obj]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: '#dbe6ff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.label ?? it.obj}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.45,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  {new Date(it.createdAt).toLocaleString()}
                </div>
              </div>
              <button onClick={() => onUse(it)} style={useBtnStyle} title="summon next to me">
                summon
              </button>
              <button
                onClick={() => onRemove(it.id)}
                style={{ ...btnStyle, padding: '2px 6px' }}
                title="remove"
                aria-label="remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(180, 200, 255, 0.10)',
          fontSize: 10,
          opacity: 0.45,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        visitor · {visitorId}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(180, 200, 255, 0.22)',
  borderRadius: 999,
  color: 'rgba(232, 237, 246, 0.65)',
  padding: '2px 10px',
  fontSize: 10,
  letterSpacing: '0.12em',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const useBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 215, 150, 0.10)',
  border: '1px solid rgba(255, 215, 150, 0.35)',
  borderRadius: 999,
  color: '#ffe7c0',
  padding: '2px 10px',
  fontSize: 10,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
