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

import { test, expect } from '@playwright/test';
import { encodeShareState } from '../src/state/shareCodec.js';
import { computePlan } from '../src/domain/plan.js';
import { AUTOSAVE_KEY, PREFS_KEY, board, header, kpiValue, openApp, openExpert, readAutosave, showTab } from './helpers.js';

// Smoke checks of the plan engine wired into the Phase 3 UI (expert mode):
// the app renders without errors, the default targets, a live recommendation
// update, the evidence behind it, share links (v4, v3 links migrated, the
// notice for an unreadable one), the autosave, drink bottles, a custom
// ingredient and the inline editors of My recipes.

/** @param {import('@playwright/test').Page} page */
const durationFields = (page) => {
  const event = page.getByRole('region', { name: 'Event' });
  return {
    hours: event.getByRole('spinbutton', { name: 'Hours', exact: true }),
    minutes: event.getByRole('spinbutton', { name: 'Minutes', exact: true }),
  };
};

/**
 * The lanes of one recipe section on the race board.
 * @param {import('@playwright/test').Page} page
 * @param {'gel'|'drink'} kind
 */
const recipeLines = (page, kind) => page.getByTestId(`recipe-section-${kind}`).getByRole('list', { name: 'Ingredients' }).getByRole('listitem');

test('loads without console or page errors, in guided and in expert mode', async ({ page }) => {
  const guidedErrors = await openApp(page);
  await expect(page.getByRole('main')).not.toBeEmpty();
  await expect(header(page).getByRole('radio', { name: 'Guided' })).toBeChecked();
  expect(guidedErrors).toEqual([]);

  await header(page).getByRole('radio', { name: 'Expert' }).click();
  await expect(board(page)).toBeVisible();
  expect(guidedErrors).toEqual([]);
});

test('shows the app name as the page heading', async ({ page, isMobile }) => {
  await openApp(page);
  const brand = header(page).getByRole('heading', { level: 1, name: 'Gel Calculator' });
  if (isMobile) {
    // Below 640 px the wordmark is visually hidden but stays the page's h1.
    await expect(brand).toBeAttached();
  } else {
    await expect(brand).toBeVisible();
  }
  await expect(page).toHaveTitle(/Energy Gel/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('shows the default plan: 75 g/h and a non-empty recipe', async ({ page }) => {
  const errors = await openExpert(page);
  // [jeukendrup2014] 180 min at moderate intensity: middle of 60–90 g/h.
  await expect(kpiValue(page, 'carbs')).toHaveText(/^75\s*g\/h$/);

  const lines = recipeLines(page, 'gel');
  await expect(lines.first()).toBeVisible();
  // Default sources: maltodextrin and fructose at 1:0.5, sodium from table salt, warm water.
  await expect(lines.filter({ hasText: 'Maltodextrin' })).toHaveText(/158\s*g/);
  await expect(lines.filter({ hasText: 'Crystalline Fructose' })).toHaveText(/75\s*g/);
  await expect(lines.filter({ hasText: 'Table Salt' })).toHaveText(/\d+(\.\d)?\s*(g|mg)/);
  await expect(lines.filter({ hasText: 'Warm water' })).toHaveText(/\d+\s*ml/);
  await expect(page.getByTestId('recipe-empty')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('changing the duration to 1 h 0 min updates the carb recommendation to 15 g/h', async ({ page }) => {
  const errors = await openExpert(page);
  await expect(kpiValue(page, 'carbs')).toHaveText(/^75\s*g\/h$/);

  await showTab(page, 'Setup');
  const { hours, minutes } = durationFields(page);
  await hours.fill('1');
  await minutes.fill('0');
  await minutes.blur();
  await expect(hours).toHaveValue('1');
  await expect(minutes).toHaveValue('0');

  // [jeukendrup2014] 45–75 min: 0–30 g/h or a mouth rinse; moderate is the middle.
  const carbs = page.getByRole('region', { name: 'Targets' }).getByRole('group', { name: 'Carbohydrates' });
  await expect(carbs.getByRole('term').filter({ hasText: 'Recommended' }).locator('xpath=following-sibling::dd[1]')).toHaveText(
    /^15\s*g\/h$/,
  );
  await showTab(page, 'Board');
  await expect(kpiValue(page, 'carbs')).toHaveText(/^15\s*g\/h$/);
  expect(errors).toEqual([]);
});

test('a "Why?" disclosure reveals a citation link', async ({ page }) => {
  const errors = await openExpert(page);
  await showTab(page, 'Setup');
  const carbs = page.getByRole('region', { name: 'Targets' }).getByRole('group', { name: 'Carbohydrates' });
  const why = carbs.getByRole('button', { name: 'Why?' });
  const citation = carbs.getByRole('link', { name: /^Jeukendrup 2014/ });

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

test('a share link restores the duration of 240 min and opens in expert mode', async ({ page }) => {
  const encoded = encodeShareState({ event: { durationMin: 240 } });
  // Only the changed field is stored, next to the version (share links v4).
  expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual({ v: 4, event: { durationMin: 240 } });

  // A first visit with a link skips the guided flow: the link is a finished plan.
  const errors = await openApp(page, { path: `./?s=${encoded}` });
  await expect(header(page).getByRole('radio', { name: 'Expert' })).toBeChecked();
  await expect(page.getByTestId('board-title')).toContainText(/4:00\s*h/i);
  await showTab(page, 'Setup');
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
    JSON.stringify({ v: 3, event: { durationMin: 240 }, carbs: { glucoseSources: [{ id: 1, percentage: 100 }] }, format: { view: 'perGel' } }),
  ).toString('base64url');
  const errors = await openApp(page, { path: `./?s=${v3}` });

  // [sawka2007] 0.8 × 1.25 L/h, capped at 800 ml/h.
  await expect(kpiValue(page, 'fluid')).toHaveText(/^800\s*ml\/h$/);
  await expect(page.getByTestId('board-sweat-source')).toHaveText(/self-assessed/i);
  await expect(page.getByRole('status').filter({ hasText: 'This share link' })).toHaveCount(0);

  const lines = recipeLines(page, 'gel');
  await expect(lines.filter({ hasText: 'Dextrose (anhydrous)' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Crystalline Fructose' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Maltodextrin' })).toHaveCount(0);
  // v3 'perGel' is the v4 'perServing' view.
  await expect(page.getByTestId('recipe-section-gel').getByTestId('amounts-caption')).toHaveText('Per gel');
  await expect(page.getByRole('radiogroup', { name: 'Recipe view' }).getByRole('radio', { name: 'Per serving' })).toBeChecked();

  await showTab(page, 'Setup');
  const { hours, minutes } = durationFields(page);
  await expect(hours).toHaveValue('4');
  await expect(minutes).toHaveValue('0');
  await expect(page.getByTestId('sweat-summary')).toHaveAttribute('data-source', 'preset');
  expect(errors).toEqual([]);
});

test('an old share link shows a notice and the default plan, and is removed from the address', async ({ page }) => {
  // Links from the previous app use share format v2, which v4 cannot read.
  const v2 = Buffer.from(JSON.stringify({ v: 2, d: 195 })).toString('base64url');
  const errors = await openApp(page, { path: `./?s=${v2}`, prefs: { mode: 'expert' } });

  const notice = page.getByRole('status').filter({ hasText: 'This share link' });
  await expect(notice).toHaveText(/This share link is from an older version or is damaged, so it could not be opened\./);
  await expect(notice).toBeVisible();
  await expect(kpiValue(page, 'carbs')).toHaveText(/^75\s*g\/h$/);
  // The unreadable link is removed, so a reload does not try it again.
  expect(new URL(page.url()).searchParams.has('s')).toBe(false);
  expect(errors).toEqual([]);
});

test('the autosave restores the plan after a reload', async ({ page }) => {
  const errors = await openExpert(page);
  await expect(kpiValue(page, 'carbs')).toHaveText(/^75\s*g\/h$/);
  // Nothing is saved before the first change: the defaults never overwrite a stored plan.
  expect(await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)).toBeNull();

  await showTab(page, 'Setup');
  const { hours, minutes } = durationFields(page);
  await hours.fill('1');
  await minutes.fill('0');
  await minutes.blur();

  // The autosave is written 400 ms after the last change.
  await expect.poll(async () => (await readAutosave(page))?.event.durationMin).toBe(60);
  await page.reload({ waitUntil: 'networkidle' });

  await expect(header(page).getByRole('radio', { name: 'Expert' })).toBeChecked();
  await expect(kpiValue(page, 'carbs')).toHaveText(/^15\s*g\/h$/);
  await showTab(page, 'Setup');
  await expect(hours).toHaveValue('1');
  await expect(minutes).toHaveValue('0');
  expect(new URL(page.url()).searchParams.has('s')).toBe(false);
  expect(errors).toEqual([]);
});

test('a first visit is guided, a returning visit is expert, and the mode is remembered', async ({ page }) => {
  await openApp(page);
  await expect(header(page).getByRole('radio', { name: 'Guided' })).toBeChecked();
  await expect(page.getByRole('navigation', { name: 'Guided setup' })).toBeVisible();
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY))).toMatchObject({ mode: 'guided' });

  await header(page).getByRole('radio', { name: 'Expert' }).click();
  await expect(board(page)).toBeVisible();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(header(page).getByRole('radio', { name: 'Expert' })).toBeChecked();
  await expect(board(page)).toBeVisible();
});

test('the drink format shows bottles and the schedule names them', async ({ page }) => {
  const errors = await openExpert(page);
  await showTab(page, 'Setup');
  // Self-assessed sweat preset (1.25 L/h): 800 ml/h for 3 h is 2,400 ml of drink.
  await page.getByRole('tablist', { name: 'Sweat source' }).getByRole('tab', { name: 'Presets' }).click();
  await page.getByRole('region', { name: 'Format' }).getByRole('radiogroup', { name: 'Format' }).getByRole('radio', { name: 'Drink' }).click();

  await showTab(page, 'Board');
  await expect(kpiValue(page, 'fluid')).toHaveText(/^800\s*ml\/h$/);
  const drink = page.getByTestId('recipe-section-drink');
  await expect(drink).toBeVisible();
  await expect(page.getByTestId('recipe-section-gel')).toHaveCount(0);
  // 2,400 ml in 750 ml bottles: 4 bottles of 600 ml each.
  await expect(drink.getByRole('heading', { name: 'Bottles ×4' })).toBeVisible();
  await expect(drink.getByTestId('section-servings')).toHaveText('600 ml each (750 ml bottle)');
  const lines = recipeLines(page, 'drink');
  await expect(lines.filter({ hasText: 'Maltodextrin' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'Water, to fill each bottle to 600 ml' })).toHaveCount(1);
  await expect(page.getByTestId('recipe-facts-drink').getByTestId('osmolality')).toContainText('mOsm/kg');

  // The schedule tells you to drink from the bottles.
  await showTab(page, 'Schedule');
  await expect(page.getByTestId('bottle-note')).toContainText('4 bottles');
  await expect(page.getByRole('list', { name: 'Schedule' })).toContainText('from bottle 1');
  expect(errors).toEqual([]);
});

test('adding a custom ingredient changes the recipe', async ({ page }) => {
  const errors = await openExpert(page);
  const gelLines = recipeLines(page, 'gel');
  await expect(gelLines.filter({ hasText: 'Maltodextrin' })).toHaveCount(1);
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveCount(0);

  await showTab(page, 'Setup');
  const custom = page.getByTestId('ingredients-custom');
  await custom.getByRole('button', { name: 'New ingredient' }).click();
  const form = custom.getByRole('form', { name: 'New ingredient' });
  await form.getByLabel('Name').fill('Agave blend');
  await form.getByLabel('Carbs per 100 g').fill('76');
  await form.getByLabel('Fructose share of the carbs').fill('50');
  await form.getByRole('button', { name: 'Save ingredient' }).click();
  // It joins the ingredient list at once.
  await expect(page.getByRole('list', { name: 'Ingredient list' })).toContainText('Agave blend');

  await showTab(page, 'Board');
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveCount(1);
  await expect(gelLines.filter({ hasText: 'Agave blend' })).toHaveText(/\d+(\.\d)?\s*g/);
  expect(errors).toEqual([]);
});

test('Escape in a rename or delete in My recipes cancels it and keeps the dialog open', async ({ page }) => {
  const errors = await openExpert(page);
  await header(page).getByRole('button', { name: 'My recipes' }).click();
  const dialog = page.getByRole('dialog', { name: 'My recipes' });
  await dialog.getByLabel('Name').fill('Long ride');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const item = dialog.getByRole('article', { name: 'Long ride' });
  await expect(item).toBeVisible();

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

  // Escape outside an inline form still closes the dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the board numbers come from the plan engine', async ({ page }) => {
  // The sweat-dependent targets, straight from the domain for the default inputs.
  const plan = computePlan({});
  const errors = await openExpert(page);
  await expect(kpiValue(page, 'carbs')).toHaveText(new RegExp(`^${plan.carbs.gPerHour}\\s*g/h$`));
  await expect(kpiValue(page, 'sodium')).toHaveText(new RegExp(`^${plan.sodium.mgPerHour}\\s*mg/h$`));
  await expect(kpiValue(page, 'fluid')).toHaveText(new RegExp(`^${plan.fluid.mlPerHour}\\s*ml/h$`));
  await expect(page.getByTestId('recipe-section-gel').getByRole('heading', { name: `Gels ×${plan.gels.count}` })).toBeVisible();
  expect(errors).toEqual([]);
});
