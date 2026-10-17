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
import { PREFS_KEY, chooseSettings, header, kpiValue, openApp, openExpert, readAutosave, showTab } from './helpers.js';

// Language, units and currency (design doc "Localisation & units"): the
// Settings dialog switches the whole UI to German with German number
// formats, imperial units show lb, °F, mph and fl oz while the plan stays
// metric, and the prefs default from the browser language and persist.

/** Self-assessed sweat (1.25 L/h) and gels plus a drink: bigger numbers, with thousands and decimals. */
const BIG_PLAN = `./?s=${encodeShareState({ sweat: { source: 'preset' }, format: { type: 'both' } })}`;

/**
 * The sub-line of a KPI tile.
 * @param {import('@playwright/test').Page} page
 * @param {'carbs'|'sodium'|'fluid'|'caffeine'} id
 */
const kpiSub = (page, id) => page.getByTestId(`kpi-${id}`).locator('p').nth(2);

/** @param {import('@playwright/test').Page} page */
const storedPrefs = async (page) => JSON.parse(await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY));

test('switching to German changes the UI text, the number formats and the page language', async ({ page, isMobile }) => {
  const errors = await openApp(page, { path: BIG_PLAN });
  await expect(kpiSub(page, 'sodium')).toHaveText('1,710 mg total');

  await chooseSettings(page, { Language: 'Deutsch', Währung: '€ EUR (Euro)' }, { settings: 'Settings', dialog: 'Settings', done: 'Fertig' });

  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page).toHaveTitle(/^Rechner für DIY-Energiegels/);
  const banner = header(page);
  await expect(banner.getByRole('radiogroup', { name: 'Modus' }).getByRole('radio', { name: 'Experte' })).toBeChecked();
  await expect(banner.getByRole('button', { name: 'Meine Rezepte' })).toBeAttached();
  await expect(banner.getByRole('button', { name: 'Einstellungen' })).toBeVisible();
  if (isMobile) {
    const tabs = page.getByRole('navigation', { name: 'Bereiche' });
    await expect(tabs.getByRole('button')).toHaveText(['Übersicht', 'Eingaben', 'Zeitplan']);
  }

  // German words, comma decimals, dot thousands, a space before % and the euro sign after the amount.
  const board = page.getByRole('region', { name: 'Wettkampfübersicht' });
  await expect(board.getByRole('group', { name: 'Kohlenhydrate' })).toBeVisible();
  await expect(kpiSub(page, 'carbs')).toHaveText('1:0,5 · 225 g gesamt');
  await expect(kpiSub(page, 'sodium')).toHaveText('1.710 mg gesamt');
  await expect(kpiSub(page, 'fluid')).toHaveText(/^2\.400 ml gesamt · 1,9\s% Verlust$/);
  await expect(page.getByTestId('board-sweat-chip')).toHaveText(/^Schweiß 1,25\sL\/h ±0,5$/);
  await expect(kpiValue(page, 'caffeine')).toHaveText('Aus');
  await expect(page.getByTestId('recipe-facts-drink').getByTestId('osmolality')).toContainText('≈ 181 mOsm/kg');
  await expect(page.getByTestId('recipe-facts-gel').getByTestId('osmolality')).toContainText('≈ 3.800 mOsm/kg');
  // Built-in ingredient names are German too.
  await expect(page.getByTestId('recipe-section-gel').getByTestId('item-label')).toHaveText(['Maltodextrin', 'Fruktose (kristallin)', 'Warmes Wasser']);
  // The drink holds every salt.
  await expect(page.getByTestId('recipe-section-drink').getByTestId('item-label')).toContainText(['Natriumchlorid (Kochsalz)']);
  await expect(page.getByTestId('cost-diy')).toHaveText(/^3,15\s€$/);
  await expect(page.getByRole('list', { name: 'Als Nächstes' }).getByRole('listitem').nth(1)).toContainText('20 Minuten nach dem Start');

  // The language is remembered.
  expect(await storedPrefs(page)).toMatchObject({ locale: 'de', currency: 'EUR', mode: 'expert' });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(kpiSub(page, 'sodium')).toHaveText('1.710 mg gesamt');

  // And back to English.
  await chooseSettings(page, { Sprache: 'English' }, { settings: 'Einstellungen', dialog: 'Einstellungen', done: 'Done' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(kpiSub(page, 'sodium')).toHaveText('1,710 mg total');
  expect(errors).toEqual([]);
});

test('German inputs read a decimal comma and the plan stores the number', async ({ page }) => {
  const errors = await openExpert(page, { prefs: { locale: 'de' } });
  await showTab(page, 'Eingaben', 'Bereiche');
  const mass = page.getByRole('region', { name: 'Körper & Wetter' }).getByRole('spinbutton', { name: 'Körpergewicht' });
  await expect(mass).toHaveValue('70');
  await mass.fill('72,5');
  await mass.blur();
  await expect(mass).toHaveValue('72,5');
  await expect(mass).toHaveAttribute('aria-valuetext', '72,5 kg');
  await expect.poll(async () => (await readAutosave(page))?.athlete.massKg).toBe(72.5);
  expect(errors).toEqual([]);
});

test('a German browser starts in German, metric and euros, in the guided flow', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  const errors = await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(header(page).getByRole('radio', { name: 'Geführt' })).toBeChecked();
  await expect(page.getByRole('main').getByRole('heading', { level: 2, name: 'Dein Event' })).toBeVisible();
  // Short visible captions that fit a phone, the full names for screen readers.
  const dock = page.getByRole('region', { name: 'Dein Plan bisher' });
  await expect(dock.locator('dt [data-testid$="-caption"]')).toHaveText(['KH', 'Natrium', 'Trinken']);
  await expect(dock.locator('dt .sr-only')).toHaveText(['Kohlenhydrate', 'Natrium', 'Trinkmenge']);
  expect(await storedPrefs(page)).toEqual({ locale: 'de', unitSystem: 'metric', currency: 'EUR', mode: 'guided' });
  expect(errors).toEqual([]);
  await context.close();
});

test('an American browser starts in imperial units and dollars', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  const errors = await openExpert(page);
  expect(await storedPrefs(page)).toEqual({ locale: 'en', unitSystem: 'imperial', currency: 'USD', mode: 'expert' });
  // 100 ml/h is 3.4 US fl oz/h; carbs and sodium stay in g and mg.
  await expect(kpiValue(page, 'fluid')).toHaveText(/^3\.4\s*fl oz\/h$/);
  await expect(kpiValue(page, 'carbs')).toHaveText(/^75\s*g\/h$/);
  // USD 0.015/g × 225 g.
  await expect(page.getByTestId('cost-diy')).toHaveText('$3.38');
  expect(errors).toEqual([]);
  await context.close();
});

test('imperial units show lb, °F, mph and fl oz, and typed values go back to metric', async ({ page }) => {
  const errors = await openExpert(page);
  await chooseSettings(page, { Units: 'Imperial' });
  expect(await storedPrefs(page)).toMatchObject({ unitSystem: 'imperial' });

  // The board: fluid in US fl oz, nutrients still in g and mg.
  await expect(kpiValue(page, 'fluid')).toHaveText(/^3\.4\s*fl oz\/h$/);
  await expect(kpiValue(page, 'sodium')).toHaveText(/^\d+\s*mg\/h$/);
  await expect(page.getByTestId('recipe-section-gel').getByRole('listitem').filter({ hasText: 'Warm water' })).toHaveText(/4\.7\s*fl oz/);
  await expect(page.getByTestId('recipe-section-gel').getByRole('listitem').filter({ hasText: 'Maltodextrin' }).getByTestId('item-amount')).toHaveText('158 g');

  await showTab(page, 'Setup');
  const body = page.getByRole('region', { name: 'Body & weather' });
  const mass = body.getByRole('spinbutton', { name: 'Body mass' });
  const height = body.getByRole('spinbutton', { name: 'Height' });
  const temp = body.getByRole('spinbutton', { name: 'Temperature' });
  const speed = page.getByRole('region', { name: 'Event' }).getByRole('spinbutton', { name: 'Speed' });
  // 70 kg, 175 cm, 20 °C and 30 km/h, shown in imperial units.
  await expect(mass).toHaveValue('154.3');
  await expect(mass).toHaveAttribute('aria-valuetext', '154.3 lb');
  await expect(height).toHaveValue('68.9');
  await expect(body).toContainText('5 ft 9 in');
  await expect(temp).toHaveValue('68');
  await expect(temp).toHaveAttribute('aria-valuetext', '68 °F');
  await expect(speed).toHaveValue('18.6');
  await expect(speed).toHaveAttribute('aria-valuetext', '18.6 mph');

  // Typed imperial values are stored in metric.
  await mass.fill('160');
  await mass.blur();
  await temp.fill('86');
  await temp.blur();
  await speed.fill('20');
  await speed.blur();
  await expect.poll(async () => (await readAutosave(page))?.environment.tempC).toBeCloseTo(30, 5);
  const saved = await readAutosave(page);
  // 160 lb = 72.57 kg; 86 °F = 30 °C; 20 mph = 32.19 km/h.
  expect(saved.athlete.massKg).toBeCloseTo(72.57, 2);
  expect(saved.event.speedKmh).toBeCloseTo(32.19, 2);

  // After a reload the same imperial numbers come back, not drifted by the round trip.
  await page.reload({ waitUntil: 'networkidle' });
  await showTab(page, 'Setup');
  await expect(mass).toHaveValue('160');
  await expect(temp).toHaveValue('86');
  await expect(speed).toHaveValue('20');

  // Metric again: the stored values in kg, °C and km/h.
  await chooseSettings(page, { Units: 'Metric' });
  await showTab(page, 'Setup');
  await expect(mass).toHaveValue('72.6');
  await expect(temp).toHaveValue('30');
  await expect(speed).toHaveValue('32.2');
  await showTab(page, 'Board');
  await expect(kpiValue(page, 'fluid')).toHaveText(/^\d+\s*ml\/h$/);
  expect(errors).toEqual([]);
});
