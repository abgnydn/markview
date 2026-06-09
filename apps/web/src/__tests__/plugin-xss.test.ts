// @vitest-environment node
//
// Regression guard for the code-fence plugin XSS hole: plugin renderers
// build raw HTML that is injected via dangerouslySetInnerHTML AFTER the
// markdown sanitizer runs, so any unescaped user value is live script.
// These tests assert that an `<img onerror>` / attribute-breakout payload
// in each plugin's input never survives into the rendered HTML.

import { describe, it, expect } from 'vitest';
import {
  alertPlugin, chartPlugin, tabsPlugin, timelinePlugin, csvPlugin, mapPlugin, escapeHtml,
} from '@/lib/plugins/plugin-registry';
import { embedPlugin } from '@/lib/plugins/embed-plugin';

const PAYLOAD = '<img src=x onerror=alert(document.cookie)>';

// The live-injection signal is an actual `<img` tag reaching the DOM —
// none of these plugins ever emit one, so if the payload's tag survives
// unescaped it shows up here. (Escaped text like `&lt;img … onerror=…`
// is inert: the `<` is encoded, so no element is created.)
function assertNoLiveInjection(html: string) {
  expect(html.toLowerCase()).not.toContain('<img');
}

describe('plugin XSS hardening', () => {
  it('escapeHtml neutralises the payload', () => {
    expect(escapeHtml(PAYLOAD)).toBe('&lt;img src=x onerror=alert(document.cookie)&gt;');
  });

  it('alert escapes the body', () => {
    assertNoLiveInjection(alertPlugin.render(`NOTE\n${PAYLOAD}`, 'dark'));
  });

  it('chart escapes labels', () => {
    assertNoLiveInjection(chartPlugin.render(`${PAYLOAD}: 5`, 'dark'));
  });

  it('tabs escapes title and body', () => {
    assertNoLiveInjection(tabsPlugin.render(`${PAYLOAD}\n${PAYLOAD}`, 'dark'));
  });

  it('timeline escapes date and text', () => {
    assertNoLiveInjection(timelinePlugin.render(`${PAYLOAD}: ${PAYLOAD}`, 'dark'));
  });

  it('csv escapes headers and cells', () => {
    assertNoLiveInjection(csvPlugin.render(`a,b\n${PAYLOAD},${PAYLOAD}`, 'dark'));
  });

  it('map escapes the label and rejects non-numeric lat/lng', () => {
    const html = mapPlugin.render(`lat: 1\nlng: 1\nlabel: ${PAYLOAD}`, 'dark');
    assertNoLiveInjection(html);
    // A non-numeric coordinate must not reach the iframe src.
    const bad = mapPlugin.render('lat: 1"></iframe><img src=x onerror=alert(1)>\nlng: 1', 'dark');
    assertNoLiveInjection(bad);
  });

  it('embed rejects attribute-breakout in the generic iframe fallback', () => {
    const html = embedPlugin.render('http://example.com/"></iframe><img src=x onerror=alert(1)>', 'dark');
    assertNoLiveInjection(html);
  });

  it('embed escapes the tweet permalink href', () => {
    const html = embedPlugin.render('https://twitter.com/a/status/1"><img src=x onerror=alert(1)>', 'dark');
    assertNoLiveInjection(html);
  });
});
