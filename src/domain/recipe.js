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
 * Recipe domain logic: turns the solved carb sources, the salt amounts and the
 * caffeine plan into one ordered list of recipe items. The same list feeds the
 * recipe card, the mixing steps, the share image and (later) the print view.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no I/O, and the
 * arguments are never mutated. Source labels are the English labels from
 * `src/constants/constants.js` (translation is Phase 3); the caffeine label is
 * a message descriptor whose key lives in `src/i18n/en/recipe.js`.
 */

import { sourceDataByIdMap, electrolyteSourceOptions } from '../constants/constants';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */

/** @typedef {'total'|'perGel'} RecipeView */
/** @typedef {'carb'|'salt'|'caffeine'} RecipeItemKind */

/**
 * One solved carb source, as returned in `solveCarbSources(...).items`.
 * @typedef {Object} CarbSourceItem
 * @property {number} id  Source id from `src/constants/constants.js`.
 * @property {number} grams  Powder/syrup mass as purchased (g, whole activity).
 * @property {number} carbsG  Carbohydrate the source delivers (g).
 * @property {number} glucoseG  Glucose-pathway carbohydrate (g).
 * @property {number} fructoseG  Fructose-pathway carbohydrate (g).
 * @property {'glucose'|'fructose'} pathway  The source list the source came from.
 */

/**
 * One salt amount for the whole activity.
 * @typedef {{ id: number, amountMg: number }} SaltAmount
 */

/**
 * One caffeine dose, as returned in `planCaffeine(...).doses`.
 * @typedef {Object} CaffeineDose
 * @property {number} timeMin  Minutes relative to the start (negative before the start).
 * @property {number} mg  Dose in mg.
 * @property {'pre'|'intra'} kind
 * @property {number|null} gelIndex  Index of the gel that carries the dose, or null.
 * @property {number|null} tablets  Number of tablets (e.g. 1.5) when added as an ingredient, else null.
 */

/**
 * The part of `planCaffeine(...)` this module reads.
 * @typedef {Object} CaffeinePlan
 * @property {boolean} enabled
 * @property {CaffeineDose[]} doses
 */

/**
 * Carb breakdown for one carb item, scaled like the item amount.
 * @typedef {{ carbsG: number, glucoseG: number, fructoseG: number }} CarbDetail
 */

/**
 * One line of the recipe.
 * @typedef {Object} RecipeItem
 * @property {string} key  Stable key, unique within the list (e.g. `carb:glucose:3`, `salt:31`, `caffeine:gel:6`).
 * @property {RecipeItemKind} kind
 * @property {number|null} id  Source id from constants for carbs and salts; null for caffeine.
 * @property {string|Message} label  English source label for carbs and salts; a
 *   `recipe.caffeineTablet` message (params `{ tablets, tabletMg, gel }`) for caffeine.
 * @property {'glucose'|'fructose'|null} pathway  Carb pathway; null for salts and caffeine.
 * @property {number} amount  Unrounded amount in `unit` for the chosen view.
 * @property {'g'|'mg'} unit
 * @property {string} display  `formatAmount(amount, unit)`.
 * @property {CarbDetail|null} detail  Carb breakdown for carbs; null otherwise.
 */

/** Carb pathways in recipe order. */
const PATHWAYS = ['glucose', 'fructose'];

/** Ids that are valid salts (electrolyte sources). */
const SALT_IDS = new Set(electrolyteSourceOptions.map((option) => option.id));

/**
 * @param {unknown} value
 * @returns {boolean} True for a finite number above 0.
 */
function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {number} The value when it is a finite number ≥ 0, else 0.
 */
function nonNegative(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Formats an amount for display.
 *
 * - `'g'`: whole grams, e.g. `formatAmount(53.4, 'g')` → `"53 g"`.
 * - `'mg'`: below 1000 mg whole milligrams (`"870 mg"`); from 1000 mg on grams
 *   with one decimal (`"3.8 g"`). The threshold is checked after rounding to
 *   whole mg, so 999.6 mg shows as `"1.0 g"` instead of `"1000 mg"`.
 * - Any other unit: the whole number followed by the unit.
 *
 * Non-finite or negative amounts are shown as 0.
 *
 * @param {number} amount  Amount in `unit`.
 * @param {'g'|'mg'|string} unit
 * @returns {string}
 */
export function formatAmount(amount, unit) {
  const value = nonNegative(amount);
  if (unit === 'mg') {
    const mg = Math.round(value);
    if (mg < 1000) return `${mg} mg`;
    return `${(Math.round(value / 100) / 10).toFixed(1)} g`;
  }
  const whole = Math.round(value);
  return unit ? `${whole} ${unit}` : String(whole);
}

/**
 * Returns a function that makes keys unique by appending `-2`, `-3`, … to repeats.
 * @returns {(base: string) => string}
 */
function keyMaker() {
  const seen = new Map();
  return (base) => {
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}

/**
 * Carb items for one pathway, in input order.
 * @param {CarbSourceItem[]} carbSources
 * @param {'glucose'|'fructose'} pathway
 * @param {number} divisor
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function carbItems(carbSources, pathway, divisor, makeKey) {
  const items = [];
  for (const source of carbSources) {
    if (!source || source.pathway !== pathway || !isPositive(source.grams)) continue;
    const data = sourceDataByIdMap.get(source.id);
    if (!data || !('carbsPerGram' in data)) continue;
    const amount = source.grams / divisor;
    items.push({
      key: makeKey(`carb:${pathway}:${source.id}`),
      kind: 'carb',
      id: source.id,
      label: data.label,
      pathway,
      amount,
      unit: 'g',
      display: formatAmount(amount, 'g'),
      detail: {
        carbsG: nonNegative(source.carbsG) / divisor,
        glucoseG: nonNegative(source.glucoseG) / divisor,
        fructoseG: nonNegative(source.fructoseG) / divisor,
      },
    });
  }
  return items;
}

/**
 * Salt items, in input order.
 * @param {SaltAmount[]} salts
 * @param {number} divisor
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function saltItems(salts, divisor, makeKey) {
  const items = [];
  for (const salt of salts) {
    if (!salt || !SALT_IDS.has(salt.id) || !isPositive(salt.amountMg)) continue;
    const amount = salt.amountMg / divisor;
    items.push({
      key: makeKey(`salt:${salt.id}`),
      kind: 'salt',
      id: salt.id,
      label: sourceDataByIdMap.get(salt.id).label,
      pathway: null,
      amount,
      unit: 'mg',
      display: formatAmount(amount, 'mg'),
      detail: null,
    });
  }
  return items;
}

/**
 * Caffeine items: one per gel that carries caffeine tablets, ordered by gel.
 * Only `intra` doses with a gel and a tablet count qualify; doses that share a
 * gel are added together. These amounts already belong to one specific gel,
 * so they are the same in both views.
 * @param {CaffeinePlan|null|undefined} caffeine
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function caffeineItems(caffeine, makeKey) {
  if (!caffeine || !caffeine.enabled || !Array.isArray(caffeine.doses)) return [];
  /** @type {Map<number, { mg: number, tablets: number }>} */
  const byGel = new Map();
  for (const dose of caffeine.doses) {
    if (!dose || dose.kind !== 'intra') continue;
    if (!Number.isInteger(dose.gelIndex) || dose.gelIndex < 0) continue;
    if (!isPositive(dose.mg) || !isPositive(dose.tablets)) continue;
    const sum = byGel.get(dose.gelIndex) ?? { mg: 0, tablets: 0 };
    byGel.set(dose.gelIndex, { mg: sum.mg + dose.mg, tablets: sum.tablets + dose.tablets });
  }
  return [...byGel.keys()]
    .sort((a, b) => a - b)
    .map((gelIndex) => {
      const { mg, tablets } = byGel.get(gelIndex);
      return {
        key: makeKey(`caffeine:gel:${gelIndex}`),
        kind: 'caffeine',
        id: null,
        label: {
          key: 'recipe.caffeineTablet',
          params: { tablets, tabletMg: Math.round(mg / tablets), gel: gelIndex + 1 },
        },
        pathway: null,
        amount: mg,
        unit: 'mg',
        display: formatAmount(mg, 'mg'),
        detail: null,
      };
    });
}

/**
 * Builds the ordered list of recipe items.
 *
 * Order: glucose-pathway carbs, fructose-pathway carbs, salts, caffeine. Carbs
 * and salts keep their input order inside each group. Items with a zero,
 * negative or non-finite amount and ids that are not in the matching constants
 * list are skipped.
 *
 * View `'perGel'` divides carb amounts (including `detail`) and salt amounts
 * by `gelCount` (at least 1; non-finite counts count as 1). Any other view is
 * treated as `'total'`. Caffeine items list the tablets for one specific gel,
 * so they are not divided. Pre-race caffeine is not a recipe item (it is in
 * the schedule), and caffeine taken without a gel is not one either.
 *
 * @param {Object} args
 * @param {CarbSourceItem[]} [args.carbSources]  `solveCarbSources(...).items`.
 * @param {SaltAmount[]} [args.salts]  Whole-activity salt amounts.
 * @param {CaffeinePlan|null} [args.caffeine]  `planCaffeine(...)`.
 * @param {number} [args.gelCount]  Number of gels over the activity.
 * @param {RecipeView} [args.view]
 * @returns {RecipeItem[]}
 */
export function buildRecipeItems({ carbSources, salts, caffeine, gelCount, view } = {}) {
  const divisor = view === 'perGel' && Number.isFinite(gelCount) ? Math.max(1, gelCount) : 1;
  const carbs = Array.isArray(carbSources) ? carbSources : [];
  const saltList = Array.isArray(salts) ? salts : [];
  const makeKey = keyMaker();
  return [
    ...PATHWAYS.flatMap((pathway) => carbItems(carbs, pathway, divisor, makeKey)),
    ...saltItems(saltList, divisor, makeKey),
    ...caffeineItems(caffeine, makeKey),
  ];
}
