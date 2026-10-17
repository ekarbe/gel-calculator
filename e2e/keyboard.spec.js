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
import { header, openApp, openExpert } from './helpers.js';

// Keyboard use (design doc "Accessibility"): every dialog opens with Enter
// on its button, is a native modal <dialog> with a labelled title, starts
// with the focus inside, closes with Escape (and with its buttons), and
// gives the focus back to the button that opened it.

/**
 * The buttons that open a dialog, where they live, and the dialog's name.
 * @type {{ opener: string, scope: 'header'|'board', dialog: string }[]}
 */
const DIALOGS = [
  { opener: 'My recipes', scope: 'header', dialog: 'My recipes' },
  { opener: 'Share', scope: 'header', dialog: 'Share' },
  { opener: 'Settings', scope: 'header', dialog: 'Settings' },
  { opener: 'Start mixing', scope: 'board', dialog: 'Mixing steps' },
  { opener: 'Share plan', scope: 'board', dialog: 'Share' },
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {'header'|'board'} scope
 * @param {string} name
 */
const opener = (page, scope, name) =>
  (scope === 'header' ? header(page) : page.getByTestId('race-board')).getByRole('button', { name, exact: true });

/**
 * Assert that the one open dialog is a modal native <dialog> named `name` with the focus inside.
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function expectModal(page, name) {
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(await dialog.evaluate((el) => el.tagName === 'DIALOG' && el.matches(':modal'))).toBe(true);
  await expect(dialog.getByRole('heading', { level: 2, name })).toBeVisible();
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  return dialog;
}

for (const { opener: name, scope, dialog: dialogName } of DIALOGS) {
  test(`"${name}" opens its dialog with Enter, Escape closes it and the focus returns`, async ({ page }) => {
    const errors = await openExpert(page);
    const button = opener(page, scope, name);
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');

    await button.focus();
    await page.keyboard.press('Enter');
    const dialog = await expectModal(page, dialogName);
    // The page behind a modal dialog is inert: Tab stays in the dialog.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button).toBeFocused();

    // The close button works from the keyboard too.
    await page.keyboard.press('Enter');
    await expectModal(page, dialogName);
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('the gel templates open from My recipes, and Escape gives the focus back to My recipes', async ({ page }) => {
  const errors = await openExpert(page);
  const recipes = header(page).getByRole('button', { name: 'My recipes' });
  await recipes.focus();
  await page.keyboard.press('Enter');
  const dialog = await expectModal(page, 'My recipes');
  await dialog.getByRole('button', { name: 'Start from a gel template' }).focus();
  await page.keyboard.press('Enter');
  const templates = await expectModal(page, 'Gel templates');
  await expect(templates.getByRole('list', { name: 'Templates' }).getByRole('article').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(recipes).toBeFocused();
  expect(errors).toEqual([]);
});

test('a template is applied from the keyboard and the dialog says so', async ({ page }) => {
  const errors = await openExpert(page);
  await header(page).getByRole('button', { name: 'My recipes' }).click();
  await page.getByRole('dialog', { name: 'My recipes' }).getByRole('button', { name: 'Start from a gel template' }).click();
  const templates = page.getByRole('dialog', { name: 'Gel templates' });
  const use = templates.getByRole('button', { name: 'Use template: Maurten Gel 100' });
  await use.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Maurten Gel 100' })).toBeVisible();
  // Maurten Gel 100: glucose and fructose at 1:0.8 (templates.js).
  await expect(page.getByTestId('kpi-carbs').locator('p').nth(2)).toHaveText(/^1:0\.8 · /);
  expect(errors).toEqual([]);
});

test('the skip link is the first tab stop and moves the focus to the main content', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('the phone tab bar works from the keyboard and marks the current tab @phone', async ({ page }) => {
  await openExpert(page);
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  const setup = tabs.getByRole('button', { name: 'Setup', exact: true });
  await expect(tabs.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await setup.focus();
  await page.keyboard.press('Enter');
  await expect(setup).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Event' })).toBeVisible();
  await expect(page.getByTestId('race-board')).toBeHidden();
  await tabs.getByRole('button', { name: 'Schedule', exact: true }).press('Space');
  await expect(page.getByRole('list', { name: 'Schedule' })).toBeVisible();
});

test('Print plan opens the browser print dialog from the keyboard', async ({ page }) => {
  await openExpert(page);
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => {
      window.__printed += 1;
    };
  });
  await page.getByTestId('race-board').getByRole('button', { name: 'Print plan' }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(1);
});

for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
  test(`every tab stop shows the 2 px focus ring in the focus colour (${colorScheme})`, async ({ page }) => {
    // Without the 150 ms colour transition, so the ring is measured as it ends up.
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await openExpert(page);
    await expect(page.locator('html')).toHaveClass(colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      // Let the browser paint the focused state first.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const ring = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const probe = document.createElement('i');
        probe.style.outlineColor = 'var(--focus)';
        el.parentElement.append(probe);
        const focusColor = getComputedStyle(probe).outlineColor;
        probe.remove();
        // A text field inside a stepper group draws the ring on the group (`:has(input:focus-visible)`).
        let node = el;
        for (let depth = 0; node && depth < 3; depth += 1, node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
            return { name: el.getAttribute('aria-label') || el.id || el.textContent.trim().slice(0, 40), width: parseFloat(style.outlineWidth), color: style.outlineColor, focusColor };
          }
        }
        return { name: el.getAttribute('aria-label') || el.id || el.textContent.trim().slice(0, 40), width: 0, color: 'none', focusColor };
      });
      // Past the last tab stop the focus leaves the page (the phone view has fewer stops).
      if (ring === null && i >= 15) break;
      expect(ring, `tab stop ${i + 1}`).not.toBeNull();
      expect(ring.width, `${ring.name}: ring width`).toBeGreaterThanOrEqual(2);
      expect(ring.color, `${ring.name}: ring colour`).toBe(ring.focusColor);
    }
  });
}

/**
 * Walk `count` tab stops (Shift+Tab when `backwards`) and return the tab
 * stops outside the pinned bars that the header, the phone tab bar or the
 * guided dock cover completely (SC 2.4.11 Focus Not Obscured): at none of
 * nine points spread over the focused element is it the element (or one of
 * its parts) that is painted on top, rather than a pinned bar. A skip link
 * drawn over the header is not covered.
 * @param {import('@playwright/test').Page} page
 * @param {number} count
 * @param {boolean} [backwards]
 */
async function obscuredTabStops(page, count, backwards = false) {
  const hidden = [];
  let seen = 0;
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const bars = [document.querySelector('header'), document.querySelector('[data-testid=shell-tabbar]'), document.querySelector('[data-testid=guided-dock]')]
        .filter((bar) => bar && ['sticky', 'fixed'].includes(getComputedStyle(bar).position));
      if (bars.some((bar) => bar.contains(el))) return { inBar: true };
      const box = el.getBoundingClientRect();
      if (box.height === 0 || box.width === 0) return null;
      let shown = 0;
      for (const fx of [0.1, 0.5, 0.9]) {
        for (const fy of [0.1, 0.5, 0.9]) {
          const x = box.left + box.width * fx;
          const y = box.top + box.height * fy;
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
          const top = document.elementFromPoint(x, y);
          if (top && !bars.some((bar) => bar.contains(top))) shown += 1;
        }
      }
      return { inBar: false, shown, name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 40) || el.tagName };
    });
    if (stop === null || stop.inBar) continue;
    seen += 1;
    if (stop.shown === 0) hidden.push(stop.name);
  }
  return { hidden, seen };
}

test('no tab stop of the phone setup hides behind the header or the tab bar @phone', async ({ page }) => {
  await openExpert(page);
  const tab = page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Setup', exact: true });
  await tab.click();
  const { hidden, seen } = await obscuredTabStops(page, 120);
  expect(seen).toBeGreaterThan(40);
  expect(hidden).toEqual([]);
});

test('no tab stop of the guided flow hides behind the header or the dock @phone', async ({ page }) => {
  await openApp(page, { prefs: { mode: 'guided' } });
  const { hidden, seen } = await obscuredTabStops(page, 40);
  expect(seen).toBeGreaterThan(5);
  expect(hidden).toEqual([]);
});

test('no tab stop hides behind the sticky header when the page is walked backwards @desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openExpert(page);
  await page.locator('footer a').last().focus();
  const { hidden, seen } = await obscuredTabStops(page, 150, true);
  expect(seen).toBeGreaterThan(60);
  expect(hidden).toEqual([]);
});
