import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 3000);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
// Use a preinstalled Chromium when present (CI images, sandboxes); otherwise Playwright's own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, actionTimeout: 30_000, navigationTimeout: 90_000, locale: 'es-MX', timezoneId: 'America/Mexico_City', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    // CI runs against the production build (`npm run build` first); locally the dev server is reused.
    command: process.env.CI ? `npx next start --hostname 127.0.0.1 --port ${port}` : `npx next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { NEXUS_DEMO_MODE: 'local', NEXT_PUBLIC_APP_URL: baseURL },
  },
});
