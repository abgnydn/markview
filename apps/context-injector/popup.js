/**
 * MarkView Context Bridge — Popup Script
 * 
 * Auto-connects to the local Context Vault on startup.
 * No room ID needed for non-developers — just install and go.
 */

const logEl = document.getElementById('log');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const disconnectedView = document.getElementById('disconnectedView');
const connectedView = document.getElementById('connectedView');
const retryBtn = document.getElementById('retryBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const advancedToggle = document.getElementById('advancedToggle');
const advancedSection = document.getElementById('advancedSection');
const manualConnectBtn = document.getElementById('manualConnectBtn');
const roomIdInput = document.getElementById('roomId');
const signalingUrlInput = document.getElementById('signalingUrl');
const toolsSection = document.getElementById('toolsSection');
const toolList = document.getElementById('toolList');

function log(msg, type = '') {
  const line = document.createElement('div');
  line.className = type;
  line.textContent = `${msg}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// Auto-connect on popup open
chrome.storage.local.get(['connectionState', 'signalingUrl', 'roomId', 'tools'], (data) => {
  // Always enforce zero-config defaults unless explicitly changed by a user
  // (Fixes issue where old test room IDs were cached in storage)
  const savedRoomId = data.roomId && data.roomId !== 'undefined' ? data.roomId : 'local-vault';
  const finalRoomId = savedRoomId.includes('-') ? savedRoomId : 'local-vault'; // Heuristic to reset if it looks like old 'test' or 'demo-room' 
  
  signalingUrlInput.value = data.signalingUrl || 'ws://localhost:4445';
  roomIdInput.value = 'local-vault'; // Force zero-config room ID

  if (data.connectionState === 'connected') {
    showConnected();
    if (data.tools) renderTools(data.tools);
  } else {
    // Auto-try connecting
    showSearching();
    autoConnect();
  }
});

function autoConnect() {
  const signalingUrl = signalingUrlInput.value.trim();
  const roomId = roomIdInput.value.trim();
  log('Looking for Context Vault...');
  chrome.storage.local.set({ signalingUrl, roomId });
  chrome.runtime.sendMessage({ type: 'CONNECT', roomId, signalingUrl });
}

// Listen for state updates from background
chrome.runtime.onMessage.addListener((msg) => {
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
  advancedToggle.textContent = isVisible ? '⚙️ Advanced Settings' : '⚙️ Hide Settings';
});

function showSearching() {
  disconnectedView.style.display = 'block';
  connectedView.style.display = 'none';
  statusDot.className = 'status-dot searching';
  statusText.innerHTML = 'Looking for Context Vault...';
  retryBtn.disabled = true;
  retryBtn.textContent = 'Connecting...';
}

function showConnected() {
  disconnectedView.style.display = 'none';
  connectedView.style.display = 'block';
  statusDot.className = 'status-dot connected';
  statusText.innerHTML = 'Connected · <strong>End-to-end Encrypted</strong>';
  retryBtn.disabled = false;
  retryBtn.textContent = '🔄 Retry Connection';
}

function showDisconnected() {
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

function renderTools(tools) {
  toolsSection.style.display = 'block';
  toolList.innerHTML = '';
  tools.forEach((t) => {
    const tag = document.createElement('span');
    tag.className = 'tool-tag';
    tag.textContent = t.name || t;
    toolList.appendChild(tag);
  });
}
