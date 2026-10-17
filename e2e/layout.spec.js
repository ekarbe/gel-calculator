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
import { board, expectNoOverflow, guidedNext, openApp } from './helpers.js';

// Layout: nothing scrolls sideways at 360, 390, 768, 1024 and 1440 px, in
// guided and expert mode, in English and in German (longer words), on every
// guided screen and every phone tab; the expert layout has two columns from
// 1024 px; print media shows the print layout instead of the app.

/** Width → phone emulation (touch, mobile viewport) below 1024 px. */
const WIDTHS = [360, 390, 768, 1024, 1440];

/** A plan with every board part: gels and a drink, caffeine, bicarbonate, warnings. */
const FULL_PLAN = `./?s=${encodeShareState({
  event: { durationMin: 240 },
  sweat: { source: 'preset' },
  format: { type: 'both' },
  caffeine: { enabled: true },
})}`;

const NAMES = {
  en: { next: /^Next/, nav: 'Step navigation', tabs: 'Sections' },
  de: { next: /^Weiter/, nav: 'Schrittnavigation', tabs: 'Bereiche' },
};

for (const width of WIDTHS) {
  const phone = width < 1024;
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: phone ? 800 : 900 }, isMobile: phone, hasTouch: phone });

    for (const locale of /** @type {const} */ (['en', 'de'])) {
      test(`the guided screens fit the width (${locale}) @desktop`, async ({ page }) => {
        const errors = await openApp(page, { prefs: { mode: 'guided', locale } });
        for (let screen = 1; screen <= 5; screen += 1) {
          await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
          await expectNoOverflow(page, `guided screen ${screen}`);
          if (screen < 5) await guidedNext(page, NAMES[locale].nav, NAMES[locale].next).click();
        }
        expect(errors).toEqual([]);
      });

      test(`the expert views fit the width (${locale}) @desktop`, async ({ page }) => {
        const errors = await openApp(page, { path: FULL_PLAN, prefs: { mode: 'expert', locale } });
        await expect(board(page)).toBeVisible();
        await expectNoOverflow(page, 'board');
        const tabs = page.getByRole('navigation', { name: NAMES[locale].tabs });
        if (phone) {
          // One view at a time: lay out each one and measure it.
          const buttons = tabs.getByRole('button');
          await expect(buttons).toHaveCount(3);
          for (let i = 0; i < 3; i += 1) {
            await buttons.nth(i).click();
            await expectNoOverflow(page, `${await buttons.nth(i).innerText()} tab`);
          }
          await buttons.first().click();
        } else {
          // Two columns: the setup on the left, the board on the right, no tab bar.
          await expect(tabs).toHaveCount(0);
          const setup = await page.getByTestId('shell-setup').boundingBox();
          const right = await page.getByTestId('shell-board').boundingBox();
          expect(setup.x + setup.width).toBeLessThanOrEqual(right.x);
          expect(setup.width).toBeLessThanOrEqual(420);
        }
        // Dialogs fit too.
        await page.getByTestId('shell-settings').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expectNoOverflow(page, 'settings dialog');
        await page.keyboard.press('Escape');
        await page.getByTestId('board-start-mixing').click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expectNoOverflow(page, 'mixing dialog');
        expect(errors).toEqual([]);
      });
    }
  });
}

test('the sticky board stays in view while the setup column scrolls @desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page, { prefs: { mode: 'expert' } });
  const before = await board(page).boundingBox();
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  const after = await board(page).boundingBox();
  // Pinned 1 rem under the 57 px header.
  expect(after.y).toBeGreaterThanOrEqual(56);
  expect(after.y).toBeLessThan(before.y + 1);
  expect(after.y).toBeLessThanOrEqual(100);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }]) {
  test(`the sticky board never covers the full schedule under the columns at ${viewport.width} × ${viewport.height} @desktop`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = await openApp(page, { path: FULL_PLAN, prefs: { mode: 'expert' } });
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    // Walk the page from the top to the bottom: the board column (the sticky box that scrolls
    // the board when it is taller than the space under the header) and the schedule never overlap.
    for (let y = 0; y <= max + 200; y += 200) {
      await page.evaluate((top) => window.scrollTo(0, top), Math.min(y, max));
      const [boardBox, schedule] = await Promise.all([page.getByTestId('shell-board').boundingBox(), page.getByTestId('shell-schedule').boundingBox()]);
      expect(boardBox.y + boardBox.height, `scrolled to ${Math.min(y, max)}`).toBeLessThanOrEqual(schedule.y + 1);
    }
    // The board itself scrolls when it is taller than the space under the header, and Full schedule is shown.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('board-full-schedule')).toBeVisible();
    await page.getByTestId('board-full-schedule').click();
    await expect.poll(() => page.getByTestId('shell-schedule').evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(viewport.height);
    expect(errors).toEqual([]);
  });
}

test.describe('the German guided dock on narrow phones', () => {
  for (const width of [320, 360, 390, 414]) {
    test.describe(`at ${width} px`, () => {
      test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      test('shows each caption on one line, inside its column @desktop', async ({ page }) => {
        const errors = await openApp(page, { prefs: { mode: 'guided', locale: 'de' } });
        for (const id of ['carbs', 'sodium', 'fluid']) {
          const stat = page.getByTestId(`guided-dock-${id}`);
          const caption = page.getByTestId(`guided-dock-${id}-caption`);
          const [statBox, captionBox, lineHeight] = await Promise.all([
            stat.boundingBox(),
            caption.boundingBox(),
            caption.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight)),
          ]);
          expect(captionBox.height, `${id}: one line`).toBeLessThanOrEqual(lineHeight + 1);
          expect(captionBox.x + captionBox.width, `${id}: inside its column`).toBeLessThanOrEqual(statBox.x + statBox.width + 1);
        }
        await expectNoOverflow(page, 'guided dock');
        expect(errors).toEqual([]);
      });
    });
  }
});

test.describe('at 320 px with the WCAG text spacing', () => {
  test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
  test('every German expert view fits the width, and the projection level wraps instead of being cut @desktop', async ({ page }) => {
    const errors = await openApp(page, { path: FULL_PLAN, prefs: { mode: 'expert', locale: 'de' } });
    // SC 1.4.12: line height 1.5, paragraph spacing 2 em, letter spacing 0.12 em, word spacing 0.16 em.
    await page.addStyleTag({
      content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    });
    const buttons = page.getByRole('navigation', { name: NAMES.de.tabs }).getByRole('button');
    for (let i = 0; i < 3; i += 1) {
      await buttons.nth(i).click();
      await expectNoOverflow(page, `${await buttons.nth(i).innerText()} tab`);
    }
    await buttons.nth(1).click();
    const level = page.getByTestId('fluid-body-mass-level');
    await expect(level).toBeVisible();
    const clipped = await level.evaluate((el) => [el, ...el.querySelectorAll('*')].some((node) => node.scrollWidth > node.clientWidth + 1));
    expect(clipped).toBe(false);
    expect(errors).toEqual([]);
  });
});

test.describe('in a short viewport (a 1280 × 1024 screen at 400 % zoom)', () => {
  test.use({ viewport: { width: 320, height: 256 }, isMobile: true, hasTouch: true });
  test('the header and the tab bar scroll with the page instead of covering it @desktop', async ({ page }) => {
    const errors = await openApp(page, { prefs: { mode: 'expert' } });
    const positions = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('header')).position,
      tabBar: getComputedStyle(document.querySelector('[data-testid=shell-tabbar]')).position,
    }));
    expect(positions).toEqual({ header: 'static', tabBar: 'static' });
    await expectNoOverflow(page, 'board at 400 %');
    expect(errors).toEqual([]);
  });
});

test('print media shows the print layout instead of the app', async ({ page }) => {
  const errors = await openApp(page, { prefs: { mode: 'expert' } });
  const printView = page.getByTestId('print-recipe');
  const app = page.getByTestId('app-shell');

  // On screen the print view is hidden.
  await expect(printView).toBeHidden();
  await expect(app).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(printView).toBeVisible();
  await expect(app).toBeHidden();
  await expect(page.getByRole('banner')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
  await expect(printView.getByRole('heading', { level: 1 })).toHaveText('Race-day fuel plan');
  // An en-GB visitor reads British dates (day first); the numbers stay the same.
  await expect(page.getByTestId('print-date')).toHaveText(/^Printed on \d{1,2} \w+ \d{4}$/);

  // The default recipe: one gel batch for 9 gels with maltodextrin, fructose, table salt and warm water.
  await expect(printView.getByRole('heading', { name: 'Gel batch: 9 gels' })).toBeVisible();
  const table = printView.getByRole('table', { name: 'Gel batch ingredients' });
  for (const label of ['Maltodextrin', 'Crystalline Fructose', 'Sodium Chloride (Table Salt)', 'Warm water']) {
    await expect(table.getByRole('rowheader', { name: label, exact: true })).toBeVisible();
  }
  await expect(printView.getByRole('list', { name: 'Gel batch steps' }).getByRole('listitem').first()).toHaveText(/^Weigh the Ingredients\. /);
  // A block heading never ends a page on its own: the schedule table follows its heading.
  const scheduleHeading = printView.getByRole('heading', { level: 2, name: 'Schedule' });
  expect(await scheduleHeading.evaluate((el) => getComputedStyle(el).breakAfter)).toBe('avoid');
  await expect(printView.getByRole('table', { name: 'Race-day schedule' })).toBeVisible();
  await expect(printView.getByRole('list', { name: 'Printed warnings' })).toBeVisible();

  // Black on white, whatever the screen theme.
  const colours = await printView.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, body: getComputedStyle(document.body).backgroundColor };
  });
  expect(colours).toEqual({ color: 'rgb(0, 0, 0)', body: 'rgb(255, 255, 255)' });

  await page.emulateMedia({ media: 'screen' });
  await expect(printView).toBeHidden();
  await expect(app).toBeVisible();
  expect(errors).toEqual([]);
});

test('print media in dark mode and German prints black on white in German', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const errors = await openApp(page, { prefs: { mode: 'expert', locale: 'de' } });
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const printView = page.getByTestId('print-recipe');
  await expect(printView.getByRole('heading', { level: 1 })).toHaveText('Verpflegungsplan für den Wettkampf');
  await expect(printView.getByRole('region', { name: 'Planübersicht' })).toBeVisible();
  const colours = await printView.evaluate((el) => ({ color: getComputedStyle(el).color, body: getComputedStyle(document.body).backgroundColor }));
  expect(colours).toEqual({ color: 'rgb(0, 0, 0)', body: 'rgb(255, 255, 255)' });
  expect(errors).toEqual([]);
});
