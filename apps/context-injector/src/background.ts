/**
 * MarkView Context Bridge — Background Service Worker
 *
 * THIN RELAY. Creates the offscreen document (which has RTCPeerConnection
 * access) and forwards messages between popup/content scripts ↔ offscreen.
 */

import type { ExtensionMessage } from './types';

let offscreenCreated = false;

// Clear stale connection state on service worker startup.
// Without this, content scripts read 'connected' from storage
// even though the offscreen DataChannel is dead.
chrome.storage.local.set({ connectionState: 'disconnected', tools: [] });

async function ensureOffscreen(): Promise<void> {
  if (offscreenCreated) return;

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.WEB_RTC],
    justification: 'WebRTC peer connection for MCP-over-WebRTC transport',
  });
  offscreenCreated = true;
}

chrome.runtime.onMessage.addListener(
  (msg: ExtensionMessage, _sender, sendResponse) => {
    // Messages FROM the offscreen document → broadcast to all content scripts
    if (
      msg.type === 'CONNECTION_STATE' ||
      msg.type === 'LOG' ||
      msg.type === 'TOOLS_DISCOVERED'
    ) {
      if (msg.type === 'CONNECTION_STATE') {
        chrome.storage.local.set({ connectionState: msg.state });
      }
      if (msg.type === 'TOOLS_DISCOVERED') {
        chrome.storage.local.set({ tools: msg.tools });
      }
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
          }
        }
      });
      return;
    }

    // Messages FROM popup/content → forward to offscreen
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
        chrome.runtime.sendMessage(
          { ...msg, target: 'offscreen' },
          (response) => {
            sendResponse(response || { state: 'disconnected' });
          }
        );
      });
      return true; // async response
    }

    if (msg.type === 'CALL_TOOL' || msg.type === 'LIST_TOOLS') {
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
          { ...msg, target: 'offscreen' },
          (response) => {
            sendResponse(response);
          }
        );
      });
      return true; // async response
    }
  }
);
