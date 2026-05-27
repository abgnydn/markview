// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeStore, type Atmosphere } from '@/stores/theme-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * CommandPalette (N4) — ⌘P opens a center-aligned card with a fuzzy
 * action list. Distinct from ⌘K (which is text search inside a file).
 * Actions cover theme / atmosphere toggles, workspace switching, and
 * export shortcuts — power-user surface for stuff that lives in menus.
 *
 * Renders nothing until first opened, so it doesn't cost anything until
 * the user reaches for it.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ⌘P / Ctrl+P toggles, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const themeStore = useThemeStore.getState();
    const wsStore = useWorkspaceStore.getState();

    const atmospheres: Atmosphere[] = ['none', 'fuji', 'wave', 'snow', 'fields'];
    const atmCmds: Command[] = atmospheres.map((a) => ({
      id: `atm-${a}`,
      label: `Atmosphere · ${a === 'none' ? 'paper (off)' : a}`,
      hint: themeStore.atmosphere === a ? '✓ current' : '',
      run: () => themeStore.setAtmosphere(a),
    }));

    const themeCmds: Command[] = (['light', 'dark', 'system'] as const).map((m) => ({
      id: `mode-${m}`,
      label: `Appearance · ${m}`,
      hint: themeStore.mode === m ? '✓ current' : '',
      run: () => themeStore.setMode(m),
    }));

    const wsCmds: Command[] = wsStore.workspaces.map((ws) => ({
      id: `ws-${ws.id}`,
      label: `Workspace · ${ws.title}`,
      hint: wsStore.activeWorkspaceId === ws.id ? '✓ active' : '',
      run: () => wsStore.switchWorkspace(ws.id),
    }));

    const misc: Command[] = [
      {
        id: 'open-search',
        label: 'Open search',
        hint: '⌘K',
        run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })),
      },
      {
        id: 'toggle-graph',
        label: 'Open graph view',
        hint: '\\',
        run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '\\' })),
      },
      {
        id: 'toggle-ai',
        label: 'Open AI chat',
        hint: '⌘J',
        run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true })),
      },
      {
        id: 'toggle-activity',
        label: 'Open activity log',
        hint: '⌘⇧H',
        run: () => window.dispatchEvent(new CustomEvent('markview:activity-toggle')),
      },
    ];

    return [...misc, ...atmCmds, ...themeCmds, ...wsCmds];
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  if (!open) return null;

  const runActive = () => {
    const cmd = filtered[activeIdx];
    if (!cmd) return;
    cmd.run();
    setOpen(false);
  };

  return (
    <div
      className="mv-palette-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="mv-palette">
        <input
          ref={inputRef}
          className="mv-palette-input"
          placeholder="Run a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              runActive();
            }
          }}
        />
        <div className="mv-palette-list">
          {filtered.length === 0 ? (
            <div className="mv-palette-item" style={{ opacity: 0.5 }}>no matches</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`mv-palette-item${i === activeIdx ? ' mv-palette-item-active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => { cmd.run(); setOpen(false); }}
              >
                <span>{cmd.label}</span>
                {cmd.hint && <span className="mv-palette-item-hint">{cmd.hint}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
