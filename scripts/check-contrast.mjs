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
 * WCAG contrast check of the design tokens in src/app/globals.css.
 *
 * Reads the colour custom properties of the `:root` (light) and `.dark`
 * (dark, on top of :root) blocks, outside any @media rule, resolves `var()`
 * and `color-mix(in srgb, …)` values, and checks every pair in
 * CONTRAST_PAIRS against its WCAG 2.x minimum: 4.5:1 for text, 3:1 for UI
 * parts (focus ring, control borders). A failure is fixed by changing the
 * token in globals.css, never per component.
 *
 * Usage: `node scripts/check-contrast.mjs [path/to/globals.css]` prints every
 * pair and exits with 1 when one fails. The Vitest test
 * (scripts/check-contrast.test.mjs) runs the same check in `npm test`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/** Text colours. */
const TEXT = ['ink', 'ink-2', 'muted'];
/** Backgrounds text sits on. */
const BACKGROUNDS = ['bg', 'surface', 'surface-2'];
/** Substance and status colours: used as text and icons on surfaces and on their own soft tint. */
const HUES = ['glucose', 'fructose', 'sodium', 'fluid', 'caffeine', 'ok', 'warn', 'danger'];

/** Every soft tint (chips, lanes, warning boxes, the accent tint). */
const SOFT = [...HUES, 'accent'].map((hue) => `${hue}-soft`);

/**
 * Pairs the primitives in src/components/ui render on top of the rule-based
 * pairs above (each with where it appears). Keep this list in step with the
 * components: a colour placed on a new background goes here.
 * @type {ReadonlyArray<{ fg: string, bg: string, min: number }>}
 */
const RENDERED_PAIRS = [
  // Citation links (underlined ink) and the "Why?" button (ink-2): in panels, the Why panel
  // (surface-2), the warning boxes (warn-soft, danger-soft) and the info box (surface-2).
  ...['ink', 'ink-2'].flatMap((fg) => ['bg', 'surface', 'surface-2', 'warn-soft', 'danger-soft'].map((bg) => ({ fg, bg, min: 4.5 }))),
  // WarningList icons in their own box; the info icon is ink-2 on surface-2 (above).
  { fg: 'danger', bg: 'danger-soft', min: 4.5 },
  { fg: 'warn', bg: 'warn-soft', min: 4.5 },
  // Chip text: a tone on its own tint, neutral (ink-2) on surface-2, accent (ink) on accent-soft.
  { fg: 'ink', bg: 'accent-soft', min: 4.5 },
  // Toast icon (tone colour) and text (ink) on the toast panel (surface).
  ...['ok', 'warn', 'danger', 'ink-2', 'ink'].map((fg) => ({ fg, bg: 'surface', min: 4.5 })),
  // NumberField unit suffix (muted) and stepper icons (ink-2) on the input (surface-2).
  ...['muted', 'ink-2'].map((fg) => ({ fg, bg: 'surface-2', min: 4.5 })),
  // Focus ring around a link or button inside a chip, lane or warning box (non-text, 3:1).
  ...SOFT.map((bg) => ({ fg: 'focus', bg, min: 3 })),
];

/**
 * Pairs without duplicates (the same fg and bg once, with the higher minimum).
 * @param {ReadonlyArray<{ fg: string, bg: string, min: number }>} pairs
 * @returns {Array<{ fg: string, bg: string, min: number }>}
 */
export function uniquePairs(pairs) {
  const byKey = new Map();
  for (const pair of pairs) {
    const key = `${pair.fg}|${pair.bg}`;
    const seen = byKey.get(key);
    if (!seen || pair.min > seen.min) byKey.set(key, { ...pair });
  }
  return [...byKey.values()];
}

/**
 * Every foreground/background pair the design uses, with its minimum ratio.
 * @type {ReadonlyArray<{ fg: string, bg: string, min: number }>}
 */
export const CONTRAST_PAIRS = Object.freeze(
  uniquePairs([
    // Text, secondary text and captions on the page, panels and insets.
    ...TEXT.flatMap((fg) => BACKGROUNDS.map((bg) => ({ fg, bg, min: 4.5 }))),
    // Substance and status colours as text on panels, insets, the page and their soft tint.
    ...HUES.flatMap((fg) => [...BACKGROUNDS, `${fg}-soft`].map((bg) => ({ fg, bg, min: 4.5 }))),
    // Body text on every soft tint (chips, lanes, warning boxes).
    ...['ink', 'ink-2'].flatMap((fg) => SOFT.map((bg) => ({ fg, bg, min: 4.5 }))),
    // Label of the primary action on the accent fill.
    { fg: 'accent-ink', bg: 'accent', min: 4.5 },
    // Focus ring and control borders (non-text contrast, WCAG 1.4.11).
    ...BACKGROUNDS.map((bg) => ({ fg: 'focus', bg, min: 3 })),
    ...BACKGROUNDS.map((bg) => ({ fg: 'line-strong', bg, min: 3 })),
    ...RENDERED_PAIRS,
  ]),
);

/**
 * Splits CSS into blocks with their prelude (selector or at-rule), the
 * preludes of their ancestors and their own declarations (not those of
 * nested blocks). Comments are removed first. Good enough for globals.css
 * (no braces or semicolons inside strings).
 * @param {string} css
 * @returns {Array<{ prelude: string, ancestors: string[], declarations: string[] }>}
 */
export function parseBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  const stack = [];
  let buffer = '';
  for (const ch of text) {
    if (ch === '{') {
      stack.push({ prelude: buffer.trim(), declarations: [] });
      buffer = '';
    } else if (ch === '}') {
      const block = stack.pop();
      if (block) {
        if (buffer.trim()) block.declarations.push(buffer.trim());
        blocks.push({ ...block, ancestors: stack.map((b) => b.prelude) });
      }
      buffer = '';
    } else if (ch === ';') {
      if (stack.length > 0 && buffer.trim()) stack.at(-1).declarations.push(buffer.trim());
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  return blocks;
}

/**
 * The custom properties of the light (`:root`) and dark (`.dark`) token
 * blocks. Blocks inside an at-rule other than `@layer` (such as the print
 * media query) are ignored. Dark starts from light, as both apply to <html>.
 * @param {string} css
 * @returns {{ light: Record<string, string>, dark: Record<string, string> }}
 */
export function parseTokens(css) {
  const light = {};
  const dark = {};
  for (const block of parseBlocks(css)) {
    if (!block.ancestors.every((a) => a.startsWith('@layer'))) continue;
    const target = block.prelude === ':root' ? light : block.prelude === '.dark' ? dark : null;
    if (!target) continue;
    for (const declaration of block.declarations) {
      const match = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(declaration);
      if (match) target[match[1]] = match[2].trim();
    }
  }
  return { light, dark: { ...light, ...dark } };
}

/**
 * Resolves a colour value to sRGB channels (0–255, unrounded): `#rgb`,
 * `#rrggbb`, `var(--x)` and `color-mix(in srgb, A p%, B)`.
 * @param {string} value
 * @param {Record<string, string>} vars
 * @param {number} [depth]
 * @returns {[number, number, number]}
 */
export function resolveColor(value, vars, depth = 0) {
  if (depth > 20) throw new Error(`Colour reference loop at ${value}`);
  const v = String(value).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
  }
  const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (ref) {
    if (!Object.hasOwn(vars, ref[1])) throw new Error(`Unknown token ${ref[1]}`);
    return resolveColor(vars[ref[1]], vars, depth + 1);
  }
  const mix = /^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)\s*\)$/.exec(v);
  if (mix) {
    const p = Number(mix[2]) / 100;
    const a = resolveColor(mix[1], vars, depth + 1);
    const b = resolveColor(mix[3], vars, depth + 1);
    return /** @type {[number, number, number]} */ (a.map((channel, i) => channel * p + b[i] * (1 - p)));
  }
  throw new Error(`Cannot resolve colour "${v}"`);
}

/**
 * WCAG relative luminance of sRGB channels (0–255).
 * @param {number[]} rgb
 * @returns {number}
 */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio of two colours (1–21).
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Checks every pair of {@link CONTRAST_PAIRS} in both themes.
 * @param {string} css  The contents of globals.css.
 * @param {ReadonlyArray<{ fg: string, bg: string, min: number }>} [pairs]
 * @returns {{ results: Array<{ theme: string, fg: string, bg: string, ratio: number, min: number, pass: boolean }>,
 *   failures: Array<{ theme: string, fg: string, bg: string, ratio: number, min: number, pass: boolean }> }}
 */
export function checkContrast(css, pairs = CONTRAST_PAIRS) {
  const themes = parseTokens(css);
  const results = [];
  for (const [theme, vars] of Object.entries(themes)) {
    for (const { fg, bg, min } of pairs) {
      const ratio = contrastRatio(resolveColor(`var(--${fg})`, vars), resolveColor(`var(--${bg})`, vars));
      results.push({ theme, fg, bg, ratio, min, pass: ratio >= min });
    }
  }
  return { results, failures: results.filter((r) => !r.pass) };
}

/** Default stylesheet: src/app/globals.css next to this script's repository. */
export const GLOBALS_CSS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'globals.css');

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const file = process.argv[2] ?? GLOBALS_CSS;
  const { results, failures } = checkContrast(readFileSync(file, 'utf8'));
  for (const r of results) {
    const mark = r.pass ? 'ok  ' : 'FAIL';
    console.log(`${mark} ${r.theme.padEnd(5)} ${r.fg.padEnd(12)} on ${r.bg.padEnd(15)} ${r.ratio.toFixed(2).padStart(5)}:1 (min ${r.min})`);
  }
  console.log(`${results.length - failures.length}/${results.length} pairs pass.`);
  if (failures.length > 0) process.exitCode = 1;
}
