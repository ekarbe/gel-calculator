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

/**
 * Renders the images the repository ships, from the current build, so they
 * can be made again after a UI change:
 *
 * - `public/og.png`: the 1200 × 630 social preview card
 *   (`scripts/og-card.html`, with the build's self-hosted fonts inlined);
 * - `assets/race-board.png`, `assets/guided-phone.png` and
 *   `assets/board-phone-de.png`: the README screenshots of the README's
 *   example plan ({@link README_PLAN}): the expert layout on a 1440 × 900
 *   desktop (dark theme), the guided flow (light) and the German race board
 *   (dark) on a 390 × 844 phone.
 *
 * Usage, after `npm run build`:
 *   node scripts/render-images.mjs [og|screenshots|all]   (default all)
 * Set PW_CHROMIUM_EXECUTABLE to use a preinstalled Chromium (as the e2e
 * suite does). The screenshots start `scripts/serve-static.mjs` on port
 * 4180 (env IMAGES_PORT) for the time it takes.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.join(ROOT, 'out', '_next', 'static');
const PORT = Number(process.env.IMAGES_PORT) || 4180;
const BASE_URL = `http://localhost:${PORT}/gel-calculator/`;
const PREFS_KEY = 'gel-calculator:prefs';
const AUTOSAVE_KEY = 'gel-calculator:autosave';

/**
 * The plan the README screenshots show: a 3:30 h race run with the self-assessed
 * sweat rate (1.25 L/h) and caffeine, as the inputs that differ from the
 * defaults. It is stored as the autosave (the `?s=` share format, v4), so
 * the guided flow opens on it too.
 */
const README_PLAN = {
  event: { sport: 'running', durationMin: 210, intensity: 'race', speedKmh: 12 },
  sweat: { source: 'preset' },
  caffeine: { enabled: true },
};
const README_PLAN_CODE = Buffer.from(JSON.stringify({ v: 4, ...README_PLAN })).toString('base64url');

/** @returns {Promise<import('@playwright/test').Browser>} */
const launch = () => chromium.launch({ executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined });

/**
 * The latin `@font-face` rules of the build's three families (Barlow
 * Condensed, IBM Plex Sans, IBM Plex Mono) with the font files inlined as
 * data URIs, so the card renders with the fonts the app uses.
 * @returns {string}
 */
function inlineFonts() {
  const chunks = path.join(STATIC_DIR, 'chunks');
  if (!existsSync(chunks)) throw new Error('No build in ./out: run `npm run build` first.');
  const css = readdirSync(chunks)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(path.join(chunks, file), 'utf8'))
    .join('\n');
  const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)]
    .map((match) => match[1])
    .filter((rule) => !/Fallback/.test(rule) && /unicode-range:U\+0*0?\?\?|unicode-range:U\+0000-00FF/i.test(rule))
    .map((rule) => {
      const family = rule.match(/font-family:([^;]+);/)[1].replace(/['"]/g, '');
      const weight = rule.match(/font-weight:(\d+)/)?.[1] ?? '400';
      const file = rule.match(/url\(\.\.\/media\/([^)]+)\)/)[1];
      const data = readFileSync(path.join(STATIC_DIR, 'media', file)).toString('base64');
      return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
    });
  if (faces.length === 0) throw new Error('No self-hosted fonts found in the build CSS.');
  return faces.join('\n');
}

/** Renders the social preview card to public/og.png. */
async function renderOg() {
  const html = readFileSync(path.join(ROOT, 'scripts', 'og-card.html'), 'utf8').replace('/*FONTS*/', inlineFonts());
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, 'public', 'og.png');
    await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`wrote ${path.relative(ROOT, out)}`);
  } finally {
    await browser.close();
  }
}

/**
 * Starts the static server and resolves once it answers.
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
async function startServer() {
  const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve-static.mjs')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  server.kill();
  throw new Error(`The static server did not start on port ${PORT}.`);
}

/**
 * Opens the app with stored prefs and the README plan in a fresh context and
 * waits for the layout.
 * @param {import('@playwright/test').Browser} browser
 * @param {{ viewport: { width: number, height: number }, prefs: Record<string, string>, mobile?: boolean,
 *   colorScheme?: 'light'|'dark' }} options
 */
async function openPage(browser, { viewport, prefs, mobile = false, colorScheme = 'light' }) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    locale: prefs.locale === 'de' ? 'de-DE' : 'en-GB',
    colorScheme,
  });
  await context.addInitScript(
    ({ prefsKey, prefsValue, autosaveKey, autosaveValue }) => {
      localStorage.setItem(prefsKey, prefsValue);
      localStorage.setItem(autosaveKey, autosaveValue);
    },
    { prefsKey: PREFS_KEY, prefsValue: JSON.stringify(prefs), autosaveKey: AUTOSAVE_KEY, autosaveValue: README_PLAN_CODE },
  );
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true');
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

/** Renders the three README screenshots to assets/. */
async function renderScreenshots() {
  const server = await startServer();
  const browser = await launch();
  try {
    const shots = [
      { file: 'race-board.png', viewport: { width: 1440, height: 900 }, colorScheme: 'dark', prefs: { locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'expert' } },
      { file: 'guided-phone.png', viewport: { width: 390, height: 844 }, mobile: true, prefs: { locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'guided' } },
      { file: 'board-phone-de.png', viewport: { width: 390, height: 844 }, mobile: true, colorScheme: 'dark', prefs: { locale: 'de', unitSystem: 'metric', currency: 'EUR', mode: 'expert' } },
    ];
    for (const shot of shots) {
      const { context, page } = await openPage(browser, shot);
      const out = path.join(ROOT, 'assets', shot.file);
      await page.screenshot({ path: out, type: 'png' });
      console.log(`wrote ${path.relative(ROOT, out)}`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

const what = process.argv[2] ?? 'all';
if (!['og', 'screenshots', 'all'].includes(what)) {
  console.error('Usage: node scripts/render-images.mjs [og|screenshots|all]');
  process.exit(2);
}
if (what === 'og' || what === 'all') await renderOg();
if (what === 'screenshots' || what === 'all') await renderScreenshots();
