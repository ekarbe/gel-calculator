/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = !!process.env.CI;

/**
 * Playwright end-to-end tests against the static export in ./out.
 * Build first (`npm run build`), then `npm run test:e2e`.
 * Set PW_CHROMIUM_EXECUTABLE to use a preinstalled Chromium instead of the
 * one downloaded by `npx playwright install chromium`.
 *
 * Two projects: a desktop Chrome window and a 390 × 844 phone (Pixel 7,
 * touch). A test tagged `@phone` runs only on the phone, one tagged
 * `@desktop` only on the desktop (for example a test that sets its own
 * viewport sizes); untagged tests run on both.
 *
 * Every context starts as a British English visitor (`en-GB`: English,
 * metric units, GBP), so the default prefs do not depend on the machine.
 * Tests that check other browser languages set `locale` themselves.
 *
 * Traces: locally a failing test keeps its trace in ./test-results. On CI only
 * the retry of a failed test records one, and the workflow uploads
 * ./test-results when the job fails.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/gel-calculator/`,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    {
      name: 'chromium',
      grepInvert: /@phone/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      grepInvert: /@desktop/,
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
