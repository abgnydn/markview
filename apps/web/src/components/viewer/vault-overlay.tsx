'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { VaultOrbit } from '@/components/vault/vault-orbit';
import type { VaultDoc, VaultTint } from '@/components/vault/vault-store';
import { db } from '@/lib/storage/db';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';

/**
 * VaultOverlay — full-screen 3D vault that crossfades over the editor.
 *
 * Triggered by `\` (backslash) or by the `onToggle` callback from the
 * editor toolbar. Renders the visitor's *current* workspace files as
 * orbiting nodes around the active file. Click a node → switches the
 * active file in the workspace + dismisses the overlay.
 *
 * Architecture pick: editor stays primary (Obsidian pattern). The vault
 * is a *mode* the editor flips into for navigation/overview, not a
 * separate destination. All editor functionality (sidebar, toolbar,
 * tabs, TOC, search, exports, version history, P2P collab, themes,
 * plugins) is preserved underneath, untouched.
 */

// Tier → tint mapping. Frontmatter `sensitivity:` becomes the node
// color, turning the vault graph into a privacy heatmap. The same four
// tints already drive the vault store's seed docs, so visual language
// is consistent across surfaces. Defaults to `internal` (violet) when
// no frontmatter is present.
const TIER_TINT: Record<string, VaultTint> = {
  public: 'cyan',
  internal: 'violet',
  private: 'amber',
  secret: 'rose',
};

function tintForFrontmatter(content: string): VaultTint {
  if (!content) return 'violet';
  try {
    const { data } = parseFrontmatter(content);
    const raw = data?.sensitivity;
    if (typeof raw === 'string') {
      const k = raw.trim().toLowerCase();
      if (TIER_TINT[k]) return TIER_TINT[k];
    }
  } catch {/* keep default */}
  return 'violet';
}

export interface VaultOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function VaultOverlay({ open, onClose }: VaultOverlayProps): React.JSX.Element | null {
  const files = useWorkspaceStore((s) => s.files);
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  // Two simple booleans rather than a 4-phase state machine: `mounted`
  // gates DOM presence (only render canvas while we want it visible or
  // animating out), `visible` drives the opacity transition. Effect
  // depends only on `open`, so rapid `\\` presses don't get the timer
  // killed by re-renders mid-transition.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeMs = 480;

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Wait one paint so the initial opacity:0 commits, *then* flip to
      // opacity:1 to actually run the CSS transition.
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), fadeMs + 20);
    return () => clearTimeout(t);
  }, [open]);

  // Batch-load full content from IndexedDB on open so VaultOrbit can
  // run its wikilink-edge builder + frontmatter sensitivity → tint.
  // Without this we'd be stuck with isolated label-only nodes.
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [docs, setDocs] = useState<VaultDoc[]>([]);

  useEffect(() => {
    // Refresh every time we re-open OR the file list / workspace changes
    // while open (e.g. user added a file in the editor and reopened).
    if (!open || !activeWorkspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const dbFiles = await db.files
          .where('workspaceId')
          .equals(activeWorkspaceId)
          .toArray();
        if (cancelled) return;
        // Map DB rows → VaultDoc, preserving editor's display order.
        const order = new Map(files.map((f, i) => [f.id, i]));
        const sorted = [...dbFiles].sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
        );
        const mapped: VaultDoc[] = sorted.map((f, idx) => ({
          id: f.id,
          title: f.displayName || f.filename,
          content: f.content ?? '',
          tint: tintForFrontmatter(f.content ?? ''),
          createdAt: Date.now() - (sorted.length - idx) * 1000,
          updatedAt: Date.now() - (sorted.length - idx) * 1000,
        }));
        setDocs(mapped);
      } catch (err) {
        console.warn('[vault-overlay] batch load failed', err);
        // Fallback: label-only nodes.
        setDocs(files.map((f, idx) => ({
          id: f.id,
          title: f.displayName || f.filename,
          content: '',
          tint: 'violet' as VaultTint,
          createdAt: Date.now() - (files.length - idx) * 1000,
          updatedAt: Date.now() - (files.length - idx) * 1000,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [open, activeWorkspaceId, files]);

  // Tier filter — visitor can preview "what does my MCP server expose
  // at this VEIL_MAX_TIER setting?" by capping the visible nodes.
  const [tierCap, setTierCap] = useState<'public' | 'internal' | 'private' | 'secret'>('secret');
  const tierRank: Record<string, number> = useMemo(
    () => ({ public: 0, internal: 1, private: 2, secret: 3 }),
    [],
  );
  const tintToTier: Record<VaultTint, 'public' | 'internal' | 'private' | 'secret'> = useMemo(
    () => ({ cyan: 'public', violet: 'internal', amber: 'private', rose: 'secret' }),
    [],
  );
  const visibleDocs = useMemo(() => {
    return docs.filter((d) => tierRank[tintToTier[d.tint]] <= tierRank[tierCap]);
  }, [docs, tierCap, tierRank, tintToTier]);
  const blockedCount = docs.length - visibleDocs.length;

  const handleSelect = useCallback(
    (id: string) => {
      setActiveFile(id);
      onClose();
    },
    [setActiveFile, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if the click was on the chrome/backdrop, not bubbled
      // from the canvas (canvas clicks are 3D node clicks).
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!mounted) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background:
          'radial-gradient(ellipse at 50% 42%, rgba(34, 211, 238, 0.10) 0%, rgba(15, 23, 42, 0.65) 50%, rgba(2, 6, 23, 1) 100%)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 480ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <VaultOrbit
        docs={visibleDocs}
        activeId={activeFileId}
        peers={[]}
        onSelect={handleSelect}
        showGraph={true}
        showSemantic={false}
        layoutMode="ring"
      />

      {/* HUD — top: title + meta + tier cap selector */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
          color: '#fbe9c4',
          fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
          letterSpacing: '0.16em',
          textTransform: 'lowercase',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'opacity 480ms ease-out 80ms, transform 480ms ease-out 80ms',
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: '0.32em' }}>graph view</div>
        <div style={{ fontSize: 18, marginTop: 4 }}>
          {visibleDocs.length} of {docs.length} {docs.length === 1 ? 'note' : 'notes'}
          {blockedCount > 0 && (
            <span style={{ opacity: 0.55, marginLeft: 8, fontSize: 13 }}>
              · {blockedCount} hidden by veil
            </span>
          )}
        </div>

        {/* Tier cap selector — preview MCP's release ceiling */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'auto' }}>
          {(['public', 'internal', 'private', 'secret'] as const).map((t) => {
            const dot = TIER_TINT[t]
              ? { cyan: '#67e8f9', violet: '#a78bfa', amber: '#fbbf24', rose: '#ff7a94' }[TIER_TINT[t]]
              : '#fff';
            const selected = t === tierCap;
            return (
              <button
                key={t}
                onClick={() => setTierCap(t)}
                title={`Cap visible nodes at sensitivity: ${t}`}
                style={{
                  background: selected ? `${dot}22` : 'rgba(8, 6, 18, 0.5)',
                  border: `1px solid ${selected ? `${dot}88` : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 999,
                  color: selected ? '#fbe9c4' : 'rgba(251, 233, 196, 0.55)',
                  padding: '4px 12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textTransform: 'uppercase',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: dot,
                  boxShadow: selected ? `0 0 6px ${dot}` : 'none',
                }} />
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* HUD — bottom-left: keyboard hints */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          color: 'rgba(251, 233, 196, 0.75)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 480ms ease-out 120ms',
        }}
      >
        <div>
          <kbd style={kbdStyle}>click</kbd> open · <kbd style={kbdStyle}>\</kbd> back to editor · <kbd style={kbdStyle}>esc</kbd> close
        </div>
        <div style={{ opacity: 0.6, marginTop: 6 }}>
          drag to orbit · scroll to zoom
        </div>
      </div>

      {/* Close button — top-right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="back to editor (esc)"
        style={{
          position: 'absolute',
          top: 22,
          right: 22,
          width: 36,
          height: 36,
          background: 'rgba(8, 6, 18, 0.6)',
          border: '1px solid rgba(251, 233, 196, 0.25)',
          borderRadius: 999,
          color: '#fbe9c4',
          fontSize: 18,
          cursor: 'pointer',
          fontFamily: 'inherit',
          backdropFilter: 'blur(10px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 480ms ease-out 80ms, background 0.15s, border-color 0.15s',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  border: '1px solid rgba(251, 233, 196, 0.35)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'inherit',
  color: '#fbe9c4',
  margin: '0 2px',
};
