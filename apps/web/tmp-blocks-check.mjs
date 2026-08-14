import { chromium } from '@playwright/test';
const S = process.env.SNAPDIR;
const b = await chromium.launch({ headless: false });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto('http://localhost:4173/');
await page.locator('.ed-cta-primary').click();
await page.waitForSelector('.viewer-layout', { timeout: 15000 });
await page.waitForTimeout(2500);
await page.getByText('blocks', { exact: true }).first().click();
await page.waitForTimeout(4500);
const state = await page.evaluate(() => {
  const md = document.querySelector('.markdown-content');
  return {
    chart: !!md?.querySelector('[class*="chart"]'),
    tabs: !!md?.querySelector('[class*="tab"]'),
    timeline: !!md?.querySelector('[class*="timeline"]'),
    csv: !!md?.querySelector('[class*="csv"] table, table'),
    map: !!md?.querySelector('iframe[src*="openstreetmap"]'),
    embed: !!md?.querySelector('iframe[src*="youtube"]'),
    mark: !!md?.querySelector('mark'),
    sup: !!md?.querySelector('sup'),
    sub: !!md?.querySelector('sub'),
    emoji: md?.textContent?.includes('✨'),
    wikilink: !!md?.querySelector('a[href*="02-typography"]'),
    transclusionBroken: md?.textContent?.includes('Embedded note not found') ?? false,
    transclusionWorked: md?.textContent?.includes('Inline') ?? false,
  };
});
console.log('BLOCKS ' + JSON.stringify(state));
console.log('ERRORS ' + JSON.stringify(errors.slice(0, 4)));
await page.screenshot({ path: `${S}/blocks-top.png`, fullPage: false });
await b.close();
