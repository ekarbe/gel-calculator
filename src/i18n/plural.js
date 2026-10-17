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
 * Counts in text: the plural form of a count and the text of a count with
 * one and many forms (`<key>.one` / `<key>.other` in a catalog). Shared by
 * every view that writes counts ("9 gels", "4 warnings"). No React.
 */

/** @typedef {import('./index').TranslateFn} TranslateFn */
/** @typedef {import('./formatters').Formatters} Formatters */

/**
 * The plural form of a count in English and German: `'one'` for exactly 1,
 * else `'other'`.
 * @param {number} count
 * @returns {'one'|'other'}
 */
export const pluralOf = (count) => (count === 1 ? 'one' : 'other');

/**
 * Text for a count with one and many forms (`<key>.one` / `<key>.other`,
 * with `{count}` in the locale's number format).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {string} key
 * @param {number} count
 * @returns {string}
 */
export function countText(t, f, key, count) {
  return t(`${key}.${pluralOf(count)}`, { count: f.number(count) });
}
