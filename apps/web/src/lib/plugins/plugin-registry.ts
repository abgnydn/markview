'use client';

import { create } from 'zustand';

/**
 * A plugin defines a custom renderer for a specific code-fence language.
 * When rendering, if a code block has `language-{id}`, the plugin's render
 * function is called instead of the default Shiki highlighter.
 */
export interface CodeFencePlugin {
  /** Unique language identifier, e.g. 'chart', 'alert', 'tabs'. Used as ```chart */
  id: string;
  /** Human-readable name */
  name: string;
  /** Render code block content to HTML. Receives the raw text inside the fence. */
  render: (content: string, theme: 'dark' | 'light') => string;
}

interface PluginStore {
  plugins: Map<string, CodeFencePlugin>;
  register: (plugin: CodeFencePlugin) => void;
  unregister: (id: string) => void;
  getPlugin: (id: string) => CodeFencePlugin | undefined;
  getAll: () => CodeFencePlugin[];
}

export const usePluginStore = create<PluginStore>()((set, get) => ({
  plugins: new Map<string, CodeFencePlugin>(),

  register: (plugin) => {
    set((state) => {
      const next = new Map(state.plugins);
      next.set(plugin.id, plugin);
      return { plugins: next };
    });
  },

  unregister: (id) => {
    set((state) => {
      const next = new Map(state.plugins);
      next.delete(id);
      return { plugins: next };
    });
  },

  getPlugin: (id) => get().plugins.get(id),

  getAll: () => Array.from(get().plugins.values()),
}));

// ═══════════════════════════════════════════════
// Built-in Plugins
// ═══════════════════════════════════════════════

/** ```alert — renders GitHub-style alerts (NOTE, TIP, WARNING, CAUTION, IMPORTANT) */
export const alertPlugin: CodeFencePlugin = {
  id: 'alert',
  name: 'Alert Box',
  render: (content, theme) => {
    const lines = content.trim().split('\n');
    const firstLine = lines[0]?.toUpperCase().trim() || 'NOTE';
    const typeMap: Record<string, { icon: string; color: string; label: string }> = {
      NOTE:      { icon: 'ℹ️', color: '#58a6ff', label: 'Note' },
      TIP:       { icon: '💡', color: '#3fb950', label: 'Tip' },
      IMPORTANT: { icon: '❗', color: '#a371f7', label: 'Important' },
      WARNING:   { icon: '⚠️', color: '#d29922', label: 'Warning' },
      CAUTION:   { icon: '🔴', color: '#f85149', label: 'Caution' },
    };

    const type = typeMap[firstLine] || typeMap['NOTE'];
    const bodyLines = typeMap[firstLine] ? lines.slice(1) : lines;
    const body = bodyLines.join('<br/>');

    return `<div class="plugin-alert" style="border-left: 4px solid ${type.color}; padding: 12px 16px; border-radius: 6px; background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}; margin: 12px 0;">
      <div style="font-weight: 600; color: ${type.color}; margin-bottom: 6px; font-size: 0.85rem;">${type.icon} ${type.label}</div>
      <div style="font-size: 0.88rem; line-height: 1.6;">${body}</div>
    </div>`;
  },
};

/** ```chart — simple inline bar chart from key:value pairs */
export const chartPlugin: CodeFencePlugin = {
  id: 'chart',
  name: 'Bar Chart',
  render: (content, theme) => {
    const lines = content.trim().split('\n').filter((l) => l.includes(':'));
    const entries = lines.map((l) => {
      const [label, ...rest] = l.split(':');
      const value = parseFloat(rest.join(':').trim()) || 0;
      return { label: label.trim(), value };
    });

    if (entries.length === 0) return '<p>No chart data</p>';

    const max = Math.max(...entries.map((e) => e.value));
    const barColor = theme === 'dark' ? '#58a6ff' : '#0969da';
    const bgColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = theme === 'dark' ? '#c9d1d9' : '#24292f';

    const bars = entries.map((e) => {
      const pct = max > 0 ? (e.value / max) * 100 : 0;
      return `<div style="display: flex; align-items: center; gap: 10px; margin: 4px 0;">
        <span style="width: 100px; text-align: right; font-size: 0.8rem; color: ${textColor}; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.label}</span>
        <div style="flex: 1; height: 22px; background: ${bgColor}; border-radius: 4px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.3s;"></div>
        </div>
        <span style="width: 50px; font-size: 0.75rem; color: ${textColor}; opacity: 0.7;">${e.value}</span>
      </div>`;
    }).join('');

    return `<div class="plugin-chart" style="padding: 16px; border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; border-radius: 8px; margin: 12px 0;">
      ${bars}
    </div>`;
  },
};

/** ```tabs — tabbed content separated by --- lines */
export const tabsPlugin: CodeFencePlugin = {
  id: 'tabs',
  name: 'Tabs',
  render: (content, theme) => {
    const sections = content.split(/^---$/m).map((s) => s.trim()).filter(Boolean);
    if (sections.length === 0) return '<p>No tab content</p>';

    const tabId = `tabs-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const activeColor = theme === 'dark' ? '#58a6ff' : '#0969da';
    const bgColor = theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

    const tabs = sections.map((s, i) => {
      const firstLine = s.split('\n')[0] || `Tab ${i + 1}`;
      const body = s.split('\n').slice(1).join('\n') || s;
      return { title: firstLine.replace(/^#+\s*/, ''), body };
    });

    const tabButtons = tabs.map((t, i) =>
      `<button onclick="document.querySelectorAll('[data-tabgroup=\\'${tabId}\\'] .plugin-tab-pane').forEach(p=>p.style.display='none'); document.querySelectorAll('[data-tabgroup=\\'${tabId}\\'] .plugin-tab-btn').forEach(b=>{b.style.borderBottom='2px solid transparent'; b.style.color='inherit'; b.style.opacity='0.6';}); document.getElementById('${tabId}-${i}').style.display='block'; this.style.borderBottom='2px solid ${activeColor}'; this.style.color='${activeColor}'; this.style.opacity='1';"
        class="plugin-tab-btn" style="padding: 8px 16px; border: none; background: none; cursor: pointer; font-size: 0.82rem; font-weight: 500; color: inherit; border-bottom: 2px solid ${i === 0 ? activeColor : 'transparent'}; opacity: ${i === 0 ? '1' : '0.6'}; ${i === 0 ? `color: ${activeColor};` : ''}">${t.title}</button>`
    ).join('');

    const tabPanes = tabs.map((t, i) =>
      `<div id="${tabId}-${i}" class="plugin-tab-pane" style="display: ${i === 0 ? 'block' : 'none'}; padding: 12px 16px; font-size: 0.88rem; white-space: pre-wrap; line-height: 1.6;">${t.body}</div>`
    ).join('');

    return `<div class="plugin-tabs" data-tabgroup="${tabId}" style="border: 1px solid ${borderColor}; border-radius: 8px; overflow: hidden; margin: 12px 0;">
      <div style="display: flex; border-bottom: 1px solid ${borderColor}; background: ${bgColor};">${tabButtons}</div>
      ${tabPanes}
    </div>`;
  },
};

/** ```timeline — vertical timeline from labeled entries */
export const timelinePlugin: CodeFencePlugin = {
  id: 'timeline',
  name: 'Timeline',
  render: (content, theme) => {
    const lines = content.trim().split('\n').filter((l) => l.includes(':'));
    const entries = lines.map((l) => {
      const idx = l.indexOf(':');
      return { date: l.slice(0, idx).trim(), text: l.slice(idx + 1).trim() };
    });

    if (entries.length === 0) return '<p>No timeline data</p>';

    const dotColor = theme === 'dark' ? '#58a6ff' : '#0969da';
    const lineColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const textColor = theme === 'dark' ? '#c9d1d9' : '#24292f';

    const items = entries.map((e) =>
      `<div style="display: flex; gap: 12px; padding-bottom: 20px; position: relative;">
        <div style="display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; z-index: 1;"></div>
          <div style="width: 2px; flex: 1; background: ${lineColor};"></div>
        </div>
        <div>
          <div style="font-size: 0.75rem; font-weight: 600; color: ${dotColor}; margin-bottom: 2px;">${e.date}</div>
          <div style="font-size: 0.85rem; color: ${textColor};">${e.text}</div>
        </div>
      </div>`
    ).join('');

    return `<div class="plugin-timeline" style="padding: 12px; margin: 12px 0;">${items}</div>`;
  },
};

// Register built-ins on module load
function registerBuiltins() {
  const store = usePluginStore.getState();
  store.register(alertPlugin);
  store.register(chartPlugin);
  store.register(tabsPlugin);
  store.register(timelinePlugin);
}

// Auto-register when this module is first imported
registerBuiltins();
