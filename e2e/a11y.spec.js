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
import { guidedNext, header, openApp, seriousViolations, showTab } from './helpers.js';

// Accessibility (P12): axe finds no serious or critical violations in light
// and dark, guided and expert, English and German, on the desktop and on a
// phone, on every guided screen, every phone tab and in every dialog.

const THEMES = /** @type {const} */ (['light', 'dark']);
const LOCALES = /** @type {const} */ (['en', 'de']);

/** Names per language that the walk below needs. */
const NAMES = {
  en: { next: /^Next/, nav: 'Step navigation', tabs: 'Sections', tab: { setup: 'Setup', schedule: 'Schedule' } },
  de: { next: /^Weiter/, nav: 'Schrittnavigation', tabs: 'Bereiche', tab: { setup: 'Eingaben', schedule: 'Zeitplan' } },
};

/**
 * Open the app in one theme and language, and check the theme took effect.
 * @param {import('@playwright/test').Page} page
 * @param {'light'|'dark'} theme
 * @param {'en'|'de'} locale
 * @param {'guided'|'expert'} mode
 */
async function open(page, theme, locale, mode) {
  // The theme follows the system setting by default (next-themes, "System").
  await page.emulateMedia({ colorScheme: theme });
  const errors = await openApp(page, { prefs: { locale, mode } });
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  else await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  return errors;
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`guided mode has no serious or critical axe violations on any screen (${theme}, ${locale})`, async ({ page }) => {
      const errors = await open(page, theme, locale, 'guided');
      const names = NAMES[locale];
      // Five screens: event, body & weather, sweat, pantry, plan.
      for (let screen = 1; screen <= 5; screen += 1) {
        const heading = page.getByRole('main').getByRole('heading', { level: 2 }).first();
        await expect(heading).toBeVisible();
        const title = await heading.innerText();
        expect(await seriousViolations(page), `screen ${screen} (${title})`).toEqual([]);
        if (screen === 4) {
          // The open warnings list in the dock, on the last screen whose dock shows the numbers (the plan
          // screen has the board's own warnings panel instead). The default plan warns, so the chip is a
          // button: no condition that could skip the check.
          const dockToggle = page.getByTestId('guided-dock-warnings');
          await expect(dockToggle).toHaveAttribute('aria-expanded', 'false');
          await dockToggle.click();
          await expect(dockToggle).toHaveAttribute('aria-expanded', 'true');
          await expect(page.getByTestId('guided-dock-warnings-panel').getByRole('list').first()).toBeVisible();
          expect(await seriousViolations(page), 'dock warnings open').toEqual([]);
          await dockToggle.click();
        }
        if (screen < 5) await guidedNext(page, names.nav, names.next).click();
      }
      expect(errors).toEqual([]);
    });

    test(`expert mode has no serious or critical axe violations in any view (${theme}, ${locale})`, async ({ page }) => {
      const errors = await open(page, theme, locale, 'expert');
      const names = NAMES[locale];
      await expect(page.getByTestId('race-board')).toBeVisible();
      expect(await seriousViolations(page), 'board').toEqual([]);
      // On phones the setup and the schedule are separate views behind the tab bar.
      await showTab(page, names.tab.setup, names.tabs);
      await expect(page.getByTestId('setup-event')).toBeVisible();
      expect(await seriousViolations(page), 'setup').toEqual([]);
      await showTab(page, names.tab.schedule, names.tabs);
      await expect(page.getByTestId('schedule')).toBeVisible();
      expect(await seriousViolations(page), 'schedule').toEqual([]);
      expect(errors).toEqual([]);
    });

    test(`every dialog has no serious or critical axe violations (${theme}, ${locale})`, async ({ page }) => {
      const errors = await open(page, theme, locale, 'expert');
      const openers = [
        header(page).locator('[data-testid="shell-recipes"]'),
        header(page).locator('[data-testid="shell-share"]'),
        header(page).locator('[data-testid="shell-settings"]'),
        page.getByTestId('board-start-mixing'),
      ];
      for (const opener of openers) {
        await opener.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const name = await dialog.getAttribute('aria-labelledby').then((id) => page.locator(`[id="${id}"]`).innerText());
        expect(await seriousViolations(page), `dialog ${name}`).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }
      // The gel templates open from My recipes.
      await header(page).locator('[data-testid="shell-recipes"]').click();
      await page.getByRole('dialog').getByRole('button', { name: locale === 'de' ? 'Mit einer Gelvorlage starten' : 'Start from a gel template' }).click();
      await expect(page.getByTestId('templates-dialog')).toBeVisible();
      expect(await seriousViolations(page), 'dialog templates').toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('the print view has no serious or critical axe violations', async ({ page }) => {
  const errors = await openApp(page, { prefs: { mode: 'expert' } });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('print-recipe')).toBeVisible();
  expect(await seriousViolations(page, '[data-testid="print-host"]')).toEqual([]);
  expect(errors).toEqual([]);
});

test('in forced colours a switch and a segmented choice still show which state is on @desktop', async ({ page }) => {
  // Without the 150 ms colour transition, so the colours are measured as they end up.
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const errors = await openApp(page, { prefs: { mode: 'expert' } });
  const toggle = page.getByRole('switch', { name: 'Include caffeine' });
  const colours = () =>
    toggle.evaluate((el) => {
      const track = el.querySelector('[data-testid=switch-track]') ?? el;
      const knob = el.querySelector('[data-testid=switch-knob]');
      return { track: getComputedStyle(track).backgroundColor, knob: knob ? getComputedStyle(knob).backgroundColor : '' };
    });
  const off = await colours();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const on = await colours();
  expect(on).not.toEqual(off);

  // The checked radio of a segmented choice is drawn unlike the others.
  const radios = await page.getByRole('radiogroup').first().getByRole('radio').evaluateAll((els) =>
    els.map((el) => ({ checked: el.getAttribute('aria-checked') === 'true', look: `${getComputedStyle(el).backgroundColor} ${getComputedStyle(el).color}` })),
  );
  const checked = radios.filter((r) => r.checked).map((r) => r.look);
  const unchecked = radios.filter((r) => !r.checked).map((r) => r.look);
  expect(checked).toHaveLength(1);
  for (const look of unchecked) expect(look).not.toBe(checked[0]);
  expect(errors).toEqual([]);
});
