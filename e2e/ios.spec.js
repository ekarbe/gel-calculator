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
import { board, header, openExpert } from './helpers.js';

// Dialogs on a phone, in both engines. Tagged @webkit, so they also run in the
// "iphone" project (Playwright's WebKit with the iPhone 17 profile, the
// engine of Safari on iOS). Chromium never showed that every dialog body
// collapsed to 0 px in Safari: the body had `flex: 1 1 0%` inside the
// fit-content modal <dialog>, and WebKit sized the dialog from that 0 %.

/**
 * Every dialog, how a phone user opens it, and the button its footer ends with.
 * @type {{ name: string, open: (page: import('@playwright/test').Page) => Promise<void>, footer?: string }[]}
 */
const DIALOGS = [
  { name: 'Mixing steps', open: (page) => board(page).getByRole('button', { name: 'Start mixing' }).click(), footer: 'Got it' },
  { name: 'Share', open: (page) => header(page).getByRole('button', { name: 'Share', exact: true }).click() },
  {
    name: 'Recipe image',
    open: async (page) => {
      await header(page).getByRole('button', { name: 'Share', exact: true }).click();
      await page.getByRole('dialog', { name: 'Share' }).getByRole('button', { name: 'Make an image' }).click();
    },
    footer: 'Download',
  },
  { name: 'Settings', open: (page) => header(page).getByRole('button', { name: 'Settings', exact: true }).click(), footer: 'Done' },
  { name: 'My recipes', open: (page) => header(page).getByRole('button', { name: 'My recipes', exact: true }).click(), footer: 'Start from a gel template' },
  {
    name: 'Gel templates',
    open: async (page) => {
      await header(page).getByRole('button', { name: 'My recipes', exact: true }).click();
      await page.getByRole('dialog', { name: 'My recipes' }).getByRole('button', { name: 'Start from a gel template' }).click();
    },
  },
];

/**
 * Wait until the open dialog's entrance animation has finished.
 * @param {import('@playwright/test').Page} page
 */
const settle = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
        .map((a) => a.finished.catch(() => {})),
    ),
  );

for (const { name, open, footer } of DIALOGS) {
  test(`the "${name}" dialog shows its content on a phone and fits the screen @phone @webkit`, async ({ page }) => {
    const errors = await openExpert(page);
    await open(page);
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    await settle(page);

    // The body is as tall as its content, or as tall as the screen allows (then it scrolls).
    const body = dialog.locator('[data-dialog-body]');
    const size = await body.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
    expect(size.scroll, 'the body has content').toBeGreaterThan(40);
    expect(size.client, 'body height').toBeGreaterThanOrEqual(Math.min(size.scroll, 200));
    await expect(body.locator(':scope > *').first()).toBeInViewport();

    // The whole dialog is on screen, with its title, its close button and its footer.
    const box = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: window.innerWidth, height: window.innerHeight };
    });
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(box.height + 0.5);
    expect(box.right).toBeLessThanOrEqual(box.width + 0.5);
    await expect(dialog.getByRole('heading', { level: 2, name })).toBeInViewport();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    if (footer) await expect(dialog.getByRole('button', { name: footer, exact: true })).toBeInViewport();

    // A body taller than the screen scrolls to its last line.
    if (size.scroll > size.client + 1) {
      await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await expect(body.locator(':scope > *').last()).toBeInViewport();
    }

    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

// TEMPORARY diagnostic (removed after one CI run): the old dialog layout
// against the fixed one, measured in each engine.
test('diagnostic: dialog body height with flex-basis 0% and auto @phone @webkit', async ({ page, browserName }) => {
  await openExpert(page);
  const heights = await page.evaluate(() => {
    const measure = (flex) => {
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'display:flex;flex-direction:column;max-height:calc(100dvh - 2rem);width:calc(100% - 2rem);padding:0;margin:auto';
      dialog.innerHTML = `<div style="padding:8px">Title</div><div data-b style="flex:${flex};min-height:0;overflow-y:auto;padding:16px"><p>Line</p><p>Line</p><p>Line</p></div><div style="padding:8px">Footer</div>`;
      document.body.append(dialog);
      dialog.showModal();
      const h = dialog.querySelector('[data-b]').getBoundingClientRect().height;
      dialog.close();
      dialog.remove();
      return Math.round(h);
    };
    return { basis0: measure('1 1 0%'), basisAuto: measure('1 1 auto') };
  });
  console.log(`[diagnostic] ${browserName}: body height with flex 1 1 0% = ${heights.basis0} px, with 1 1 auto = ${heights.basisAuto} px`);
  expect(heights.basisAuto).toBeGreaterThan(60);
});
