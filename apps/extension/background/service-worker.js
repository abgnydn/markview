// MarkView Chrome Extension — Background Service Worker
// Handles: context menu for .md links, side panel toggling

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for .md links
  chrome.contextMenus.create({
    id: 'open-in-markview',
    title: 'Open in MarkView',
    contexts: ['link'],
    targetUrlPatterns: [
      '*://*/*.md',
      '*://*/*.md?*',
      '*://*/*.markdown',
      '*://*/*.MD',
    ],
  });

  // Create context menu for page (when on a .md page)
  chrome.contextMenus.create({
    id: 'view-page-in-markview',
    title: 'View this page in MarkView',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://*/*.md',
      '*://*/*.md?*',
      '*://*/*.markdown',
      '*://raw.githubusercontent.com/*',
    ],
  });
});

// Handle toolbar icon click — toggle side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  let url = '';

  if (info.menuItemId === 'open-in-markview' && info.linkUrl) {
    url = info.linkUrl;
  } else if (info.menuItemId === 'view-page-in-markview' && info.pageUrl) {
    url = info.pageUrl;
  }

  if (!url) return;

  // Convert GitHub URLs to raw content URLs
  const rawUrl = convertToRawUrl(url);

  // Open side panel and pass the URL
  await chrome.sidePanel.open({ tabId: tab.id });

  // Send message to side panel with the URL to fetch
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'LOAD_URL',
      url: rawUrl,
      originalUrl: url,
    });
  }, 500);
});

// Convert GitHub blob URLs to raw URLs
function convertToRawUrl(url) {
  // GitHub: github.com/user/repo/blob/branch/file.md → raw.githubusercontent.com/user/repo/branch/file.md
  const ghMatch = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/
  );
  if (ghMatch) {
    return `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}`;
  }
  return url;
}
