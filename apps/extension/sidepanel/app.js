// MarkView Chrome Extension — Side Panel App
// Vanilla JS for minimal bundle size in extension context

(function () {
  'use strict';

  const dropZone = document.getElementById('drop-zone');
  const viewer = document.getElementById('viewer');
  const markdownContent = document.getElementById('markdown-content');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const themeToggle = document.getElementById('theme-toggle');

  let currentTheme = 'dark';

  // ---- Theme ----
  function initTheme() {
    const saved = localStorage.getItem('markview-theme');
    if (saved) {
      currentTheme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      currentTheme = 'light';
    }
    applyTheme();
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('markview-theme', currentTheme);
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  // ---- File Handling ----
  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(
      (f) => f.name.endsWith('.md') || f.name.endsWith('.markdown')
    );
    if (files.length === 0) return;

    // Read the first file
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      renderMarkdown(content);
    };
    reader.readAsText(files[0]);
  }

  // ---- Simple Markdown Rendering ----
  // Uses basic regex-based rendering for the extension scaffold
  // Will be replaced with the full unified pipeline when we integrate the shared package
  function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Headers
    html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Code blocks
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>'
    );

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Unordered lists
    html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Blockquotes (basic)
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');

    // Tables (basic)
    html = html.replace(
      /^\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/gm,
      function (match, header, body) {
        const headerCells = header.split('|').map((c) => c.trim()).filter(Boolean);
        const rows = body.trim().split('\n');
        let table = '<table><thead><tr>';
        headerCells.forEach((cell) => { table += `<th>${cell}</th>`; });
        table += '</tr></thead><tbody>';
        rows.forEach((row) => {
          const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
          table += '<tr>';
          cells.forEach((cell) => { table += `<td>${cell}</td>`; });
          table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
      }
    );

    // Paragraphs (wrap remaining text)
    html = html.replace(/^(?!<[hbuolptid])((?!<).+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');

    showViewer(html);
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showViewer(html) {
    dropZone.hidden = true;
    viewer.hidden = false;
    markdownContent.innerHTML = html;
  }

  function showDropZone() {
    dropZone.hidden = false;
    viewer.hidden = true;
    markdownContent.innerHTML = '';
  }

  // ---- URL Loading (from background script) ----
  async function loadFromUrl(url) {
    showViewer('<div class="loading">Loading...</div>');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      renderMarkdown(text);
    } catch (err) {
      showViewer(`<div class="loading">Failed to load: ${escapeHtml(err.message)}</div>`);
    }
  }

  // ---- Event Listeners ----
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);

  // Browse button
  browseBtn.addEventListener('click', () => fileInput.click());

  // File input
  fileInput.addEventListener('change', (e) => {
    if (e.target.files) handleFiles(e.target.files);
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'LOAD_URL' && message.url) {
      loadFromUrl(message.url);
    }
  });

  // ---- Initialize ----
  initTheme();
})();
