
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, FileText, Sparkles, Type } from 'lucide-react';
import { searchFiles, type SearchResult } from '@/lib/markdown/pipeline';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db } from '@/lib/storage/db';
import { embedQuery, searchEmbeddings, onModelStatus, type ModelStatus, type SimilarityHit } from '@/lib/embeddings';

type Mode = 'text' | 'meaning';

/** Unified row shape for both literal + semantic results. */
interface DisplayRow {
  fileId: string;
  filename: string;
  label: string;       // file display label or fallback
  line: string;        // preview line
  lineNumber?: number;
  score?: number;      // semantic-only
  mode: Mode;
}

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('text');
  const [query, setQuery] = useState('');
  const [textResults, setTextResults] = useState<SearchResult[]>([]);
  const [semResults, setSemResults] = useState<SimilarityHit[]>([]);
  const [semLoading, setSemLoading] = useState(false);
  const [modelStatus, setModelStatusState] = useState<ModelStatus>({ state: 'idle' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const files = useWorkspaceStore((s) => s.files);

  // ⌘K / Ctrl+K — open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Embedding model status — surfaces "downloading…" the first time.
  useEffect(() => onModelStatus(setModelStatusState), []);

  // Focus on open + reset state.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTextResults([]);
      setSemResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Text search — fast, debounced, in-memory grep across all files.
  useEffect(() => {
    if (mode !== 'text' || !activeWorkspaceId || !query) {
      setTextResults([]);
      return;
    }
    let cancelled = false;
    const doSearch = async () => {
      const dbFiles = await db.files.where('workspaceId').equals(activeWorkspaceId).toArray();
      if (cancelled) return;
      const searchable = dbFiles.map((f) => ({ id: f.id, filename: f.filename, content: f.content }));
      const r = searchFiles(searchable, query);
      setTextResults(r);
      setSelectedIndex(0);
    };
    const timer = setTimeout(doSearch, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, activeWorkspaceId, mode]);

  // Semantic search — debounced longer (embedding takes longer than grep).
  useEffect(() => {
    if (mode !== 'meaning' || !activeWorkspaceId || !query.trim()) {
      setSemResults([]);
      setSemLoading(false);
      return;
    }
    let cancelled = false;
    setSemLoading(true);
    const timer = setTimeout(async () => {
      try {
        const v = await embedQuery(query);
        if (cancelled) return;
        const hits = await searchEmbeddings(activeWorkspaceId, v, { topK: 15 });
        if (cancelled) return;
        setSemResults(hits);
        setSelectedIndex(0);
      } catch {
        if (!cancelled) setSemResults([]);
      } finally {
        if (!cancelled) setSemLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, activeWorkspaceId, mode]);

  const rows: DisplayRow[] = mode === 'text'
    ? textResults.map((r) => ({
        fileId: r.fileId,
        filename: r.filename,
        label: files.find((f) => f.id === r.fileId)?.displayName || r.filename,
        line: r.line,
        lineNumber: r.lineNumber,
        mode: 'text',
      }))
    : semResults.map((h) => ({
        fileId: h.fileId,
        filename: files.find((f) => f.id === h.fileId)?.filename || '',
        label: files.find((f) => f.id === h.fileId)?.displayName || 'untitled',
        line: h.preview,
        score: h.score,
        mode: 'meaning',
      }));

  const handleSelect = useCallback(
    (row: DisplayRow) => {
      setActiveFile(row.fileId);
      setIsOpen(false);
    },
    [setActiveFile]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[selectedIndex]) {
      handleSelect(rows[selectedIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setMode((m) => (m === 'text' ? 'meaning' : 'text'));
    }
  };

  if (!isOpen) return null;

  const showDownloadHint = mode === 'meaning' && modelStatus.state === 'loading';
  const downloadPct = showDownloadHint && typeof modelStatus.progress === 'number'
    ? Math.round(modelStatus.progress)
    : null;

  return (
    <div className="search-overlay" onClick={() => setIsOpen(false)}>
      <div className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <Search size={20} className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={mode === 'text' ? 'Search across all documents…' : 'Describe what you\'re looking for…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-mode-toggle" role="tablist" title="Tab to switch">
            <button
              className={`search-mode-btn${mode === 'text' ? ' is-active' : ''}`}
              onClick={() => setMode('text')}
              title="Literal text match (fast)"
            >
              <Type size={11} /> text
            </button>
            <button
              className={`search-mode-btn${mode === 'meaning' ? ' is-active' : ''}`}
              onClick={() => setMode('meaning')}
              title="Semantic search via local embeddings"
            >
              <Sparkles size={11} /> meaning
            </button>
          </div>
          <kbd className="search-kbd">ESC</kbd>
        </div>

        {showDownloadHint && (
          <div className="search-model-status">
            Downloading local embedding model… {downloadPct !== null ? `${downloadPct}%` : ''}
            <div className="search-model-bar"><div style={{ width: `${downloadPct ?? 0}%` }} /></div>
            <span>One-time, ~23 MB. Cached forever after.</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="search-results">
            {rows.map((row, i) => (
              <button
                key={`${row.fileId}-${row.lineNumber ?? row.score ?? i}`}
                className={`search-result-item ${i === selectedIndex ? 'search-result-active' : ''}`}
                onClick={() => handleSelect(row)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <FileText size={14} className="search-result-icon" />
                <div className="search-result-content">
                  <span className="search-result-file">{row.label}</span>
                  <span className="search-result-line">
                    {row.lineNumber !== undefined && (
                      <span className="search-result-ln">L{row.lineNumber}</span>
                    )}
                    {row.score !== undefined && (
                      <span className="search-result-score">{row.score.toFixed(2)}</span>
                    )}
                    {mode === 'text'
                      ? highlightMatch(row.line, query)
                      : <span>{row.line}</span>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {query && !semLoading && rows.length === 0 && !showDownloadHint && (
          <div className="search-empty">
            <p>
              {mode === 'text'
                ? <>No literal match for &quot;{query}&quot;. Press <kbd>Tab</kbd> to search by meaning.</>
                : <>No semantically similar paragraphs yet. Save files at least once to build their embeddings.</>}
            </p>
          </div>
        )}

        {mode === 'meaning' && semLoading && query && (
          <div className="search-empty">
            <p>Embedding query…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <>
      {before}
      <mark className="search-highlight">{match}</mark>
      {after}
    </>
  );
}
