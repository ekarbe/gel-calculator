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
 * Class name helpers shared by the primitives in `src/components/ui/`.
 */

/**
 * Joins class names, skipping falsy values (`cx('a', on && 'b')`).
 * @param {...(string|false|null|undefined|0)} classes
 * @returns {string}
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Colour tones: one per substance (glucose, fructose, sodium, fluid,
 * caffeine), per status (ok, warn, danger), the accent and neutral. Each has
 * complete Tailwind class names (written out so Tailwind finds them):
 * `text` (AA on surfaces and on its soft tint), `soft` (tinted background),
 * `fill` (solid: bars, dots, edge marks) and `border`.
 * @type {Readonly<Record<string, Readonly<{ text: string, soft: string, fill: string, border: string }>>>}
 */
export const TONES = Object.freeze({
  neutral: Object.freeze({ text: 'text-ink-2', soft: 'bg-surface-2', fill: 'bg-ink-2', border: 'border-line-strong' }),
  accent: Object.freeze({ text: 'text-ink', soft: 'bg-accent-soft', fill: 'bg-accent', border: 'border-accent' }),
  glucose: Object.freeze({ text: 'text-glucose', soft: 'bg-glucose-soft', fill: 'bg-glucose', border: 'border-glucose' }),
  fructose: Object.freeze({ text: 'text-fructose', soft: 'bg-fructose-soft', fill: 'bg-fructose', border: 'border-fructose' }),
  sodium: Object.freeze({ text: 'text-sodium', soft: 'bg-sodium-soft', fill: 'bg-sodium', border: 'border-sodium' }),
  fluid: Object.freeze({ text: 'text-fluid', soft: 'bg-fluid-soft', fill: 'bg-fluid', border: 'border-fluid' }),
  caffeine: Object.freeze({ text: 'text-caffeine', soft: 'bg-caffeine-soft', fill: 'bg-caffeine', border: 'border-caffeine' }),
  ok: Object.freeze({ text: 'text-ok', soft: 'bg-ok-soft', fill: 'bg-ok', border: 'border-ok' }),
  warn: Object.freeze({ text: 'text-warn', soft: 'bg-warn-soft', fill: 'bg-warn', border: 'border-warn' }),
  danger: Object.freeze({ text: 'text-danger', soft: 'bg-danger-soft', fill: 'bg-danger', border: 'border-danger' }),
});

/**
 * The classes of a tone; unknown tones are neutral.
 * @param {string|undefined} tone
 * @returns {{ text: string, soft: string, fill: string, border: string }}
 */
export function toneClasses(tone) {
  return typeof tone === 'string' && Object.hasOwn(TONES, tone) ? TONES[tone] : TONES.neutral;
}
