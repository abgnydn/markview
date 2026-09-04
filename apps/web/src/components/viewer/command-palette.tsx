// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeStore, type Atmosphere } from '@/stores/theme-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useFocusReturn } from '@/hooks/use-focus-return';

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
  useFocusReturn(open);
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
        // Consume in capture phase so lower layers (editor overlay, graph
        // view…) don't also close on the same keypress.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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

    const atmospheres: Atmosphere[] = ['none', 'fuji', 'wave', 'snow', 'fields', 'rain'];
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

    // Jump to any file in the active workspace — type its name to navigate.
    const fileCmds: Command[] = wsStore.files.map((f) => ({
      id: `file-${f.id}`,
      label: `Go to · ${f.displayName || f.filename}`,
      hint: wsStore.activeFileId === f.id ? '✓ open' : '',
      run: () => void wsStore.setActiveFile(f.id),
    }));

    const misc: Command[] = [
      {
        id: 'open-search',
        label: 'Open search',
        hint: '⌘K',
        run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })),
      },
      {
        id: 'browse-files',
        label: 'Browse all workspaces & files',
        run: () => window.dispatchEvent(new CustomEvent('markview:open-file-browser')),
      },
      {
        id: 'toggle-ai',
        label: 'Open AI chat',
        hint: '⌘J',
        run: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true })),
      },
      {
        id: 'toggle-vertical',
        label: document.documentElement.classList.contains('mv-vertical')
          ? 'Vertical writing · turn off'
          : 'Vertical writing · turn on (Japanese-style)',
        run: () => document.documentElement.classList.toggle('mv-vertical'),
      },
      {
        id: 'toggle-typography',
        label: (() => {
          try { return localStorage.getItem('mv-smart-typography') === '0' ? 'Smart typography · turn on' : 'Smart typography · turn off'; }
          catch { return 'Smart typography · toggle'; }
        })(),
        run: () => {
          try {
            const off = localStorage.getItem('mv-smart-typography') === '0';
            localStorage.setItem('mv-smart-typography', off ? '1' : '0');
          } catch { /* ignore */ }
        },
      },
    ];

    return [...misc, ...fileCmds, ...atmCmds, ...themeCmds, ...wsCmds];
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
      <div className="mv-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="mv-palette-input"
          placeholder="Run a command or jump to a file…"
          aria-label="Run a command or jump to a file"
          role="combobox"
          aria-expanded="true"
          aria-controls="mv-palette-listbox"
          aria-activedescendant={filtered.length > 0 ? `mv-palette-opt-${activeIdx}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIdx((i) => {
                const next = e.key === 'ArrowDown' ? Math.min(i + 1, filtered.length - 1) : Math.max(i - 1, 0);
                requestAnimationFrame(() => {
                  document.getElementById(`mv-palette-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
                });
                return next;
              });
            } else if (e.key === 'Enter') {
              e.preventDefault();
              runActive();
            }
          }}
        />
        <div className="mv-palette-list" id="mv-palette-listbox" role="listbox">
          {filtered.length === 0 ? (
            <div className="mv-palette-item" style={{ opacity: 0.5 }}>no matches</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                id={`mv-palette-opt-${i}`}
                role="option"
                aria-selected={i === activeIdx}
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
