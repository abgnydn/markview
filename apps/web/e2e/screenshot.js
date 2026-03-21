import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Create context with coerced dark mode preference
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark'
  });

  const page = await context.newPage();
  
  // Emulate media features for extra safety
  await page.emulateMedia({ colorScheme: 'dark' });
  
  await page.goto('http://localhost:3000/');
  
  // Click the subtle "Try the Demo" button that sets up the fake workspace
  await page.click('button:has-text("Try the Demo")');
  
  // Actually wait for elements to render
  await page.waitForTimeout(3000);

  // Take the glorious screenshot
  await page.screenshot({ path: 'public/landing-screenshot.png' });
  console.log("Screenshot successfully saved to public/landing-screenshot.png in Dark Mode");
  
  await browser.close();
})();
