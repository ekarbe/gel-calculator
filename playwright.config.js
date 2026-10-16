import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = !!process.env.CI;

/**
 * Playwright smoke tests against the static export in ./out.
 * Build first (`npm run build`), then `npm run test:e2e`.
 * Set PW_CHROMIUM_EXECUTABLE to use a preinstalled Chromium instead of the
 * one downloaded by `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/gel-calculator/`,
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: `http://localhost:${PORT}/gel-calculator/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
});
