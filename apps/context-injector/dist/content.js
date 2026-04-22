let isConnected = false;
let injectedButton = null;
let chatHistory = [];
let currentPageContext = "";
let currentPageUrl = "";
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CONNECTION_STATE") {
    isConnected = msg.state === "connected";
    console.log("[MV Content] Connection state:", msg.state);
    updateButton();
  } else if (msg.type === "RENDER_AI_UI") {
    renderAIOverlay(msg.payload);
  }
});
chrome.storage.local.get(["connectionState"], (result) => {
  if (result.connectionState === "connected") {
    isConnected = true;
  } else {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response?.state === "connected") isConnected = true;
      updateButton();
    });
  }
  waitForInjectionPoints();
});
function waitForInjectionPoints() {
  const observer = new MutationObserver(() => {
    if (!injectedButton) {
      const container2 = findInputContainer();
      if (container2) injectButton(container2);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const container = findInputContainer();
  if (container) injectButton(container);
}
function findInputContainer() {
  if (window.location.hostname === "github.com") {
    return document.querySelector(".gh-header-actions") || document.querySelector(".pr-review-tools") || document.querySelector(".gh-header-show .flex-md-row");
  }
  return document.querySelector('form[class*="stretch"]') || document.querySelector('[class*="composer"]') || document.querySelector(".chat-input");
}
function injectButton(container) {
  if (injectedButton) return;
  injectedButton = document.createElement("div");
  injectedButton.innerHTML = `
    <button id="mvContextBtn" style="
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 6px;
      background: rgba(139, 92, 246, 0.1);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #a78bfa; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: system-ui, -apple-system, sans-serif;
      transition: all 0.2s ease;
      line-height: 1.5;
    ">
      <span class="mv-dot" style="
        width: 8px; height: 8px; border-radius: 50%;
        background: #ef4444; display: inline-block;
        transition: background 0.3s ease;
      "></span>
      <span class="mv-label">\u26A1 MarkView Brain</span>
    </button>
  `;
  container.style.position = container.style.position || "relative";
  container.insertBefore(injectedButton, container.firstChild);
  updateButton();
  document.getElementById("mvContextBtn").addEventListener("click", handleBrainClick);
}
async function handleBrainClick(e) {
  e.preventDefault();
  e.stopPropagation();
  console.log("[MV Content] Button clicked. isConnected:", isConnected);
  const liveState = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      console.log("[MV Content] Live state check:", response);
      resolve(response?.state || "disconnected");
    });
  });
  if (liveState !== "connected") {
    console.log("[MV Content] DataChannel not open. Auto-reconnecting...");
    isConnected = false;
    updateButton();
    chrome.runtime.sendMessage({
      type: "CONNECT",
      roomId: "local-vault",
      signalingUrl: "ws://localhost:4445"
    });
    renderAIOverlay(`
      <p style="color:#f59e0b; font-size:14px;">
        \u26A0\uFE0F DataChannel was stale. Auto-reconnecting...<br>
        <span style="color:#9ca3af; font-size:12px;">Wait 3 seconds, then click MarkView Brain again.</span>
      </p>
    `);
    return;
  }
  const context = document.body.innerText.substring(0, 2e3);
  const url = window.location.href;
  currentPageContext = context;
  currentPageUrl = url;
  chatHistory = [];
  console.log("[MV Content] Sending CALL_TOOL, context length:", context.length);
  const dot = document.querySelector(".mv-dot");
  const label = document.querySelector(".mv-label");
  if (dot) dot.classList.add("pulsing");
  if (label) label.textContent = "Thinking...";
  chrome.runtime.sendMessage(
    {
      type: "CALL_TOOL",
      toolName: "process_browser_context",
      args: { url, context }
    },
    (response) => {
      console.log(
        "[MV Content] Response:",
        JSON.stringify(response).substring(0, 300)
      );
      if (dot) dot.classList.remove("pulsing");
      if (label) label.textContent = "Brain \xB7 Linked";
      if (!response) {
        console.error("[MV Content] Response is null");
        renderAIOverlay(
          '<p style="color:#ef4444;">No response from Brain. Check MCP server.</p>'
        );
        return;
      }
      if (response.error) {
        renderAIOverlay(
          `<p style="color:#ef4444;">Error: ${response.error}</p>`
        );
        return;
      }
      try {
        const resultText = response?.content?.[0]?.text;
        if (!resultText) {
          renderAIOverlay(
            '<p style="color:#ef4444;">Empty response from MCP tool.</p>'
          );
          return;
        }
        const data = JSON.parse(resultText);
        if (data.uiPayload) {
          renderAIOverlay(data.uiPayload);
        } else {
          renderAIOverlay(
            `<p style="color:#e5e7eb;">${resultText}</p>`
          );
        }
      } catch (err) {
        renderAIOverlay(
          `<p style="color:#ef4444;">Parse error: ${err.message}</p>`
        );
      }
    }
  );
}
function updateButton() {
  const dot = document.querySelector(".mv-dot");
  const label = document.querySelector(".mv-label");
  if (!dot || !label) return;
  if (isConnected) {
    dot.classList.add("connected");
    label.textContent = "Brain \xB7 Linked";
  } else {
    dot.classList.remove("connected");
    label.textContent = "Brain \xB7 Offline";
  }
}
function renderAIOverlay(htmlPayload, isFollowUp = false) {
  console.log("[MV Content] renderAIOverlay, isFollowUp:", isFollowUp);
  let overlay = document.getElementById("mv-ai-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mv-ai-overlay";
    overlay.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      width: 420px !important;
      max-height: 85vh !important;
      display: flex !important;
      flex-direction: column !important;
      background: rgba(15, 23, 42, 0.97) !important;
      border: 1px solid rgba(167, 139, 250, 0.3) !important;
      border-radius: 12px !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6),
                  0 0 30px rgba(167, 139, 250, 0.1) !important;
      color: white !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      animation: mvSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
    `;
    injectKeyframes();
    overlay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); border-radius:12px 12px 0 0; flex-shrink:0;">
        <span style="font-size:13px; font-weight:700; color:#a78bfa; letter-spacing:0.5px;">\u26A1 MarkView Brain</span>
        <button id="mv-overlay-close-btn" style="background:none; border:none; color:#9ca3af; cursor:pointer; font-size:18px; padding:2px 6px; border-radius:4px;">\u2715</button>
      </div>
      <div id="mv-chat-messages" style="flex:1; overflow-y:auto; padding:16px; min-height:100px;"></div>
      <div style="padding:12px 16px; border-top:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
        <div style="display:flex; gap:8px;">
          <input id="mv-chat-input" type="text" placeholder="Ask about this page..."
            style="flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 12px; color:white; font-size:13px; outline:none; font-family:inherit;"
          />
          <button id="mv-chat-send" style="background:rgba(167,139,250,0.2); border:1px solid rgba(167,139,250,0.3); border-radius:8px; padding:8px 12px; color:#a78bfa; font-size:13px; cursor:pointer; font-weight:600; white-space:nowrap;">
            Send
          </button>
        </div>
        <div style="font-size:10px; color:#4b5563; margin-top:6px; text-align:center;">qwen3:0.6b \xB7 local \xB7 zero cloud</div>
      </div>
    `;
    document.body.appendChild(overlay);
    wireOverlayEvents(overlay);
  }
  const messagesDiv = document.getElementById("mv-chat-messages");
  if (messagesDiv) {
    if (isFollowUp) {
      messagesDiv.innerHTML += htmlPayload;
    } else {
      messagesDiv.innerHTML = htmlPayload;
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  setTimeout(() => {
    document.getElementById("mv-chat-input")?.focus();
  }, 100);
}
function wireOverlayEvents(overlay) {
  document.getElementById("mv-overlay-close-btn").addEventListener("click", () => {
    overlay.remove();
    chatHistory = [];
  });
  const input = document.getElementById("mv-chat-input");
  const sendBtn = document.getElementById("mv-chat-send");
  const sendChat = () => {
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    handleChatMessage(q);
  };
  sendBtn.addEventListener("click", sendChat);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChat();
    }
  });
}
function injectKeyframes() {
  if (document.getElementById("mv-keyframes")) return;
  const style = document.createElement("style");
  style.id = "mv-keyframes";
  style.textContent = `
    @keyframes mvSlideIn {
      from { transform: translateX(440px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes mvPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    @keyframes mvFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}
function handleChatMessage(question) {
  console.log("[MV Content] Chat:", question);
  const messagesDiv = document.getElementById("mv-chat-messages");
  if (messagesDiv) {
    messagesDiv.innerHTML += `
      <div style="margin-top:12px; padding:8px 12px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2); border-radius:8px; animation: mvFadeIn 0.3s ease;">
        <div style="font-size:11px; color:#60a5fa; margin-bottom:4px; font-weight:600;">You</div>
        <div style="font-size:13px; color:#e5e7eb; line-height:1.5;">${escapeHtml(question)}</div>
      </div>
      <div id="mv-thinking" style="margin-top:8px; padding:8px 12px;">
        <span style="font-size:12px; color:#a78bfa; animation: mvPulse 1.5s infinite;">Thinking...</span>
      </div>
    `;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  chatHistory.push({ role: "user", content: question });
  const context = currentPageContext || document.body.innerText.substring(0, 2e3);
  const url = currentPageUrl || window.location.href;
  chrome.runtime.sendMessage(
    {
      type: "CALL_TOOL",
      toolName: "process_browser_context",
      args: {
        url,
        context,
        question,
        history: JSON.stringify(chatHistory)
      }
    },
    (response) => {
      console.log("[MV Content] Chat response received");
      document.getElementById("mv-thinking")?.remove();
      let responseText = "";
      if (!response || response.error) {
        responseText = response?.error || "No response received";
        appendBrainMessage(`<span style="color:#ef4444;">${responseText}</span>`);
        return;
      }
      try {
        const resultText = response?.content?.[0]?.text;
        if (resultText) {
          const data = JSON.parse(resultText);
          if (data.uiPayload) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = data.uiPayload;
            const firstP = tempDiv.querySelector("p");
            responseText = firstP?.textContent || data.uiPayload;
          }
        }
      } catch {
        responseText = "Failed to parse response";
      }
      chatHistory.push({ role: "assistant", content: responseText });
      appendBrainMessage(escapeHtml(responseText));
    }
  );
}
function appendBrainMessage(text) {
  const messagesDiv = document.getElementById("mv-chat-messages");
  if (!messagesDiv) return;
  messagesDiv.innerHTML += `
    <div style="margin-top:8px; padding:8px 12px; background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.15); border-radius:8px; animation: mvFadeIn 0.3s ease;">
      <div style="font-size:11px; color:#a78bfa; margin-bottom:4px; font-weight:600;">Brain</div>
      <div style="font-size:13px; color:#e5e7eb; line-height:1.5;">${text}</div>
    </div>
  `;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
