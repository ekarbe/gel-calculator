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
import { computePlan } from '../src/domain/plan.js';
import { encodeShareState } from '../src/state/shareCodec.js';
import { board, kpiValue, openExpert, showTab } from './helpers.js';

// The race board in expert mode (design doc "Race board"): title row and
// chips, four KPI tiles with a "Why?" each, the recipe lanes with Total ↔
// Per serving, the actions, Next up and the warnings panel.

const KPIS = [
  { id: 'carbs', name: 'Carbs', value: /^75\s*g\/h$/, sub: '1:0.5 · 225 g total' },
  { id: 'sodium', name: 'Sodium', value: /^\d+\s*mg\/h$/, sub: /^[\d,]+ mg total$/ },
  { id: 'fluid', name: 'Fluid', value: /^\d+\s*ml\/h$/, sub: /^[\d,]+ ml total · [\d.]+% (loss|gain)$/ },
  { id: 'caffeine', name: 'Caffeine', value: 'Off', sub: 'Not in this plan' },
];

test('the expert board shows the four KPIs, each with a caption, a sub-line and a "Why?"', async ({ page }) => {
  const errors = await openExpert(page);
  const tiles = page.getByTestId('board-kpis').getByRole('group');
  await expect(tiles).toHaveCount(4);
  for (const [index, kpi] of KPIS.entries()) {
    const tile = tiles.nth(index);
    // In design order, named by its caption.
    await expect(tile).toHaveAccessibleName(kpi.name);
    await expect(tile).toHaveAttribute('data-testid', `kpi-${kpi.id}`);
    await expect(kpiValue(page, kpi.id)).toHaveText(kpi.value);
    await expect(tile.locator('p').nth(2)).toHaveText(kpi.sub);
    await expect(tile.getByRole('button', { name: `Why? (${kpi.name})` })).toHaveAttribute('aria-expanded', 'false');
  }

  // A "Why?" opens the reasons with the studies behind them.
  const why = page.getByRole('button', { name: 'Why? (Carbs)' });
  await why.click();
  await expect(why).toHaveAttribute('aria-expanded', 'true');
  const reasons = page.locator(`[id="${await why.getAttribute('aria-controls')}"]`);
  await expect(reasons).toBeVisible();
  await expect(reasons.getByRole('link', { name: /^Jeukendrup 2014/ })).toHaveAttribute('href', 'https://doi.org/10.1007/s40279-014-0148-z');
  expect(errors).toEqual([]);
});

test('the four KPIs sit in the first screen: 2 × 2 on a phone, one row on a desktop', async ({ page, isMobile }) => {
  await openExpert(page);
  const boxes = await page
    .getByTestId('board-kpis')
    .getByRole('group')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().toJSON()));
  const viewport = page.viewportSize();
  // Above the fold, and above the phone tab bar when there is one.
  const tabBar = page.getByRole('navigation', { name: 'Sections' });
  await expect(tabBar).toHaveCount(isMobile ? 1 : 0);
  const fold = isMobile ? (await tabBar.boundingBox()).y : viewport.height;
  for (const box of boxes) expect(box.bottom).toBeLessThanOrEqual(fold);
  const rows = new Set(boxes.map((box) => Math.round(box.top)));
  expect(rows.size).toBe(isMobile ? 2 : 1);
});

for (const locale of /** @type {const} */ (['en', 'de'])) {
  test(`${locale}: the lanes, START MIXING and Next up are on the first screen of a 390 × 844 phone and a 1440 × 900 desktop`, async ({ page, isMobile }) => {
    await openExpert(page, { prefs: { locale } });
    const fold = isMobile ? (await page.getByTestId('shell-tabbar').boundingBox()).y : page.viewportSize().height;
    // Every lane of the gel batch and START MIXING above the fold (above the tab bar on a phone).
    const lanes = await page.getByTestId('recipe-section-gel').locator('li[data-kind]').evaluateAll((items) => items.map((li) => li.getBoundingClientRect().bottom));
    for (const bottom of lanes) expect(bottom, `${locale}: lane`).toBeLessThanOrEqual(fold);
    expect((await page.getByTestId('board-start-mixing').boundingBox()).y + 48, `${locale}: START MIXING`).toBeLessThanOrEqual(fold);
    // The two chips of the title row share one row, at one height.
    const chips = await page.getByTestId('board-title').locator('[data-testid$="-chip"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(new Set(chips.map((box) => Math.round(box.top))).size, `${locale}: chip rows`).toBe(1);
    expect(new Set(chips.map((box) => Math.round(box.height))).size, `${locale}: chip heights`).toBe(1);
    if (!isMobile) {
      // A desktop board puts Next up beside the recipe, with its first events on screen.
      const next = await page.getByRole('list', { name: locale === 'de' ? 'Als Nächstes' : 'Next up' }).getByRole('listitem').first().boundingBox();
      expect(next.y + next.height, `${locale}: Next up`).toBeLessThanOrEqual(fold);
    }
  });
}

test('the caffeine tile follows the caffeine plan', async ({ page }) => {
  const errors = await openExpert(page);
  await showTab(page, 'Setup');
  await page.getByRole('switch', { name: 'Include caffeine' }).click();
  await showTab(page, 'Board');
  // [guest2021] 3 mg/kg × 70 kg, split over two doses by the plan.
  const { caffeine } = computePlan({ caffeine: { enabled: true } });
  await expect(kpiValue(page, 'caffeine')).toHaveText(new RegExp(`^${caffeine.totalMg}\\s*mg$`));
  await expect(page.getByTestId('kpi-caffeine').locator('p').nth(2)).toHaveText(`3 mg/kg · ${caffeine.doses.length} doses`);
  expect(errors).toEqual([]);
});

test('the recipe switches between the whole batch and one gel', async ({ page }) => {
  const errors = await openExpert(page);
  const gel = page.getByTestId('recipe-section-gel');
  const malto = gel.getByRole('listitem').filter({ hasText: 'Maltodextrin' });
  await expect(gel.getByTestId('amounts-caption')).toHaveText('Whole batch');
  await expect(malto.getByTestId('item-amount')).toHaveText('158 g');

  await page.getByRole('radiogroup', { name: 'Recipe view' }).getByRole('radio', { name: 'Per serving' }).click();
  await expect(gel.getByTestId('amounts-caption')).toHaveText('Per gel');
  // 158 g over 9 gels.
  await expect(malto.getByTestId('item-amount')).toHaveText('18 g');
  const facts = page.getByTestId('recipe-facts-gel');
  await expect(facts.getByTestId('osmolality')).toContainText('mOsm/kg');
  await expect(facts.getByTestId('tonicity-chip')).toHaveText('Hypertonic');
  expect(errors).toEqual([]);
});

test('the board lists the next schedule events and every plan warning', async ({ page }) => {
  // 100 ml/h of fluid gives a warning and a note (900 mg sodium in 300 ml; take each gel with water),
  // so the panel has more than one level to order. The default plan has only the note.
  const inputs = { fluid: { mode: 'manual', manualMlPerHour: 100 } };
  const errors = await openExpert(page, { path: `./?s=${encodeShareState(inputs)}` });
  const plan = computePlan(inputs);
  const nextUp = page.getByRole('list', { name: 'Next up' }).getByRole('listitem');
  await expect(nextUp).toHaveCount(4);
  await expect(nextUp.first()).toContainText('At the start');
  await expect(page.getByTestId('next-more')).toHaveText(`${plan.schedule.length - 4} more events in the full schedule`);

  const chip = page.getByTestId('board-warnings-chip');
  // A phone shows the icon and the count only; the name says it in full everywhere.
  await expect(chip).toHaveAccessibleName(`${plan.warnings.length} warnings: show the list`);
  const panel = page.getByTestId('board-warnings');
  await expect(panel.getByRole('list', { name: 'Warnings' }).locator(':scope > li')).toHaveCount(plan.warnings.length);
  // Danger first, then warnings, then notes; each has an icon and says its level in words, not by colour alone.
  const items = panel.getByRole('list', { name: 'Warnings' }).locator(':scope > li');
  const order = ['danger', 'warning', 'info'];
  const levels = plan.warnings.map((warning) => warning.level).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  expect(await items.evaluateAll((lis) => lis.map((li) => li.dataset.level))).toEqual(levels);
  for (const [index, level] of levels.entries()) {
    await expect(items.nth(index).locator('svg').first()).toBeAttached();
    await expect(items.nth(index).locator('p').first()).toHaveText(new RegExp(`^${{ danger: 'Danger', warning: 'Warning', info: 'Note' }[level]}: `));
  }

  await chip.click();
  await expect(panel.getByRole('button', { name: `Warnings (${plan.warnings.length})` })).toBeFocused();
  await expect(board(page)).toBeVisible();
  expect(errors).toEqual([]);
});
