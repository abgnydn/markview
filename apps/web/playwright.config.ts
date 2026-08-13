import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 2 workers: each test gets an isolated context (fresh IndexedDB), so
  // the old 'IndexedDB timing is flaky in parallel' single-worker rule
  // was superstition — and it serialized a 5-minute suite.
  workers: process.env.CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Pin the port (vite silently falls back to 3001 when 3000 is taken,
    // which strands the suite against baseURL) and give CI's cold start
    // room to breathe.
    command: 'bunx vite --port 3000 --strictPort',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
