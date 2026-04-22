/**
 * MarkView Context Bridge — Popup Script
 *
 * Auto-connects to the local Context Vault on startup.
 * Zero-config for non-developers — install and go.
 */

import type { ExtensionMessage, ToolInfo } from './types';

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const logEl = document.getElementById('log') as HTMLDivElement;
const statusDot = document.getElementById('statusDot') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLDivElement;
const disconnectedView = document.getElementById('disconnectedView') as HTMLDivElement;
const connectedView = document.getElementById('connectedView') as HTMLDivElement;
const retryBtn = document.getElementById('retryBtn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement;
const advancedToggle = document.getElementById('advancedToggle') as HTMLButtonElement;
const advancedSection = document.getElementById('advancedSection') as HTMLDivElement;
const manualConnectBtn = document.getElementById('manualConnectBtn') as HTMLButtonElement;
const roomIdInput = document.getElementById('roomId') as HTMLInputElement;
const signalingUrlInput = document.getElementById('signalingUrl') as HTMLInputElement;
const toolsSection = document.getElementById('toolsSection') as HTMLDivElement;
const toolList = document.getElementById('toolList') as HTMLDivElement;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(msg: string, type = ''): void {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// Auto-connect on popup open
// ---------------------------------------------------------------------------

chrome.storage.local.get(
  ['connectionState', 'signalingUrl', 'roomId', 'tools'],
  (data) => {
    signalingUrlInput.value = (data.signalingUrl as string) || 'ws://localhost:4445';
    roomIdInput.value = 'local-vault';

    if (data.connectionState === 'connected') {
      showConnected();
      if (data.tools) renderTools(data.tools as ToolInfo[]);
    } else {
      showSearching();
      autoConnect();
    }
  }
);

function autoConnect(): void {
  const signalingUrl = signalingUrlInput.value.trim();
  const roomId = roomIdInput.value.trim();
  log('Looking for Context Vault...');
  chrome.storage.local.set({ signalingUrl, roomId });
  chrome.runtime.sendMessage({ type: 'CONNECT', roomId, signalingUrl });
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg: ExtensionMessage) => {
  if (msg.type === 'CONNECTION_STATE') {
    if (msg.state === 'connected') {
      showConnected();
      log('P2P connection established!', 'success');
    } else if (msg.state === 'disconnected' || msg.state === 'failed') {
      showDisconnected();
      log('Could not find Context Vault', 'error');
    }
  } else if (msg.type === 'TOOLS_DISCOVERED') {
    renderTools(msg.tools);
  } else if (msg.type === 'LOG') {
    log(msg.message, msg.logType || '');
  }
});

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

retryBtn.addEventListener('click', () => {
  showSearching();
  autoConnect();
});

manualConnectBtn.addEventListener('click', () => {
  showSearching();
  autoConnect();
});

disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DISCONNECT' });
  showDisconnected();
  log('Disconnected');
});

advancedToggle.addEventListener('click', () => {
  const isVisible = advancedSection.style.display !== 'none';
  advancedSection.style.display = isVisible ? 'none' : 'block';
  advancedToggle.textContent = isVisible
    ? '⚙️ Advanced Settings'
    : '⚙️ Hide Settings';
});

// ---------------------------------------------------------------------------
// UI State
// ---------------------------------------------------------------------------

function showSearching(): void {
  disconnectedView.style.display = 'block';
  connectedView.style.display = 'none';
  statusDot.className = 'status-dot searching';
  statusText.innerHTML = 'Looking for Context Vault...';
  retryBtn.disabled = true;
  retryBtn.textContent = 'Connecting...';
}

function showConnected(): void {
  disconnectedView.style.display = 'none';
  connectedView.style.display = 'block';
  statusDot.className = 'status-dot connected';
  statusText.innerHTML = 'Connected · <strong>End-to-end Encrypted</strong>';
  retryBtn.disabled = false;
  retryBtn.textContent = '🔄 Retry Connection';
}

function showDisconnected(): void {
  disconnectedView.style.display = 'block';
  connectedView.style.display = 'none';
  toolsSection.style.display = 'none';
  toolList.innerHTML = '';
  statusDot.className = 'status-dot';
  statusText.textContent = 'Not connected';
  retryBtn.disabled = false;
  retryBtn.textContent = '🔄 Retry Connection';
  chrome.storage.local.set({ connectionState: 'disconnected', tools: [] });
}

function renderTools(tools: ToolInfo[]): void {
  toolsSection.style.display = 'block';
  toolList.innerHTML = '';
  tools.forEach((t) => {
    const tag = document.createElement('span');
    tag.className = 'tool-tag';
    tag.textContent = t.name || String(t);
    toolList.appendChild(tag);
  });
}
