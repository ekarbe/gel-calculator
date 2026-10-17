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
 * A rough cost estimate of the carbohydrate in a plan, in the currency the
 * user picked: home-mixed powders (DIY) against commercial gels.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no text. The rates
 * are rough retail prices per gram of carbohydrate (2026), not live prices,
 * so every result is flagged `approximate`. The plan keeps its own
 * currency-less `cost` field; the UI shows this estimate.
 */

/** Currencies the cost estimate supports. */
export const CURRENCIES = Object.freeze(['EUR', 'USD', 'GBP']);

/** Currency used for an unknown currency code. */
export const DEFAULT_CURRENCY = 'EUR';

/**
 * Rough prices per gram of carbohydrate: `diy` for bulk maltodextrin,
 * dextrose and fructose powders, `commercial` for ready-made gels (about
 * 2.25–2.50 per 25 g gel).
 * @type {Readonly<Record<'EUR'|'USD'|'GBP', Readonly<{ diy: number, commercial: number }>>>}
 */
export const COST_PER_G = Object.freeze({
  USD: Object.freeze({ diy: 0.015, commercial: 0.1 }),
  EUR: Object.freeze({ diy: 0.014, commercial: 0.09 }),
  GBP: Object.freeze({ diy: 0.012, commercial: 0.08 }),
});

/**
 * @typedef {Object} CostEstimate
 * @property {number} diy  Cost of the carbs as home-mixed powders.
 * @property {number} commercial  Cost of the same carbs as commercial gels.
 * @property {number} savings  `commercial − diy` (never negative: both rates scale the same grams).
 * @property {'EUR'|'USD'|'GBP'} currency  The currency of the amounts.
 * @property {true} approximate  Always true: the rates are rough retail prices.
 */

/**
 * Estimates what the carbs of a plan cost, mixed at home and as commercial
 * gels. Amounts are not rounded (the UI formats them as currency).
 *
 * @param {number} totalCarbsG  Carbohydrate for the whole activity in g. Missing, non-finite or
 *   negative values count as 0.
 * @param {string} [currency]  `'EUR'`, `'USD'` or `'GBP'`; anything else uses {@link DEFAULT_CURRENCY}.
 * @returns {CostEstimate}
 */
export function estimateCost(totalCarbsG, currency) {
  const grams = typeof totalCarbsG === 'number' && Number.isFinite(totalCarbsG) && totalCarbsG > 0 ? totalCarbsG : 0;
  const code = typeof currency === 'string' && Object.hasOwn(COST_PER_G, currency) ? currency : DEFAULT_CURRENCY;
  const rates = COST_PER_G[code];
  const diy = grams * rates.diy;
  const commercial = grams * rates.commercial;
  return { diy, commercial, savings: commercial - diy, currency: /** @type {'EUR'|'USD'|'GBP'} */ (code), approximate: true };
}
