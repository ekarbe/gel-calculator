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
 * The plan: the inputs schema (v4), its normalisation (with the v3 → v4
 * migration), and `computePlan`, which turns inputs into everything the UI
 * shows by calling the other domain modules.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no I/O. Arguments
 * are never mutated. Functions never return English text; they return message
 * descriptors whose keys live in `src/i18n/en/*.js`.
 */

import {
  INTENSITIES,
  recommendCarbs,
  recommendRatio,
  ratioShare,
  checkRatio,
  carbIntakeWarnings,
  carbCalories,
} from './carbs';
import { resolveSweat } from './sweat';
import { SPORTS, SETTINGS, SUN_ERF_W_M2 } from './heatBalance';
import { recommendFluid, fluidWarnings, projectBodyMass } from './hydration';
import {
  recommendSodium,
  sodiumWarnings,
  recommendExtras,
  deliveredIons,
  saltsForTargets,
  compareIons,
  saltProfile,
} from './electrolytes';
import { planCaffeine } from './caffeine';
import { planBicarbonate } from './bicarbonate';
import { getGelTimes, buildSchedule } from './schedule';
import { buildRecipe } from './recipe';
import { ingredientProfile, solveIngredients } from './solver';
import { GEL_CONSISTENCY_PCT, gelBatch, drinkBottles } from './concentration';
import { deepFreeze, isPlainObject } from './objects';
import {
  glucoseSourceOptions,
  fructoseSourceOptions,
  carbSourceOptions,
  electrolyteSourceOptions,
} from '../constants/constants';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/** @typedef {'easy'|'moderate'|'hard'|'race'} Intensity */
/** @typedef {'auto'|'manual'} Mode */
/** @typedef {'running'|'cycling'|'other'} Sport */
/** @typedef {'outdoor'|'indoorFan'|'indoorNoFan'} Setting */
/** @typedef {'none'|'partly'|'full'} Sun */
/** @typedef {'gel'|'drink'|'both'} FormatType */
/** @typedef {'isotonic'|'liquid'|'standard'|'thick'} GelConsistency */

/**
 * One carb ingredient in the recipe list. `ref` is a carb source id (number)
 * or the key of a custom ingredient ('c1'). `weight` is a preference (0–100):
 * the solver keeps the split as close to the normalised weights as the
 * glucose:fructose share allows.
 * @typedef {{ ref: number|string, weight: number }} IngredientRef
 */

/** @typedef {{ ref: number|string, amountMg: number }} SaltAmount  Whole-activity mg of a salt id or custom key ('s1'). */

/**
 * Conditions of a sweat test session (same fields as the event and
 * environment sections).
 * @typedef {{ sport: Sport, speedKmh: number, powerW: number, mets: number, setting: Setting,
 *   tempC: number, humidity: number, sun: Sun }} SweatTestConditions
 */

/**
 * @typedef {Object} SweatTest
 * @property {string} id  Unique in the list (`[A-Za-z0-9_-]`, 1–40 characters).
 * @property {string} date  'YYYY-MM-DD' or ''.
 * @property {string} label  At most 60 characters.
 * @property {number} preKg  Body mass before, kg.
 * @property {number} postKg  Body mass after, kg.
 * @property {number} fluidL  Fluid drunk, L.
 * @property {number} urineL  Urine passed, L.
 * @property {number} durationMin  Session length, min.
 * @property {SweatTestConditions} conditions
 */

/**
 * A carb ingredient typed in from a label.
 * @typedef {{ key: string, name: string, carbsPer100g: number, fructoseSharePct: number, waterPct?: number }} CustomCarb
 */

/**
 * A salt typed in from a label (% of the salt's mass for each element).
 * @typedef {{ key: string, name: string, sodiumPct: number, potassiumPct: number, magnesiumPct: number,
 *   calciumPct: number, chloridePct: number }} CustomSalt
 */

/**
 * Calculator inputs, schema v4. Every field is always present after
 * {@link normalizeInputs} (except the optional `waterPct` of a custom
 * ingredient).
 *
 * @typedef {Object} PlanInputs
 * @property {{ durationMin: number, intensity: Intensity, highCarb: boolean, sport: Sport, speedKmh: number,
 *   powerW: number, mets: number, setting: Setting }} event
 *   `powerW` 0 means unknown (derived from the speed, cycling only); `mets` is used for `'other'` only.
 * @property {{ massKg: number, heightCm: number, acclimatised: boolean }} athlete
 * @property {{ tempC: number, humidity: number, sun: Sun }} environment
 * @property {{ source: 'test'|'estimate'|'preset', rateIndex: number, saltinessIndex: number, tests: SweatTest[],
 *   selectedTestId: string|null, calibrate: boolean }} sweat
 *   `selectedTestId` null means the last test. Saltiness is used by every source.
 * @property {{ mode: Mode, manualGPerHour: number, ratioMode: Mode,
 *   manualRatio: { glucose: number, fructose: number }, ingredients: IngredientRef[], custom: CustomCarb[] }} carbs
 * @property {{ mode: Mode, manualMgPerHour: number }} sodium
 * @property {{ potassium: boolean, magnesium: boolean, calcium: boolean }} extras
 * @property {{ mode: Mode, sodiumSalt: 'table'|'citrate'|'mix', manual: SaltAmount[], custom: CustomSalt[] }} salts
 *   `manual` holds whole-activity salt amounts in mg.
 * @property {{ mode: Mode, manualMlPerHour: number }} fluid
 * @property {{ type: FormatType, gelsPerHour: number, view: 'total'|'perServing', gelConsistency: GelConsistency,
 *   bottleMl: number, drinkCarbSharePct: number }} format
 *   `drinkCarbSharePct` is used by `'both'` only: the % of the carbs that goes into the drink.
 * @property {{ enabled: boolean, mgPerKg: number, asIngredient: boolean, tabletMg: 100|200 }} caffeine
 * @property {{ enabled: boolean, gPerKg: number }} bicarb
 */

/**
 * Default inputs: a 3 h moderate ride at 30 km/h in 20 °C shade for a 70 kg,
 * 175 cm athlete, with a heat-balance sweat estimate and a 2:1
 * maltodextrin/fructose gel. Deeply frozen; {@link normalizeInputs} returns
 * fresh, unfrozen copies.
 *
 * @type {Readonly<PlanInputs>}
 */
export const DEFAULT_INPUTS = deepFreeze({
  event: {
    durationMin: 180,
    intensity: 'moderate',
    highCarb: false,
    sport: 'cycling',
    speedKmh: 30,
    powerW: 0,
    mets: 8,
    setting: 'outdoor',
  },
  athlete: { massKg: 70, heightCm: 175, acclimatised: false },
  environment: { tempC: 20, humidity: 50, sun: 'none' },
  sweat: { source: 'estimate', rateIndex: 2, saltinessIndex: 2, tests: [], selectedTestId: null, calibrate: true },
  carbs: {
    mode: 'auto',
    manualGPerHour: 60,
    ratioMode: 'auto',
    manualRatio: { glucose: 1, fructose: 0.8 },
    ingredients: [
      { ref: 3, weight: 67 },
      { ref: 11, weight: 33 },
    ],
    custom: [],
  },
  sodium: { mode: 'auto', manualMgPerHour: 500 },
  extras: { potassium: false, magnesium: false, calcium: false },
  salts: { mode: 'auto', sodiumSalt: 'table', manual: [], custom: [] },
  fluid: { mode: 'auto', manualMlPerHour: 500 },
  format: {
    type: 'gel',
    gelsPerHour: 3,
    view: 'total',
    gelConsistency: 'standard',
    bottleMl: 750,
    drinkCarbSharePct: 50,
  },
  caffeine: { enabled: false, mgPerKg: 3, asIngredient: false, tabletMg: 100 },
  bicarb: { enabled: false, gPerKg: 0.3 },
});

/**
 * Inclusive [min, max] bounds that {@link normalizeInputs} clamps numbers
 * (and list lengths and text lengths) to. Exported so input controls use the
 * same limits.
 */
export const INPUT_LIMITS = deepFreeze({
  durationMin: [0, 2880],
  massKg: [30, 200],
  heightCm: [120, 220],
  tempC: [-20, 50],
  humidity: [0, 100],
  speedKmh: [3, 70],
  powerW: [0, 2000],
  mets: [1, 20],
  presetIndex: [0, 5],
  manualGPerHour: [0, 200],
  ratioPart: [0, 5],
  // Preference weight of one ingredient (a slider 0–100).
  ingredientWeight: [0, 100],
  // Label values of custom ingredients and salts, % of the mass.
  labelPct: [0, 100],
  manualMgPerHour: [0, 5000],
  manualMlPerHour: [0, 3000],
  gelsPerHour: [0, 12],
  bottleMl: [250, 1500],
  drinkCarbSharePct: [0, 100],
  caffeineMgPerKg: [1, 6],
  bicarbGPerKg: [0.2, 0.3],
  // Whole-activity mg of one salt. Covers the most the auto salts can ask for
  // (48 h at the 5000 mg/h manual sodium limit, all from sodium citrate:
  // 240 g sodium ÷ 0.2345 ≈ 1,023,455 mg), so switching salts to Manual never
  // cuts the amounts it starts from.
  saltAmountMg: [0, 1100000],
  // Sweat test entries. 0 is allowed so an unfinished entry stays visible
  // (the sweat module reports it as a problem).
  testMassKg: [0, 300],
  testFluidL: [0, 20],
  testUrineL: [0, 20],
  testDurationMin: [0, 1440],
  // List and text lengths.
  sweatTests: [0, 20],
  customIngredients: [0, 10],
  customSalts: [0, 10],
  customNameChars: [0, 40],
  testLabelChars: [0, 60],
});

/** Allowed values of the enumerated inputs. */
export const INPUT_OPTIONS = deepFreeze({
  intensity: [...INTENSITIES],
  sport: [...SPORTS],
  setting: [...SETTINGS],
  sun: Object.keys(SUN_ERF_W_M2),
  sweatSource: ['test', 'estimate', 'preset'],
  mode: ['auto', 'manual'],
  sodiumSalt: ['table', 'citrate', 'mix'],
  formatType: ['gel', 'drink', 'both'],
  view: ['total', 'perServing'],
  gelConsistency: Object.keys(GEL_CONSISTENCY_PCT),
  tabletMg: [100, 200],
});

/**
 * Speeds (km/h) that fit each sport that has a speed. Running from 5 km/h
 * (a brisk walk) to 22 km/h (about 2:44 min/km, faster than the marathon
 * world record); cycling from 15 to 60 km/h.
 */
export const SPORT_SPEED_RANGE_KMH = deepFreeze({ running: [5, 22], cycling: [15, 60] });

/** Typical speed (km/h) of each sport, used when a sport change leaves a speed that does not fit it. */
export const SPORT_DEFAULT_SPEED_KMH = deepFreeze({ running: 11, cycling: 30 });

/**
 * The speed to use after the sport changes to `sport`. Running and cycling
 * share one speed input, so a 30 km/h ride switched to running would be a
 * 2:00 min/km run (and a sweat estimate at the model ceiling). The current
 * speed stays when it fits the new sport ({@link SPORT_SPEED_RANGE_KMH}),
 * else the sport's typical speed is used ({@link SPORT_DEFAULT_SPEED_KMH}).
 * Sports without a speed ('other') and unknown sports keep the speed.
 *
 * @param {unknown} sport
 * @param {unknown} speedKmh
 * @returns {number|unknown}  The speed to store.
 */
export function speedForSport(sport, speedKmh) {
  if (typeof sport !== 'string' || !Object.hasOwn(SPORT_SPEED_RANGE_KMH, sport)) return speedKmh;
  const [lo, hi] = SPORT_SPEED_RANGE_KMH[sport];
  return Number.isFinite(speedKmh) && speedKmh >= lo && speedKmh <= hi ? speedKmh : SPORT_DEFAULT_SPEED_KMH[sport];
}

/** Rough DIY powder cost in currency units per g of carbohydrate. */
const DIY_COST_PER_G = 0.015;
/** Rough commercial gel cost per g of carbohydrate (about 2.50 per 25 g gel). */
const COMMERCIAL_COST_PER_G = 0.1;

const CARB_IDS = new Set(carbSourceOptions.map((o) => o.id));
const SALT_IDS = new Set(electrolyteSourceOptions.map((o) => o.id));
const V3_GLUCOSE_IDS = new Set(glucoseSourceOptions.map((o) => o.id));
const V3_FRUCTOSE_IDS = new Set(fructoseSourceOptions.map((o) => o.id));

/** v3 carb source lists and their per-list percentage limit (migration only). */
const V3_DEFAULT_GLUCOSE_SOURCES = Object.freeze([Object.freeze({ id: 3, percentage: 100 })]);
const V3_DEFAULT_FRUCTOSE_SOURCES = Object.freeze([Object.freeze({ id: 11, percentage: 100 })]);
const V3_SOURCE_PERCENTAGE = Object.freeze([0, 1000]);
/** Fructose share of the 2:1 default ratio, used to migrate v3 lists in auto ratio mode. */
const DEFAULT_FRUCTOSE_SHARE = 1 / 3;

const CUSTOM_CARB_KEY = /^c([1-9]|10)$/;
const CUSTOM_SALT_KEY = /^s([1-9]|10)$/;
const TEST_ID = /^[A-Za-z0-9_-]{1,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LEVEL_ORDER = { danger: 0, warning: 1, info: 2 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round2 = (x) => Math.round(x * 100) / 100;
const sum = (list, field) => list.reduce((acc, item) => acc + item[field], 0);

/**
 * Carbs (g) the gel part must deliver for the plan to have gels. Anything at
 * or below this is solver float noise, not an ingredient.
 */
const MIN_GEL_CARBS_G = 1e-6;

/**
 * Coerces numbers and numeric strings to a number; anything else is NaN.
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

/**
 * A number clamped to `[lo, hi]`, or `fallback` when it is not finite.
 * `-0` becomes `0` so normalized inputs survive a JSON round trip unchanged.
 * @param {unknown} value
 * @param {number} fallback
 * @param {readonly [number, number]} bounds
 * @returns {number}
 */
function num(value, fallback, [lo, hi]) {
  const n = toNumber(value);
  return Number.isFinite(n) ? clamp(n, lo, hi) + 0 : fallback;
}

/**
 * Like {@link num}, rounded to an integer first.
 * @param {unknown} value
 * @param {number} fallback
 * @param {readonly [number, number]} bounds
 * @returns {number}
 */
function int(value, fallback, bounds) {
  const n = toNumber(value);
  return Number.isFinite(n) ? num(Math.round(n), fallback, bounds) : fallback;
}

/**
 * @template T
 * @param {unknown} value
 * @param {readonly T[]} allowed
 * @param {T} fallback
 * @returns {T}
 */
function oneOf(value, allowed, fallback) {
  return allowed.includes(/** @type {T} */ (value)) ? /** @type {T} */ (value) : fallback;
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Text cut to `maxChars` code points; anything that is not a string is `''`.
 * Not trimmed: inputs are normalized on every keystroke, so trimming would
 * swallow the space someone is typing between two words. Labels are trimmed
 * where they are shown.
 * @param {unknown} value
 * @param {number} maxChars
 * @returns {string}
 */
function text(value, maxChars) {
  if (typeof value !== 'string') return '';
  const chars = Array.from(value);
  return chars.length > maxChars ? chars.slice(0, maxChars).join('') : value;
}

/**
 * The sub-object at `key`, or `{}` when it is missing or not a plain object.
 * @param {unknown} parent
 * @param {string} key
 * @returns {Record<string, unknown>}
 */
function sectionOf(parent, key) {
  if (!isPlainObject(parent)) return {};
  const value = parent[key];
  return isPlainObject(value) ? value : {};
}

/**
 * A carb ingredient ref: a custom key in `customKeys`, else a carb source id
 * (numbers and numeric strings); null for anything else.
 * @param {unknown} ref
 * @param {Set<string>} customKeys
 * @returns {number|string|null}
 */
function carbRef(ref, customKeys) {
  if (typeof ref === 'string' && customKeys.has(ref)) return ref;
  const id = toNumber(ref);
  return CARB_IDS.has(id) ? id : null;
}

/**
 * A salt ref: a custom key in `customKeys`, else an electrolyte source id
 * (numbers and numeric strings); null for anything else.
 * @param {unknown} ref
 * @param {Set<string>} customKeys
 * @returns {number|string|null}
 */
function saltRef(ref, customKeys) {
  if (typeof ref === 'string' && customKeys.has(ref)) return ref;
  const id = toNumber(ref);
  return SALT_IDS.has(id) ? id : null;
}

/**
 * Plain-object entries with a valid, unused key (`keyPattern`), at most
 * `maxCount` of them. Later entries with a key already taken are dropped.
 * @param {unknown} value
 * @param {RegExp} keyPattern
 * @param {number} maxCount
 * @returns {Record<string, unknown>[]}
 */
function keyedEntries(value, keyPattern, maxCount) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (out.length >= maxCount) break;
    if (!isPlainObject(entry) || typeof entry.key !== 'string' || !keyPattern.test(entry.key)) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push(entry);
  }
  return out;
}

/**
 * Normalizes the custom carb ingredients: keys 'c1'..'c10' (entries with
 * another key or a repeated key are dropped), at most 10; name cut to 40
 * characters; label percentages clamped to 0–100 (non-finite → 0). `waterPct`
 * is kept only when it is a finite number (else the solver derives it from
 * the carbs).
 * @param {unknown} value
 * @returns {CustomCarb[]}
 */
function customCarbList(value) {
  const L = INPUT_LIMITS;
  return keyedEntries(value, CUSTOM_CARB_KEY, L.customIngredients[1]).map((entry) => {
    /** @type {CustomCarb} */
    const item = {
      key: /** @type {string} */ (entry.key),
      name: text(entry.name, L.customNameChars[1]),
      carbsPer100g: num(entry.carbsPer100g, 0, L.labelPct),
      fructoseSharePct: num(entry.fructoseSharePct, 0, L.labelPct),
    };
    const waterPct = toNumber(entry.waterPct);
    if (Number.isFinite(waterPct)) item.waterPct = num(waterPct, 0, L.labelPct);
    return item;
  });
}

/**
 * Normalizes the custom salts: keys 's1'..'s10', at most 10; name cut to 40
 * characters; label percentages clamped to 0–100 (non-finite → 0).
 * @param {unknown} value
 * @returns {CustomSalt[]}
 */
function customSaltList(value) {
  const L = INPUT_LIMITS;
  return keyedEntries(value, CUSTOM_SALT_KEY, L.customSalts[1]).map((entry) => ({
    key: /** @type {string} */ (entry.key),
    name: text(entry.name, L.customNameChars[1]),
    sodiumPct: num(entry.sodiumPct, 0, L.labelPct),
    potassiumPct: num(entry.potassiumPct, 0, L.labelPct),
    magnesiumPct: num(entry.magnesiumPct, 0, L.labelPct),
    calciumPct: num(entry.calciumPct, 0, L.labelPct),
    chloridePct: num(entry.chloridePct, 0, L.labelPct),
  }));
}

/**
 * Normalizes the ingredient list: entries must be objects whose `ref` is a
 * carb source id (number or numeric string) or the key of a custom
 * ingredient; others are dropped. Weights are clamped to 0–100; a non-finite
 * weight becomes 0, so a row never vanishes while someone is typing.
 * @param {unknown[]} value
 * @param {Set<string>} customKeys
 * @returns {IngredientRef[]}
 */
function ingredientList(value, customKeys) {
  const out = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const ref = carbRef(entry.ref, customKeys);
    if (ref === null) continue;
    out.push({ ref, weight: num(entry.weight, 0, INPUT_LIMITS.ingredientWeight) });
  }
  return out;
}

/**
 * Turns v3 per-pathway source lists into one ingredient list (the v3 → v4
 * migration, also used for templates). Each source keeps its list's v3 rule
 * (glucose ids in the glucose list, fructose ids in the fructose list) and
 * gets `weight = percentage × poolShare`, the share of the carbs its list
 * covers under the ratio. Weights are only preferences, so when one is above
 * 100 all are scaled down together (largest 100). Rounded to 0.01.
 * A list that is not an array uses the v3 default list.
 * @param {unknown} glucoseSources
 * @param {unknown} fructoseSources
 * @param {number} fructoseShare  Fructose share of the ratio (0–1).
 * @returns {IngredientRef[]}
 */
export function ingredientsFromV3Sources(glucoseSources, fructoseSources, fructoseShare) {
  const share = Number.isFinite(fructoseShare) ? clamp(fructoseShare, 0, 1) : DEFAULT_FRUCTOSE_SHARE;
  const pools = [
    [Array.isArray(glucoseSources) ? glucoseSources : V3_DEFAULT_GLUCOSE_SOURCES, V3_GLUCOSE_IDS, 1 - share],
    [Array.isArray(fructoseSources) ? fructoseSources : V3_DEFAULT_FRUCTOSE_SOURCES, V3_FRUCTOSE_IDS, share],
  ];
  const raw = [];
  for (const [list, ids, poolShare] of pools) {
    for (const entry of list) {
      if (!isPlainObject(entry)) continue;
      const id = toNumber(entry.id);
      if (!ids.has(id)) continue;
      raw.push({ ref: id, weight: num(entry.percentage, 0, V3_SOURCE_PERCENTAGE) * poolShare });
    }
  }
  const largest = raw.reduce((max, item) => Math.max(max, item.weight), 0);
  const [, maxWeight] = INPUT_LIMITS.ingredientWeight;
  const scale = largest > maxWeight ? maxWeight / largest : 1;
  return raw.map(({ ref, weight }) => ({ ref, weight: clamp(round2(weight * scale), 0, maxWeight) + 0 }));
}

/**
 * The carb ingredients of a `carbs` section: the v4 `ingredients` list when
 * it is an array; else, when the section has v3 `glucoseSources` or
 * `fructoseSources`, those lists migrated with the v3 ratio (the manual ratio
 * in manual ratio mode, else 2:1); else the default list.
 * @param {Record<string, unknown>} carbs
 * @param {Set<string>} customKeys
 * @returns {IngredientRef[]}
 */
function carbIngredients(carbs, customKeys) {
  if (Array.isArray(carbs.ingredients)) return ingredientList(carbs.ingredients, customKeys);
  if (Array.isArray(carbs.glucoseSources) || Array.isArray(carbs.fructoseSources)) {
    const manual = sectionOf(carbs, 'manualRatio');
    const glucose = num(manual.glucose, DEFAULT_INPUTS.carbs.manualRatio.glucose, INPUT_LIMITS.ratioPart);
    const fructose = num(manual.fructose, DEFAULT_INPUTS.carbs.manualRatio.fructose, INPUT_LIMITS.ratioPart);
    const useManual = carbs.ratioMode === 'manual' && glucose + fructose > 0;
    const share = useManual ? ratioShare({ glucose, fructose }) : DEFAULT_FRUCTOSE_SHARE;
    return ingredientsFromV3Sources(carbs.glucoseSources, carbs.fructoseSources, share);
  }
  return DEFAULT_INPUTS.carbs.ingredients.map((item) => ({ ...item }));
}

/**
 * Normalizes the manual salt list: refs must be electrolyte source ids or
 * custom salt keys (v3 entries name the salt `id`; that is read as `ref`).
 * Amounts are clamped to `INPUT_LIMITS.saltAmountMg` (non-finite → 0). Not an
 * array → `[]`.
 * @param {unknown} value
 * @param {Set<string>} customKeys
 * @returns {SaltAmount[]}
 */
function saltList(value, customKeys) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const ref = saltRef(entry.ref ?? entry.id, customKeys);
    if (ref === null) continue;
    out.push({ ref, amountMg: num(entry.amountMg, 0, INPUT_LIMITS.saltAmountMg) });
  }
  return out;
}

/**
 * Normalizes the conditions of a sweat test. Missing or invalid fields come
 * from the (normalized) event and environment, so every test always has
 * complete conditions: the form fills them from the current inputs too.
 * @param {unknown} value
 * @param {PlanInputs['event']} event
 * @param {PlanInputs['environment']} environment
 * @returns {SweatTestConditions}
 */
function testConditions(value, event, environment) {
  const c = isPlainObject(value) ? value : {};
  const L = INPUT_LIMITS;
  const O = INPUT_OPTIONS;
  return {
    sport: oneOf(c.sport, O.sport, event.sport),
    speedKmh: num(c.speedKmh, event.speedKmh, L.speedKmh),
    powerW: num(c.powerW, event.powerW, L.powerW),
    mets: num(c.mets, event.mets, L.mets),
    setting: oneOf(c.setting, O.setting, event.setting),
    tempC: num(c.tempC, environment.tempC, L.tempC),
    humidity: num(c.humidity, environment.humidity, L.humidity),
    sun: oneOf(c.sun, O.sun, environment.sun),
  };
}

/**
 * Normalizes the sweat tests: plain-object entries, at most 20. Ids must be
 * 1–40 characters of `[A-Za-z0-9_-]` and unique; an entry without a usable id
 * gets the first free `t<n>`. Dates must look like 'YYYY-MM-DD' (else '').
 * Labels are cut to 60 characters. Masses, volumes and durations are clamped
 * (non-finite → 0, which the sweat module reports as a problem); durations
 * are rounded to 0.01 min.
 * @param {unknown} value
 * @param {PlanInputs['event']} event
 * @param {PlanInputs['environment']} environment
 * @returns {SweatTest[]}
 */
function sweatTestList(value, event, environment) {
  if (!Array.isArray(value)) return [];
  const L = INPUT_LIMITS;
  const entries = value.filter(isPlainObject).slice(0, L.sweatTests[1]);
  const used = new Set();
  const ids = entries.map((entry) => {
    const ok = typeof entry.id === 'string' && TEST_ID.test(entry.id) && !used.has(entry.id);
    if (ok) used.add(entry.id);
    return ok ? entry.id : null;
  });
  let next = 1;
  const freshId = () => {
    while (used.has(`t${next}`)) next += 1;
    const id = `t${next}`;
    used.add(id);
    return id;
  };
  return entries.map((entry, i) => ({
    id: ids[i] ?? freshId(),
    date: typeof entry.date === 'string' && ISO_DATE.test(entry.date) ? entry.date : '',
    label: text(entry.label, L.testLabelChars[1]),
    preKg: num(entry.preKg, 0, L.testMassKg),
    postKg: num(entry.postKg, 0, L.testMassKg),
    fluidL: num(entry.fluidL, 0, L.testFluidL),
    urineL: num(entry.urineL, 0, L.testUrineL),
    // Snapped to 0.01 min: a subnormal duration would make the rate overflow.
    durationMin: round2(num(entry.durationMin, 0, L.testDurationMin)),
    conditions: testConditions(entry.conditions, event, environment),
  }));
}

/**
 * Turns any value into complete, valid {@link PlanInputs} (schema v4).
 *
 * Deep-merges `partial` onto {@link DEFAULT_INPUTS} field by field and drops
 * unknown keys. Numbers (and numeric strings) are clamped to
 * {@link INPUT_LIMITS}; non-finite numbers and values of the wrong type fall
 * back to the default for that field. Enums outside {@link INPUT_OPTIONS}
 * fall back to the default. Sweat preset indices are rounded to integers
 * 0–5; gels per hour and the manual fluid rate are rounded to 0.01. Lists:
 *
 * - `carbs.custom` / `salts.custom`: keys 'c1'..'c10' / 's1'..'s10', unique,
 *   at most 10; names cut to 40 characters; label % clamped to 0–100.
 * - `carbs.ingredients`: refs must be carb source ids or custom keys of
 *   `carbs.custom`; weights 0–100. Not an array → the default list (or the v3
 *   migration below).
 * - `salts.manual`: refs must be salt ids or custom keys of `salts.custom`.
 * - `sweat.tests`: see {@link sweatTestList}; `selectedTestId` must name one
 *   of them, else it becomes null (the last test).
 * - Entries whose ref is unknown are dropped; a kept entry with a non-finite
 *   number gets 0, so a row never vanishes while someone is typing.
 *
 * v3 → v4 migration (v3 share links keep working): `carbs.glucoseSources` /
 * `fructoseSources` become `carbs.ingredients` (when the partial has no
 * `ingredients` array) with `weight = percentage × poolShare`
 * ({@link ingredientsFromV3Sources}); `salts.manual[].id` is read as `ref`;
 * `format.view 'perGel'` becomes `'perServing'`; `athlete.sex` is dropped;
 * `sweat.source 'estimate'` stays `'estimate'` (now the heat-balance model).
 *
 * Always returns a new object; never mutates `partial`. Idempotent:
 * `normalizeInputs(normalizeInputs(x))` deep-equals `normalizeInputs(x)`, and
 * the result survives a JSON round trip unchanged.
 *
 * @param {unknown} [partial]  Usually a partial {@link PlanInputs}; anything else counts as `{}`.
 * @returns {PlanInputs}
 */
export function normalizeInputs(partial) {
  const d = DEFAULT_INPUTS;
  const L = INPUT_LIMITS;
  const O = INPUT_OPTIONS;

  const eventIn = sectionOf(partial, 'event');
  const athleteIn = sectionOf(partial, 'athlete');
  const environmentIn = sectionOf(partial, 'environment');
  const sweat = sectionOf(partial, 'sweat');
  const carbs = sectionOf(partial, 'carbs');
  const manualRatio = sectionOf(carbs, 'manualRatio');
  const sodium = sectionOf(partial, 'sodium');
  const extras = sectionOf(partial, 'extras');
  const salts = sectionOf(partial, 'salts');
  const fluid = sectionOf(partial, 'fluid');
  const format = sectionOf(partial, 'format');
  const caffeine = sectionOf(partial, 'caffeine');
  const bicarb = sectionOf(partial, 'bicarb');

  const event = {
    durationMin: num(eventIn.durationMin, d.event.durationMin, L.durationMin),
    intensity: oneOf(eventIn.intensity, O.intensity, d.event.intensity),
    highCarb: bool(eventIn.highCarb, d.event.highCarb),
    sport: oneOf(eventIn.sport, O.sport, d.event.sport),
    speedKmh: num(eventIn.speedKmh, d.event.speedKmh, L.speedKmh),
    powerW: num(eventIn.powerW, d.event.powerW, L.powerW),
    mets: num(eventIn.mets, d.event.mets, L.mets),
    setting: oneOf(eventIn.setting, O.setting, d.event.setting),
  };
  const athlete = {
    massKg: num(athleteIn.massKg, d.athlete.massKg, L.massKg),
    heightCm: num(athleteIn.heightCm, d.athlete.heightCm, L.heightCm),
    acclimatised: bool(athleteIn.acclimatised, d.athlete.acclimatised),
  };
  const environment = {
    tempC: num(environmentIn.tempC, d.environment.tempC, L.tempC),
    humidity: num(environmentIn.humidity, d.environment.humidity, L.humidity),
    sun: oneOf(environmentIn.sun, O.sun, d.environment.sun),
  };

  const tests = sweatTestList(sweat.tests, event, environment);
  const selectedTestId = tests.some((test) => test.id === sweat.selectedTestId)
    ? /** @type {string} */ (sweat.selectedTestId)
    : null;

  const customCarbs = customCarbList(carbs.custom);
  const customCarbKeys = new Set(customCarbs.map((c) => c.key));
  const customSalts = customSaltList(salts.custom);
  const customSaltKeys = new Set(customSalts.map((c) => c.key));

  const tabletMg = toNumber(caffeine.tabletMg);
  const view = format.view === 'perGel' ? 'perServing' : format.view;

  return {
    event,
    athlete,
    environment,
    sweat: {
      source: oneOf(sweat.source, O.sweatSource, d.sweat.source),
      rateIndex: int(sweat.rateIndex, d.sweat.rateIndex, L.presetIndex),
      saltinessIndex: int(sweat.saltinessIndex, d.sweat.saltinessIndex, L.presetIndex),
      tests,
      selectedTestId,
      calibrate: bool(sweat.calibrate, d.sweat.calibrate),
    },
    carbs: {
      mode: oneOf(carbs.mode, O.mode, d.carbs.mode),
      manualGPerHour: num(carbs.manualGPerHour, d.carbs.manualGPerHour, L.manualGPerHour),
      ratioMode: oneOf(carbs.ratioMode, O.mode, d.carbs.ratioMode),
      manualRatio: {
        glucose: num(manualRatio.glucose, d.carbs.manualRatio.glucose, L.ratioPart),
        fructose: num(manualRatio.fructose, d.carbs.manualRatio.fructose, L.ratioPart),
      },
      ingredients: carbIngredients(carbs, customCarbKeys),
      custom: customCarbs,
    },
    sodium: {
      mode: oneOf(sodium.mode, O.mode, d.sodium.mode),
      manualMgPerHour: num(sodium.manualMgPerHour, d.sodium.manualMgPerHour, L.manualMgPerHour),
    },
    extras: {
      potassium: bool(extras.potassium, d.extras.potassium),
      magnesium: bool(extras.magnesium, d.extras.magnesium),
      calcium: bool(extras.calcium, d.extras.calcium),
    },
    salts: {
      mode: oneOf(salts.mode, O.mode, d.salts.mode),
      sodiumSalt: oneOf(salts.sodiumSalt, O.sodiumSalt, d.salts.sodiumSalt),
      manual: saltList(salts.manual, customSaltKeys),
      custom: customSalts,
    },
    fluid: {
      mode: oneOf(fluid.mode, O.mode, d.fluid.mode),
      // Snapped to 0.01 ml/h like gels per hour: a subnormal rate would make a
      // drink bottle's fill underflow and its strength overflow.
      manualMlPerHour: round2(num(fluid.manualMlPerHour, d.fluid.manualMlPerHour, L.manualMlPerHour)),
    },
    format: {
      type: oneOf(format.type, O.formatType, d.format.type),
      // Snapped to 0.01 gels/h: finer rates mean nothing and only lengthen
      // share links. (getGelTimes also copes with a subnormal rate itself.)
      gelsPerHour: round2(num(format.gelsPerHour, d.format.gelsPerHour, L.gelsPerHour)),
      view: oneOf(view, O.view, d.format.view),
      gelConsistency: oneOf(format.gelConsistency, O.gelConsistency, d.format.gelConsistency),
      bottleMl: num(format.bottleMl, d.format.bottleMl, L.bottleMl),
      drinkCarbSharePct: num(format.drinkCarbSharePct, d.format.drinkCarbSharePct, L.drinkCarbSharePct),
    },
    caffeine: {
      enabled: bool(caffeine.enabled, d.caffeine.enabled),
      mgPerKg: num(caffeine.mgPerKg, d.caffeine.mgPerKg, L.caffeineMgPerKg),
      asIngredient: bool(caffeine.asIngredient, d.caffeine.asIngredient),
      tabletMg: oneOf(tabletMg, O.tabletMg, d.caffeine.tabletMg),
    },
    bicarb: {
      enabled: bool(bicarb.enabled, d.bicarb.enabled),
      gPerKg: num(bicarb.gPerKg, d.bicarb.gPerKg, L.bicarbGPerKg),
    },
  };
}

/**
 * Keeps the first warning of each id, in order.
 * @param {Warning[]} warnings
 * @returns {Warning[]}
 */
function dedupeById(warnings) {
  const seen = new Set();
  return warnings.filter((w) => {
    if (!w || seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
}

/**
 * Sorts warnings danger > warning > info; stable within a level.
 * @param {Warning[]} warnings
 * @returns {Warning[]}
 */
function sortByLevel(warnings) {
  const rank = (w) => LEVEL_ORDER[w.level] ?? LEVEL_ORDER.info;
  return [...warnings].sort((a, b) => rank(a) - rank(b));
}

/**
 * A solved ingredient with the profile data the concentration and recipe
 * modules need.
 * @typedef {import('./solver').IngredientItem & { carbsPerGram: number, fructoseShare: number, osmPerG: number,
 *   waterFraction: number, custom: boolean }} PlanCarbItem
 */

/**
 * A salt line with its label and the data the concentration module needs.
 * @typedef {{ ref: number|string, label: string, amountMg: number, grams: number, osmPerG: number }} PlanSaltItem
 */

/**
 * The part `factor` (0–1) of each carb item: grams and carbs scaled.
 * @param {PlanCarbItem[]} items
 * @param {number} factor
 * @returns {PlanCarbItem[]}
 */
function carbPart(items, factor) {
  if (factor === 1) return items;
  if (!(factor > 0)) return [];
  return items.map((item) => ({
    ...item,
    carbsG: item.carbsG * factor,
    grams: item.grams * factor,
    glucoseG: item.glucoseG * factor,
    fructoseG: item.fructoseG * factor,
  }));
}

/**
 * @typedef {Object} Plan
 * @property {PlanInputs} inputs  The normalized inputs the plan was computed from.
 * @property {number} durationMin
 * @property {number} durationH
 * @property {ReturnType<typeof resolveSweat>} sweat  Rate, sodium, source, uncertainty, the heat-balance
 *   `estimate` for the event, the selected `test`, every `tests` result, `calibration`, `why`, `warnings`.
 * @property {ReturnType<typeof projectBodyMass>} hydration  Projected water deficit and scale change over the event.
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendCarbs>, gPerHour: number, totalG: number,
 *   deliveredG: number, warnings: Warning[],
 *   ratio: { mode: Mode, recommended: ReturnType<typeof recommendRatio>, value: { glucose: number, fructose: number },
 *     share: number, allowedShare: [number, number], glucoseGPerHour: number, fructoseGPerHour: number,
 *     warnings: Warning[] },
 *   ingredients: Omit<ReturnType<typeof solveIngredients>, 'items'> & { items: PlanCarbItem[] },
 *   mouthRinse: boolean, mouthRinseHowTo: ReturnType<typeof recommendCarbs>['mouthRinseHowTo'] }} carbs
 *   `ratio.value`/`ratio.share` are the target (manual ratio, or the recommendation); `allowedShare` the
 *   fructose shares the solver may use instead. `ingredients` is the solver result for the whole activity
 *   (`usedShare`, `achievedShare`, `feasibleRange`, `adjusted`), its items merged with their profiles.
 *   `deliveredG` is the carbohydrate the recipe contains. `glucoseGPerHour`/`fructoseGPerHour` split the
 *   carbs the recipe delivers per hour by the share it delivers (0 when it delivers no carbs).
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendSodium>, mgPerHour: number, totalMg: number,
 *   warnings: Warning[] }} sodium
 * @property {Object} extras  `recommendExtras(...)`; each ion entry also has `totalMg`.
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendFluid>, mlPerHour: number, totalMl: number,
 *   warnings: Warning[] }} fluid
 * @property {{ mode: Mode, sodiumSalt: 'table'|'citrate'|'mix', items: SaltAmount[],
 *   delivered: ReturnType<typeof deliveredIons>, comparison: ReturnType<typeof compareIons>,
 *   warnings: Warning[] }} salts
 * @property {{ type: FormatType, requestedType: FormatType, drinkCarbShare: number }} format  `requestedType`
 *   is `inputs.format.type`; `type` is the format the recipe uses: the requested one, or `'drink'` when a
 *   'gel' or 'both' plan has no gels but something to mix. `drinkCarbShare`: part of the carbs in the drink
 *   (0 for gels, 1 for a drink, `drinkCarbSharePct / 100` for both).
 * @property {{ gel: ReturnType<typeof gelBatch>|null, drink: ReturnType<typeof drinkBottles>|null }} concentration
 *   `gel` when the plan has gels (null without gels: no batch to make), `drink` when `format.type` is
 *   'drink' or 'both'.
 * @property {ReturnType<typeof planCaffeine>} caffeine
 * @property {ReturnType<typeof planBicarbonate>} bicarb
 * @property {{ perHour: number, count: number, times: number[] }} gels
 * @property {ReturnType<typeof buildSchedule>} schedule
 * @property {ReturnType<typeof buildRecipe>} recipe  `{ sections, view }`.
 * @property {{ kcal: number, deliveredKcal: number, expenditureKcalPerHour: number, expenditureKcal: number }} energy
 *   `kcal` from the carb target, `deliveredKcal` from the carbs the recipe contains, `expenditure*` from the
 *   heat-balance estimate for the event.
 * @property {{ diy: number, commercial: number, savings: number }} cost
 * @property {Warning[]} warnings  Every warning above, de-duplicated by id, sorted danger > warning > info.
 */

/**
 * Computes everything the UI shows from the inputs.
 *
 * The inputs are passed through {@link normalizeInputs} first, so any value is
 * accepted. Effective values: `auto` uses the recommendation, `manual` the
 * manual value. Manual values get the same evidence warnings as recommended
 * ones (`carbIntakeWarnings`, `sodiumWarnings`, `fluidWarnings`). In auto
 * carb mode the recommendation's own warnings are added too.
 *
 * - Sweat: `resolveSweat(inputs.sweat, { event, athlete, environment })`. Its
 *   warnings (`sweat.testUnusable`, `sweat.uncompensable`) are plan warnings.
 * - Ratio and ingredients: `solveIngredients` for the whole activity. Auto
 *   ratio: target = `recommendRatio(gPerHour).recommendedShare`, allowed =
 *   [minShare, maxShare]; manual: target = the manual share, allowed = that
 *   share only, plus `checkRatio` warnings. A manual 0:0 ratio (danger
 *   `carbs.noRatio`) gives no ingredients. Solver warnings
 *   (`carbs.ratioNotReachable`, `carbs.noIngredients`) go to `carbs.warnings`.
 * - Fluid as before; `hydration = projectBodyMass(...)` with the sweat rate,
 *   the effective fluid and the estimate's energy expenditure.
 * - Sodium concentration is checked against the effective fluid intake. A
 *   manual sodium target below the evidence range of an event of 120 min or
 *   more gets info `plan.sodiumBelowRange`.
 * - Salts: auto → `saltsForTargets` from the sodium and extras totals and the
 *   chosen sodium salt; manual → `inputs.salts.manual` (salt ids or custom
 *   salts). `comparison` covers the ions that have targets (sodium,
 *   potassium, magnesium, calcium); chloride is left out. Manual salts also
 *   get `sodiumWarnings` for the sodium they deliver per hour.
 * - Format: `'gel'` puts all carbs and salts in gels; `'drink'` in drink
 *   bottles; `'both'` puts `drinkCarbSharePct` % of each ingredient and all
 *   salts in the drink and the rest of the carbs in gels.
 * - Gels: `getGelTimes(durationMin, gelsPerHour)` when the gel part of the
 *   recipe delivers carbs. The carbs the solver delivers count, not the
 *   target: a 0 g plan, a plan without a usable ingredient or with a 0:0
 *   ratio, a drink, or 'both' at 100 % drink has no gels. Caffeine is planned
 *   on those gel times.
 * - No gels in a 'gel' or 'both' plan (gels per hour 0, or no carbs for
 *   gels): what the gels would hold goes into the drink, so `format.type`
 *   becomes `'drink'` and the drink is checked like any drink. A 'gel' plan
 *   with nothing to mix (no carbs, no salts) stays an empty gel recipe.
 *   When something moved, info `plan.noGels` says so
 *   (`plan.warn.noGelsCarbsInDrink`, or `plan.warn.noGelsSaltsInDrink` when
 *   only salts moved).
 * - Concentration: `gelBatch` for the gel part when there are gels
 *   (servings = gel count, consistency from the inputs) and `drinkBottles`
 *   for the drink part (the plan's whole fluid, the bottle size from the
 *   inputs).
 * - Recipe: `buildRecipe` with the whole-activity ingredients and salts, the
 *   concentration results and `inputs.format.view`. Schedule: `buildSchedule`
 *   with `format.type` and the drink bottles.
 * - Pathways: `glucoseGPerHour`/`fructoseGPerHour` split the carbs the
 *   recipe delivers per hour by the share it delivers; both are 0 when it
 *   delivers none.
 * - Energy: 4 kcal per g of the carb target (`kcal`) and of the carbs the
 *   recipe contains (`deliveredKcal`); expenditure from the sweat estimate.
 *   Cost: rough estimate of 0.015 (DIY) and 0.10 (commercial) per g of carbs.
 *
 * @param {unknown} rawInputs  Usually {@link PlanInputs}.
 * @returns {Plan}
 */
export function computePlan(rawInputs) {
  const inputs = normalizeInputs(rawInputs);
  const { event, athlete, environment } = inputs;
  const durationMin = event.durationMin;
  const durationH = durationMin / 60;

  const sweat = resolveSweat(inputs.sweat, { event, athlete, environment });

  // Carb target
  const carbRecommendation = recommendCarbs({
    durationMin,
    intensity: event.intensity,
    highCarb: event.highCarb,
  });
  const carbMode = inputs.carbs.mode;
  const gPerHour = carbMode === 'manual' ? inputs.carbs.manualGPerHour : carbRecommendation.gPerHour;
  const totalG = gPerHour * durationH;

  // Ratio and ingredients
  const ratioRecommendation = recommendRatio(gPerHour);
  const ratioMode = inputs.carbs.ratioMode;
  const ratioValue =
    ratioMode === 'manual' ? { ...inputs.carbs.manualRatio } : { ...ratioRecommendation.ratio };
  const hasRatio = ratioValue.glucose + ratioValue.fructose > 0;
  const share = ratioMode === 'manual' ? ratioShare(ratioValue) : ratioRecommendation.recommendedShare;
  /** @type {[number, number]} */
  const allowedShare =
    ratioMode === 'manual' ? [share, share] : [ratioRecommendation.minShare, ratioRecommendation.maxShare];
  const ratioWarnings = ratioMode === 'manual' ? checkRatio(gPerHour, ratioValue) : [];

  const solution = solveIngredients({
    // Without a ratio (0:0, already a danger) nothing can be split.
    totalCarbsG: hasRatio ? totalG : 0,
    targetShare: share,
    allowedShare,
    ingredients: inputs.carbs.ingredients,
    custom: inputs.carbs.custom,
  });
  /** @type {PlanCarbItem[]} */
  const carbItems = solution.items.map((item) => {
    const profile = ingredientProfile(item.ref, inputs.carbs.custom);
    return {
      ...item,
      carbsPerGram: profile.carbsPerGram,
      fructoseShare: profile.fructoseShare,
      osmPerG: profile.osmPerG,
      waterFraction: profile.waterFraction,
      custom: profile.custom,
    };
  });
  const deliveredCarbsG = sum(carbItems, 'carbsG');
  const pathwayShare = solution.achievedShare ?? solution.usedShare ?? share;

  const carbWarnings = dedupeById([
    ...(carbMode === 'auto' ? carbRecommendation.warnings : []),
    ...carbIntakeWarnings(gPerHour, { durationMin, highCarb: event.highCarb }),
    ...solution.warnings,
  ]);

  // Fluid (before sodium: the sodium concentration check needs it)
  const fluidRecommendation = recommendFluid({
    durationMin,
    sweatRateLph: sweat.rateLph,
    tempC: environment.tempC,
  });
  const fluidMode = inputs.fluid.mode;
  const mlPerHour = fluidMode === 'manual' ? inputs.fluid.manualMlPerHour : fluidRecommendation.mlPerHour;
  const fluidTotalMl = mlPerHour * durationH;
  const hydration = projectBodyMass({
    sweatRateLph: sweat.rateLph,
    fluidMlPerHour: mlPerHour,
    durationMin,
    massKg: athlete.massKg,
    energyKcalPerHour: sweat.estimate.energyKcalPerHour,
  });

  // Sodium
  const sodiumRecommendation = recommendSodium({
    durationMin,
    sweatRateLph: sweat.rateLph,
    sweatSodiumMmolL: sweat.sodiumMmolL,
  });
  const sodiumMode = inputs.sodium.mode;
  const mgPerHour = sodiumMode === 'manual' ? inputs.sodium.manualMgPerHour : sodiumRecommendation.mgPerHour;
  const sodiumTotalMg = mgPerHour * durationH;
  const [sodiumRangeLo, sodiumRangeHi] = sodiumRecommendation.range;
  const sodiumBelowRange =
    sodiumMode === 'manual' && durationMin >= 120 && sodiumRangeLo > 0 && mgPerHour < sodiumRangeLo;

  // Extras
  const extrasRecommendation = recommendExtras({ sweatRateLph: sweat.rateLph, enabled: inputs.extras });
  const withTotal = (entry) => ({ ...entry, totalMg: entry.mgPerHour * durationH });
  const extras = {
    ...extrasRecommendation,
    Potassium: withTotal(extrasRecommendation.Potassium),
    Magnesium: withTotal(extrasRecommendation.Magnesium),
    Calcium: withTotal(extrasRecommendation.Calcium),
  };

  // Salts
  const saltMode = inputs.salts.mode;
  const customSalts = inputs.salts.custom;
  /** @type {SaltAmount[]} */
  const saltItems =
    saltMode === 'manual'
      ? inputs.salts.manual.map((s) => ({ ref: s.ref, amountMg: s.amountMg }))
      : saltsForTargets({
          sodiumMg: sodiumTotalMg,
          potassiumMg: extras.Potassium.totalMg,
          magnesiumMg: extras.Magnesium.totalMg,
          calciumMg: extras.Calcium.totalMg,
          sodiumSalt: inputs.salts.sodiumSalt,
        }).map(({ id, amountMg }) => ({ ref: id, amountMg }));
  const delivered = deliveredIons(saltItems, customSalts);
  const comparison = compareIons(
    { ...delivered, Chloride: 0 },
    {
      Sodium: sodiumTotalMg,
      Potassium: extras.Potassium.totalMg,
      Magnesium: extras.Magnesium.totalMg,
      Calcium: extras.Calcium.totalMg,
    },
  );
  const saltWarnings =
    saltMode === 'manual' && durationH > 0
      ? sodiumWarnings(delivered.Sodium / durationH, { fluidMlPerHour: mlPerHour })
      : [];
  /** @type {PlanSaltItem[]} */
  const saltLines = saltItems.map(({ ref, amountMg }) => {
    const profile = saltProfile(ref, customSalts);
    return {
      ref,
      label: profile ? profile.label : String(ref),
      amountMg,
      grams: amountMg / 1000,
      osmPerG: profile ? profile.osmPerG : 0,
    };
  });

  // Format: which part of the carbs goes into gels and which into the drink.
  const requestedType = inputs.format.type;
  const requestedDrinkShare =
    requestedType === 'drink' ? 1 : requestedType === 'both' ? inputs.format.drinkCarbSharePct / 100 : 0;

  // Gels, caffeine, bicarbonate. A gel needs carbs: gels are planned only
  // when the gel part of the recipe delivers carbs (not just a carb target),
  // so a 0 g plan, a plan whose ingredients deliver nothing (no ingredient,
  // a 0:0 ratio), a drink or 'both' at 100 % drink has no gels.
  const gelPartCarbsG =
    requestedType === 'drink' ? 0 : sum(carbPart(carbItems, 1 - requestedDrinkShare), 'carbsG');
  const gelsPerHour = gelPartCarbsG > MIN_GEL_CARBS_G ? inputs.format.gelsPerHour : 0;
  const gelTimes = getGelTimes(durationMin, gelsPerHour);
  const hasGels = gelTimes.length > 0;

  // Without gels, whatever the gels would hold goes into the drink, so the
  // drink's strength, osmolality and warnings describe everything the athlete
  // mixes: 'both' becomes a drink, and so does 'gel' when it has carbs or
  // salts to mix. A 'gel' plan with nothing to mix stays an empty gel recipe.
  const gelPartHasContents = gelPartCarbsG > MIN_GEL_CARBS_G || (requestedType === 'gel' && saltLines.length > 0);
  const formatType =
    requestedType === 'drink' || hasGels || (requestedType === 'gel' && !gelPartHasContents) ? requestedType : 'drink';
  const drinkCarbShare = formatType === requestedType ? requestedDrinkShare : 1;
  const gelShare = 1 - drinkCarbShare;
  /** @type {Warning[]} */
  const formatWarnings = [];
  if (formatType !== requestedType && gelPartHasContents) {
    formatWarnings.push({
      id: 'plan.noGels',
      level: 'info',
      message: {
        key: gelPartCarbsG > MIN_GEL_CARBS_G ? 'plan.warn.noGelsCarbsInDrink' : 'plan.warn.noGelsSaltsInDrink',
      },
    });
  }

  const caffeine = planCaffeine({
    enabled: inputs.caffeine.enabled,
    massKg: athlete.massKg,
    mgPerKg: inputs.caffeine.mgPerKg,
    durationMin,
    gelTimesMin: gelTimes,
    asIngredient: inputs.caffeine.asIngredient,
    tabletMg: inputs.caffeine.tabletMg,
  });
  const bicarb = planBicarbonate({
    enabled: inputs.bicarb.enabled,
    massKg: athlete.massKg,
    gPerKg: inputs.bicarb.gPerKg,
    durationMin,
  });

  // Concentration: the gel batch and the drink bottles.
  const gelCarbItems = formatType === 'drink' ? [] : carbPart(carbItems, gelShare);
  const drinkCarbItems = formatType === 'gel' ? [] : carbPart(carbItems, drinkCarbShare);
  const gel = hasGels
    ? gelBatch({
        carbItems: gelCarbItems,
        saltItems: formatType === 'gel' ? saltLines : [],
        totalCarbsG: sum(gelCarbItems, 'carbsG'),
        servings: gelTimes.length,
        consistency: inputs.format.gelConsistency,
      })
    : null;
  const drink =
    formatType === 'gel'
      ? null
      : drinkBottles({
          carbItems: drinkCarbItems,
          saltItems: saltLines,
          totalCarbsG: sum(drinkCarbItems, 'carbsG'),
          totalSodiumMg: delivered.Sodium,
          totalFluidMl: fluidTotalMl,
          bottleMl: inputs.format.bottleMl,
        });

  const schedule = buildSchedule({
    durationMin,
    type: formatType,
    gelsPerHour,
    fluidMlPerHour: mlPerHour,
    drink: drink ?? undefined,
    caffeine,
    bicarb,
  });

  const recipe = buildRecipe({
    type: formatType,
    carbItems,
    saltItems: saltLines.map(({ ref, label, amountMg }) => ({ ref, label, amountMg })),
    caffeine,
    gel: gel ? { ...gel, servings: gelTimes.length } : null,
    drink,
    view: inputs.format.view,
    drinkCarbShare,
  });

  // Pathway intake from the carbs the recipe delivers (the full target
  // whenever an ingredient can carry carbs, nothing without one).
  const deliveredGPerHour = durationH > 0 ? deliveredCarbsG / durationH : 0;
  const hasDelivered = deliveredCarbsG > 0;

  const carbs = {
    mode: carbMode,
    recommended: carbRecommendation,
    gPerHour,
    totalG,
    deliveredG: deliveredCarbsG,
    warnings: carbWarnings,
    ratio: {
      mode: ratioMode,
      recommended: ratioRecommendation,
      value: ratioValue,
      share,
      allowedShare,
      glucoseGPerHour: hasDelivered ? deliveredGPerHour * (1 - pathwayShare) : 0,
      fructoseGPerHour: hasDelivered ? deliveredGPerHour * pathwayShare : 0,
      warnings: ratioWarnings,
    },
    ingredients: { ...solution, items: carbItems },
    mouthRinse: carbRecommendation.mouthRinse,
    mouthRinseHowTo: carbRecommendation.mouthRinseHowTo,
  };
  const sodium = {
    mode: sodiumMode,
    recommended: sodiumRecommendation,
    mgPerHour,
    totalMg: sodiumTotalMg,
    warnings: [
      ...sodiumWarnings(mgPerHour, { fluidMlPerHour: mlPerHour }),
      ...(sodiumBelowRange
        ? [
            {
              id: 'plan.sodiumBelowRange',
              level: 'info',
              message: {
                key: 'plan.warn.sodiumBelowRange',
                params: { mgPerHour, lo: sodiumRangeLo, hi: sodiumRangeHi },
              },
              citations: [...sodiumRecommendation.why.citations],
            },
          ]
        : []),
    ],
  };
  const fluid = {
    mode: fluidMode,
    recommended: fluidRecommendation,
    mlPerHour,
    totalMl: fluidTotalMl,
    warnings: fluidWarnings(mlPerHour, { sweatRateLph: sweat.rateLph }),
  };
  const salts = {
    mode: saltMode,
    sodiumSalt: inputs.salts.sodiumSalt,
    items: saltItems,
    delivered,
    comparison,
    warnings: saltWarnings,
  };

  const commercial = totalG * COMMERCIAL_COST_PER_G;
  const diy = totalG * DIY_COST_PER_G;
  const expenditureKcalPerHour = sweat.estimate.energyKcalPerHour;

  const warnings = sortByLevel(
    dedupeById([
      ...sweat.warnings,
      ...carbs.warnings,
      ...carbs.ratio.warnings,
      ...sodium.warnings,
      ...salts.warnings,
      ...fluid.warnings,
      ...hydration.warnings,
      ...formatWarnings,
      ...(gel ? gel.warnings : []),
      ...(drink ? drink.warnings : []),
      ...caffeine.warnings,
      ...bicarb.warnings,
    ]),
  );

  return {
    inputs,
    durationMin,
    durationH,
    sweat,
    hydration,
    carbs,
    sodium,
    extras,
    fluid,
    salts,
    format: { type: formatType, requestedType, drinkCarbShare },
    concentration: { gel, drink },
    caffeine,
    bicarb,
    gels: { perHour: gelsPerHour, count: gelTimes.length, times: gelTimes },
    schedule,
    recipe,
    energy: {
      kcal: carbCalories(totalG),
      deliveredKcal: carbCalories(deliveredCarbsG),
      expenditureKcalPerHour,
      expenditureKcal: expenditureKcalPerHour * durationH,
    },
    cost: { diy, commercial, savings: commercial - diy },
    warnings,
  };
}

/**
 * Partial inputs that load a commercial gel template (`src/constants/templates.js`).
 *
 * - Carbs: manual ratio from the template, and its glucose and fructose
 *   source lists as one ingredient list ({@link ingredientsFromV3Sources}
 *   with the template's ratio: `weight = percentage × the share of the carbs
 *   the list covers`). The carb target itself and the custom ingredients are
 *   left alone.
 * - Gels per hour: `gPerHour / carbsPerGelG` rounded to the nearest 0.5, at
 *   least 1 (and at most 12, the input limit).
 * - Salts: auto, with the template's sodium salt. The sodium target is left
 *   alone: a gel's label sodium (often 0–60 mg) is far below what most events
 *   need, so the plan keeps its evidence-based target and the salts cover it.
 *
 * A non-finite or negative `gPerHour` or a non-positive `carbsPerGelG` gives
 * 1 gel per hour. Returns new objects; the (frozen) template is not touched.
 * Pass the result to `normalizeInputs` (or the provider's `apply`).
 *
 * @param {{ ratio: { glucose: number, fructose: number }, glucoseSources: { id: number, percentage: number }[],
 *   fructoseSources: { id: number, percentage: number }[], carbsPerGelG: number,
 *   sodiumSalt: 'table'|'citrate'|'mix' }} template
 * @param {{ gPerHour: number }} options  The current effective carb target in g/h.
 * @returns {{ carbs: { ratioMode: 'manual', manualRatio: { glucose: number, fructose: number },
 *   ingredients: IngredientRef[] }, format: { gelsPerHour: number },
 *   salts: { mode: 'auto', sodiumSalt: 'table'|'citrate'|'mix' } }}
 */
export function templateToInputs(template, { gPerHour } = {}) {
  const t = template && typeof template === 'object' ? template : {};
  const carbsPerGel = Number.isFinite(t.carbsPerGelG) && t.carbsPerGelG > 0 ? t.carbsPerGelG : 0;
  const g = Number.isFinite(gPerHour) && gPerHour > 0 ? gPerHour : 0;
  const rawGels = carbsPerGel > 0 ? Math.round((g / carbsPerGel) * 2) / 2 : 0;
  const gelsPerHour = clamp(rawGels, 1, INPUT_LIMITS.gelsPerHour[1]);
  const glucose = t.ratio?.glucose;
  const fructose = t.ratio?.fructose;
  const share = ratioShare({ glucose, fructose });
  const hasRatio = Number.isFinite(glucose) && Number.isFinite(fructose) && glucose + fructose > 0;

  return {
    carbs: {
      ratioMode: 'manual',
      manualRatio: { glucose, fructose },
      ingredients: ingredientsFromV3Sources(
        Array.isArray(t.glucoseSources) ? t.glucoseSources : [],
        Array.isArray(t.fructoseSources) ? t.fructoseSources : [],
        hasRatio ? share : DEFAULT_FRUCTOSE_SHARE,
      ),
    },
    format: { gelsPerHour },
    salts: { mode: 'auto', sodiumSalt: t.sodiumSalt },
  };
}
