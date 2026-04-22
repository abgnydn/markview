/**
 * MarkView Context Bridge — Content Script
 * 
 * Injected into chatgpt.com, claude.ai, and GitHub.
 * Implements the Tripartite Fusion: Scrapes DOM and renders AI UI payloads over WebRTC.
 */

let isConnected = false;
let injectedButton = null;

// Listen for connection state changes from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CONNECTION_STATE') {
    isConnected = msg.state === 'connected';
    console.log('[MV Content] Connection state changed:', msg.state);
    updateButton();
  } else if (msg.type === 'RENDER_AI_UI') {
    renderAIOverlay(msg.payload);
  }
});

// Check initial state from storage instead of messaging offscreen directly
chrome.storage.local.get(['connectionState'], (result) => {
  if (result.connectionState === 'connected') {
    isConnected = true;
  } else {
    // Fallback to messaging
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
      if (response && response.state === 'connected') {
        isConnected = true;
      }
      updateButton();
    });
  }
  // Start observing for the context injection points
  waitForInjectionPoints();
});

function waitForInjectionPoints() {
  const observer = new MutationObserver(() => {
    if (!injectedButton) {
      const container = findInputContainer();
      if (container) {
        injectButton(container);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const container = findInputContainer();
  if (container) {
    injectButton(container);
  }
}

function findInputContainer() {
  const host = location.hostname;

  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    const textarea = document.querySelector('#prompt-textarea');
    if (textarea) return textarea.closest('form') || textarea.parentElement;
  }

  if (host.includes('claude.ai')) {
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor) return editor.closest('form') || editor.parentElement?.parentElement;
  }

  if (host.includes('github.com')) {
    const prBody = document.querySelector('.pull-discussion-timeline');
    if (prBody) return document.querySelector('.gh-header-actions') || prBody;
  }

  return null;
}

function injectButton(container) {
  if (injectedButton) return;

  // Clean up orphaned elements from previous extension reloads
  const existingBtn = document.getElementById('markview-context-bridge');
  if (existingBtn) existingBtn.remove();

  injectedButton = document.createElement('div');
  injectedButton.id = 'markview-context-bridge';
  injectedButton.innerHTML = `
    <button id="mvContextBtn" class="mv-context-btn">
      <span class="mv-dot"></span>
      <span class="mv-label">MarkView Brain</span>
    </button>
  `;

  container.style.position = container.style.position || 'relative';
  container.insertBefore(injectedButton, container.firstChild);

  updateButton();

  document.getElementById('mvContextBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[MV Content] Button clicked. isConnected:', isConnected);

    // ALWAYS do a live check — chrome.storage state can be stale from previous sessions
    const liveState = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        console.log('[MV Content] Live state check:', response);
        resolve(response?.state || 'disconnected');
      });
    });

    if (liveState !== 'connected') {
      console.log('[MV Content] DataChannel not open. Triggering auto-reconnect...');
      isConnected = false;
      updateButton();
      
      // Try auto-reconnect
      chrome.runtime.sendMessage({ 
        type: 'CONNECT', 
        roomId: 'local-vault', 
        signalingUrl: 'ws://localhost:4445' 
      });
      
      renderAIOverlay(`
        <p style="color:#f59e0b; font-size:14px;">
          ⚠️ DataChannel was stale. Auto-reconnecting...<br>
          <span style="color:#9ca3af; font-size:12px;">Wait 3 seconds, then click MarkView Brain again.</span>
        </p>
      `);
      return;
    }

    // Scrape the context (limit to 2000 chars for standard WebRTC packet limits)
    const context = document.body.innerText.substring(0, 2000); 
    const url = window.location.href;

    // Store for chat follow-ups
    currentPageContext = context;
    currentPageUrl = url;
    chatHistory = []; // Reset chat on new analysis

    console.log('[MV Content] Sending CALL_TOOL, context length:', context.length);

    // Visual: turn dot orange (pulsing)
    const dot = document.querySelector('.mv-dot');
    const label = document.querySelector('.mv-label');
    if (dot) dot.classList.add('pulsing');
    if (label) label.textContent = 'Thinking...';
    
    chrome.runtime.sendMessage({
      type: 'CALL_TOOL',
      toolName: 'process_browser_context',
      args: { url, context }
    }, (response) => {
      console.log('[MV Content] Got response from CALL_TOOL:', JSON.stringify(response).substring(0, 300));

      // Reset visual state
      if (dot) dot.classList.remove('pulsing');
      if (label) label.textContent = 'Brain · Linked';

      // Handle errors
      if (!response) {
        console.error('[MV Content] Response is null/undefined');
        renderAIOverlay('<p style="color:#ef4444;">No response received from the MCP server. The request may have timed out.</p>');
        return;
      }

      if (response.error) {
        console.error('[MV Content] Error response:', response.error);
        renderAIOverlay(`<p style="color:#ef4444;">Error: ${response.error}</p>`);
        return;
      }

      // Parse the MCP tool result
      try {
        const resultText = response?.content?.[0]?.text;
        console.log('[MV Content] resultText:', resultText ? resultText.substring(0, 200) : 'EMPTY');
        
        if (resultText) {
          const data = JSON.parse(resultText);
          if (data.uiPayload) {
            console.log('[MV Content] Rendering UI overlay');
            renderAIOverlay(data.uiPayload);
          } else {
            console.error('[MV Content] No uiPayload in parsed data:', Object.keys(data));
            renderAIOverlay(`<p style="color:#f59e0b;">Response received but no UI payload. Keys: ${Object.keys(data).join(', ')}</p>`);
          }
        } else {
          console.error('[MV Content] No content[0].text in response. Full response:', JSON.stringify(response).substring(0, 500));
          renderAIOverlay(`<p style="color:#f59e0b;">Unexpected response format. Check console for details.</p>`);
        }
      } catch (e) {
        console.error('[MV Content] Failed to parse AI payload:', e, 'Raw response:', JSON.stringify(response).substring(0, 500));
        renderAIOverlay(`<p style="color:#ef4444;">Parse error: ${e.message}</p>`);
      }
    });
  });
}

function updateButton() {
  const dot = document.querySelector('.mv-dot');
  const label = document.querySelector('.mv-label');
  if (!dot || !label) return;

  if (isConnected) {
    dot.classList.add('connected');
    label.textContent = 'Brain · Linked';
  } else {
    dot.classList.remove('connected');
    label.textContent = 'Brain · Offline';
  }
}

// --- Chat state ---
let chatHistory = []; // [{role: 'user'|'assistant', content: string}]
let currentPageContext = '';
let currentPageUrl = '';

function renderAIOverlay(htmlPayload, isFollowUp = false) {
  console.log('[MV Content] renderAIOverlay called, isFollowUp:', isFollowUp);
  
  let overlay = document.getElementById('mv-ai-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mv-ai-overlay';
    
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
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(167, 139, 250, 0.1) !important;
      color: white !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      animation: mvSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
    `;

    if (!document.getElementById('mv-keyframes')) {
      const style = document.createElement('style');
      style.id = 'mv-keyframes';
      style.textContent = `
        @keyframes mvSlideIn {
          from { transform: translateX(440px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes mvPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    overlay.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(0,0,0,0.3); border-radius:12px 12px 0 0; flex-shrink:0;">
        <span style="font-size:13px; font-weight:700; color:#a78bfa; letter-spacing:0.5px;">⚡ MarkView Brain</span>
        <button id="mv-overlay-close-btn" style="background:none; border:none; color:#9ca3af; cursor:pointer; font-size:18px; padding:2px 6px; border-radius:4px;">✕</button>
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
        <div style="font-size:10px; color:#4b5563; margin-top:6px; text-align:center;">qwen3:0.6b · local · zero cloud</div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire up close
    document.getElementById('mv-overlay-close-btn').addEventListener('click', () => {
      overlay.remove();
      chatHistory = [];
    });

    // Wire up chat input
    const input = document.getElementById('mv-chat-input');
    const sendBtn = document.getElementById('mv-chat-send');

    const sendChat = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      handleChatMessage(q);
    };

    sendBtn.addEventListener('click', sendChat);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    });
  }

  // Append content to chat messages area
  const messagesDiv = document.getElementById('mv-chat-messages');
  if (messagesDiv) {
    if (isFollowUp) {
      // Append just the new response
      messagesDiv.innerHTML += htmlPayload;
    } else {
      // Initial analysis — reset and show
      messagesDiv.innerHTML = htmlPayload;
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Focus the input
  setTimeout(() => {
    const input = document.getElementById('mv-chat-input');
    if (input) input.focus();
  }, 100);
}

function handleChatMessage(question) {
  console.log('[MV Content] Chat question:', question);

  // Add user message to UI
  const messagesDiv = document.getElementById('mv-chat-messages');
  if (messagesDiv) {
    messagesDiv.innerHTML += `
      <div style="margin-top:12px; padding:8px 12px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.2); border-radius:8px;">
        <div style="font-size:11px; color:#60a5fa; margin-bottom:4px; font-weight:600;">You</div>
        <div style="font-size:13px; color:#e5e7eb; line-height:1.5;">${question}</div>
      </div>
    `;
    // Add thinking indicator
    messagesDiv.innerHTML += `
      <div id="mv-thinking" style="margin-top:8px; padding:8px 12px;">
        <span style="font-size:12px; color:#a78bfa; animation: mvPulse 1.5s infinite;">Thinking...</span>
      </div>
    `;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Add to history
  chatHistory.push({ role: 'user', content: question });

  // Get fresh page context
  const context = currentPageContext || document.body.innerText.substring(0, 2000);
  const url = currentPageUrl || window.location.href;

  // Send to MCP
  chrome.runtime.sendMessage({
    type: 'CALL_TOOL',
    toolName: 'process_browser_context',
    args: { 
      url, 
      context,
      question,
      history: JSON.stringify(chatHistory)
    }
  }, (response) => {
    console.log('[MV Content] Chat response received');

    // Remove thinking indicator
    const thinking = document.getElementById('mv-thinking');
    if (thinking) thinking.remove();

    let responseText = '';

    if (!response || response.error) {
      responseText = response?.error || 'No response received';
      appendBrainMessage(`<span style="color:#ef4444;">${responseText}</span>`);
      return;
    }

    try {
      const resultText = response?.content?.[0]?.text;
      if (resultText) {
        const data = JSON.parse(resultText);
        // Extract the LLM text from the HTML payload
        if (data.uiPayload) {
          // Parse the analysis text from the payload
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data.uiPayload;
          const firstP = tempDiv.querySelector('p');
          responseText = firstP ? firstP.textContent : data.uiPayload;
        }
      }
    } catch (e) {
      responseText = 'Failed to parse response';
    }

    chatHistory.push({ role: 'assistant', content: responseText });
    appendBrainMessage(responseText);
  });
}

function appendBrainMessage(text) {
  const messagesDiv = document.getElementById('mv-chat-messages');
  if (!messagesDiv) return;

  messagesDiv.innerHTML += `
    <div style="margin-top:8px; padding:8px 12px; background:rgba(167,139,250,0.08); border:1px solid rgba(167,139,250,0.15); border-radius:8px;">
      <div style="font-size:11px; color:#a78bfa; margin-bottom:4px; font-weight:600;">Brain</div>
      <div style="font-size:13px; color:#e5e7eb; line-height:1.5;">${text}</div>
    </div>
  `;
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

