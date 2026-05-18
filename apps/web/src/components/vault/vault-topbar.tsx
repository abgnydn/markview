'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Share2, Check, Users, LogOut, Radio, Gauge, Zap, Network, Waypoints, Sparkles, FileUp, Loader2 } from 'lucide-react';
import type { PeerPresence } from './use-vault';
import type { SemanticSource } from './use-semantic-edges';
import { t } from '@/i18n';

export type VaultBrand = 'markview';

interface VaultTopbarProps {
  vaultName: string;
  docCount: number;
  mode: 'solo' | 'room';
  roomId: string | null;
  peers: PeerPresence[];
  localName: string;
  localColor: string;
  onRename: (name: string) => void;
  onCreate: () => void;
  onShare: () => Promise<string>;
  onStartCollab: () => void;
  onLeaveRoom: () => void;
  onSeedMany: (count: number) => void;
  onPickFiles: () => void;
  ingesting: boolean;
  showStats: boolean;
  onToggleStats: () => void;
  showGraph: boolean;
  onToggleGraph: () => void;
  showSemantic: boolean;
  onToggleSemantic: () => void;
  semanticSource: SemanticSource;
  semanticProgress: number;
  layoutMode: 'ring' | 'cluster';
  onToggleLayout: () => void;
  /** Which brand chrome to show. Defaults to 'markview'. */
  brand?: VaultBrand;
}

export function VaultTopbar({
  vaultName,
  docCount,
  mode,
  roomId,
  peers,
  localName,
  localColor,
  onRename,
  onCreate,
  onShare,
  onStartCollab,
  onLeaveRoom,
  onSeedMany,
  onPickFiles,
  ingesting,
  showStats,
  onToggleStats,
  showGraph,
  onToggleGraph,
  showSemantic,
  onToggleSemantic,
  semanticSource,
  semanticProgress,
  layoutMode,
  onToggleLayout,
  brand = 'markview',
}: VaultTopbarProps) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(vaultName);
  const [copied, setCopied] = useState(false);

  const brandHref = '/';
  const brandLabel = 'MarkView';
  const brandTitle = t('back_to_landing');

  const share = async () => {
    const url = await onShare();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt('Copy this URL:', url);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 15,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: 'rgba(2, 6, 23, 0.55)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        borderBottom: '1px solid rgba(103, 232, 249, 0.08)',
      }}
    >
      <Link
        href={brandHref}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'rgba(226, 232, 240, 0.75)',
          fontSize: '12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          textDecoration: 'none',
          letterSpacing: '0.04em',
          fontWeight: 400,
        }}
        title={brandTitle}
      >
        <ArrowLeft size={14} />
        <span>{brandLabel}</span>
      </Link>

      <span style={{ color: 'rgba(148, 163, 184, 0.4)' }}>/</span>

      {editingName ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditingName(false);
            if (draft.trim()) onRename(draft.trim());
            else setDraft(vaultName);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(vaultName);
              setEditingName(false);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#f0f9ff',
            fontSize: '14px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            minWidth: '120px',
          }}
        />
      ) : (
        <button
          onClick={() => {
            setDraft(vaultName);
            setEditingName(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f0f9ff',
            fontSize: '14px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            cursor: 'pointer',
            padding: 0,
          }}
          title={t('rename_vault')}
        >
          {vaultName}
        </button>
      )}

      <span
        data-testid="topbar-doc-count"
        data-doc-count={docCount}
        style={{
          fontSize: '11px',
          color: 'rgba(148, 163, 184, 0.55)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          letterSpacing: '0.1em',
        }}
      >
        {docCount === 1 ? t('docs_count_one') : t('docs_count_many', { n: docCount })}
      </span>

      {mode === 'room' && roomId && (
        <div
          title={t('live_room', { id: roomId })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'rgba(52, 211, 153, 0.14)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            fontSize: '10px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: 'rgba(134, 239, 172, 0.95)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          <Radio size={10} />
          {t('live_room', { id: roomId.slice(4) })}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {mode === 'room' && (
        <PeerStack peers={peers} localName={localName} localColor={localColor} />
      )}

      <button
        data-testid="topbar-edges"
        data-pressed={showGraph ? 'true' : 'false'}
        onClick={onToggleGraph}
        style={ghostBtn(showGraph)}
        title={showGraph ? t('edges_hide') : t('edges_show')}
      >
        <Network size={14} /> {t('btn_edges')}
      </button>

      <button
        data-testid="topbar-layout"
        data-layout={layoutMode}
        onClick={onToggleLayout}
        style={ghostBtn(layoutMode === 'cluster')}
        title={layoutMode === 'cluster' ? t('layout_to_rings') : t('layout_to_cluster')}
      >
        <Waypoints size={14} /> {layoutMode === 'cluster' ? t('btn_layout_rings') : t('btn_layout_cluster')}
      </button>

      <button
        data-testid="topbar-semantic"
        data-pressed={showSemantic ? 'true' : 'false'}
        onClick={onToggleSemantic}
        style={ghostBtn(showSemantic)}
        title={showSemantic ? t('semantic_hide') : t('semantic_show')}
      >
        <Sparkles size={14} /> {t('btn_semantic')}
        {showSemantic && <SemanticChip source={semanticSource} progress={semanticProgress} />}
      </button>

      <button
        data-testid="topbar-fps"
        data-pressed={showStats ? 'true' : 'false'}
        onClick={onToggleStats}
        style={ghostBtn(showStats)}
        title={showStats ? t('fps_hide') : t('fps_show')}
      >
        <Gauge size={14} /> {t('btn_fps')}
      </button>

      <button
        data-testid="topbar-seed"
        onClick={() => onSeedMany(50)}
        style={ghostBtn()}
        title={t('seed50_title')}
      >
        <Zap size={14} /> {t('btn_seed50')}
      </button>

      <button
        data-testid="topbar-import"
        onClick={onPickFiles}
        style={ghostBtn(ingesting)}
        disabled={ingesting}
        title={t('import_title')}
      >
        {ingesting ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <FileUp size={14} />
        )}
        {ingesting ? t('btn_import_busy') : t('btn_import_idle')}
      </button>

      <button
        data-testid="topbar-new"
        onClick={onCreate}
        style={primaryBtn}
        title={t('new_title')}
      >
        <Plus size={14} /> {t('btn_new')}
      </button>

      <button
        data-testid="topbar-share"
        onClick={share}
        style={ghostBtn(copied)}
        title={t('share_title')}
      >
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? t('btn_share_done') : t('btn_share_idle')}
      </button>

      {mode === 'solo' ? (
        <button
          data-testid="topbar-collab"
          onClick={onStartCollab}
          style={ghostBtn()}
          title={t('collab_title')}
        >
          <Users size={14} /> {t('btn_collab')}
        </button>
      ) : (
        // Full-nav anchor on purpose: drops any in-flight Yjs state + WebRTC
        // peers cleanly, and sidesteps a Next client-router edge case where
        // router.push from a client room page to the server /vault page
        // doesn't soft-nav under `output: export`.
        <a
          data-testid="topbar-leave"
          href="/vault"
          style={{ ...ghostBtn(), textDecoration: 'none' }}
          title={t('leave_title')}
          onClick={onLeaveRoom}
        >
          <LogOut size={14} /> {t('btn_leave')}
        </a>
      )}
    </div>
  );
}

function PeerStack({
  peers,
  localName,
  localColor,
}: {
  peers: PeerPresence[];
  localName: string;
  localColor: string;
}) {
  const all = [
    { clientId: -1, name: `${localName}${t('peer_you_suffix')}`, color: localColor },
    ...peers,
  ];
  const show = all.slice(0, 5);
  const extra = Math.max(0, all.length - 5);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '999px',
        background: 'rgba(7, 14, 33, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
      title={all.map((p) => p.name).join(', ')}
    >
      {show.map((p) => (
        <span
          key={p.clientId}
          title={p.name}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
      {extra > 0 && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: 'rgba(148, 163, 184, 0.75)',
            marginLeft: 4,
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function SemanticChip({
  source,
  progress,
}: {
  source: SemanticSource;
  progress: number;
}) {
  let label = '';
  let color = 'rgba(226, 232, 240, 0.6)';
  if (source === 'loading') {
    label = `model ${Math.round(progress * 100)}%`;
    color = 'rgba(251, 191, 36, 0.9)';
  } else if (source === 'embedding') {
    label = 'ai';
    color = 'rgba(167, 139, 250, 0.95)';
  } else if (source === 'tfidf') {
    label = 'tf-idf';
    color = 'rgba(103, 232, 249, 0.85)';
  } else {
    return null;
  }
  return (
    <span
      style={{
        marginLeft: 6,
        padding: '1px 6px',
        borderRadius: '6px',
        background: `${color.replace('0.9', '0.18').replace('0.85', '0.16').replace('0.95', '0.18').replace('0.6', '0.12')}`,
        border: `1px solid ${color.replace('0.9', '0.4').replace('0.85', '0.35').replace('0.95', '0.42').replace('0.6', '0.25')}`,
        color,
        fontSize: '9px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 14px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #0ea5e9 0%, #a78bfa 100%)',
  color: '#061225',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 0 20px rgba(103, 232, 249, 0.3)',
};

function ghostBtn(highlight?: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    borderRadius: '999px',
    background: highlight ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
    color: highlight ? 'rgba(52, 211, 153, 0.95)' : 'rgba(226, 232, 240, 0.8)',
    fontSize: '12px',
    letterSpacing: '0.02em',
    border: `1px solid ${highlight ? 'rgba(52, 211, 153, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
    cursor: 'pointer',
  };
}
