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
import { board, guidedNext, header, kpiValue, openApp, readAutosave, showTab } from './helpers.js';

// The guided flow (spec 3.1, design doc "Guided mode"): four steps on five
// screens (Event → Body & weather → Sweat → Pantry → Recipe & plan), a dock
// with the live targets, "Switch to expert" on every step, and expert mode
// keeping everything the flow set.

/** The inputs the end-to-end walk below enters (metric, as the plan stores them). */
const WALK = {
  event: { sport: 'running', durationMin: 150, intensity: 'race', speedKmh: 12 },
  athlete: { massKg: 60 },
  environment: { tempC: 28, humidity: 60, sun: 'full' },
  salts: { sodiumSalt: 'citrate' },
};

/**
 * The value next to a term of the dock ("75 g/h").
 * @param {import('@playwright/test').Page} page
 * @param {string} term
 */
const dock = (page, term) =>
  page.getByRole('region', { name: 'Your plan so far' }).getByRole('term').filter({ hasText: term }).locator('xpath=following-sibling::dd[1]');

/**
 * The guided screen, a region named by its heading.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
const screen = (page, name) => page.getByRole('main').getByRole('region', { name, exact: true });

/**
 * A rate as the dock and the KPI tiles show it ("75 g/h"; number and unit are separate spans).
 * @param {number} value
 * @param {string} unit
 */
const rate = (value, unit) => new RegExp(`^${value}\\s*${unit}/h$`);

test('a first visit walks the guided flow on a phone, from the event to the race board @phone', async ({ page }) => {
  const expected = computePlan(WALK);
  const errors = await openApp(page);
  const steps = page.getByRole('navigation', { name: 'Guided setup' });
  await expect(header(page).getByRole('radio', { name: 'Guided' })).toBeChecked();
  // No tab bar in guided mode: the step list and the dock are the navigation.
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);

  // Step 1: the event.
  const event = screen(page, 'Your event');
  await expect(event).toBeVisible();
  await expect(steps.getByRole('button', { name: 'Step 1: Event' })).toHaveAttribute('aria-current', 'step');
  await expect(event.getByTestId('guided-reason')).toHaveText(/carbs you need per hour/);
  await expect(dock(page, 'Carbs')).toHaveText(rate(75, 'g'));
  await event.getByRole('radiogroup', { name: 'Sport' }).getByRole('radio', { name: 'Running' }).click();
  await event.getByRole('spinbutton', { name: 'Hours' }).fill('2');
  await event.getByRole('spinbutton', { name: 'Minutes' }).fill('30');
  await event.getByRole('combobox', { name: 'Intensity' }).selectOption({ label: 'Race (Zone 4–5)' });
  await event.getByRole('spinbutton', { name: 'Speed' }).fill('12');
  await event.getByRole('spinbutton', { name: 'Speed' }).blur();
  await expect(event).toContainText('Pace 5:00 min/km');
  // [jeukendrup2014] 1–2.5 h: 30–60 g/h, race effort at the top. The dock follows live.
  await expect(dock(page, 'Carbs')).toHaveText(rate(60, 'g'));

  // Step 2: body and weather. Next names where it goes, and the focus lands on the new heading.
  await guidedNext(page).click();
  const conditions = screen(page, 'Body & weather');
  await expect(conditions.getByRole('heading', { level: 2, name: 'Body & weather' })).toBeFocused();
  await expect(steps.getByRole('button', { name: 'Step 2: Body & weather' })).toHaveAttribute('aria-current', 'step');
  await conditions.getByRole('spinbutton', { name: 'Body mass' }).fill('60');
  await conditions.getByRole('spinbutton', { name: 'Temperature' }).fill('28');
  await conditions.getByRole('spinbutton', { name: 'Humidity' }).fill('60');
  await conditions.getByRole('combobox', { name: 'Sun' }).selectOption({ label: 'Full sun' });
  // The estimate drives the fluid and sodium targets (heat balance; numbers from the plan engine).
  await expect(dock(page, 'Fluid')).toHaveText(rate(expected.fluid.mlPerHour, 'ml'));
  await expect(dock(page, 'Sodium')).toHaveText(rate(expected.sodium.mgPerHour, 'mg'));

  // Still step 2: the sweat question. "No" keeps the estimate.
  await guidedNext(page).click();
  const sweat = screen(page, 'Sweat');
  await expect(sweat.getByRole('heading', { level: 2, name: 'Sweat' })).toBeFocused();
  await expect(steps.getByRole('button', { name: 'Step 2: Body & weather' })).toHaveAttribute('aria-current', 'step');
  const answer = sweat.getByRole('radiogroup', { name: 'Have you done a sweat test?' });
  await expect(answer.getByRole('radio', { name: 'No' })).toBeChecked();
  await expect(sweat.getByText('Estimated sweat rate')).toBeVisible();

  // Step 3: the pantry. Tiles toggle ingredients; the salt is a choice.
  await guidedNext(page).click();
  const pantry = screen(page, 'Your pantry');
  await expect(pantry.getByRole('heading', { level: 2, name: 'Your pantry' })).toBeFocused();
  await expect(steps.getByRole('button', { name: 'Step 3: Ingredients' })).toHaveAttribute('aria-current', 'step');
  const honey = pantry.getByRole('button', { name: 'Honey', exact: true });
  await expect(honey).toHaveAttribute('aria-pressed', 'false');
  await honey.click();
  await expect(honey).toHaveAttribute('aria-pressed', 'true');
  await expect(honey).toContainText(/\d+ g in the recipe/);
  await pantry.getByRole('radiogroup', { name: 'Which salt do you have?' }).getByRole('radio', { name: 'Sodium citrate' }).click();
  await expect(pantry.getByRole('list', { name: 'Salt amounts for the whole activity' })).toContainText('Sodium Citrate');

  // Step 4: the race board, with the recipe and the schedule.
  await guidedNext(page).click();
  const plan = screen(page, 'Your plan');
  await expect(plan.getByRole('heading', { level: 2, name: 'Your plan' })).toBeFocused();
  await expect(steps.getByRole('button', { name: 'Step 4: Recipe & plan' })).toHaveAttribute('aria-current', 'step');
  await expect(guidedNext(page)).toHaveCount(0);
  await expect(page.getByTestId('board-title')).toHaveText(/2:30\s*h · Running · Race/i);
  await expect(kpiValue(page, 'carbs')).toHaveText(rate(60, 'g'));
  await expect(kpiValue(page, 'sodium')).toHaveText(rate(expected.sodium.mgPerHour, 'mg'));
  await expect(kpiValue(page, 'fluid')).toHaveText(rate(expected.fluid.mlPerHour, 'ml'));
  await expect(page.getByTestId('recipe-section-gel').getByRole('listitem').filter({ hasText: 'Honey' })).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'Next up' }).getByRole('listitem')).toHaveCount(4);

  // The mixing steps open from the board.
  await plan.getByRole('button', { name: 'Start mixing' }).click();
  const mixing = page.getByRole('dialog', { name: 'Mixing steps' });
  await expect(mixing).toBeVisible();
  await mixing.getByRole('button', { name: 'Got it' }).click();
  await expect(mixing).toHaveCount(0);

  // Back goes one screen back, the step list jumps.
  await page.getByRole('group', { name: 'Step navigation' }).getByRole('button', { name: /^Back/ }).click();
  await expect(screen(page, 'Your pantry')).toBeVisible();
  await steps.getByRole('button', { name: 'Step 1: Event' }).click();
  await expect(screen(page, 'Your event').getByRole('spinbutton', { name: 'Hours' })).toHaveValue('2');

  // Expert mode keeps everything the flow set.
  await page.getByRole('button', { name: 'Switch to expert' }).click();
  await expect(header(page).getByRole('radio', { name: 'Expert' })).toBeChecked();
  await expect(board(page)).toBeVisible();
  await expect(kpiValue(page, 'carbs')).toHaveText(rate(60, 'g'));
  await showTab(page, 'Setup');
  const setupEvent = page.getByRole('region', { name: 'Event' });
  await expect(setupEvent.getByRole('radio', { name: 'Running' })).toBeChecked();
  await expect(setupEvent.getByRole('spinbutton', { name: 'Minutes' })).toHaveValue('30');
  await expect(page.getByRole('list', { name: 'Ingredient list' })).toContainText('Honey');
  await expect(page.getByRole('region', { name: 'Salts' }).getByRole('combobox', { name: 'Sodium salt' })).toHaveValue('citrate');

  // Everything is autosaved, and the mode is remembered.
  await expect.poll(async () => (await readAutosave(page))?.salts.sodiumSalt).toBe('citrate');
  const saved = await readAutosave(page);
  expect(saved).toMatchObject(WALK);
  // Honey is carb source 14.
  expect(saved.carbs.ingredients.map((item) => item.ref)).toContain(14);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(header(page).getByRole('radio', { name: 'Expert' })).toBeChecked();
  await expect(kpiValue(page, 'carbs')).toHaveText(rate(60, 'g'));
  expect(errors).toEqual([]);
});

test('the dock counts the warnings and opens their list', async ({ page }) => {
  const errors = await openApp(page);
  const dockRegion = page.getByRole('region', { name: 'Your plan so far' });
  const count = computePlan({}).warnings.length;
  const toggle = dockRegion.getByRole('button', { name: `${count} warnings` });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(dockRegion.getByRole('list', { name: 'Warnings' }).getByRole('listitem').filter({ has: page.getByRole('list') })).toHaveCount(
    count,
  );
  expect(errors).toEqual([]);
});

test('the header switch leaves the guided flow and comes back to the same step', async ({ page }) => {
  const errors = await openApp(page);
  await guidedNext(page).click();
  await expect(screen(page, 'Body & weather')).toBeVisible();

  await header(page).getByRole('radio', { name: 'Expert' }).click();
  await expect(board(page)).toBeVisible();
  await header(page).getByRole('radio', { name: 'Guided' }).click();
  await expect(page.getByRole('navigation', { name: 'Guided setup' })).toBeVisible();
  await expect(screen(page, 'Body & weather')).toBeVisible();
  expect(errors).toEqual([]);
});
