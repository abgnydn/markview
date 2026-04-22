/**
 * MarkView Context Bridge — Background Service Worker
 * 
 * This is a THIN RELAY. It creates an offscreen document (which has
 * access to RTCPeerConnection) and forwards all messages between
 * the popup/content scripts and the offscreen document.
 */

let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  
  // Check if offscreen doc already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  
  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['WEB_RTC'],
    justification: 'WebRTC peer connection for MCP-over-WebRTC transport',
  });
  offscreenCreated = true;
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Messages FROM the offscreen document → broadcast to popup + content scripts
  if (msg.type === 'CONNECTION_STATE' || msg.type === 'LOG' || msg.type === 'TOOLS_DISCOVERED') {
    // Save state
    if (msg.type === 'CONNECTION_STATE') {
      chrome.storage.local.set({ connectionState: msg.state });
    }
    if (msg.type === 'TOOLS_DISCOVERED') {
      chrome.storage.local.set({ tools: msg.tools });
    }
    // Broadcast to all tabs (content scripts)
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    });
    return;
  }

  // Messages FROM popup/content → forward to offscreen document
  if (msg.type === 'CONNECT') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }).catch(() => {});
    });
    return;
  }

  if (msg.type === 'DISCONNECT') {
    chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }).catch(() => {});
    return;
  }

  if (msg.type === 'GET_STATE') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }, (response) => {
        sendResponse(response || { state: 'disconnected' });
      });
    });
    return true; // async
  }

  if (msg.type === 'CALL_TOOL' || msg.type === 'LIST_TOOLS') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ ...msg, target: 'offscreen' }, (response) => {
        sendResponse(response);
      });
    });
    return true; // async
  }
});
