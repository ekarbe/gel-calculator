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
 * Recipe domain logic: turns the solved carb ingredients, the salt amounts,
 * the caffeine plan and the gel/drink concentration results into recipe
 * sections (one per gel batch or drink), each with an ordered list of lines.
 * The same sections feed the recipe card, the mixing steps, the share image
 * and the print view.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no I/O, and the
 * arguments are never mutated. Carb and salt labels are plain strings (the
 * English label from `src/constants/constants.js`, or the name of a custom
 * ingredient); caffeine and water labels are message descriptors whose keys
 * live in `src/i18n/en/recipe.js`.
 */

import { sourceDataByIdMap, electrolyteSourceOptions } from '../constants/constants';
import { ingredientVolumeMl } from './concentration';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/** @typedef {'gel'|'drink'|'both'} FormatType */
/** @typedef {'total'|'perServing'} RecipeView */
/** @typedef {'carb'|'salt'|'caffeine'|'water'} RecipeItemKind */
/** @typedef {'g'|'mg'|'ml'|'tablet'} RecipeUnit */

/**
 * One carb ingredient for the whole activity, as in `solveIngredients(...).items`.
 * Extra profile fields (`osmPerG`, …) may be present and are ignored, except
 * `waterFraction`, which the drink section uses for its water line.
 * @typedef {Object} RecipeCarbInput
 * @property {number|string} ref  Source id (number) or custom key ('c1').
 * @property {string} [label]  Source label or custom name. Missing → the constants label for a source id, the key for a custom ref.
 * @property {number} grams  Ingredient mass as purchased (g).
 * @property {number} [carbsG]  Carbohydrate it delivers (g).
 * @property {number} [glucoseG]  Glucose-pathway carbohydrate (g).
 * @property {number} [fructoseG]  Fructose-pathway carbohydrate (g).
 * @property {number} [waterFraction]  Water per gram as purchased (0–1). Missing → 0 (dry).
 */

/**
 * One salt amount for the whole activity.
 * @typedef {Object} RecipeSaltInput
 * @property {number|string} ref  Salt id (number) or custom key ('s1'). `id` is accepted as an alias.
 * @property {string} [label]  Salt label or custom name. Missing → the constants label for a salt id, the key for a custom ref.
 * @property {number} amountMg  Salt mass as sold (mg).
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

/** @typedef {{ mOsmPerKg: number, waterG?: number, tonicity?: 'hypotonic'|'isotonic'|'hypertonic' }} Osmolality */

/**
 * The gel batch: `gelBatch(...)` from `src/domain/concentration.js` plus the
 * number of gels it fills.
 * @typedef {Object} GelInput
 * @property {number} servings  Number of gels (`getGelTimes(...).length`).
 * @property {number} [addedWaterMl]  Water to add to the batch (ml).
 * @property {{ massG?: number, volumeMl?: number, carbsG?: number }} [perServing]
 * @property {Osmolality|null} [osmolality]
 * @property {number} [waterToDrinkMlPerServing]  Water to drink with each gel (ml).
 * @property {Warning[]} [warnings]
 */

/**
 * The drink: `drinkBottles(...)` from `src/domain/concentration.js` plus the
 * bottle size. In `'both'` it must be computed from the drink's part of the
 * carbs and all salts, like the drink lines, so the water and the
 * concentration describe the bottle the lines make.
 * @typedef {Object} DrinkInput
 * @property {number} bottles  Number of bottles. 0 (no fluid planned) means there is no bottle.
 * @property {number} bottleMl  Bottle size (ml).
 * @property {{ carbsG?: number, sodiumMg?: number, carbPctWv?: number, sodiumMgPerL?: number,
 *   osmolality?: Osmolality|null, addedWaterMl?: number, fillMl?: number }} [perBottle]
 *   `fillMl`: how far each bottle is filled (ml, at most `bottleMl`); missing → `bottleMl`.
 *   `addedWaterMl`: water to add per bottle (ml), the water the osmolality is based on.
 * @property {Warning[]} [warnings]
 */

/**
 * Carb breakdown of a carb line for the whole section.
 * @typedef {Object} CarbDetail
 * @property {number} carbsG
 * @property {number} glucoseG
 * @property {number} fructoseG
 * @property {{ carbsG: number, glucoseG: number, fructoseG: number }} perServing  The same per gel or bottle.
 */

/**
 * One line of a recipe section.
 * @typedef {Object} RecipeItem
 * @property {string} key  Stable key, unique within its section (`carb:3`, `carb:c1`, `salt:31`, `salt:s1`, `water`, `caffeine:gel:6`).
 * @property {RecipeItemKind} kind
 * @property {number|string|null} ref  Source id or custom key for carbs and salts; null for water and caffeine.
 * @property {string|Message} label  Plain string for carbs and salts; a message for water
 *   (`recipe.water.gel`, `recipe.water.drink` with `{ ml }`) and caffeine (`recipe.caffeineForGel` with `{ gel, tabletMg }`).
 * @property {number} amount  Unrounded amount in `unit` for the whole section.
 * @property {RecipeUnit} unit  `g` carbs, `mg` salts, `ml` water, `tablet` caffeine.
 * @property {string} display  `formatAmount(amount, unit)`.
 * @property {number} perServing  Unrounded amount per gel or bottle.
 * @property {string} perServingDisplay  `formatAmount(perServing, unit)`.
 * @property {CarbDetail|{ mg: number, tabletMg: number }|null} detail  Carb breakdown for carbs; the dose for caffeine; null otherwise.
 */

/**
 * One gel batch or drink.
 * @typedef {Object} RecipeSection
 * @property {'gel'|'drink'} kind
 * @property {number} servings  Gels or bottles (whole number ≥ 0). Per-serving amounts divide by at least 1.
 * @property {string} servingLabelKey  Message key for the per-serving heading (`recipe.serving.gel`, `recipe.serving.bottle`).
 * @property {RecipeItem[]} items  Carbs, salts, water, then caffeine.
 * @property {{ totalMl: number, perServingMl: number }} water  Water to add (ml).
 * @property {Object} perServing  Gel: `{ carbsG, massG, volumeMl, waterToDrinkMl }`. Drink: `{ carbsG, sodiumMg,
 *   volumeMl, carbPctWv, sodiumMgPerL }` (`volumeMl` is the fill mark). `carbsG` comes from the lines; the rest
 *   from the concentration input (null when missing, and for a drink with 0 bottles).
 * @property {Osmolality|null} osmolality  From the concentration input (null for a drink with 0 bottles).
 * @property {Warning[]} warnings  From the concentration input.
 */

/**
 * @typedef {Object} Recipe
 * @property {RecipeSection[]} sections  `gel` → [gel]; `drink` → [drink]; `both` → [gel, drink].
 * @property {RecipeView} view  The view the recipe should show.
 */

/** Sections per format type, in display order. */
const SECTION_KINDS = Object.freeze({ gel: ['gel'], drink: ['drink'], both: ['gel', 'drink'] });

/** Message key for the per-serving heading of each section kind. */
const SERVING_LABEL_KEYS = Object.freeze({ gel: 'recipe.serving.gel', drink: 'recipe.serving.bottle' });

/** Drink carb share used when `drinkCarbShare` is missing (the input default is 50 %). */
const DEFAULT_DRINK_CARB_SHARE = 0.5;

/** Ids that are valid carb sources. */
const CARB_IDS = new Set(
  [...sourceDataByIdMap.values()].filter((option) => 'carbsPerGram' in option).map((option) => option.id),
);

/** Ids that are valid salts (electrolyte sources). */
const SALT_IDS = new Set(electrolyteSourceOptions.map((option) => option.id));

/**
 * Smallest amount that counts as a real ingredient: 1 µg.
 * A solver can leave float noise (about 1e-14 g) on an ingredient it does not
 * use. That noise is a zero amount, so it must not become a "0.0 g" recipe
 * line. Real amounts are many orders of magnitude above this floor.
 */
const MIN_AMOUNT_MG = 1e-3;
const MIN_AMOUNT_G = MIN_AMOUNT_MG / 1000;

/**
 * @param {unknown} value
 * @returns {boolean} True for a finite number above 0.
 */
function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * @param {unknown} value
 * @param {number} floor  Amounts at or below this are zero (float noise).
 * @returns {boolean} True for a finite number above `floor`.
 */
function isAbove(value, floor) {
  return Number.isFinite(value) && value > floor;
}

/**
 * @param {unknown} value
 * @returns {number} The value when it is a finite number ≥ 0, else 0.
 */
function nonNegative(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * @param {unknown} value
 * @returns {number|null} The value when it is a finite number, else null.
 */
function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>} True for a non-null, non-array object.
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Grams for display: whole grams from 10 g, one decimal below. The threshold
 * is checked after rounding to one decimal, so 9.96 g shows as "10", not "10.0".
 * @param {number} grams  Finite, above 0, and at least 0.05 (so it never rounds to "0.0").
 * @returns {string}
 */
function formatGrams(grams) {
  const tenths = Math.round(grams * 10) / 10;
  return tenths >= 10 ? grouped(Math.round(grams)) : tenths.toFixed(1);
}

/**
 * A number with thousands separators (en-US) and exactly `digits` decimals,
 * as every other number in the app reads ("1,200").
 * @param {number} value
 * @param {number} [digits=0]
 * @returns {string}
 */
function grouped(value, digits = 0) {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Milligrams for display (see `formatAmount`). Each band is checked after
 * rounding, so 99.6 mg shows as "0.10 g" and 999.6 mg as "1.0 g".
 * @param {number} mg  Finite, ≥ 0.
 * @returns {string}
 */
function formatMilligrams(mg) {
  if (Math.round(mg) < 100) return `${Math.round(mg)} mg`;
  const hundredths = Math.round(mg / 10) / 100;
  if (hundredths < 1) return `${hundredths.toFixed(2)} g`;
  return `${grouped(Math.round(mg / 100) / 10, 1)} g`;
}

/**
 * Tablets for display: up to two decimals, trailing zeros dropped.
 * @param {number} tablets  Finite, ≥ 0.
 * @returns {string}
 */
function formatTablets(tablets) {
  const value = Math.round(tablets * 100) / 100;
  return `${value} ${value === 1 ? 'tablet' : 'tablets'}`;
}

/**
 * The smallest step each unit shows, as `[steps per unit, text of one step]`.
 * A positive amount below half a step would round to zero.
 */
const DISPLAY_STEPS = Object.freeze({
  g: [10, '0.1 g'],
  mg: [1, '1 mg'],
  ml: [1, '1 ml'],
  tablet: [100, '0.01 tablets'],
});

/**
 * Formats an amount for display.
 *
 * - `'g'`: from 10 g whole grams (`"53 g"`, `"1,250 g"`), below 10 g one decimal (`"4.5 g"`).
 * - `'mg'` (salts are given in mg): from 1000 mg grams with one decimal
 *   (`"3.8 g"`); 100–999 mg grams with two decimals (`"0.42 g"`); below 100 mg
 *   whole milligrams (`"60 mg"`).
 * - `'ml'`: whole millilitres (`"180 ml"`, `"1,200 ml"`).
 * - Whole numbers from 1000 have thousands separators, like every other
 *   number the app shows.
 * - `'tablet'`: up to two decimals (`"1.5 tablets"`, `"1 tablet"`).
 * - Any other unit: the whole number followed by the unit.
 *
 * Each band is chosen after rounding, so an amount never shows as "10.0 g",
 * "100 mg" or "1.00 g". Zero shows as a plain `"0 g"`, `"0 mg"`, `"0 ml"` or
 * `"0 tablets"`; non-finite or negative amounts count as zero. A positive
 * amount that would round to zero shows as below the smallest step
 * (`"<0.1 g"`, `"<1 mg"`, `"<1 ml"`, `"<0.01 tablets"`, `"<1 kcal"`), so an
 * ingredient that is in the recipe never reads as zero.
 *
 * @param {number} amount  Amount in `unit`.
 * @param {RecipeUnit|string} unit
 * @returns {string}
 */
export function formatAmount(amount, unit) {
  const value = nonNegative(amount);
  const [stepsPerUnit, stepText] = Object.hasOwn(DISPLAY_STEPS, unit) ? DISPLAY_STEPS[unit] : [1, unit ? `1 ${unit}` : '1'];
  if (value > 0 && Math.round(value * stepsPerUnit) === 0) return `<${stepText}`;
  switch (unit) {
    case 'g':
      return value === 0 ? '0 g' : `${formatGrams(value)} g`;
    case 'mg':
      return formatMilligrams(value);
    case 'ml':
      return `${grouped(Math.round(value))} ml`;
    case 'tablet':
      return formatTablets(value);
    default: {
      const whole = grouped(Math.round(value));
      return unit ? `${whole} ${unit}` : whole;
    }
  }
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
 * The display label of a carb or salt: the given label, else the constants
 * label for a known id of the right kind, else the key of a custom ref.
 * @param {unknown} ref
 * @param {unknown} label
 * @param {Set<number>} knownIds
 * @returns {string|null} null when the item cannot be named (unknown id without a label, bad ref).
 */
function resolveLabel(ref, label, knownIds) {
  if (typeof label === 'string' && label.trim() !== '') return label.trim();
  if (typeof ref === 'number' && knownIds.has(ref)) return sourceDataByIdMap.get(ref).label;
  if (typeof ref === 'string' && ref.trim() !== '') return ref.trim();
  return null;
}

/**
 * @param {unknown} ref
 * @returns {boolean} True for a numeric id or a non-empty custom key.
 */
function isRef(ref) {
  return (typeof ref === 'number' && Number.isFinite(ref)) || (typeof ref === 'string' && ref.trim() !== '');
}

/**
 * Carb inputs that can become lines, with clean numbers.
 * @param {unknown} carbItems
 * @returns {{ ref: number|string, label: string, grams: number, carbsG: number, glucoseG: number, fructoseG: number, waterFraction: number }[]}
 */
function cleanCarbs(carbItems) {
  if (!Array.isArray(carbItems)) return [];
  const out = [];
  for (const item of carbItems) {
    if (!isObject(item) || !isAbove(item.grams, MIN_AMOUNT_G)) continue;
    const ref = item.ref ?? item.id;
    if (!isRef(ref)) continue;
    const label = resolveLabel(ref, item.label, CARB_IDS);
    if (label === null) continue;
    const waterFraction = Number.isFinite(item.waterFraction) ? Math.min(Math.max(item.waterFraction, 0), 1) : 0;
    out.push({
      ref,
      label,
      grams: item.grams,
      carbsG: nonNegative(item.carbsG),
      glucoseG: nonNegative(item.glucoseG),
      fructoseG: nonNegative(item.fructoseG),
      waterFraction,
    });
  }
  return out;
}

/**
 * Salt inputs that can become lines.
 * @param {unknown} saltItems
 * @returns {{ ref: number|string, label: string, amountMg: number }[]}
 */
function cleanSalts(saltItems) {
  if (!Array.isArray(saltItems)) return [];
  const out = [];
  for (const item of saltItems) {
    if (!isObject(item) || !isAbove(item.amountMg, MIN_AMOUNT_MG)) continue;
    const ref = item.ref ?? item.id;
    if (!isRef(ref)) continue;
    const label = resolveLabel(ref, item.label, SALT_IDS);
    if (label === null) continue;
    out.push({ ref, label, amountMg: item.amountMg });
  }
  return out;
}

/**
 * The amount fields of a line.
 * @param {number} amount
 * @param {RecipeUnit} unit
 * @param {number} divisor  Servings (at least 1).
 * @returns {{ amount: number, unit: RecipeUnit, display: string, perServing: number, perServingDisplay: string }}
 */
function amountFields(amount, unit, divisor) {
  const perServing = amount / divisor;
  return {
    amount,
    unit,
    display: formatAmount(amount, unit),
    perServing,
    perServingDisplay: formatAmount(perServing, unit),
  };
}

/**
 * Carb lines for one section.
 * @param {ReturnType<typeof cleanCarbs>} carbs
 * @param {number} factor  Part of each ingredient that goes into this section (0–1).
 * @param {number} divisor
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function carbLines(carbs, factor, divisor, makeKey) {
  const lines = [];
  for (const carb of carbs) {
    const amount = carb.grams * factor;
    if (!isAbove(amount, MIN_AMOUNT_G)) continue;
    const carbsG = carb.carbsG * factor;
    const glucoseG = carb.glucoseG * factor;
    const fructoseG = carb.fructoseG * factor;
    lines.push({
      key: makeKey(`carb:${carb.ref}`),
      kind: 'carb',
      ref: carb.ref,
      label: carb.label,
      ...amountFields(amount, 'g', divisor),
      detail: {
        carbsG,
        glucoseG,
        fructoseG,
        perServing: { carbsG: carbsG / divisor, glucoseG: glucoseG / divisor, fructoseG: fructoseG / divisor },
      },
    });
  }
  return lines;
}

/**
 * Salt lines, in input order.
 * @param {ReturnType<typeof cleanSalts>} salts
 * @param {number} divisor
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function saltLines(salts, divisor, makeKey) {
  return salts.map((salt) => ({
    key: makeKey(`salt:${salt.ref}`),
    kind: 'salt',
    ref: salt.ref,
    label: salt.label,
    ...amountFields(salt.amountMg, 'mg', divisor),
    detail: null,
  }));
}

/**
 * The water line, or none when less than 0.5 ml is added.
 * @param {number} totalMl
 * @param {number} divisor
 * @param {Message} label
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function waterLines(totalMl, divisor, label, makeKey) {
  if (Math.round(totalMl) <= 0) return [];
  return [{ key: makeKey('water'), kind: 'water', ref: null, label, ...amountFields(totalMl, 'ml', divisor), detail: null }];
}

/**
 * Caffeine tablets grouped by the gel that carries them: intra doses with a
 * gel index below `gelCount` and a tablet count. Doses that share a gel are
 * added together. This is the rule `buildSchedule` uses (a dose for a gel that
 * does not exist is a separate caffeine event there), so the recipe and the
 * schedule never disagree about where a dose goes.
 * @param {CaffeinePlan|null|undefined} caffeine
 * @param {number} gelCount  Gels that exist (Infinity: no limit).
 * @returns {{ gelIndex: number, mg: number, tablets: number }[]}  Ordered by gel.
 */
function caffeineByGel(caffeine, gelCount) {
  if (!isObject(caffeine) || caffeine.enabled !== true || !Array.isArray(caffeine.doses)) return [];
  /** @type {Map<number, { mg: number, tablets: number }>} */
  const byGel = new Map();
  for (const dose of caffeine.doses) {
    if (!dose || dose.kind !== 'intra') continue;
    if (!Number.isInteger(dose.gelIndex) || dose.gelIndex < 0 || dose.gelIndex >= gelCount) continue;
    if (!isPositive(dose.mg) || !isPositive(dose.tablets)) continue;
    const sum = byGel.get(dose.gelIndex) ?? { mg: 0, tablets: 0 };
    byGel.set(dose.gelIndex, { mg: sum.mg + dose.mg, tablets: sum.tablets + dose.tablets });
  }
  return [...byGel.keys()].sort((a, b) => a - b).map((gelIndex) => ({ gelIndex, ...byGel.get(gelIndex) }));
}

/**
 * Caffeine lines: one per gel that carries tablets. The tablets belong to one
 * specific gel, so the amount and the per-serving amount are the same.
 * @param {CaffeinePlan|null|undefined} caffeine
 * @param {number} gelCount
 * @param {(base: string) => string} makeKey
 * @returns {RecipeItem[]}
 */
function caffeineLines(caffeine, gelCount, makeKey) {
  return caffeineByGel(caffeine, gelCount).map(({ gelIndex, mg, tablets }) => {
    const tabletMg = Math.round(mg / tablets);
    return {
      key: makeKey(`caffeine:gel:${gelIndex}`),
      kind: 'caffeine',
      ref: null,
      label: { key: 'recipe.caffeineForGel', params: { gel: gelIndex + 1, tabletMg } },
      ...amountFields(tablets, 'tablet', 1),
      detail: { mg, tabletMg },
    };
  });
}

/**
 * @param {unknown} value
 * @returns {number} A whole number of servings ≥ 0 (non-finite or negative → 0).
 */
function servingCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * @param {unknown} value
 * @returns {Osmolality|null} A copy when it has a finite `mOsmPerKg`, else null.
 */
function copyOsmolality(value) {
  return isObject(value) && Number.isFinite(value.mOsmPerKg) ? { ...value } : null;
}

/**
 * @param {unknown} value
 * @returns {Warning[]} A copy of the warning list (non-arrays → empty).
 */
function copyWarnings(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

/**
 * Carbohydrate per serving from the carb lines.
 * @param {RecipeItem[]} items
 * @returns {number}
 */
function carbsPerServing(items) {
  return items.reduce((sum, item) => (item.kind === 'carb' ? sum + item.detail.perServing.carbsG : sum), 0);
}

/**
 * The gel section.
 * @param {Object} args
 * @param {ReturnType<typeof cleanCarbs>} args.carbs
 * @param {number} args.carbFactor
 * @param {ReturnType<typeof cleanSalts>} args.salts
 * @param {CaffeinePlan|null|undefined} args.caffeine
 * @param {GelInput|null|undefined} args.gel
 * @returns {RecipeSection}
 */
function gelSection({ carbs, carbFactor, salts, caffeine, gel }) {
  const input = isObject(gel) ? gel : {};
  const servings = servingCount(input.servings);
  const divisor = Math.max(1, servings);
  const makeKey = keyMaker();
  const totalWaterMl = nonNegative(input.addedWaterMl);
  const items = [
    ...carbLines(carbs, carbFactor, divisor, makeKey),
    ...saltLines(salts, divisor, makeKey),
    ...waterLines(totalWaterMl, divisor, { key: 'recipe.water.gel' }, makeKey),
    ...caffeineLines(caffeine, servings, makeKey),
  ];
  const perServing = isObject(input.perServing) ? input.perServing : {};
  return {
    kind: 'gel',
    servings,
    servingLabelKey: SERVING_LABEL_KEYS.gel,
    items,
    water: { totalMl: totalWaterMl, perServingMl: totalWaterMl / divisor },
    perServing: {
      carbsG: carbsPerServing(items),
      massG: finiteOrNull(perServing.massG),
      volumeMl: finiteOrNull(perServing.volumeMl),
      waterToDrinkMl: finiteOrNull(input.waterToDrinkMlPerServing),
    },
    osmolality: copyOsmolality(input.osmolality),
    warnings: copyWarnings(input.warnings),
  };
}

/**
 * How far each bottle is filled: `perBottle.fillMl` when it is a number above
 * 0 and not above the bottle size, else the bottle size.
 * @param {number|null} bottleMl  Bottle size, or null when unknown.
 * @param {Record<string, unknown>} perBottle
 * @returns {number|null} null when neither is known.
 */
function fillMark(bottleMl, perBottle) {
  const fillMl = perBottle.fillMl;
  if (isPositive(fillMl) && (bottleMl === null || fillMl <= bottleMl)) return fillMl;
  return bottleMl;
}

/**
 * Water to pour into one bottle so it reaches the fill mark.
 *
 * Uses `perBottle.addedWaterMl` from the concentration input when it is a
 * number from 0 to the fill mark: that is the water the osmolality and the
 * strength were computed with, so the recipe and those values describe the
 * same bottle. Without it, `fill − ingredientVolumeMl(one bottle's
 * ingredients)` from `concentration.js` (the formula `drinkBottles` uses),
 * at least 0.
 * @param {number} fillMl
 * @param {Record<string, unknown>} perBottle
 * @param {ReturnType<typeof cleanCarbs>} carbs
 * @param {number} carbFactor
 * @param {ReturnType<typeof cleanSalts>} salts
 * @param {number} bottles  At least 1.
 * @returns {number}
 */
function drinkWaterPerBottleMl(fillMl, perBottle, carbs, carbFactor, salts, bottles) {
  const given = perBottle.addedWaterMl;
  if (Number.isFinite(given) && given >= 0 && given <= fillMl) return given;
  const perBottleItems = [
    ...carbs
      .filter((carb) => isAbove(carb.grams * carbFactor, MIN_AMOUNT_G))
      .map((carb) => ({ grams: (carb.grams * carbFactor) / bottles, waterFraction: carb.waterFraction })),
    ...salts.map((salt) => ({ grams: salt.amountMg / 1000 / bottles, waterFraction: 0 })),
  ];
  return Math.max(0, fillMl - ingredientVolumeMl(perBottleItems));
}

/**
 * The drink section.
 *
 * With 0 bottles (no fluid planned) there is no bottle to fill: the lines
 * still list what the drink would hold (per serving = whole amount, like any
 * section without servings), but there is no water line and no bottle values
 * (volume, strength, sodium per bottle, osmolality are null). The
 * concentration input reports placeholder zeros for that case (0 % and
 * 0 mOsm/kg "hypotonic"), which do not describe these lines. Its warnings
 * (`concentration.noFluidForDrink`) are kept.
 * @param {Object} args
 * @param {ReturnType<typeof cleanCarbs>} args.carbs
 * @param {number} args.carbFactor
 * @param {ReturnType<typeof cleanSalts>} args.salts
 * @param {DrinkInput|null|undefined} args.drink
 * @returns {RecipeSection}
 */
function drinkSection({ carbs, carbFactor, salts, drink }) {
  const input = isObject(drink) ? drink : {};
  const servings = servingCount(input.bottles);
  const divisor = Math.max(1, servings);
  const perBottle = servings > 0 && isObject(input.perBottle) ? input.perBottle : {};
  const fillMl = servings > 0 ? fillMark(isPositive(input.bottleMl) ? input.bottleMl : null, perBottle) : null;
  const makeKey = keyMaker();
  const perBottleWaterMl = fillMl === null ? 0 : drinkWaterPerBottleMl(fillMl, perBottle, carbs, carbFactor, salts, divisor);
  const totalWaterMl = perBottleWaterMl * divisor;
  const items = [
    ...carbLines(carbs, carbFactor, divisor, makeKey),
    ...saltLines(salts, divisor, makeKey),
    ...waterLines(totalWaterMl, divisor, { key: 'recipe.water.drink', params: { ml: Math.round(fillMl ?? 0) } }, makeKey),
  ];
  return {
    kind: 'drink',
    servings,
    servingLabelKey: SERVING_LABEL_KEYS.drink,
    items,
    water: { totalMl: totalWaterMl, perServingMl: perBottleWaterMl },
    perServing: {
      carbsG: carbsPerServing(items),
      sodiumMg: finiteOrNull(perBottle.sodiumMg),
      volumeMl: fillMl,
      carbPctWv: finiteOrNull(perBottle.carbPctWv),
      sodiumMgPerL: finiteOrNull(perBottle.sodiumMgPerL),
    },
    osmolality: copyOsmolality(perBottle.osmolality),
    warnings: copyWarnings(input.warnings),
  };
}

/**
 * @param {unknown} view
 * @returns {RecipeView} `'perServing'` for `'perServing'` and the v3 `'perGel'`, else `'total'`.
 */
function normalizeView(view) {
  return view === 'perServing' || view === 'perGel' ? 'perServing' : 'total';
}

/**
 * @param {unknown} share
 * @returns {number} The drink's share of the carbs, clamped to 0–1 (non-finite → 0.5).
 */
function normalizeDrinkShare(share) {
  if (!Number.isFinite(share)) return DEFAULT_DRINK_CARB_SHARE;
  return Math.min(1, Math.max(0, share));
}

/**
 * Builds the recipe sections for a format.
 *
 * - `type 'gel'`: one gel section with all carbs and salts.
 * - `type 'drink'`: one drink section with all carbs and salts.
 * - `type 'both'`: a gel section with `(1 − drinkCarbShare)` of each carb
 *   ingredient, then a drink section with the rest of the carbs and all salts.
 * - Any other type is treated as `'gel'`.
 *
 * Each section lists carbs (input order), salts (input order), the water to
 * add, then caffeine. Caffeine tablets are only in the gel section: one line
 * per gel with an intra tablet dose whose `gelIndex` is below the gel count.
 * Pre-race doses and doses without tablets are in the schedule, not here; in
 * a drink-only recipe caffeine is not a line at all.
 *
 * Amounts: `amount` is the whole section, `perServing` is per gel or bottle
 * (divided by `servings`, at least 1). Carb amounts of 1 µg or less and salt
 * amounts of 1 µg or less count as zero (solver float noise) and are left out.
 * Carbs and salts need a numeric id or a custom key (`id` is accepted as an
 * alias of `ref`) and a label (given, from constants, or the custom key).
 *
 * Water: the gel section adds `gel.addedWaterMl`. Each drink bottle gets
 * `drink.perBottle.addedWaterMl` and is filled to `drink.perBottle.fillMl`
 * (else to `drink.bottleMl`), the values its osmolality was computed with.
 * Without `addedWaterMl` it gets `fill − 0.625 × dry solids − ingredient
 * water` (ml), from `ingredientVolumeMl` in `concentration.js`. A drink with 0 bottles has no
 * water and no bottle values. Water lines below 0.5 ml are left out;
 * `section.water` always holds the numbers.
 *
 * @param {Object} [args]
 * @param {FormatType} [args.type]
 * @param {RecipeCarbInput[]} [args.carbItems]  Whole-activity carb ingredients (`solveIngredients(...).items`).
 * @param {RecipeSaltInput[]} [args.saltItems]  Whole-activity salt amounts.
 * @param {CaffeinePlan|null} [args.caffeine]  `planCaffeine(...)`.
 * @param {GelInput|null} [args.gel]  `{ ...gelBatch(...), servings }`; used for `'gel'` and `'both'`.
 * @param {DrinkInput|null} [args.drink]  `{ ...drinkBottles(...), bottleMl }`; used for `'drink'` and `'both'`.
 * @param {RecipeView|'perGel'} [args.view]  `'perGel'` (v3) counts as `'perServing'`; anything else as `'total'`.
 * @param {number} [args.drinkCarbShare]  `'both'` only: the drink's share of the carbs, 0–1 (the input's percentage ÷ 100). Default 0.5.
 * @returns {Recipe}
 */
export function buildRecipe({ type, carbItems, saltItems, caffeine, gel, drink, view, drinkCarbShare } = {}) {
  const format = typeof type === 'string' && Object.hasOwn(SECTION_KINDS, type) ? type : 'gel';
  const carbs = cleanCarbs(carbItems);
  const salts = cleanSalts(saltItems);
  const drinkShare = format === 'both' ? normalizeDrinkShare(drinkCarbShare) : format === 'drink' ? 1 : 0;
  const sections = SECTION_KINDS[format].map((kind) =>
    kind === 'gel'
      ? gelSection({ carbs, carbFactor: 1 - drinkShare, salts: format === 'gel' ? salts : [], caffeine, gel })
      : drinkSection({ carbs, carbFactor: drinkShare, salts, drink }),
  );
  return { sections, view: normalizeView(view) };
}
