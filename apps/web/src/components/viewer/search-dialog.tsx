'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Search, FileText } from 'lucide-react';
import { searchFiles, type SearchResult } from '@/lib/markdown/pipeline';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { db } from '@/lib/storage/db';

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Search as you type — fetch content from IndexedDB
  useEffect(() => {
    if (!activeWorkspaceId || !query) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const doSearch = async () => {
      // Load file content from IndexedDB for search
      const dbFiles = await db.files
        .where('workspaceId')
        .equals(activeWorkspaceId)
        .toArray();

      const searchableFiles = dbFiles.map((f) => ({
        id: f.id,
        filename: f.filename,
        content: f.content,
      }));

      if (cancelled) return;

      const r = searchFiles(searchableFiles, query);
      setResults(r);
      setSelectedIndex(0);
    };

    // Debounce search
    const timer = setTimeout(doSearch, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeWorkspaceId]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setActiveFile(result.fileId);
      setIsOpen(false);
    },
    [setActiveFile]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={() => setIsOpen(false)}>
      <div className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <Search size={20} className="search-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search across all documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-kbd">ESC</kbd>
        </div>

        {results.length > 0 && (
          <div className="search-results">
            {results.map((result, i) => (
              <button
                key={`${result.fileId}-${result.lineNumber}`}
                className={`search-result-item ${i === selectedIndex ? 'search-result-active' : ''}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <FileText size={14} className="search-result-icon" />
                <div className="search-result-content">
                  <span className="search-result-file">{result.filename}</span>
                  <span className="search-result-line">
                    <span className="search-result-ln">L{result.lineNumber}</span>
                    {highlightMatch(result.line, query)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="search-empty">
            <p>No results found for &quot;{query}&quot;</p>
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
