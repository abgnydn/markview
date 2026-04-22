/**
 * Testable exports from mcp-bridge.
 * This module extracts the pure-logic functions for testing
 * without needing WebRTC or Electron.
 */

const fs = require('fs');
const path = require('path');

// ─── Supported File Extensions ───────────────────────────────────────
const SUPPORTED_EXTENSIONS = new Set([
  '.md', '.txt', '.pdf', '.docx', '.doc', '.rtf', '.odt',
  '.rst', '.tex', '.org', '.adoc', '.log',
  '.html', '.htm', '.css', '.svg',
  '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.toml',
  '.ini', '.conf', '.cfg', '.properties',
  '.xlsx', '.xls',
  '.ipynb',
  '.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.swift', '.kt',
  '.php', '.r', '.m', '.scala', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql',
  '.dockerfile', '.tf', '.hcl', '.env.example', '.gitignore',
  '.proto', '.prisma', '.vue', '.svelte',
]);

// ─── File Permissions ────────────────────────────────────────────────
const DEFAULT_BLOCKED_PATTERNS = [
  '*.env', '*.env.*',
  '*.pem', '*.key', '*.p12', '*.pfx',
  '*secret*', '*password*', '*credential*', '*token*',
  '.git/**', 'node_modules/**',
  '*.sqlite', '*.db',
];

function isFileBlocked(filePath, docsDir) {
  const baseDir = docsDir || path.dirname(filePath);
  const relative = path.relative(baseDir, filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();
  const customPatterns = (global && global.vaultBlockedPatterns) || [];
  const allPatterns = [...DEFAULT_BLOCKED_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
      + '$'
    );
    if (regex.test(basename) || regex.test(relative)) return pattern;
  }
  return false;
}

// ─── Find Supported Files ────────────────────────────────────────────
function findSupportedFiles(dir, maxDepth = 5, currentDepth = 0) {
  const files = [];
  if (currentDepth >= maxDepth) return files;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findSupportedFiles(full, maxDepth, currentDepth + 1));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          if (!isFileBlocked(full, dir)) files.push(full);
        }
      }
    }
  } catch (e) {}
  return files;
}

// ─── Search ──────────────────────────────────────────────────────────
async function searchDocs(docsDir, query) {
  const q = query.toLowerCase();
  const files = findSupportedFiles(docsDir);
  const results = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      if (content.toLowerCase().includes(q)) {
        results.push({ file: path.relative(docsDir, f) });
      }
    } catch (e) {}
  }
  return results;
}

module.exports = { findSupportedFiles, isFileBlocked, searchDocs, SUPPORTED_EXTENSIONS, DEFAULT_BLOCKED_PATTERNS };
