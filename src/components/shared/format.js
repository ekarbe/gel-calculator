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
 * Number and ratio formatting shared by every card and modal, so the same
 * value always reads the same way. Display only: these helpers never compute
 * nutrition, they format numbers the plan already holds.
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

/**
 * A glucose:fructose ratio as text, normalized to glucose 1 (`2:1` → `1:0.5`),
 * the form the domain messages use. Without glucose it is `0:1`; without
 * either part `0:0`. Negative or non-finite parts count as 0.
 * @param {{ glucose: number, fructose: number }|null|undefined} ratio
 * @returns {string}
 */
export function formatRatio(ratio) {
  const glucose = Number.isFinite(ratio?.glucose) && ratio.glucose > 0 ? ratio.glucose : 0;
  const fructose = Number.isFinite(ratio?.fructose) && ratio.fructose > 0 ? ratio.fructose : 0;
  if (glucose > 0) return `1:${Number((fructose / glucose).toFixed(2))}`;
  return fructose > 0 ? "0:1" : "0:0";
}

/**
 * A fructose share (fructose ÷ all carbs) as ratio text (`1/3` → `1:0.5`,
 * `0.5` → `1:1`). A share of 1 or more is `0:1`.
 * @param {number} share
 * @returns {string}
 */
export function shareToRatio(share) {
  if (!(share < 1)) return "0:1";
  return formatRatio({ glucose: 1, fructose: Math.max(0, share) / (1 - share) });
}
