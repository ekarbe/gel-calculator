import { test, expect } from '@playwright/test';

// Generic smoke checks against the static export. The UI gets rewired in later
// phases, so these only assert things that should stay true: the app renders
// without errors, the brand and the recipe are on the page, and nothing
// overflows horizontally on a phone.

/**
 * Open the app and collect console errors and uncaught page errors.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} live list of error descriptions
 */
async function openApp(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  const response = await page.goto('./', { waitUntil: 'networkidle' });
  expect(response?.status(), 'index page HTTP status').toBe(200);
  return errors;
}

test('loads without console or page errors', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('shows the app name in the header', async ({ page, isMobile }) => {
  await openApp(page);
  const header = page.locator('header').first();
  await expect(header).toBeVisible();
  const brand = header.getByText('Gel-Calculator', { exact: true });
  if (isMobile) {
    // The phone layout may collapse the name to an icon.
    await expect(brand).toBeAttached();
  } else {
    await expect(brand).toBeVisible();
  }
});

test('shows the Final Recipe heading', async ({ page }) => {
  await openApp(page);
  const heading = page.getByRole('heading', { name: 'Final Recipe' }).first();
  // On phones the recipe may sit behind a "Recipe" tab. Open it when present.
  const recipeTab = page.getByRole('button', { name: /^recipe$/i });
  if (!(await heading.isVisible()) && (await recipeTab.count()) > 0) {
    await recipeTab.first().click();
  }
  await expect(heading).toBeVisible();
});

test('has no horizontal overflow on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await openApp(page);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  // A page wider than the device makes mobile Chromium zoom out, which would
  // also widen innerWidth and hide the overflow. Pin it to the viewport.
  expect(innerWidth).toBe(page.viewportSize()?.width);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
});
