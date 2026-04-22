let offscreenCreated = false;
chrome.storage.local.set({ connectionState: "disconnected", tools: [] });
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "markview-ask-brain",
    title: 'Ask Brain about "%s"',
    contexts: ["selection"]
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "markview-ask-brain" && tab?.id && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_MENU_ASK",
      text: info.selectionText
    });
  }
});
async function ensureOffscreen() {
  if (offscreenCreated) return;
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  });
  if (existingContexts.length > 0) {
    offscreenCreated = true;
    return;
  }
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.WEB_RTC],
    justification: "WebRTC peer connection for MCP-over-WebRTC transport"
  });
  offscreenCreated = true;
}
chrome.runtime.onMessage.addListener(
  (msg, _sender, sendResponse) => {
    if (msg.type === "CONNECTION_STATE" || msg.type === "LOG" || msg.type === "TOOLS_DISCOVERED" || msg.type === "STREAM_TOKEN" || msg.type === "STREAM_END") {
      if (msg.type === "CONNECTION_STATE") {
        chrome.storage.local.set({ connectionState: msg.state });
      }
      if (msg.type === "TOOLS_DISCOVERED") {
        chrome.storage.local.set({ tools: msg.tools });
      }
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, msg).catch(() => {
            });
          }
        }
      });
      return;
    }
    if (msg.type === "CONNECT") {
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage({ ...msg, target: "offscreen" }).catch(() => {
        });
      });
      return;
    }
    if (msg.type === "DISCONNECT") {
      chrome.runtime.sendMessage({ ...msg, target: "offscreen" }).catch(() => {
      });
      return;
    }
    if (msg.type === "GET_STATE") {
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
          { ...msg, target: "offscreen" },
          (response) => {
            sendResponse(response || { state: "disconnected" });
          }
        );
      });
      return true;
    }
    if (msg.type === "CALL_TOOL" || msg.type === "LIST_TOOLS") {
      ensureOffscreen().then(() => {
        chrome.runtime.sendMessage(
          { ...msg, target: "offscreen" },
          (response) => {
            sendResponse(response);
          }
        );
      });
      return true;
    }
  }
);
