/**
 * MarkView Context Vault — Main Electron Process
 * 
 * Privacy-first, read-only AI document bridge.
 * 
 * Features:
 * - Zero-config menu bar app with folder picker
 * - One-click Connect to Claude Desktop / Cursor
 * - Access Log: every file the AI touches is logged
 * - Approval Gate: native popup before sharing sensitive files
 * - Auto-start on login
 */

const { app, Tray, Menu, dialog, nativeImage, shell, Notification, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startSignaling, stopSignaling } = require('./signaling');
const { startMCPBridge, stopMCPBridge } = require('./mcp-bridge');

// ─── Config ──────────────────────────────────────────────────────────
const VERSION = '0.2.0';
const PORT = 4445;
const ROOM_ID = 'local-vault';
const CONFIG_PATH = path.join(app.getPath('userData'), 'vault-config.json');
const ACCESS_LOG_PATH = path.join(app.getPath('userData'), 'access-log.json');

// Show in dock with proper icon

let tray = null;
let docsPaths = [];
let isRunning = false;
let accessLog = [];
let dashboardWindow = null;
let welcomeWindow = null;

// ─── Config Persistence ──────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  const existing = loadConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
}

// ─── Access Log ──────────────────────────────────────────────────────
function loadAccessLog() {
  try {
    accessLog = JSON.parse(fs.readFileSync(ACCESS_LOG_PATH, 'utf-8'));
  } catch {
    accessLog = [];
  }
}

function logAccess(toolName, args, result) {
  const entry = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    args,
    fileAccessed: args?.path || null,
    resultSize: typeof result === 'string' ? result.length : JSON.stringify(result).length,
  };
  accessLog.push(entry);
  // Keep last 500 entries
  if (accessLog.length > 500) accessLog = accessLog.slice(-500);
  try {
    fs.writeFileSync(ACCESS_LOG_PATH, JSON.stringify(accessLog, null, 2));
  } catch (e) {
    console.error('[AccessLog] Write failed:', e.message);
  }
}

// Expose logAccess globally so mcp-bridge can use it
global.vaultLogAccess = logAccess;

// ─── Approval Gate ───────────────────────────────────────────────────
async function approveFileAccess(filePath) {
  const config = loadConfig();
  if (config.approvalMode === 'allow-all') return true;
  if (config.approvalMode === 'deny-all') return false;

  // Default: ask for sensitive files
  const sensitivePatterns = ['.env', 'secret', 'password', 'token', 'key', 'credential', 'private'];
  const fileName = path.basename(filePath).toLowerCase();
  const isSensitive = sensitivePatterns.some(p => fileName.includes(p));

  if (!isSensitive) return true;

  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'MarkView Vault — File Access Request',
    message: `AI wants to read a sensitive file`,
    detail: `File: ${filePath}\n\nThis file matches a sensitive pattern. Do you want to allow AI to read it?`,
    buttons: ['Allow Once', 'Allow All Files', 'Deny'],
    defaultId: 2,
    cancelId: 2,
  });

  if (result.response === 0) return true; // Allow once
  if (result.response === 1) {
    saveConfig({ approvalMode: 'allow-all' });
    return true;
  }
  return false;
}

// Expose approval gate globally
global.vaultApproveAccess = approveFileAccess;

// ─── Privacy Dashboard Window ────────────────────────────────────────
function openPrivacyDashboard() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 700,
    height: 600,
    title: 'Privacy Dashboard',
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'dashboard-preload.js'),
    },
  });

  // Inject the access log data before loading
  dashboardWindow.webContents.on('did-finish-load', () => {
    dashboardWindow.webContents.executeJavaScript(`
      window.__VAULT_DATA__ = ${JSON.stringify({ accessLog, blockedPatterns: global.vaultBlockedPatterns || [] })};
      // Re-run the dashboard script
      document.dispatchEvent(new Event('vault-data-ready'));
    `);
  });

  dashboardWindow.loadFile(path.join(__dirname, 'privacy-dashboard.html'));
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
}

// ─── Welcome Window ──────────────────────────────────────────────────
function showWelcomeWindow() {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.focus();
    return;
  }

  welcomeWindow = new BrowserWindow({
    width: 460,
    height: 620,
    title: 'MarkView Context Vault',
    backgroundColor: '#08061a',
    titleBarStyle: 'hiddenInset',
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'welcome-preload.js'),
    },
  });

  welcomeWindow.loadFile(path.join(__dirname, 'welcome.html'));
  welcomeWindow.on('closed', () => {
    welcomeWindow = null;
  });
}

ipcMain.on('close-welcome', () => {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.close();
  }
});

// ─── File Permissions Dialog ─────────────────────────────────────────
async function showPermissionsDialog() {
  const config = loadConfig();
  const customPatterns = config.blockedPatterns || [];
  const currentList = customPatterns.length > 0
    ? customPatterns.join(', ')
    : '(none — using defaults only)';

  const result = await dialog.showMessageBox({
    type: 'question',
    title: 'File Permissions',
    message: 'Manage blocked file patterns',
    detail:
      'Default blocked patterns (always active):\n' +
      '  *.env, *.pem, *.key, *secret*, *password*, *credential*, *token*, .git/**, node_modules/**, *.sqlite, *.db\n\n' +
      `Custom blocked patterns:\n  ${currentList}\n\n` +
      'Choose an action:',
    buttons: ['Add Custom Pattern', 'Clear Custom Patterns', 'Cancel'],
    defaultId: 2,
    cancelId: 2,
  });

  if (result.response === 0) {
    // Add a custom pattern
    const input = await dialog.showMessageBox({
      type: 'question',
      title: 'Add Blocked Pattern',
      message: 'Enter a glob pattern to block',
      detail: 'Examples: *.pdf, contracts/*, *confidential*',
      buttons: ['Cancel'],
    });
    // Since showMessageBox can't take text input, use showOpenDialog trick
    // For now just show a prompt-like experience
    const { response } = await dialog.showMessageBox({
      type: 'info',
      message: 'To add custom patterns, edit the config file:',
      detail: `${CONFIG_PATH}\n\nAdd a "blockedPatterns" array, e.g.:\n{\n  "blockedPatterns": ["*.pdf", "contracts/*"]\n}`,
      buttons: ['Open Config File', 'Cancel'],
    });
    if (response === 0) {
      shell.openPath(CONFIG_PATH);
    }
  } else if (result.response === 1) {
    saveConfig({ blockedPatterns: [] });
    global.vaultBlockedPatterns = [];
    dialog.showMessageBox({ message: 'Custom patterns cleared. Default patterns still active.' });
  }
}

// ─── Claude Desktop Integration ──────────────────────────────────────
function getClaudeConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  }
  return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json');
}

function getCursorConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }
  return path.join(os.homedir(), '.cursor', 'mcp.json');
}

function connectToMCPClient(configPath, clientName) {
  if (docsPaths.length === 0) {
    dialog.showErrorBox('MarkView Vault', 'Please select a folder first.');
    return;
  }

  try {
    // Ensure the directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read existing config or create empty
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Ensure mcpServers key exists
    if (!config.mcpServers) config.mcpServers = {};

    // Find the MCP server index.ts path
    const mcpServerPath = path.join(__dirname, '..', 'mcp', 'src', 'index.ts');

    // Add MarkView entry
    config.mcpServers['markview-vault'] = {
      command: 'npx',
      args: ['tsx', mcpServerPath, ...docsPaths],
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    dialog.showMessageBox({
      type: 'info',
      title: 'Connected!',
      message: `MarkView Vault connected to ${clientName}`,
      detail: `Config updated: ${configPath}\n\nPlease restart ${clientName} to activate.\n\nShared folders: ${docsPaths.map(p => path.basename(p)).join(', ')}`,
      buttons: ['Got it'],
    });

    console.log(`[Vault] Connected to ${clientName} at ${configPath}`);
  } catch (err) {
    dialog.showErrorBox('Connection Failed', `Could not update ${clientName} config:\n${err.message}`);
  }
}

// ─── Auto-Start on Login ─────────────────────────────────────────────
function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });
  saveConfig({ autoStart: enabled });
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  const config = loadConfig();
  docsPaths = config.docsPaths || (config.docsPath ? [config.docsPath] : []);
  loadAccessLog();

  // Create tray with monochrome template icon for menu bar
  let trayIcon;
  try {
    // Create a simple 22x22 monochrome shield icon programmatically
    const size = 22;
    const canvas = Buffer.alloc(size * size * 4, 0); // RGBA
    // Draw a simple shield outline
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        // Shield shape: top wider, narrows to point at bottom
        const cx = size / 2;
        const halfW = (size / 2 - 2) * (1 - Math.pow(y / size, 1.5));
        const inShield = x >= cx - halfW && x <= cx + halfW && y >= 2 && y < size - 2;
        const isEdge = inShield && (
          x <= cx - halfW + 1.5 || x >= cx + halfW - 1.5 ||
          y <= 3 || y >= size - 4
        );
        if (isEdge) {
          canvas[idx] = 0;     // R
          canvas[idx+1] = 0;   // G
          canvas[idx+2] = 0;   // B
          canvas[idx+3] = 200; // A
        }
      }
    }
    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
    trayIcon.setTemplateImage(true);
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('MarkView Context Vault');

  // First launch: ask for folder
  if (docsPaths.length === 0) {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'MarkView Context Vault',
      message: 'Choose the folder you want AI to access (read-only)',
      buttonLabel: 'Share with AI',
    });

    if (result.canceled || result.filePaths.length === 0) {
      updateTrayMenu();
      return;
    }

    docsPaths = [result.filePaths[0]];
    saveConfig({ docsPaths });
  }

  // Remove invalid paths
  docsPaths = docsPaths.filter(p => fs.existsSync(p));
  if (docsPaths.length === 0) {
    updateTrayMenu();
    return;
  }
  saveConfig({ docsPaths });

  // Auto-start vault
  await startVault();
  updateTrayMenu();

  // Load custom blocked patterns from config  
  const blockedPatterns = config.blockedPatterns || [];
  global.vaultBlockedPatterns = blockedPatterns;

  // Enable auto-start if first launch
  if (config.autoStart === undefined) {
    setAutoStart(true);
  }

  // Show welcome window on first launch
  if (!config.welcomeShown) {
    showWelcomeWindow();
    saveConfig({ welcomeShown: true });
  }

  // Refresh the tray every 30 seconds to show latest access log
  setInterval(() => {
    if (tray) updateTrayMenu();
  }, 30000);
});

function updateTrayMenu() {
  const config = loadConfig();
  const autoStartEnabled = config.autoStart !== false;

  tray.setTitle(isRunning ? ' Active' : '', { fontType: 'monospacedDigit' });

  const recentAccess = accessLog.slice(-5).reverse();
  const recentAccessItems = recentAccess.length > 0
    ? recentAccess.map(entry => ({
        label: `   ${entry.timestamp.split('T')[1]?.slice(0, 8)} — ${entry.tool}(${entry.fileAccessed || '...'})`,
        enabled: false,
      }))
    : [{ label: '   No files accessed yet', enabled: false }];

  // Build folder list for menu
  const folderItems = docsPaths.map((p, i) => ({
    label: `  📂  ${path.basename(p)}`,
    submenu: [
      { label: p, enabled: false },
      {
        label: 'Remove from Vault',
        click: async () => {
          docsPaths = docsPaths.filter((_, idx) => idx !== i);
          saveConfig({ docsPaths });
          if (isRunning) { await stopVault(); if (docsPaths.length > 0) await startVault(); }
          updateTrayMenu();
        },
      },
    ],
  }));

  const template = [
    // ── Status ──
    {
      label: isRunning ? '🟢  Context Vault Active' : '🔴  Context Vault Inactive',
      enabled: false,
    },
    { type: 'separator' },

    // ── Folder ──
    { label: `📂  Vault Folders (${docsPaths.length})`, enabled: false },
    ...folderItems,
    {
      label: '    ➕ Add Another Folder...',
      click: async () => {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          message: 'Add a folder to your AI vault (read-only)',
          buttonLabel: 'Add to Vault',
        });
        if (!result.canceled && result.filePaths.length > 0) {
          const newPath = result.filePaths[0];
          if (!docsPaths.includes(newPath)) {
            docsPaths.push(newPath);
            saveConfig({ docsPaths });
            if (isRunning) { await stopVault(); await startVault(); }
            updateTrayMenu();
          }
        }
      },
    },
    { type: 'separator' },

    // ── Start/Stop ──
    {
      label: isRunning ? '⏹  Stop Vault' : '▶️  Start Vault',
      click: async () => {
        if (isRunning) {
          await stopVault();
        } else {
          if (docsPaths.length === 0) {
            const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
            if (result.canceled) return;
            docsPaths = [result.filePaths[0]];
            saveConfig({ docsPaths });
          }
          await startVault();
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },

    // ── Connect to AI Apps ──
    { label: '🔗  Connect to AI Apps', enabled: false },
    {
      label: '    Claude Desktop',
      click: () => connectToMCPClient(getClaudeConfigPath(), 'Claude Desktop'),
    },
    {
      label: '    Cursor',
      click: () => connectToMCPClient(getCursorConfigPath(), 'Cursor'),
    },
    {
      label: '    Chrome Extension',
      click: () => shell.openExternal('https://markview.ai'),
    },
    { type: 'separator' },

    // ── Privacy & Access Log ──
    { label: '🔒  Privacy', enabled: false },
    {
      label: `    ${accessLog.length} total file accesses logged`,
      enabled: false,
    },
    ...recentAccessItems,
    {
      label: '    📊 Open Privacy Dashboard...',
      click: () => openPrivacyDashboard(),
    },
    {
      label: '    🚫 Manage File Permissions...',
      click: () => showPermissionsDialog(),
    },
    {
      label: '    📄 View Raw Access Log...',
      click: () => shell.openPath(ACCESS_LOG_PATH),
    },
    { type: 'separator' },

    // ── Settings ──
    { label: '⚙️  Settings', enabled: false },
    {
      label: autoStartEnabled ? '    ✓ Start on Login' : '    Start on Login',
      click: () => {
        setAutoStart(!autoStartEnabled);
        updateTrayMenu();
      },
    },
    {
      label: '    ❓ How It Works',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'How MarkView Context Vault Works',
          message: 'Your files stay on your computer. Always.',
          detail:
            '1. Choose a folder → AI apps can read those files\n' +
            '2. Connect to Claude Desktop, Cursor, or use our Chrome Extension\n' +
            '3. AI reads your files when needed — but can NEVER modify them\n\n' +
            '🔒 Read-only. Local-first. Every access is logged.\n' +
            '🛡️ Sensitive files require your approval before sharing.\n\n' +
            'Supported formats: MD, TXT, PDF, DOCX, JSON, CSV, XML, YAML, HTML',
          buttons: ['Got it'],
        });
      },
    },
    { type: 'separator' },
    {
      label: `MarkView Context Vault v${VERSION}`,
      enabled: false,
    },
    {
      label: 'Quit',
      click: () => stopVault().then(() => app.quit()),
    },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

async function startVault() {
  try {
    // Check if port is already in use
    const net = require('net');
    const portFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(); resolve(true); });
      server.listen(PORT);
    });

    if (!portFree) {
      console.warn(`[Vault] Port ${PORT} is in use — attempting to kill old process`);
      try {
        const { execSync } = require('child_process');
        execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`);
        // Wait a moment for the port to free up
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        // Ignore — we'll try to start anyway
      }
    }

    startSignaling(PORT);
    console.log(`[Vault] Signaling server started on port ${PORT}`);

    await startMCPBridge(docsPaths, ROOM_ID, `ws://localhost:${PORT}`);
    console.log(`[Vault] MCP bridge active — sharing: ${docsPaths.join(', ')}`);

    isRunning = true;

    if (Notification.isSupported()) {
      let fileCount = 0;
      for (const p of docsPaths) fileCount += countFiles(p);
      const folderNames = docsPaths.map(p => path.basename(p)).join(', ');
      new Notification({
        title: '🔒 Context Vault Active',
        body: `Sharing ${fileCount} files from ${folderNames} (read-only)`,
        silent: true,
      }).show();
    }
  } catch (err) {
    console.error('[Vault] Failed to start:', err);
    await stopVault();
    dialog.showErrorBox('MarkView Context Vault', `Failed to start: ${err.message}`);
  }
}

function countFiles(dir) {
  const SUPPORTED = new Set([
    '.md','.txt','.pdf','.docx','.doc','.rtf','.odt','.rst','.tex','.org','.adoc','.log',
    '.html','.htm','.css','.svg','.json','.csv','.tsv','.xml','.yaml','.yml','.toml',
    '.ini','.conf','.cfg','.properties','.xlsx','.xls','.ipynb',
    '.py','.js','.ts','.jsx','.tsx','.go','.rs','.java','.c','.cpp','.h','.hpp',
    '.cs','.rb','.swift','.kt','.php','.r','.m','.scala','.sh','.bash','.zsh',
    '.sql','.graphql','.gql','.dockerfile','.tf','.hcl',
    '.proto','.prisma','.vue','.svelte',
  ]);
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        count += countFiles(path.join(dir, entry.name));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED.has(ext)) count++;
      }
    }
  } catch (e) {}
  return count;
}

async function stopVault() {
  stopMCPBridge();
  stopSignaling();
  isRunning = false;
}

// Graceful shutdown
app.on('before-quit', async () => {
  await stopVault();
});

process.on('SIGINT', async () => {
  await stopVault();
  app.quit();
});

process.on('SIGTERM', async () => {
  await stopVault();
  app.quit();
});

app.on('window-all-closed', (e) => e.preventDefault());
