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
 * Number and range formatting shared by every card and modal, so the same
 * value always reads the same way. Display only: these helpers never compute
 * nutrition, they format numbers the plan already holds. Ratios are formatted
 * by the domain (`formatRatio` in `src/domain/carbs.js`).
 */

/**
 * A number with thousands separators and at most `digits` decimals (en-US).
 * Non-finite numbers show as 0.
 * @param {number} value
 * @param {number} [digits=0]
 * @returns {string}
 */
export function fmt(value, digits = 0) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/**
 * A `[lo, hi]` range with an en dash and a unit (`60–90 g/h`). A `[0, 0]`
 * range reads as one value (`0 g/h`). Anything that is not a two-number range
 * gives `null`.
 * @param {number[]|undefined|null} range
 * @param {string} unit
 * @returns {string|null}
 */
export function formatRange(range, unit) {
  if (!Array.isArray(range) || range.length < 2) return null;
  const [lo, hi] = range;
  if (lo === 0 && hi === 0) return `0 ${unit}`;
  return `${fmt(lo)}–${fmt(hi)} ${unit}`;
}

/** The minus sign of signed numbers (U+2212), the same as in domain messages. */
const MINUS = "−";

/**
 * A number with an explicit sign ("+0.3", "−1.8"). The value is rounded to
 * `digits` decimals first, so a value that shows as zero reads "0" with no
 * sign; non-finite values count as 0.
 * @param {number} value
 * @param {number} [digits=0]
 * @returns {string}
 */
export function signed(value, digits = 0) {
  const factor = 10 ** digits;
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : MINUS}${fmt(Math.abs(rounded), digits)}`;
}

/**
 * A duration as text: "45 min", "3 h", "2 h 30 min". Rounded to whole
 * minutes; non-finite or negative values count as 0.
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  const total = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * An estimated energy use in kcal, rounded to 10 ("2,040"): the estimate is
 * not precise to the kcal, and every view shows it the same way.
 * @param {number} kcal
 * @returns {string}
 */
export function aboutKcal(kcal) {
  return fmt(Math.round((Number.isFinite(kcal) ? kcal : 0) / 10) * 10);
}
