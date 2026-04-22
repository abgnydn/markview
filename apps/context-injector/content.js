/**
 * MarkView Context Bridge — Content Script
 * 
 * Injected into chatgpt.com and claude.ai.
 * Adds a "Connect Local Context" button near the chat input area.
 */

let isConnected = false;
let injectedButton = null;

// Listen for connection state changes from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CONNECTION_STATE') {
    isConnected = msg.state === 'connected';
    updateButton();
  }
});

// Check initial state
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  if (response) {
    isConnected = response.state === 'connected';
  }
  // Start observing for the chat input
  waitForChatInput();
});

function waitForChatInput() {
  // Different selectors for different AI chat sites
  const observer = new MutationObserver(() => {
    if (!injectedButton) {
      const container = findInputContainer();
      if (container) {
        injectButton(container);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately
  const container = findInputContainer();
  if (container) {
    injectButton(container);
  }
}

function findInputContainer() {
  const host = location.hostname;

  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    // ChatGPT: look for the main textarea container
    const textarea = document.querySelector('#prompt-textarea');
    if (textarea) {
      return textarea.closest('form') || textarea.parentElement;
    }
  }

  if (host.includes('claude.ai')) {
    // Claude: look for the content editable div
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor) {
      return editor.closest('form') || editor.parentElement?.parentElement;
    }
  }

  return null;
}

function injectButton(container) {
  if (injectedButton) return;

  injectedButton = document.createElement('div');
  injectedButton.id = 'markview-context-bridge';
  injectedButton.innerHTML = `
    <button id="mvContextBtn" class="mv-context-btn">
      <span class="mv-dot"></span>
      <span class="mv-label">MarkView</span>
    </button>
    <div id="mvContextPanel" class="mv-context-panel" style="display: none;">
      <div class="mv-panel-header">
        <span>📂 Local Files</span>
        <button id="mvClosePanel" class="mv-close-btn">×</button>
      </div>
      <div id="mvFileList" class="mv-file-list">
        <div class="mv-loading">Loading files...</div>
      </div>
    </div>
  `;

  // Insert before or near the container
  container.style.position = container.style.position || 'relative';
  container.insertBefore(injectedButton, container.firstChild);

  updateButton();

  // Button click handler
  document.getElementById('mvContextBtn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isConnected) {
      // Open the extension popup
      alert('MarkView Context Bridge is not connected.\n\nClick the MarkView extension icon in your toolbar to connect to your local machine first.');
      return;
    }

    const panel = document.getElementById('mvContextPanel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      loadFileList();
    }
  });

  document.getElementById('mvClosePanel').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('mvContextPanel').style.display = 'none';
  });
}

function updateButton() {
  const dot = document.querySelector('.mv-dot');
  const label = document.querySelector('.mv-label');
  if (!dot || !label) return;

  if (isConnected) {
    dot.classList.add('connected');
    label.textContent = 'MarkView · Linked';
  } else {
    dot.classList.remove('connected');
    label.textContent = 'MarkView';
  }
}

async function loadFileList() {
  const fileListEl = document.getElementById('mvFileList');
  fileListEl.innerHTML = '<div class="mv-loading">Fetching local files via P2P...</div>';

  chrome.runtime.sendMessage({ type: 'CALL_TOOL', toolName: 'list_documents', args: {} }, (response) => {
    if (!response || response.error) {
      fileListEl.innerHTML = `<div class="mv-error">Error: ${response?.error || 'No response'}</div>`;
      return;
    }

    try {
      // Parse the tool result — MCP returns content array
      const content = response.content || [];
      const textContent = content.find((c) => c.type === 'text');
      if (!textContent) {
        fileListEl.innerHTML = '<div class="mv-error">No files found</div>';
        return;
      }

      const data = JSON.parse(textContent.text);
      const files = data.documents || data.files || [];

      if (files.length === 0) {
        fileListEl.innerHTML = '<div class="mv-empty">No markdown files found</div>';
        return;
      }

      fileListEl.innerHTML = '';
      files.forEach((file) => {
        const fileName = typeof file === 'string' ? file : file.name || file.path || JSON.stringify(file);
        const item = document.createElement('div');
        item.className = 'mv-file-item';
        item.textContent = `📄 ${fileName}`;
        item.addEventListener('click', () => insertFileContent(fileName));
        fileListEl.appendChild(item);
      });
    } catch (e) {
      fileListEl.innerHTML = `<div class="mv-error">Parse error: ${e.message}</div>`;
    }
  });
}

async function insertFileContent(fileName) {
  const fileListEl = document.getElementById('mvFileList');
  fileListEl.innerHTML = `<div class="mv-loading">Reading ${fileName}...</div>`;

  chrome.runtime.sendMessage({
    type: 'CALL_TOOL',
    toolName: 'get_document',
    args: { path: fileName },
  }, (response) => {
    if (!response || response.error) {
      fileListEl.innerHTML = `<div class="mv-error">${response?.error || 'Failed to read file'}</div>`;
      return;
    }

    try {
      const content = response.content || [];
      const textContent = content.find((c) => c.type === 'text');
      const fileText = textContent?.text || '';

      // Insert into the chat input
      const host = location.hostname;
      let inserted = false;

      if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
        const textarea = document.querySelector('#prompt-textarea');
        if (textarea) {
          // ChatGPT uses a contenteditable <p> element nowadays
          const p = textarea.querySelector('p') || textarea;
          p.textContent = `Here is the content of my local file "${fileName}":\n\n${fileText}\n\nPlease analyze this file.`;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          inserted = true;
        }
      }

      if (host.includes('claude.ai')) {
        const editor = document.querySelector('[contenteditable="true"]');
        if (editor) {
          editor.innerHTML = `<p>Here is the content of my local file "${fileName}":</p><p></p><p>${fileText}</p><p></p><p>Please analyze this file.</p>`;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          inserted = true;
        }
      }

      if (inserted) {
        document.getElementById('mvContextPanel').style.display = 'none';
        fileListEl.innerHTML = '<div class="mv-success">✅ Content injected into prompt!</div>';
      } else {
        fileListEl.innerHTML = '<div class="mv-error">Could not find chat input</div>';
      }
    } catch (e) {
      fileListEl.innerHTML = `<div class="mv-error">${e.message}</div>`;
    }
  });
}
