'use client';

import React, { useState, useCallback } from 'react';
import { Globe, Loader2, AlertCircle } from 'lucide-react';

interface GitHubImportProps {
  onFilesLoaded: (files: { filename: string; content: string }[], repoName: string) => void;
}

export function GitHubImport({ onFilesLoaded }: GitHubImportProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback(async () => {
    setError(null);
    if (!url.trim()) return;

    // Parse GitHub URL
    // Supports: https://github.com/owner/repo, /tree/branch/path, /blob/branch/file.md
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/?(.*)|\/blob\/([^/]+)\/(.*)|\/?)$/);
    if (!match) {
      setError('Please enter a valid GitHub URL (e.g., github.com/owner/repo or github.com/owner/repo/tree/main/docs)');
      return;
    }

    const [, owner, repo, treeBranch, treePath, blobBranch, blobPath] = match;
    const branch = treeBranch || blobBranch || 'main';
    const path = treePath || blobPath || '';
    const repoName = repo.replace(/\.git$/, '');

    // Security: validate extracted segments contain only safe characters
    const safeSegment = /^[a-zA-Z0-9._-]+$/;
    if (!safeSegment.test(owner) || !safeSegment.test(repoName)) {
      setError('Invalid GitHub owner or repository name.');
      return;
    }

    setIsLoading(true);

    try {
      if (blobPath) {
        // Single file
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${blobPath}`;
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`);
        const content = await res.text();
        const filename = blobPath.split('/').pop() || 'file.md';
        onFilesLoaded([{ filename, content }], repoName);
      } else {
        // Directory — use GitHub API to list contents
        const apiUrl = path
          ? `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`
          : `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`;

        const res = await fetch(apiUrl);
        if (!res.ok) {
          if (res.status === 403) throw new Error('GitHub API rate limit exceeded. Try again later.');
          throw new Error(`Failed to fetch repo tree (${res.status})`);
        }

        const data = await res.json();
        const mdFiles = (data.tree || []).filter((item: { path: string; type: string }) => {
          if (item.type !== 'blob') return false;
          if (!item.path.match(/\.(md|markdown)$/i)) return false;
          if (path && !item.path.startsWith(path)) return false;
          return true;
        });

        if (mdFiles.length === 0) {
          throw new Error('No markdown files found in this repository/path.');
        }

        // Fetch each file's content
        const files: { filename: string; content: string }[] = [];
        const batchSize = 5;

        for (let i = 0; i < mdFiles.length; i += batchSize) {
          const batch = mdFiles.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (item: { path: string }) => {
              const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${item.path}`;
              const res = await fetch(rawUrl);
              if (!res.ok) return null;
              const content = await res.text();
              // Strip the prefix path to get relative path
              const filename = path ? item.path.slice(path.length).replace(/^\//, '') : item.path;
              return { filename, content };
            })
          );
          files.push(...results.filter(Boolean) as { filename: string; content: string }[]);
        }

        if (files.length > 0) {
          onFilesLoaded(files, repoName);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import from GitHub');
    } finally {
      setIsLoading(false);
    }
  }, [url, onFilesLoaded]);

  return (
    <div className="github-import">
      <div className="github-import-input-row">
        <Globe size={18} className="github-import-icon" />
        <input
          type="text"
          className="github-import-input"
          placeholder="Paste GitHub URL (e.g., github.com/owner/repo/tree/main/docs)"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
          disabled={isLoading}
        />
        <button
          className="github-import-btn"
          onClick={handleImport}
          disabled={isLoading || !url.trim()}
        >
          {isLoading ? <Loader2 size={16} className="spin" /> : 'Import'}
        </button>
      </div>
      {error && (
        <div className="github-import-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
