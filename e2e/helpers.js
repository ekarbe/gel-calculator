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

import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { decodeShareState } from '../src/state/shareCodec.js';

/**
 * Shared helpers for the end-to-end suite (static export served by
 * `scripts/serve-static.mjs`). Locators use roles and accessible names, the
 * way a screen-reader user finds things; test ids only where the UI has no
 * better handle (a number inside a KPI tile).
 */

/** localStorage key of the UI prefs (src/state/prefs.js). */
export const PREFS_KEY = 'gel-calculator:prefs';
/** localStorage key of the autosave (src/state/storage.js). */
export const AUTOSAVE_KEY = 'gel-calculator:autosave';
/** localStorage key next-themes keeps the theme in. */
export const THEME_KEY = 'theme';

/**
 * Open the app and collect console errors and uncaught page errors.
 *
 * `prefs` and `theme` are written to localStorage before the first page
 * script runs, and only when nothing is stored yet, so a reload keeps what
 * the page itself saved.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ path?: string, prefs?: Record<string, string>, theme?: 'light'|'dark'|'system' }} [options]
 * @returns {Promise<string[]>} live list of error descriptions
 */
export async function openApp(page, { path = './', prefs, theme } = {}) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  if (prefs || theme) {
    await page.addInitScript(
      ({ prefsKey, prefsValue, themeKey, themeValue }) => {
        try {
          if (prefsValue && localStorage.getItem(prefsKey) === null) localStorage.setItem(prefsKey, prefsValue);
          if (themeValue && localStorage.getItem(themeKey) === null) localStorage.setItem(themeKey, themeValue);
        } catch {
          // Storage blocked: the app falls back to its defaults.
        }
      },
      { prefsKey: PREFS_KEY, prefsValue: prefs ? JSON.stringify(prefs) : null, themeKey: THEME_KEY, themeValue: theme ?? null },
    );
  }
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  expect(response?.status(), 'index page HTTP status').toBe(200);
  // The shell renders <main> empty and busy until the prefs are resolved.
  await expect(page.getByRole('main')).not.toHaveAttribute('aria-busy', 'true');
  return errors;
}

/**
 * Open the app in expert mode (a returning visitor), with optional prefs.
 * @param {import('@playwright/test').Page} page
 * @param {{ path?: string, prefs?: Record<string, string>, theme?: 'light'|'dark'|'system' }} [options]
 */
export function openExpert(page, { prefs, ...options } = {}) {
  return openApp(page, { ...options, prefs: { mode: 'expert', ...prefs } });
}

/** @param {import('@playwright/test').Page} page */
export const header = (page) => page.getByRole('banner');

/** @param {import('@playwright/test').Page} page */
export const board = (page) => page.getByTestId('race-board');

/**
 * The value of one KPI tile of the race board with its unit ("75 g/h"; the
 * number and the unit are two spans of one line, so the text reads "75g/h").
 * @param {import('@playwright/test').Page} page
 * @param {'carbs'|'sodium'|'fluid'|'caffeine'} id
 */
export const kpiValue = (page, id) => page.getByTestId(`kpi-${id}-value`).locator('xpath=..');

/**
 * On phones the expert layout shows one view at a time behind the tab bar.
 * Tap the named tab when the bar is shown; from 1024 px every view is
 * already on screen.
 * @param {import('@playwright/test').Page} page
 * @param {string} label visible tab label ("Board", "Setup", "Schedule"; German "Übersicht", "Eingaben", "Zeitplan")
 * @param {string} [navName] accessible name of the tab bar ("Bereiche" in German)
 */
export async function showTab(page, label, navName = 'Sections') {
  const tab = page.getByRole('navigation', { name: navName }).getByRole('button', { name: label, exact: true });
  if (await tab.isVisible()) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
  }
}

/**
 * Open the Settings dialog from the header and pick one radio per group.
 * @param {import('@playwright/test').Page} page
 * @param {Record<string, string>} choices radio group name → radio name, e.g. `{ Units: 'Imperial' }`
 * @param {{ settings?: string, dialog?: string, done?: string }} [names] accessible names (German UI)
 */
export async function chooseSettings(page, choices, names = {}) {
  const { settings = 'Settings', dialog = settings, done = 'Done' } = names;
  await header(page).getByRole('button', { name: settings, exact: true }).click();
  let current = page.getByRole('dialog', { name: dialog });
  await expect(current).toBeVisible();
  for (const [group, radio] of Object.entries(choices)) {
    // A language change renames the dialog: find the open one again.
    current = page.getByRole('dialog');
    await current.getByRole('radiogroup', { name: group }).getByRole('radio', { name: radio, exact: true }).click();
  }
  await page.getByRole('dialog').getByRole('button', { name: done, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * The inputs in the autosave, decoded (the plan saves 400 ms after the last change).
 * @param {import('@playwright/test').Page} page
 */
export async function readAutosave(page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY);
  return raw === null ? null : decodeShareState(raw);
}

/**
 * Wait for the autosave to hold a value that passes `check`.
 * @param {import('@playwright/test').Page} page
 * @param {(inputs: any) => boolean} check
 */
export async function waitForAutosave(page, check) {
  await expect.poll(async () => {
    const inputs = await readAutosave(page);
    return inputs !== null && check(inputs);
  }).toBe(true);
}

/**
 * Assert that the page fits its viewport: no horizontal scrolling.
 * @param {import('@playwright/test').Page} page
 * @param {string} view name used in failure messages
 */
export async function expectNoOverflow(page, view) {
  // Let React commit and the browser lay out the new view before measuring.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const { scrollWidth, innerWidth, offenders } = await page.evaluate(() => {
    const width = window.innerWidth;
    // Name the widest elements that stick out, to make a failure actionable.
    const wide = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 0 && box.right > width + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className).slice(0, 60)}`);
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: width, offenders: wide };
  });
  // A page wider than the device makes mobile Chromium zoom out, which would
  // also widen innerWidth and hide the overflow. Pin it to the viewport.
  expect(innerWidth, `${view}: innerWidth`).toBe(page.viewportSize()?.width);
  expect(scrollWidth, `${view}: scrollWidth (sticking out: ${offenders.join(', ') || 'none'})`).toBeLessThanOrEqual(innerWidth);
}

/**
 * Run axe (WCAG 2.0–2.2 A/AA and best practices) on the page and return the
 * serious and critical violations, each with its first few targets.
 * @param {import('@playwright/test').Page} page
 * @param {string} [include] CSS selector to limit the scan to
 */
export async function seriousViolations(page, include) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
}

/**
 * The guided flow's Next button (its name says where it goes: "Next (Sweat)").
 * @param {import('@playwright/test').Page} page
 * @param {string} [navName] accessible name of the step navigation group
 * @param {RegExp} [label] the button label
 */
export const guidedNext = (page, navName = 'Step navigation', label = /^Next/) =>
  page.getByRole('group', { name: navName }).getByRole('button', { name: label });
