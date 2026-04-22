/**
 * MarkView Context Vault — MCP Bridge
 * 
 * Privacy-first, read-only MCP server with:
 * - Markdown, PDF, DOCX support
 * - File-level permission rules (block/allow patterns)
 * - Access logging for every tool call
 * - Approval gate for sensitive files
 */

const { RTCPeerConnection } = require('werift');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Document parsers
let pdfParse, mammoth, XLSX;
try { pdfParse = require('pdf-parse'); } catch (e) { console.warn('[Bridge] pdf-parse not available'); }
try { mammoth = require('mammoth'); } catch (e) { console.warn('[Bridge] mammoth not available'); }
try { XLSX = require('xlsx'); } catch (e) { console.warn('[Bridge] xlsx not available'); }

let pc = null;
let dc = null;
let ws = null;
let docsDir = '';

// ─── Supported File Extensions (40+) ─────────────────────────────────
const SUPPORTED_EXTENSIONS = new Set([
  // Documents
  '.md', '.txt', '.pdf', '.docx', '.doc', '.rtf', '.odt',
  '.rst', '.tex', '.org', '.adoc', '.log',
  // Web
  '.html', '.htm', '.css', '.svg',
  // Data & Config
  '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.toml',
  '.ini', '.conf', '.cfg', '.properties',
  // Spreadsheets
  '.xlsx', '.xls',
  // Notebooks
  '.ipynb',
  // Source code
  '.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.swift', '.kt',
  '.php', '.r', '.m', '.scala', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql',
  // DevOps & Infra
  '.dockerfile', '.tf', '.hcl',
  '.env.example', '.gitignore',
  // Markup
  '.proto', '.prisma', '.vue', '.svelte',
]);

// ─── File Permissions ────────────────────────────────────────────────
// Default blocked patterns — files matching these will be denied
const DEFAULT_BLOCKED_PATTERNS = [
  '*.env', '*.env.*',
  '*.pem', '*.key', '*.p12', '*.pfx',
  '*secret*', '*password*', '*credential*', '*token*',
  '.git/**', 'node_modules/**',
  '*.sqlite', '*.db',
];

function isFileBlocked(filePath) {
  const relative = path.relative(docsDir, filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  // Load custom blocked patterns from config (set via main.js)
  const customPatterns = global.vaultBlockedPatterns || [];
  const allPatterns = [...DEFAULT_BLOCKED_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    // Simple glob matching
    const regex = new RegExp(
      '^' + pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
      + '$'
    );
    if (regex.test(basename) || regex.test(relative)) {
      return pattern; // Return the pattern that blocked it
    }
  }
  return false;
}

// ─── Document Text Extraction ────────────────────────────────────────
// Formats that can be read directly as UTF-8 text
const PLAIN_TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.csv', '.tsv', '.xml', '.yaml', '.yml',
  '.html', '.htm', '.css', '.svg', '.rst', '.tex', '.log', '.rtf',
  '.org', '.adoc', '.toml', '.ini', '.conf', '.cfg', '.properties',
  '.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.swift', '.kt',
  '.php', '.r', '.m', '.scala', '.sh', '.bash', '.zsh',
  '.sql', '.graphql', '.gql',
  '.dockerfile', '.tf', '.hcl', '.env.example', '.gitignore',
  '.proto', '.prisma', '.vue', '.svelte',
]);

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  // Plain text formats (largest category)
  if (PLAIN_TEXT_EXTENSIONS.has(ext) || PLAIN_TEXT_EXTENSIONS.has(basename)) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  // PDF
  if (ext === '.pdf' && pdfParse) {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }

  // DOCX / ODT
  if ((ext === '.docx' || ext === '.doc' || ext === '.odt') && mammoth) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  // Excel spreadsheets
  if ((ext === '.xlsx' || ext === '.xls') && XLSX) {
    const workbook = XLSX.readFile(filePath);
    const sheets = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
    return sheets.join('\n\n');
  }

  // Jupyter Notebooks
  if (ext === '.ipynb') {
    const nb = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const cells = (nb.cells || []).map((cell, i) => {
      const type = cell.cell_type || 'unknown';
      const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
      return `[${type.toUpperCase()} Cell ${i + 1}]\n${source}`;
    });
    return cells.join('\n\n');
  }

  return `[Unsupported format: ${ext}]`;
}

// ─── Find All Supported Files ────────────────────────────────────────
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
          // Skip if blocked by permissions
          if (!isFileBlocked(full)) {
            files.push(full);
          }
        }
      }
    }
  } catch (e) {
    // Permission denied, etc.
  }
  return files;
}

// ─── WebRTC & MCP Connection ─────────────────────────────────────────
let currentRoomId = '';
let currentSignalingUrl = '';
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

async function startMCPBridge(docsPaths, roomId, signalingUrl = 'ws://localhost:4445') {
  // Support both single path (string) and multi-folder (array)
  if (typeof docsPaths === 'string') {
    docsDir = docsPaths;
    global.vaultDocsDirs = [docsPaths];
  } else if (Array.isArray(docsPaths)) {
    docsDir = docsPaths[0]; // Primary dir for backward compat
    global.vaultDocsDirs = docsPaths;
  }

  currentRoomId = roomId;
  currentSignalingUrl = signalingUrl;
  reconnectAttempts = 0;

  await createConnection(roomId, signalingUrl);
}

async function createConnection(roomId, signalingUrl) {
  // Cleanup any existing connection
  if (dc) { try { dc.close(); } catch(e) {} dc = null; }
  if (pc) { try { pc.close(); } catch(e) {} pc = null; }
  if (ws) { try { ws.close(); } catch(e) {} ws = null; }

  pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  dc = pc.createDataChannel('mcp');

  dc.onMessage.subscribe((data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMCPMessage(msg);
    } catch (e) {
      console.error('[Bridge] Message parse error:', e);
    }
  });

  dc.stateChanged.subscribe((state) => {
    console.log(`[Bridge] DataChannel state: ${state}`);
    if (state === 'open') {
      reconnectAttempts = 0; // Reset on successful connection
      console.log('[Bridge] ✅ Data channel open — MCP ready');
    }
  });

  pc.onIceCandidate.subscribe((candidate) => {
    if (candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'candidate', room: roomId, candidate: candidate.toJSON() }));
    }
  });

  pc.connectionStateChange.subscribe((state) => {
    console.log(`[Bridge] Connection state: ${state}`);
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      scheduleReconnect();
    }
  });

  ws = new WebSocket(signalingUrl);

  ws.on('open', () => {
    console.log('[Bridge] Connected to signaling server');
    ws.send(JSON.stringify({ type: 'join', room: roomId }));
  });

  ws.on('message', async (message) => {
    const msg = JSON.parse(message.toString());
    if (msg.room !== roomId) return;

    if (msg.type === 'answer' && msg.answer) {
      await pc.setRemoteDescription(msg.answer);
    } else if (msg.type === 'candidate' && msg.candidate) {
      await pc.addIceCandidate(msg.candidate);
    } else if (msg.type === 'peer_joined') {
      console.log('[Bridge] Peer joined, sending offer');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'offer', room: roomId, offer: pc.localDescription }));
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] WebSocket closed');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[Bridge] WebSocket error:', err.message);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return; // Already scheduled

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
  console.log(`[Bridge] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await createConnection(currentRoomId, currentSignalingUrl);
    } catch (e) {
      console.error('[Bridge] Reconnect failed:', e.message);
      scheduleReconnect();
    }
  }, delay);
}

// ─── MCP Protocol Handler ────────────────────────────────────────────
function handleMCPMessage(msg) {
  if (!msg.method) return;

  if (msg.method === 'initialize') {
    sendResponse(msg.id, {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'markview-context-vault', version: '0.2.0' },
    });
    return;
  }

  if (msg.method === 'notifications/initialized') return;

  if (msg.method === 'tools/list') {
    sendResponse(msg.id, {
      tools: [
        {
          name: 'list_documents',
          description: 'List all documents in the vault (markdown, PDF, DOCX, text). Read-only.',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'get_document',
          description: 'Read a document. Supports .md, .txt, .pdf, .docx. Read-only; sensitive files require user approval.',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string', description: 'Relative path to the document' } },
            required: ['path'],
          },
        },
        {
          name: 'search_docs',
          description: 'Full-text keyword search across all documents. Read-only.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Search query' } },
            required: ['query'],
          },
        },
      ],
    });
    return;
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params || {};
    executeToolAsync(name, args || {}, msg.id);
    return;
  }

  sendError(msg.id, -32601, `Method not found: ${msg.method}`);
}

async function executeToolAsync(name, args, msgId) {
  try {
    const result = await executeTool(name, args);

    // Log every access
    if (global.vaultLogAccess) {
      global.vaultLogAccess(name, args, result);
    }

    sendResponse(msgId, { content: [{ type: 'text', text: JSON.stringify(result) }] });
  } catch (err) {
    // Log denied accesses too
    if (global.vaultLogAccess) {
      global.vaultLogAccess(name, args, { error: err.message });
    }
    sendResponse(msgId, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true });
  }
}

async function executeTool(name, args) {
  switch (name) {
    case 'list_documents': {
      const allDirs = global.vaultDocsDirs || [docsDir];
      const allFiles = [];
      for (const dir of allDirs) {
        allFiles.push(...findSupportedFiles(dir).map(f => ({ file: f, baseDir: dir })));
      }
      return {
        documents: allFiles.map(({ file: f, baseDir }) => {
          const relative = path.relative(baseDir, f);
          const stat = fs.statSync(f);
          const ext = path.extname(f).toLowerCase();
          const folderLabel = allDirs.length > 1 ? path.basename(baseDir) : null;
          return {
            name: relative,
            folder: folderLabel,
            type: ext.replace('.', '').toUpperCase(),
            size: stat.size,
            sizeHuman: formatBytes(stat.size),
          };
        }),
        totalFiles: allFiles.length,
        folders: allDirs.map(d => path.basename(d)),
        supportedFormats: 'md, txt, pdf, docx, json, csv, xml, yaml, html',
      };
    }

    case 'get_document': {
      // Search across all vault dirs
      const allDirs = global.vaultDocsDirs || [docsDir];
      let filePath = null;
      let resolvedDir = null;
      for (const dir of allDirs) {
        const candidate = path.resolve(dir, args.path);
        if (candidate.startsWith(dir) && fs.existsSync(candidate)) {
          filePath = candidate;
          resolvedDir = dir;
          break;
        }
      }
      if (!filePath) throw new Error(`File not found: ${args.path}`);

      // File permissions check
      const blockedBy = isFileBlocked(filePath);
      if (blockedBy) {
        throw new Error(`Access denied: file blocked by permission rule "${blockedBy}"`);
      }

      // Approval Gate
      if (global.vaultApproveAccess) {
        const approved = await global.vaultApproveAccess(filePath);
        if (!approved) throw new Error('Access denied by user');
      }

      const content = await extractText(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return {
        path: args.path,
        type: ext.replace('.', '').toUpperCase(),
        content,
        charCount: content.length,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      };
    }

    case 'search_docs': {
      const query = (args.query || '').toLowerCase();
      if (!query) throw new Error('Query is required');

      const allDirs = global.vaultDocsDirs || [docsDir];
      const results = [];

      for (const dir of allDirs) {
        const files = findSupportedFiles(dir);
        for (const f of files) {
          try {
            const content = await extractText(f);
            if (content.toLowerCase().includes(query)) {
              const lines = content.split('\n');
              const matchingLines = lines
                .map((line, i) => ({ line: i + 1, text: line.trim() }))
                .filter((l) => l.text.toLowerCase().includes(query))
                .slice(0, 3);
              results.push({
                file: path.relative(dir, f),
                folder: allDirs.length > 1 ? path.basename(dir) : undefined,
                type: path.extname(f).replace('.', '').toUpperCase(),
                matches: matchingLines,
              });
            }
          } catch (e) { /* Skip unreadable files */ }
        }
      }
      return { query: args.query, results, totalMatches: results.length };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Utilities ───────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function sendResponse(id, result) {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
  }
}

function sendError(id, code, message) {
  if (dc && dc.readyState === 'open') {
    dc.send(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
  }
}

function stopMCPBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (dc) { try { dc.close(); } catch(e) {} dc = null; }
  if (pc) { try { pc.close(); } catch(e) {} pc = null; }
  if (ws) { try { ws.close(); } catch(e) {} ws = null; }
}

function getBridgeStatus() {
  return {
    connected: dc ? dc.readyState === 'open' : false,
    docsDir,
    supportedFormats: [...SUPPORTED_EXTENSIONS].map(e => e.replace('.', '')),
  };
}

module.exports = { startMCPBridge, stopMCPBridge, getBridgeStatus };
