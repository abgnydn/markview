let isConnected = false;
let injectedButton = null;
let isSending = false;
let isMinimized = false;
let chatHistory = [];
let currentPageContext = "";
let currentPageUrl = "";
let lastAnalysisPayload = "";
let detectedPageType = "generic";
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
    chrome.runtime.sendMessage({
      type: "CONNECT",
      roomId: "local-vault",
      signalingUrl: "ws://localhost:4445"
    });
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response?.state === "connected") isConnected = true;
      updateButton();
    });
  }
  waitForInjectionPoints();
  setTimeout(() => {
    if (isConnected && !document.getElementById("mv-ai-overlay")) {
      autoAnalyze();
    }
  }, 3e3);
});
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "b") {
    e.preventDefault();
    const overlay = document.getElementById("mv-ai-overlay");
    if (overlay) {
      overlay.remove();
      chatHistory = [];
    } else {
      handleBrainClick(e);
    }
  }
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
      <span class="mv-label">\u26A1 Brain</span>
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
  const liveState = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      resolve(response?.state || "disconnected");
    });
  });
  if (liveState !== "connected") {
    isConnected = false;
    updateButton();
    chrome.runtime.sendMessage({
      type: "CONNECT",
      roomId: "local-vault",
      signalingUrl: "ws://localhost:4445"
    });
    renderAIOverlay(`
      <div style="text-align:center; padding:20px 0;">
        <div style="font-size:24px; margin-bottom:8px;">\u{1F504}</div>
        <p style="color:#f59e0b; font-size:14px; margin:0 0 4px;">Reconnecting to Brain...</p>
        <p style="color:#6b7280; font-size:12px; margin:0;">Click again in 3 seconds</p>
      </div>
    `);
    return;
  }
  const context = document.body.innerText.substring(0, 2e3);
  const url = window.location.href;
  currentPageContext = context;
  currentPageUrl = url;
  chatHistory = [];
  const dot = document.querySelector(".mv-dot");
  const label = document.querySelector(".mv-label");
  if (dot) dot.classList.add("pulsing");
  if (label) label.textContent = "\u26A1 Thinking...";
  renderAIOverlay(`
    <div style="text-align:center; padding:30px 0;">
      <div style="font-size:20px; margin-bottom:12px; animation: mvPulse 1.5s infinite;">\u{1F9E0}</div>
      <p style="color:#a78bfa; font-size:13px; margin:0;">Analyzing page...</p>
      <p style="color:#4b5563; font-size:11px; margin:4px 0 0;">Scanning vault \xB7 Querying LLM</p>
    </div>
  `);
  chrome.runtime.sendMessage(
    {
      type: "CALL_TOOL",
      toolName: "process_browser_context",
      args: { url, context }
    },
    (response) => {
      if (dot) dot.classList.remove("pulsing");
      if (label) label.textContent = "\u26A1 Brain";
      if (!response) {
        renderAIOverlay(
          '<p style="color:#ef4444; text-align:center; padding:16px 0;">No response from Brain. Is the MCP server running?</p>'
        );
        return;
      }
      if (response.error) {
        renderAIOverlay(
          `<p style="color:#ef4444; text-align:center; padding:16px 0;">Error: ${escapeHtml(response.error)}</p>`
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
          renderAIOverlay(`<p style="color:#e5e7eb;">${resultText}</p>`);
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
    dot.style.background = "#22c55e";
    dot.style.boxShadow = "0 0 6px rgba(34,197,94,0.5)";
    label.textContent = "\u26A1 Brain";
  } else {
    dot.style.background = "#ef4444";
    dot.style.boxShadow = "none";
    label.textContent = "\u26A1 Offline";
  }
}
function renderAIOverlay(htmlPayload, isFollowUp = false) {
  let overlay = document.getElementById("mv-ai-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "mv-ai-overlay";
    overlay.style.cssText = `
      position: fixed !important;
      top: 16px !important;
      right: 16px !important;
      z-index: 2147483647 !important;
      width: 400px !important;
      max-height: 80vh !important;
      display: flex !important;
      flex-direction: column !important;
      background: rgba(10, 10, 20, 0.96) !important;
      border: 1px solid rgba(139, 92, 246, 0.25) !important;
      border-radius: 16px !important;
      box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.7),
                  0 0 40px rgba(139, 92, 246, 0.08) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
      animation: mvSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
    `;
    injectKeyframes();
    overlay.innerHTML = `
      <!-- Header \u2014 draggable -->
      <div id="mv-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.03); border-radius:16px 16px 0 0; flex-shrink:0; cursor:grab; user-select:none;">
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:20px; height:20px; background:linear-gradient(135deg, #8b5cf6, #6366f1); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:10px;">\u{1F9E0}</div>
          <span style="font-size:12px; font-weight:600; color:#c4b5fd; letter-spacing:0.3px;">MarkView Brain</span>
        </div>
        <div style="display:flex; align-items:center; gap:2px;">
          <button id="mv-minimize-btn" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:13px; padding:2px 4px; border-radius:4px; transition:color 0.2s;" title="Minimize">\u25AC</button>
          <button id="mv-export-btn" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:13px; padding:2px 4px; border-radius:4px; transition:color 0.2s;" title="Export chat">\u{1F4E4}</button>
          <button id="mv-clear-btn" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:13px; padding:2px 4px; border-radius:4px; transition:color 0.2s;" title="Clear chat">\u{1F5D1}</button>
          <button id="mv-overlay-close-btn" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:16px; padding:2px 4px; border-radius:4px; transition:color 0.2s; line-height:1;">\u2715</button>
        </div>
      </div>

      <!-- Messages -->
      <div id="mv-chat-messages" style="flex:1; overflow-y:auto; padding:14px; min-height:80px; scroll-behavior:smooth;"></div>

      <!-- Quick actions (dynamic per page type) -->
      <div id="mv-quick-actions" style="padding:0 14px 8px; flex-shrink:0; display:flex; gap:6px; flex-wrap:wrap;"></div>

      <!-- Input -->
      <div id="mv-input-area" style="padding:8px 14px 12px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
        <div style="display:flex; gap:6px; align-items:center;">
          <input id="mv-chat-input" type="text" placeholder="Ask anything about this page..."
            style="flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:9px 12px; color:white; font-size:13px; outline:none; font-family:inherit; transition:border-color 0.2s;"
          />
          <button id="mv-chat-send" style="background:linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.3)); border:1px solid rgba(139,92,246,0.3); border-radius:10px; padding:9px 14px; color:#c4b5fd; font-size:13px; cursor:pointer; font-weight:600; white-space:nowrap; transition:all 0.2s; font-family:inherit;">
            \u2191
          </button>
        </div>
        <div style="font-size:9px; color:#3f3f46; margin-top:5px; text-align:center;">qwen3:0.6b \xB7 Apple M2 Pro \xB7 100% local</div>
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
    const input = document.getElementById("mv-chat-input");
    if (input && !isSending) input.focus();
  }, 150);
}
function wireOverlayEvents(overlay) {
  document.getElementById("mv-overlay-close-btn").addEventListener("click", () => {
    overlay.style.animation = "mvSlideOut 0.25s cubic-bezier(0.55, 0, 1, 0.45)";
    setTimeout(() => {
      overlay.remove();
      chatHistory = [];
      isMinimized = false;
    }, 230);
  });
  document.getElementById("mv-minimize-btn").addEventListener("click", () => {
    const msgs = document.getElementById("mv-chat-messages");
    const quickAct = document.getElementById("mv-quick-actions");
    const inputArea = document.getElementById("mv-input-area");
    isMinimized = !isMinimized;
    msgs.style.display = isMinimized ? "none" : "block";
    quickAct.style.display = isMinimized ? "none" : "flex";
    inputArea.style.display = isMinimized ? "none" : "block";
    overlay.style.maxHeight = isMinimized ? "auto" : "80vh";
  });
  document.getElementById("mv-export-btn").addEventListener("click", () => {
    if (chatHistory.length === 0) return;
    const url = currentPageUrl || window.location.href;
    const lines = [
      `# Brain Chat \u2014 ${document.title}`,
      `> ${url}`,
      `> ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      ""
    ];
    chatHistory.forEach((m) => {
      lines.push(`**${m.role === "user" ? "You" : "Brain"}:** ${m.content}`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brain-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    const btn = document.getElementById("mv-export-btn");
    btn.textContent = "\u2705";
    setTimeout(() => {
      btn.textContent = "\u{1F4E4}";
    }, 1500);
  });
  document.getElementById("mv-clear-btn").addEventListener("click", () => {
    chatHistory = [];
    const msgs = document.getElementById("mv-chat-messages");
    if (msgs) msgs.innerHTML = '<div style="text-align:center; padding:20px 0; color:#4b5563; font-size:12px;">Chat cleared. Ask something new!</div>';
    populateSmartChips();
  });
  const input = document.getElementById("mv-chat-input");
  const sendBtn = document.getElementById("mv-chat-send");
  const sendChat = () => {
    const q = input.value.trim();
    if (!q || isSending) return;
    input.value = "";
    handleChatMessage(q);
  };
  sendBtn.addEventListener("click", sendChat);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  input.addEventListener("focus", () => {
    input.style.borderColor = "rgba(139, 92, 246, 0.4)";
    input.style.boxShadow = "0 0 0 2px rgba(139, 92, 246, 0.1)";
  });
  input.addEventListener("blur", () => {
    input.style.borderColor = "rgba(255, 255, 255, 0.08)";
    input.style.boxShadow = "none";
  });
  populateSmartChips();
  const header = document.getElementById("mv-header");
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let overlayStartX = 0;
  let overlayStartY = 0;
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = overlay.getBoundingClientRect();
    overlayStartX = rect.left;
    overlayStartY = rect.top;
    header.style.cursor = "grabbing";
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    overlay.style.left = `${overlayStartX + dx}px`;
    overlay.style.top = `${overlayStartY + dy}px`;
    overlay.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = "grab";
    }
  });
}
function detectPageType() {
  const url = window.location.href;
  if (url.includes("github.com") && url.includes("/pull/")) return "github-pr";
  if (url.includes("github.com") && url.includes("/issues/")) return "github-issue";
  if (url.includes("github.com")) return "github-repo";
  if (url.includes("claude.ai") || url.includes("chatgpt.com")) return "ai-chat";
  if (url.includes("arxiv.org")) return "paper";
  if (url.includes("stackoverflow.com")) return "stackoverflow";
  return "generic";
}
function getChipsForPageType(type) {
  const base = [
    { label: "\u{1F4DD} Summarize", q: "Summarize this page in 3 concise bullets" },
    { label: "\u{1F517} Vault links", q: "How does this connect to my vault research?" }
  ];
  switch (type) {
    case "github-pr":
      return [
        { label: "\u{1F4DD} PR Summary", q: "Summarize this PR: what it changes, why, and impact" },
        { label: "\u26A0\uFE0F Risks", q: "What are the risks or potential issues with this PR?" },
        { label: "\u{1F4C2} Files", q: "What files does this PR change and why?" },
        { label: "\u2705 Review", q: "Give me a code review checklist for this PR" },
        { label: "\u{1F517} Vault", q: "How does this PR relate to my vault research?" }
      ];
    case "github-issue":
      return [
        { label: "\u{1F4DD} Summary", q: "Summarize this issue and its current status" },
        { label: "\u{1F6E0} Solution", q: "Suggest a solution approach for this issue" },
        ...base
      ];
    case "github-repo":
      return [
        { label: "\u{1F4DD} Overview", q: "What is this project about and what problem does it solve?" },
        { label: "\u{1F3D7} Architecture", q: "Describe the tech stack and architecture" },
        { label: "\u2B50 Value", q: "Why would this be useful for my work?" },
        { label: "\u{1F517} Vault", q: "How does this relate to my vault research?" }
      ];
    case "ai-chat":
      return [
        { label: "\u{1F4DD} Summary", q: "Summarize the key points from this conversation" },
        { label: "\u{1F4A1} Extract", q: "Extract actionable items and decisions from this chat" },
        ...base
      ];
    case "paper":
      return [
        { label: "\u{1F4DD} Abstract", q: "Summarize this paper's key contribution" },
        { label: "\u{1F9EA} Methods", q: "What methodology does this paper use?" },
        { label: "\u{1F4A1} Impact", q: "How is this relevant to my research?" },
        { label: "\u{1F517} Vault", q: "Connect this to my vault notes" }
      ];
    default:
      return [
        ...base,
        { label: "\u26A0\uFE0F Key risks", q: "What are the key risks or concerns here?" },
        { label: "\u27A1\uFE0F Next steps", q: "What should I do next based on this?" }
      ];
  }
}
function populateSmartChips() {
  const container = document.getElementById("mv-quick-actions");
  if (!container) return;
  detectedPageType = detectPageType();
  const chips = getChipsForPageType(detectedPageType);
  const chipStyle = "font-size:11px; padding:4px 10px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.15); border-radius:20px; color:#a78bfa; cursor:pointer; font-family:inherit; transition:all 0.2s;";
  container.innerHTML = chips.map(
    (c) => `<button class="mv-chip" data-q="${escapeHtml(c.q)}" style="${chipStyle}">${c.label}</button>`
  ).join("");
  container.querySelectorAll(".mv-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.q;
      if (q && !isSending) handleChatMessage(q);
    });
  });
}
function injectKeyframes() {
  if (document.getElementById("mv-keyframes")) return;
  const style = document.createElement("style");
  style.id = "mv-keyframes";
  style.textContent = `
    @keyframes mvSlideIn {
      from { transform: translateX(440px) scale(0.95); opacity: 0; }
      to { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes mvSlideOut {
      from { transform: translateX(0) scale(1); opacity: 1; }
      to { transform: translateX(440px) scale(0.95); opacity: 0; }
    }
    @keyframes mvPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
    @keyframes mvFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #mv-ai-overlay *::-webkit-scrollbar { width: 4px; }
    #mv-ai-overlay *::-webkit-scrollbar-track { background: transparent; }
    #mv-ai-overlay *::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.2); border-radius: 4px; }
    #mv-ai-overlay *::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.4); }
    .mv-chip:hover { background: rgba(139,92,246,0.15) !important; border-color: rgba(139,92,246,0.3) !important; }
    #mv-chat-send:hover { background: linear-gradient(135deg, rgba(139,92,246,0.5), rgba(99,102,241,0.5)) !important; color: white !important; }
    #mv-overlay-close-btn:hover { color: #ef4444 !important; }
    #mv-minimize-btn:hover, #mv-export-btn:hover, #mv-clear-btn:hover { color: #a78bfa !important; }
    .mv-copy-btn:hover, .mv-save-btn:hover { color: #a78bfa !important; }
  `;
  document.head.appendChild(style);
}
function handleChatMessage(question) {
  console.log("[MV Content] Chat:", question);
  isSending = true;
  const messagesDiv = document.getElementById("mv-chat-messages");
  const sendBtn = document.getElementById("mv-chat-send");
  const input = document.getElementById("mv-chat-input");
  if (sendBtn) {
    sendBtn.style.opacity = "0.4";
    sendBtn.style.pointerEvents = "none";
  }
  if (input) {
    input.disabled = true;
    input.style.opacity = "0.5";
  }
  const quickActions = document.getElementById("mv-quick-actions");
  if (quickActions && chatHistory.length > 0) {
    quickActions.style.display = "none";
  }
  if (messagesDiv) {
    messagesDiv.innerHTML += `
      <div style="margin-top:10px; padding:8px 12px; background:rgba(96,165,250,0.06); border:1px solid rgba(96,165,250,0.12); border-radius:10px; animation: mvFadeIn 0.3s ease;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <div style="font-size:10px; color:#60a5fa; font-weight:600; text-transform:uppercase; letter-spacing:0.3px;">You</div>
          <div style="font-size:9px; color:#374151;">${(/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div style="font-size:13px; color:#d1d5db; line-height:1.6;">${escapeHtml(question)}</div>
      </div>
      <div id="mv-thinking" style="margin-top:6px; padding:8px 12px; animation: mvFadeIn 0.3s ease;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#8b5cf6; animation: mvPulse 1s infinite;"></span>
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#8b5cf6; animation: mvPulse 1s infinite 0.2s;"></span>
          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#8b5cf6; animation: mvPulse 1s infinite 0.4s;"></span>
        </div>
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
      isSending = false;
      document.getElementById("mv-thinking")?.remove();
      if (sendBtn) {
        sendBtn.style.opacity = "1";
        sendBtn.style.pointerEvents = "auto";
      }
      if (input) {
        input.disabled = false;
        input.style.opacity = "1";
        input.focus();
      }
      let responseText = "";
      if (!response || response.error) {
        responseText = response?.error || "No response received";
        appendBrainMessage(`<span style="color:#ef4444;">${escapeHtml(responseText)}</span>`);
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
  const msgId = `mv-msg-${Date.now()}`;
  messagesDiv.innerHTML += `
    <div style="margin-top:6px; padding:8px 12px; background:rgba(139,92,246,0.05); border:1px solid rgba(139,92,246,0.1); border-radius:10px; animation: mvFadeIn 0.3s ease;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="font-size:10px; color:#a78bfa; font-weight:600; text-transform:uppercase; letter-spacing:0.3px;">Brain</div>
          <div style="font-size:9px; color:#374151;">${(/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div style="display:flex; gap:4px;">
          <button class="mv-copy-btn" data-msg-id="${msgId}" style="background:none; border:none; color:#4b5563; cursor:pointer; font-size:11px; padding:1px 4px; border-radius:3px; transition:color 0.2s;" title="Copy">\u{1F4CB}</button>
          <button class="mv-save-btn" data-msg-id="${msgId}" style="background:none; border:none; color:#4b5563; cursor:pointer; font-size:11px; padding:1px 4px; border-radius:3px; transition:color 0.2s;" title="Save to Vault">\u{1F4BE}</button>
        </div>
      </div>
      <div id="${msgId}" style="font-size:13px; color:#d1d5db; line-height:1.6;">${text}</div>
    </div>
  `;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  messagesDiv.querySelector(`.mv-copy-btn[data-msg-id="${msgId}"]`)?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const msgEl = document.getElementById(msgId);
    if (msgEl) {
      navigator.clipboard.writeText(msgEl.textContent || "");
      btn.textContent = "\u2705";
      setTimeout(() => {
        btn.textContent = "\u{1F4CB}";
      }, 1500);
    }
  });
  messagesDiv.querySelector(`.mv-save-btn[data-msg-id="${msgId}"]`)?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const msgEl = document.getElementById(msgId);
    if (msgEl) {
      saveToVault(msgEl.textContent || "");
      btn.textContent = "\u2705";
      setTimeout(() => {
        btn.textContent = "\u{1F4BE}";
      }, 2e3);
    }
  });
}
function autoAnalyze() {
  const context = document.body.innerText.substring(0, 2e3);
  const url = window.location.href;
  currentPageContext = context;
  currentPageUrl = url;
  chatHistory = [];
  chrome.runtime.sendMessage(
    {
      type: "CALL_TOOL",
      toolName: "process_browser_context",
      args: { url, context }
    },
    (response) => {
      if (!response || response.error) return;
      try {
        const resultText = response?.content?.[0]?.text;
        if (resultText) {
          const data = JSON.parse(resultText);
          if (data.uiPayload) {
            showAutoAnalyzePill(data.uiPayload);
          }
        }
      } catch {
      }
    }
  );
}
function showAutoAnalyzePill(payload) {
  if (document.getElementById("mv-auto-pill")) return;
  const pill = document.createElement("div");
  pill.id = "mv-auto-pill";
  pill.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 8px 14px !important;
    background: rgba(10, 10, 20, 0.95) !important;
    border: 1px solid rgba(139, 92, 246, 0.25) !important;
    border-radius: 24px !important;
    color: #c4b5fd !important;
    font-family: -apple-system, system-ui, sans-serif !important;
    font-size: 12px !important;
    cursor: pointer !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
    backdrop-filter: blur(20px) !important;
    animation: mvFadeIn 0.4s ease !important;
    transition: all 0.2s !important;
  `;
  pill.innerHTML = `
    <div style="width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px rgba(34,197,94,0.4);"></div>
    <span>\u{1F9E0} Brain ready \u2014 click to expand</span>
  `;
  pill._payload = payload;
  pill.addEventListener("click", () => {
    pill.remove();
    renderAIOverlay(pill._payload);
  });
  setTimeout(() => {
    pill.style.opacity = "0";
    setTimeout(() => pill.remove(), 300);
  }, 8e3);
  injectKeyframes();
  document.body.appendChild(pill);
}
function saveToVault(content) {
  const url = currentPageUrl || window.location.href;
  const title = document.title.substring(0, 80) || "Brain Capture";
  chrome.runtime.sendMessage(
    {
      type: "CALL_TOOL",
      toolName: "save_to_vault",
      args: { title, content, url, tags: "brain-capture,auto" }
    },
    (response) => {
      console.log("[MV Content] Save to vault:", response);
    }
  );
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
