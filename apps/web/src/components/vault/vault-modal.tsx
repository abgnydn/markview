'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '@markview/core';
import { X, Pencil, Check, Trash2, SquareStack } from 'lucide-react';
import type { VaultDoc } from './vault-store';
import { buildVaultAdjacency, kHopNeighbors } from './vault-graph-queries';
import { t } from '@/i18n';

interface VaultModalProps {
  doc: VaultDoc;
  /** All docs in the vault — used to compute "related within N hops". Pass [doc]
   *  if you only have the active doc; the panel will simply be empty. */
  docs?: VaultDoc[];
  /** Click-handler for related-note chips. Omit to disable navigation. */
  onSelect?: (id: string) => void;
  /** Optional human label per tint (e.g. legal-document privilege classes for
   *  DavaKasası: cyan = Halka Açık, amber = İş Ürünü, violet = Müvekkil–Avukat
   *  Gizli). When set, renders next to the tint dot in the header. */
  tintLabels?: Partial<Record<VaultDoc['tint'], string>>;
  onSave: (patch: { title?: string; content?: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}

const TINT_HEX: Record<VaultDoc['tint'], string> = {
  cyan: '#67e8f9',
  violet: '#a78bfa',
  amber: '#fbbf24',
  rose: '#ff7a94',
};

export function VaultModal({
  doc,
  docs,
  onSelect,
  tintLabels,
  onSave,
  onDelete,
  onClose,
}: VaultModalProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title);
  const [draftContent, setDraftContent] = useState(doc.content);
  const [html, setHtml] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hops, setHops] = useState<1 | 2 | 3>(1);

  const adjacency = useMemo(
    () => (docs && docs.length > 1 ? buildVaultAdjacency(docs) : null),
    [docs],
  );
  const related = useMemo(() => {
    if (!adjacency) return [];
    const titleById = new Map((docs ?? []).map((d) => [d.id, d] as const));
    return kHopNeighbors(adjacency, doc.id, hops)
      .map((h) => ({ doc: titleById.get(h.id), hops: h.hops }))
      .filter((r): r is { doc: VaultDoc; hops: number } => Boolean(r.doc));
  }, [adjacency, docs, doc.id, hops]);

  useEffect(() => {
    setDraftTitle(doc.title);
    setDraftContent(doc.content);
    setEditing(false);
    setConfirmDelete(false);
  }, [doc.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rendered = await renderMarkdown(doc.content, {
          shiki: true,
          mermaid: false,
          katex: true,
        });
        if (!cancelled) setHtml(rendered);
      } catch {
        if (!cancelled) setHtml(`<pre>${escapeHtml(doc.content)}</pre>`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tint = TINT_HEX[doc.tint];
  const dirty = editing && (draftTitle !== doc.title || draftContent !== doc.content);

  const commit = () => {
    const patch: { title?: string; content?: string } = {};
    if (draftTitle !== doc.title) patch.title = draftTitle;
    if (draftContent !== doc.content) patch.content = draftContent;
    if (patch.title || patch.content) onSave(patch);
    setEditing(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '5vh 4vw',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 94vw)',
          height: 'min(780px, 90vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(7, 14, 33, 0.82)',
          backdropFilter: 'blur(22px) saturate(140%)',
          WebkitBackdropFilter: 'blur(22px) saturate(140%)',
          border: `1px solid ${tint}33`,
          borderRadius: '16px',
          boxShadow: `0 0 60px ${tint}22, 0 24px 80px rgba(0, 0, 0, 0.55)`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: tint,
              boxShadow: `0 0 10px ${tint}`,
              flexShrink: 0,
            }}
            title={tintLabels?.[doc.tint]}
          />
          {tintLabels?.[doc.tint] && (
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tint,
                padding: '2px 8px',
                borderRadius: '999px',
                background: `${tint}14`,
                border: `1px solid ${tint}3a`,
                flexShrink: 0,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {tintLabels[doc.tint]}
            </span>
          )}
          {editing ? (
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f0f9ff',
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                padding: '4px 0',
              }}
              placeholder={t('modal_title_placeholder')}
            />
          ) : (
            <span
              style={{
                flex: 1,
                color: '#f0f9ff',
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {doc.title}
            </span>
          )}

          <button
            onClick={() => (editing ? commit() : setEditing(true))}
            style={iconBtn(editing ? tint : undefined)}
            title={editing ? t('modal_save') : t('modal_edit')}
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />}
          </button>

          <button
            onClick={() => {
              if (confirmDelete) {
                onDelete();
              } else {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 2500);
              }
            }}
            style={iconBtn(confirmDelete ? '#f87171' : undefined)}
            title={confirmDelete ? t('modal_delete_confirm') : t('modal_delete')}
          >
            <Trash2 size={14} />
          </button>

          <button onClick={onClose} style={iconBtn()} title={t('modal_close')}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px' }}>
          {editing ? (
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '420px',
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e2e8f0',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '13px',
                lineHeight: 1.65,
                tabSize: 2,
              }}
            />
          ) : (
            <div
              className="vault-doc-rendered"
              style={{
                color: '#e2e8f0',
                fontSize: '15px',
                lineHeight: 1.65,
              }}
              dangerouslySetInnerHTML={{ __html: html || `<p style="opacity:.5">${t('modal_rendering')}</p>` }}
            />
          )}
        </div>

        {/* Related-within-N-hops panel */}
        {adjacency && !editing && (
          <div
            data-testid="vault-related-panel"
            style={{
              flexShrink: 0,
              maxHeight: '180px',
              overflow: 'auto',
              padding: '10px 18px 12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(148, 163, 184, 0.75)',
                }}
              >
                {t('related_heading', { n: hops })}
              </span>
              <div role="group" aria-label={t('related_hops_label')} style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3].map((h) => {
                  const active = h === hops;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHops(h as 1 | 2 | 3)}
                      data-testid={`vault-related-hops-${h}`}
                      style={{
                        minWidth: 22,
                        height: 22,
                        padding: '0 6px',
                        background: active ? `${tint}22` : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${active ? `${tint}66` : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '6px',
                        color: active ? tint : 'rgba(226, 232, 240, 0.75)',
                        fontSize: '11px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
            {related.length === 0 ? (
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(148, 163, 184, 0.55)',
                  letterSpacing: '0.04em',
                }}
              >
                {t('related_empty')}
              </div>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {related.map((r) => (
                  <li key={r.doc.id}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(r.doc.id)}
                      disabled={!onSelect}
                      data-testid="vault-related-item"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '999px',
                        color: 'rgba(226, 232, 240, 0.92)',
                        fontSize: '11px',
                        fontFamily: 'inherit',
                        cursor: onSelect ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: TINT_HEX[r.doc.tint],
                          boxShadow: `0 0 6px ${TINT_HEX[r.doc.tint]}`,
                        }}
                      />
                      {r.doc.title.replace(/\.md$/i, '')}
                      <span style={{ color: 'rgba(148, 163, 184, 0.55)' }}>·{r.hops}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '11px',
            color: 'rgba(148, 163, 184, 0.65)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.04em',
          }}
        >
          <span>
            <SquareStack size={10} style={{ verticalAlign: '-1px', marginRight: 6 }} />
            {new Date(doc.updatedAt).toLocaleString()}
          </span>
          {dirty && <span style={{ color: tint }}>{t('modal_unsaved')}</span>}
        </div>
      </div>

      <style jsx global>{`
        .vault-doc-rendered h1,
        .vault-doc-rendered h2,
        .vault-doc-rendered h3 {
          color: #f0f9ff;
          letter-spacing: -0.015em;
          margin: 1.4em 0 0.5em;
          line-height: 1.15;
        }
        .vault-doc-rendered h1 { font-size: 1.75em; }
        .vault-doc-rendered h2 { font-size: 1.4em; }
        .vault-doc-rendered h3 { font-size: 1.15em; }
        .vault-doc-rendered p { margin: 0.8em 0; }
        .vault-doc-rendered a { color: ${tint}; text-decoration: none; border-bottom: 1px solid ${tint}55; }
        .vault-doc-rendered code {
          background: rgba(103, 232, 249, 0.08);
          border: 1px solid rgba(103, 232, 249, 0.15);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.88em;
        }
        .vault-doc-rendered pre {
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px 16px;
          overflow: auto;
        }
        .vault-doc-rendered pre code { background: transparent; border: none; padding: 0; }
        .vault-doc-rendered blockquote {
          border-left: 3px solid ${tint};
          padding-left: 14px;
          color: rgba(203, 213, 225, 0.85);
          margin: 1em 0;
        }
        .vault-doc-rendered ul, .vault-doc-rendered ol { padding-left: 1.4em; margin: 0.8em 0; }
        .vault-doc-rendered li { margin: 0.25em 0; }
        .vault-doc-rendered hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1.5em 0; }
      `}</style>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function iconBtn(highlight?: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: highlight ? `${highlight}22` : 'rgba(255,255,255,0.04)',
    border: `1px solid ${highlight ? `${highlight}55` : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '8px',
    color: highlight ?? 'rgba(226, 232, 240, 0.85)',
    cursor: 'pointer',
    flexShrink: 0,
  };
}
