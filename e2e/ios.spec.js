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

// TEMPORARY diagnostic (removed once CI has run it): the old dialog body
// (flex-1) against the fixed one (flex-auto), with the dialog's own classes,
// in the order the app uses (an empty dialog is opened and laid out, then the
// content is put in), and with the class swapped on the real Share dialog.
test('diagnostic: dialog body height with flex-1 and flex-auto @phone @webkit', async ({ page, browserName }) => {
  await openExpert(page);
  const results = await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const DIALOG = 'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-panel border border-line bg-surface p-0 text-ink shadow-dialog open:flex open:flex-col open:animate-rise-in max-w-sm';
    const content = (flex) =>
      `<div class="flex items-start justify-between gap-3 border-b border-line py-2 pl-4 pr-2"><h2 class="display-section min-w-0 py-2 text-ink">Title</h2><button type="button">Close</button></div>` +
      `<div data-b class="min-h-0 ${flex} overflow-y-auto px-4 py-4"><p class="mb-3 text-body-sm text-ink-2">Send this plan as a link, or save a picture of the recipe.</p><div style="height:120px">x</div></div>` +
      `<div class="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3"><button type="button">Done</button></div>`;
    const measure = async (flex, order) => {
      const dialog = document.createElement('dialog');
      dialog.className = DIALOG;
      document.body.append(dialog);
      if (order === 'before') dialog.innerHTML = content(flex);
      dialog.showModal();
      if (order === 'after') {
        dialog.getBoundingClientRect();
        dialog.innerHTML = content(flex);
      }
      const now = Math.round(dialog.querySelector('[data-b]').getBoundingClientRect().height);
      await frame();
      const later = Math.round(dialog.querySelector('[data-b]').getBoundingClientRect().height);
      dialog.close();
      dialog.remove();
      return `${now}/${later}`;
    };
    const out = {};
    for (const flex of ['flex-1', 'flex-auto']) for (const order of ['before', 'after']) out[`${flex} ${order}`] = await measure(flex, order);
    return out;
  });
  // The real Share dialog, its body switched back to flex-1.
  await header(page).getByRole('button', { name: 'Share', exact: true }).click();
  const body = page.getByRole('dialog', { name: 'Share' }).locator('[data-dialog-body]');
  await expect(body).toBeVisible();
  const swapped = await body.evaluate(async (el) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const before = Math.round(el.getBoundingClientRect().height);
    el.classList.replace('flex-auto', 'flex-1');
    const now = Math.round(el.getBoundingClientRect().height);
    await frame();
    return `${before} -> ${now}/${Math.round(el.getBoundingClientRect().height)}`;
  });
  console.log(`[diagnostic] ${browserName}: ${JSON.stringify(results)}; real Share body flex-auto -> flex-1: ${swapped} px`);
  expect(results['flex-auto after']).not.toMatch(/^(\d|[1-5]\d)\//);
});
