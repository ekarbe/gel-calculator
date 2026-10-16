import { test, expect } from '@playwright/test';
import { encodeShareState } from '../src/state/shareCodec.js';

// Smoke checks against the static export. The layout is redesigned in Phase 3,
// so these assert things that should stay true: the app renders without
// errors, the brand and the recipe are on the page, nothing overflows
// horizontally on a phone, and the plan engine is wired up end to end (default
// targets, a live recommendation update, the evidence behind it, share links
// (v4, and v3 links migrated), the notice for an unreadable share link, the
// autosave, the print view, drink bottles and a custom ingredient).

/**
 * Open the app and collect console errors and uncaught page errors.
 * @param {import('@playwright/test').Page} page
 * @param {string} [path] page to open, relative to the base URL
 * @returns {Promise<string[]>} live list of error descriptions
 */
async function openApp(page, path = './') {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  expect(response?.status(), 'index page HTTP status').toBe(200);
  return errors;
}

/**
 * On phones the cards sit behind a bottom tab bar. Tap the named tab when the
 * bar is shown; on wider screens every card is already visible.
 * @param {import('@playwright/test').Page} page
 * @param {string} label visible tab label, e.g. "Recipe"
 */
async function showView(page, label) {
  const tab = page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: label, exact: true })
    .filter({ visible: true });
  if ((await tab.count()) > 0) await tab.click();
}

/** @param {import('@playwright/test').Page} page */
const durationFields = (page) => ({
  hours: page.getByRole('spinbutton', { name: 'Hours', exact: true }),
  minutes: page.getByRole('spinbutton', { name: 'Minutes', exact: true }),
});

/** @param {import('@playwright/test').Page} page */
const carbsSection = (page) => page.getByRole('region', { name: 'Carbohydrate target' });

/**
 * The ingredient lines of one recipe section as shown in the recipe card.
 * @param {import('@playwright/test').Page} page
 * @param {'gel'|'drink'} kind
 */
const recipeLines = (page, kind) =>
  page.getByTestId(`recipe-section-${kind}`).getByRole('list', { name: 'Ingredients' }).getByRole('listitem');

/** localStorage key of the autosave (src/state/storage.js). */
const AUTOSAVE_KEY = 'gel-calculator:autosave';

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

test('shows the default plan: 75 g/h and a non-empty recipe', async ({ page }) => {
  const errors = await openApp(page);

  // [jeukendrup2014] 180 min at moderate intensity: middle of 60–90 g/h.
  await expect(page.getByTestId('carbs-target')).toHaveText(/^75\s*g\/h$/);

  await showView(page, 'Recipe');
  const ingredients = page.getByRole('list', { name: 'Ingredients' });
  await expect(ingredients).toBeVisible();
  const items = ingredients.getByRole('listitem');
  await expect(items.first()).toBeVisible();
  // Default sources: maltodextrin and fructose at 1:0.5, sodium from table salt.
  await expect(items.filter({ hasText: 'Maltodextrin' })).toHaveText(/\d+\s*g/);
  await expect(items.filter({ hasText: 'Crystalline Fructose' })).toHaveText(/\d+\s*g/);
  await expect(items.filter({ hasText: 'Table Salt' })).toHaveText(/\d+(\.\d)?\s*(g|mg)/);
  await expect(page.getByText('Nothing to mix for this plan.')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('changing the duration to 1 h 0 min updates the carb recommendation to 15 g/h', async ({ page }) => {
  const errors = await openApp(page);
  const { hours, minutes } = durationFields(page);
  const target = page.getByTestId('carbs-target');
  await expect(target).toHaveText(/^75\s*g\/h$/);

  await hours.fill('1');
  await minutes.fill('0');
  await minutes.blur();

  await expect(hours).toHaveValue('1');
  await expect(minutes).toHaveValue('0');
  // [jeukendrup2014] 45–75 min: 0–30 g/h or a mouth rinse; moderate is the middle.
  await expect(target).toHaveText(/^15\s*g\/h$/);
  const recommended = carbsSection(page).getByRole('definition').first();
  await expect(recommended).toHaveText(/^15\s*g\/h$/);
  expect(errors).toEqual([]);
});

test('a "Why?" control reveals a citation link', async ({ page }) => {
  const errors = await openApp(page);
  const section = carbsSection(page);
  const why = section.getByRole('button', { name: 'Why?' });
  const citation = section.getByRole('link', { name: 'Jeukendrup 2014' });

  await expect(why).toHaveAttribute('aria-expanded', 'false');
  await expect(citation).toBeHidden();

  await why.click();

  await expect(why).toHaveAttribute('aria-expanded', 'true');
  await expect(citation).toBeVisible();
  await expect(citation).toHaveAttribute('href', 'https://doi.org/10.1007/s40279-014-0148-z');
  await expect(citation).toHaveAttribute('target', '_blank');
  await expect(citation).toHaveAttribute('rel', /noopener/);
  expect(errors).toEqual([]);
});

test('a share link restores the duration of 240 min', async ({ page }) => {
  const encoded = encodeShareState({ event: { durationMin: 240 } });
  // Only the changed field is stored, next to the version (share links v4).
  expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual({
    v: 4,
    event: { durationMin: 240 },
  });

  const errors = await openApp(page, `./?s=${encoded}`);
  const { hours, minutes } = durationFields(page);

  await expect(hours).toHaveValue('4');
  await expect(minutes).toHaveValue('0');
  expect(errors).toEqual([]);
});

test('a v3 share link still opens, migrated to the ingredient list', async ({ page }) => {
  // A Phase 1 link: 4 h, dextrose instead of maltodextrin in the glucose list
  // (the fructose list keeps its v3 default) and the per-gel view. Everything
  // it does not name keeps its v3 default, including the self-assessed sweat
  // preset (1.25 L/h), so the plan means what it meant when it was shared.
  const v3 = Buffer.from(
    JSON.stringify({
      v: 3,
      event: { durationMin: 240 },
      carbs: { glucoseSources: [{ id: 1, percentage: 100 }] },
      format: { view: 'perGel' },
    }),
  ).toString('base64url');
  const errors = await openApp(page, `./?s=${v3}`);
  const { hours, minutes } = durationFields(page);

  await expect(hours).toHaveValue('4');
  await expect(minutes).toHaveValue('0');
  await expect(page.getByTestId('sweat-summary')).toHaveAttribute('data-source', 'preset');
  // [sawka2007] 0.8 × 1.25 L/h, capped at 800 ml/h.
  await expect(page.getByTestId('fluid-value')).toHaveText(/^800\s*ml\/h$/);
  await expect(page.getByRole('status').filter({ hasText: 'This share link' })).toHaveCount(0);

  await showView(page, 'Recipe');
  const lines = recipeLines(page, 'gel');
  await expect(lines.filter({ hasText: 'Dextrose (anhydrous)' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Crystalline Fructose' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Maltodextrin' })).toHaveCount(0);
  // v3 'perGel' is the v4 'perServing' view.
  await expect(page.getByTestId('recipe-section-gel').getByTestId('amounts-caption')).toHaveText('Per gel');
  expect(errors).toEqual([]);
});

test('an old share link shows a notice, the default plan and no overflow', async ({ page, isMobile }) => {
  // Links from the previous app use share format v2, which v4 cannot read.
  const v2 = Buffer.from(JSON.stringify({ v: 2, d: 195 })).toString('base64url');
  const errors = await openApp(page, `./?s=${v2}`);

  const notice = page.getByRole('status').filter({ hasText: 'This share link' });
  await expect(notice).toHaveText(/older version or is damaged, so it could not be opened/);
  await expect(notice).toBeVisible();
  await expect(page.getByTestId('carbs-target')).toHaveText(/^75\s*g\/h$/);
  // The unreadable link is removed, so a reload does not try it again.
  expect(new URL(page.url()).searchParams.has('s')).toBe(false);
  if (isMobile) await expectNoOverflow(page, 'old share link notice');
  expect(errors).toEqual([]);
});

test('the autosave restores the plan after a reload', async ({ page }) => {
  const errors = await openApp(page);
  const { hours, minutes } = durationFields(page);
  const target = page.getByTestId('carbs-target');
  await expect(target).toHaveText(/^75\s*g\/h$/);
  // Nothing is saved before the first change: the defaults never overwrite a stored plan.
  expect(await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)).toBeNull();

  await hours.fill('1');
  await minutes.fill('0');
  await minutes.blur();
  await expect(target).toHaveText(/^15\s*g\/h$/);

  // The autosave is written 400 ms after the last change.
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, AUTOSAVE_KEY);
  await page.reload({ waitUntil: 'networkidle' });

  await expect(hours).toHaveValue('1');
  await expect(minutes).toHaveValue('0');
  await expect(target).toHaveText(/^15\s*g\/h$/);
  expect(new URL(page.url()).searchParams.has('s')).toBe(false);
  expect(errors).toEqual([]);
});

test('printing shows the print recipe instead of the app', async ({ page }) => {
  const errors = await openApp(page);
  const printView = page.getByTestId('print-recipe');
  const app = page.getByTestId('app-content');

  // On screen the print view is hidden.
  await expect(printView).toBeHidden();
  await expect(app).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(printView).toBeVisible();
  await expect(app).toBeHidden();
  await expect(printView.getByRole('heading', { level: 1 })).toHaveText('Gel-Calculator fuel plan');
  await expect(page.getByTestId('print-date')).toHaveText(/^Printed on \w+ \d{1,2}, \d{4}$/);

  // The default recipe: one gel batch for 9 gels with maltodextrin, fructose, table salt and warm water.
  await expect(printView.getByRole('heading', { name: 'Gel batch: 9 gels' })).toBeVisible();
  const table = printView.getByRole('table', { name: 'Gel batch ingredients' });
  for (const label of ['Maltodextrin', 'Crystalline Fructose', 'Sodium Chloride (Table Salt)', 'Warm water']) {
    await expect(table.getByRole('rowheader', { name: label, exact: true })).toBeVisible();
  }
  await expect(printView.getByRole('list', { name: 'Gel batch steps' }).getByRole('listitem').first()).toHaveText(
    /^Weigh the Ingredients\. /,
  );
  // A block heading never ends a page on its own: the schedule table follows its heading.
  const scheduleHeading = printView.getByRole('heading', { level: 2, name: 'Schedule' });
  expect(await scheduleHeading.evaluate((el) => getComputedStyle(el).breakAfter)).toBe('avoid');
  await expect(printView.getByRole('table', { name: 'Race-day schedule' })).toBeVisible();
  await expect(printView.getByRole('list', { name: 'References' }).getByRole('listitem').first()).toContainText(
    'https://doi.org/',
  );

  await page.emulateMedia({ media: 'screen' });
  await expect(printView).toBeHidden();
  expect(errors).toEqual([]);
});

test('the drink format shows bottles', async ({ page }) => {
  const errors = await openApp(page);
  // Self-assessed sweat preset (1.25 L/h): 800 ml/h for 3 h is 2,400 ml of drink.
  await page.getByRole('button', { name: 'Presets', exact: true }).click();
  await expect(page.getByTestId('fluid-value')).toHaveText(/^800\s*ml\/h$/);

  await showView(page, 'Recipe');
  await page.getByRole('group', { name: 'Format' }).getByRole('button', { name: 'Drink', exact: true }).click();

  const drink = page.getByTestId('recipe-section-drink');
  await expect(drink).toBeVisible();
  await expect(page.getByTestId('recipe-section-gel')).toHaveCount(0);
  // 2,400 ml in 750 ml bottles: 4 bottles of 600 ml each.
  await expect(drink.getByTestId('section-servings')).toHaveText('4 bottles, 600 ml each (750 ml bottle)');
  const lines = recipeLines(page, 'drink');
  await expect(lines.filter({ hasText: 'Maltodextrin' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Water, to fill each bottle to 600 ml' })).toHaveCount(1);
  await expect(drink.getByTestId('osmolality')).toContainText('mOsm/kg');

  // The schedule tells you to drink from the bottles.
  await showView(page, 'Analysis');
  await expect(page.getByTestId('bottle-note')).toContainText('4 bottles');
  expect(errors).toEqual([]);
});

test('Escape in a rename or delete in My recipes cancels it and keeps the modal open', async ({ page }) => {
  const errors = await openApp(page);
  await page.getByRole('button', { name: 'My recipes' }).click();
  const dialog = page.getByRole('dialog', { name: 'My recipes' });
  await dialog.getByLabel('Name').fill('Long ride');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const item = dialog.getByRole('article', { name: 'Long ride' });
  await expect(item).toBeVisible();

  // React listens on `document` in the app, the same node as the modal's own Escape listener.
  await item.getByRole('button', { name: 'Rename: Long ride' }).click();
  const field = item.getByLabel('New name for Long ride');
  await field.fill('Long ride 2');
  await field.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(item.getByLabel('New name for Long ride')).toHaveCount(0);

  await item.getByRole('button', { name: 'Delete: Long ride' }).click();
  await item.getByRole('button', { name: 'Keep it' }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(item.getByRole('button', { name: 'Yes, delete' })).toHaveCount(0);

  // Escape outside an inline form still closes the modal.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('adding a custom ingredient changes the recipe', async ({ page }) => {
  const errors = await openApp(page);
  await showView(page, 'Recipe');
  const gelLines = recipeLines(page, 'gel');
  await expect(gelLines.filter({ hasText: 'Maltodextrin' })).toHaveCount(1);
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveCount(0);

  await showView(page, 'Setup');
  await page.getByRole('button', { name: 'New ingredient' }).click();
  const form = page.getByRole('group', { name: 'New ingredient' });
  await form.getByLabel('Name').fill('Agave blend');
  await form.getByLabel('Carbs per 100 g').fill('76');
  await form.getByLabel('Fructose share of the carbs').fill('50');
  await page.getByRole('button', { name: 'Save ingredient' }).click();
  // It joins the ingredient list at once.
  await expect(page.getByRole('list', { name: 'Ingredient list' })).toContainText('Agave blend');

  await showView(page, 'Recipe');
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveCount(1);
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveText(/\d+(\.\d)?\s*g/);
  expect(errors).toEqual([]);
});

// Labels of the phone bottom-bar buttons that switch between views. The current
// UI uses Setup, Recipe and Analysis; "Inputs" covers a likely rename.
const MOBILE_VIEW_TABS = /^(setup|inputs|recipe|analysis)$/i;

/**
 * Assert that the currently shown view fits the phone viewport.
 * @param {import('@playwright/test').Page} page
 * @param {string} view name used in failure messages
 */
async function expectNoOverflow(page, view) {
  // Let React commit and the browser lay out the new view before measuring.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  // A page wider than the device makes mobile Chromium zoom out, which would
  // also widen innerWidth and hide the overflow. Pin it to the viewport.
  expect(innerWidth, `${view}: innerWidth`).toBe(page.viewportSize()?.width);
  expect(scrollWidth, `${view}: scrollWidth`).toBeLessThanOrEqual(innerWidth);
}

test('has no horizontal overflow on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile viewport only');
  await openApp(page);

  // Measure the page as it loads. This is the whole check for a one-view
  // layout, and it fails clearly before any tab click is attempted.
  await expectNoOverflow(page, 'initial view');

  // Views behind a bottom tab bar are display:none until their tab is tapped,
  // so they are not laid out yet. Open each one and measure it too.
  const tabs = page.getByRole('button', { name: MOBILE_VIEW_TABS }).filter({ visible: true });
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i += 1) {
    const tab = tabs.nth(i);
    const label = (await tab.innerText()).trim();
    await tab.click();
    await expectNoOverflow(page, `${label} view`);
  }
});
