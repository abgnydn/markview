'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { VaultOrbit } from './vault-orbit';
import { useBrainDocs } from './use-brain-docs';
import { focusIterm } from '@/lib/brain-hub-client';
import type { VaultDoc } from './vault-store';
import styles from './brain-experience.module.css';

type LayoutMode = 'ring' | 'cluster';

export function BrainExperience(): React.JSX.Element {
  const { docs, loading, error, refresh } = useBrainDocs();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('ring');
  const [showGraph, setShowGraph] = useState(true);
  const [query, setQuery] = useState('');

  const filteredDocs = useMemo<VaultDoc[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.project ?? '').toLowerCase().includes(q) ||
        (d.docType ?? '').toLowerCase().includes(q) ||
        (d.slot ?? '').toLowerCase().includes(q),
    );
  }, [docs, query]);

  const active = useMemo(
    () => docs.find((d) => d.id === activeId) ?? null,
    [docs, activeId],
  );

  const stats = useMemo(() => {
    const sessions = docs.filter((d) => d.docType === 'claude-session');
    const needsInput = sessions.filter((d) => d.status === 'Needs Input').length;
    const totalCost = sessions.reduce((a, d) => a + (d.cost_usd ?? 0), 0);
    return {
      total: docs.length,
      sessions: sessions.length,
      needsInput,
      totalCost,
      projects: docs.filter((d) => d.slot === 'projects').length,
      experiments: docs.filter((d) => d.slot === 'experiments').length,
    };
  }, [docs]);

  const handleFocus = useCallback(async () => {
    if (!active?.pid) return;
    await focusIterm(active.pid);
  }, [active]);

  return (
    <div className={styles.page}>
      <div className={styles.canvas}>
        {loading && docs.length === 0 ? (
          <div className={styles.loading}>loading vault…</div>
        ) : (
          <VaultOrbit
            docs={filteredDocs}
            activeId={activeId}
            peers={[]}
            onSelect={setActiveId}
            showGraph={showGraph}
            layoutMode={layoutMode}
          />
        )}
      </div>

      <header className={styles.hud}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>◈</span>
          <span>brain</span>
        </Link>
        <div className={styles.stats}>
          <Stat label="docs" value={stats.total} />
          <Stat label="projects" value={stats.projects} />
          <Stat label="experiments" value={stats.experiments} />
          <Stat label="sessions" value={stats.sessions} tint="rose" />
          <Stat label="needs input" value={stats.needsInput} tint="warn" />
          <Stat label="total cost" value={`$${stats.totalCost.toFixed(0)}`} />
        </div>
        <input
          className={styles.query}
          placeholder="filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.toggles}>
          <button
            type="button"
            className={`${styles.toggle} ${layoutMode === 'ring' ? styles.toggleOn : ''}`}
            onClick={() => setLayoutMode('ring')}
          >
            ring
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${layoutMode === 'cluster' ? styles.toggleOn : ''}`}
            onClick={() => setLayoutMode('cluster')}
          >
            cluster
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${showGraph ? styles.toggleOn : ''}`}
            onClick={() => setShowGraph((v) => !v)}
          >
            edges
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>hub: {error} — is apps/hub running on :3100?</div>}

      {active && <DetailPanel doc={active} onClose={() => setActiveId(null)} onFocus={handleFocus} />}
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string | number;
  tint?: 'rose' | 'warn';
}): React.JSX.Element {
  const tintClass =
    tint === 'rose' ? styles.tintRose : tint === 'warn' ? styles.tintWarn : '';
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${tintClass}`}>{value}</span>
    </div>
  );
}

interface DetailPanelProps {
  doc: VaultDoc;
  onClose: () => void;
  onFocus: () => void | Promise<void>;
}

function DetailPanel({ doc, onClose, onFocus }: DetailPanelProps): React.JSX.Element {
  const isSession = doc.docType === 'claude-session';
  return (
    <aside className={styles.detail}>
      <button type="button" className={styles.detailClose} onClick={onClose} aria-label="close">
        ×
      </button>
      <div className={styles.detailTint} data-tint={doc.tint} />
      <h2 className={styles.detailTitle}>{doc.title}</h2>
      <div className={styles.detailMeta}>
        {doc.docType && <span className={styles.metaChip}>{doc.docType}</span>}
        {doc.slot && <span className={styles.metaChip}>{doc.slot}</span>}
        {doc.sensitivity && (
          <span className={`${styles.metaChip} ${styles.metaChipSensitivity}`}>
            {doc.sensitivity}
          </span>
        )}
      </div>
      {isSession && (
        <>
          <dl className={styles.detailStats}>
            {doc.pid !== undefined && <Kv k="pid" v={doc.pid} />}
            {doc.project && <Kv k="project" v={doc.project} />}
            {doc.status && <Kv k="status" v={doc.status} />}
            {doc.cost_usd !== undefined && <Kv k="cost" v={`$${doc.cost_usd.toFixed(2)}`} />}
            {doc.context_pct !== undefined && (
              <Kv k="context" v={`${doc.context_pct.toFixed(1)}%`} />
            )}
          </dl>
          {doc.pid && (
            <button type="button" className={styles.detailAction} onClick={() => void onFocus()}>
              focus iTerm →
            </button>
          )}
          {doc.files_modified && doc.files_modified.length > 0 && (
            <>
              <h3 className={styles.detailHeading}>Files modified</h3>
              <ul className={styles.filesList}>
                {doc.files_modified.slice(0, 8).map(([path, edits]) => (
                  <li key={path} className={styles.fileRow}>
                    <span className={styles.filePath} title={path}>
                      {shortPath(path)}
                    </span>
                    <span className={styles.fileCount}>{edits}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {!isSession && doc.content && (
        <pre className={styles.detailContent}>{doc.content.slice(0, 1200)}</pre>
      )}
    </aside>
  );
}

function Kv({ k, v }: { k: string; v: string | number }): React.JSX.Element {
  return (
    <div className={styles.kvRow}>
      <dt className={styles.kvKey}>{k}</dt>
      <dd className={styles.kvValue}>{v}</dd>
    </div>
  );
}

function shortPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `.../${parts.slice(-3).join('/')}`;
}
