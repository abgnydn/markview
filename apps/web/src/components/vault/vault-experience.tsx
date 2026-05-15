'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VaultOrbit } from './vault-orbit';
import { VaultModal } from './vault-modal';
import { VaultTopbar, type VaultBrand } from './vault-topbar';
import { useVault } from './use-vault';
import { generateRoomId } from '@/lib/collab/y-provider';
import type { SemanticSource } from './use-semantic-edges';
import { INGEST_ACCEPT, isIngestable } from './vault-ingest';
import { t, setLocale, type Locale } from '@/i18n';
import type { VaultDoc } from './vault-store';

interface VaultExperienceProps {
  roomId?: string | null;
  /** Brand chrome on topbar + back-link target. Defaults to 'markview'. */
  brand?: VaultBrand;
  /** Lock the locale before render (overrides URL/nav detection). DavaKasası
   *  pages set this to 'tr' so the lawyer never sees English copy by accident. */
  forceLocale?: Locale;
}

export function VaultExperience({
  roomId = null,
  brand = 'markview',
  forceLocale,
}: VaultExperienceProps) {
  // Lock the locale synchronously *before* any t() call in this render. Effects
  // can't reach this — t() is called during render in deeply-nested children.
  if (forceLocale) setLocale(forceLocale);
  const router = useRouter();
  const [showStats, setShowStats] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [showSemantic, setShowSemantic] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'ring' | 'cluster'>('ring');
  const [semanticSource, setSemanticSource] = useState<SemanticSource>('off');
  const [semanticProgress, setSemanticProgress] = useState(0);

  const handleSemanticStatus = useCallback(
    (source: SemanticSource, progress: number) => {
      setSemanticSource(source);
      setSemanticProgress(progress);
    },
    [],
  );

  const {
    state,
    mode,
    peers,
    ready,
    localName,
    localColor,
    activeId,
    setActiveId,
    create,
    update,
    remove,
    rename,
    seedMany,
    ingestFiles,
    getShareUrl,
  } = useVault(roomId);

  const [dragOver, setDragOver] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestToast, setIngestToast] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const runIngest = useCallback(
    async (files: File[] | FileList) => {
      if (!files || (files as FileList).length === 0) return;
      setIngesting(true);
      try {
        const report = await ingestFiles(files);
        if (report.firstId) setActiveId(report.firstId);
        const parts: string[] = [];
        if (report.ingested > 0) {
          parts.push(
            report.ingested === 1
              ? t('toast_added_one')
              : t('toast_added_many', { n: report.ingested }),
          );
        }
        if (report.skipped > 0) {
          parts.push(
            report.skipped === 1
              ? t('toast_skipped_one')
              : t('toast_skipped_many', { n: report.skipped }),
          );
        }
        if (parts.length === 0) parts.push(t('toast_none_supported'));
        setIngestToast(parts.join(' · '));
        setTimeout(() => setIngestToast(null), 3200);
      } finally {
        setIngesting(false);
      }
    },
    [ingestFiles, setActiveId],
  );

  const onPickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await runIngest(files);
      }
      // Reset so the same file can be picked again.
      e.target.value = '';
    },
    [runIngest],
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const hasAny = files.some(isIngestable);
        if (!hasAny) {
          setIngestToast(t('toast_unsupported'));
          setTimeout(() => setIngestToast(null), 3200);
          return;
        }
        await runIngest(files);
      }
    },
    [runIngest],
  );

  const onStartCollab = useCallback(() => {
    const newRoomId = generateRoomId();
    router.push(`/vault/room?id=${newRoomId}`);
  }, [router]);

  const onLeaveRoom = useCallback(() => {
    // Hard nav on purpose — `router.push('/vault')` from a client-component
    // room page to the server-component /vault page doesn't reliably soft-nav
    // under Next's static-export config, leaving the user stuck in the room.
    // Clean-break is also the right semantic for "leave": drops any in-flight
    // Yjs state + WebRTC peers cleanly.
    if (typeof window !== 'undefined') {
      window.location.href = '/vault';
    }
  }, []);

  const onShare = useCallback(async () => {
    // If we're still solo, sharing has to mean "start a room first."
    // Mint one, route into it, then the user can hit Share again for the room URL.
    if (mode === 'solo') {
      const newRoomId = generateRoomId();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      router.push(`/vault/room?id=${newRoomId}`);
      return `${origin}/vault/room?id=${newRoomId}`;
    }
    return getShareUrl();
  }, [mode, getShareUrl, router]);

  const activeDoc = activeId ? state.docs.find((d) => d.id === activeId) : null;

  const tintLabels = undefined;

  // Dev-only test hook so Playwright can drive canvas-panel selection
  // without raycasting pixels. Stripped in production builds (NODE_ENV check).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as {
      __vaultTest?: Record<string, unknown>;
    };
    w.__vaultTest = {
      getDocs: () => state.docs.map((d) => ({ id: d.id, title: d.title, tint: d.tint })),
      getActiveId: () => activeId,
      getPeerCount: () => peers.length,
      getMode: () => mode,
      getRoomId: () => roomId,
      getSemanticSource: () => semanticSource,
      create,
      selectById: (id: string) => setActiveId(id),
      selectByIndex: (i: number) => setActiveId(state.docs[i]?.id ?? null),
      clearActive: () => setActiveId(null),
    };
    return () => {
      if (w.__vaultTest) delete w.__vaultTest;
    };
  }, [state.docs, activeId, peers.length, mode, roomId, semanticSource, create, setActiveId]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#020617' }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={INGEST_ACCEPT}
        onChange={onFileInput}
        data-testid="vault-file-input"
        style={{ display: 'none' }}
      />

      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <VaultOrbit
          docs={state.docs}
          activeId={activeId}
          peers={peers}
          onSelect={setActiveId}
          showStats={showStats}
          showGraph={showGraph}
          showSemantic={showSemantic}
          layoutMode={layoutMode}
          onSemanticStatus={handleSemanticStatus}
        />
      </div>

      <VaultTopbar
        vaultName={state.name}
        docCount={state.docs.length}
        mode={mode}
        roomId={roomId}
        peers={peers}
        localName={localName}
        localColor={localColor}
        onRename={rename}
        onCreate={create}
        onShare={onShare}
        onStartCollab={onStartCollab}
        onLeaveRoom={onLeaveRoom}
        onSeedMany={seedMany}
        onPickFiles={onPickFiles}
        ingesting={ingesting}
        showStats={showStats}
        onToggleStats={() => setShowStats((v) => !v)}
        showGraph={showGraph}
        onToggleGraph={() => setShowGraph((v) => !v)}
        showSemantic={showSemantic}
        onToggleSemantic={() => setShowSemantic((v) => !v)}
        semanticSource={semanticSource}
        semanticProgress={semanticProgress}
        layoutMode={layoutMode}
        onToggleLayout={() =>
          setLayoutMode((m) => (m === 'ring' ? 'cluster' : 'ring'))
        }
        brand={brand}
      />

      {ready && state.docs.length === 0 && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '12vh',
            transform: 'translateX(-50%)',
            zIndex: 10,
            color: 'rgba(203, 213, 225, 0.75)',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.08em',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {mode === 'room' ? t('empty_room') : t('empty_solo')}{' '}
          {t('empty_press_prefix')}
          <span
            style={{
              display: 'inline-block',
              margin: '0 6px',
              padding: '2px 8px',
              border: '1px solid rgba(103, 232, 249, 0.35)',
              borderRadius: '6px',
              color: '#67e8f9',
            }}
          >
            {t('empty_new_chip')}
          </span>
          {t('empty_to_begin')}
        </div>
      )}

      {ready && state.docs.length > 0 && !activeDoc && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '4vh',
            transform: 'translateX(-50%)',
            zIndex: 10,
            color: 'rgba(148, 163, 184, 0.55)',
            fontSize: '11px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}
        >
          {t('hint_click_panel')}
          {mode === 'room' && peers.length > 0
            ? peers.length === 1
              ? t('hint_peers_online_one')
              : t('hint_peers_online_many', { n: peers.length })
            : ''}
        </div>
      )}

      {activeDoc && (
        <VaultModal
          doc={activeDoc}
          docs={state.docs}
          onSelect={setActiveId}
          tintLabels={tintLabels}
          onSave={(patch) => update(activeDoc.id, patch)}
          onDelete={() => remove(activeDoc.id)}
          onClose={() => setActiveId(null)}
        />
      )}

      {dragOver && (
        <div
          data-testid="vault-dropzone"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at 50% 55%, rgba(167, 139, 250, 0.22) 0%, rgba(2, 6, 23, 0.82) 70%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px) saturate(140%)',
            WebkitBackdropFilter: 'blur(6px) saturate(140%)',
          }}
        >
          <div
            style={{
              padding: '28px 44px',
              borderRadius: '20px',
              border: '1.5px dashed rgba(167, 139, 250, 0.55)',
              background: 'rgba(15, 23, 42, 0.55)',
              boxShadow: '0 0 60px rgba(167, 139, 250, 0.25)',
              color: '#f0f9ff',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              textAlign: 'center',
              maxWidth: '520px',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              {t('dropzone_heading')}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(203, 213, 225, 0.75)',
                letterSpacing: '0.06em',
                lineHeight: 1.55,
              }}
            >
              {t('dropzone_formats')}
              <br />
              {t('dropzone_assurance')}
            </div>
          </div>
        </div>
      )}

      {(ingesting || ingestToast) && (
        <div
          data-testid="vault-ingest-toast"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '8vh',
            transform: 'translateX(-50%)',
            zIndex: 45,
            padding: '10px 18px',
            borderRadius: '999px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(167, 139, 250, 0.35)',
            boxShadow: '0 0 24px rgba(167, 139, 250, 0.25)',
            color: '#e0e7ff',
            fontSize: '12px',
            letterSpacing: '0.04em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          {ingesting ? t('toast_ingesting') : ingestToast}
        </div>
      )}
    </div>
  );
}
