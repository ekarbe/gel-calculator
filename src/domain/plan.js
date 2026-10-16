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
 * The plan: the inputs schema (v3), its normalisation, and `computePlan`,
 * which turns inputs into everything the UI shows by calling the other domain
 * modules.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no I/O. Arguments
 * are never mutated. Functions never return English text; they return message
 * descriptors whose keys live in `src/i18n/en/*.js` (`plan.*` keys in
 * `src/i18n/en/plan.js`).
 */

import {
  INTENSITIES,
  recommendCarbs,
  recommendRatio,
  ratioShare,
  checkRatio,
  carbIntakeWarnings,
  solveCarbSources,
  carbCalories,
} from './carbs';
import { resolveSweat } from './sweat';
import { recommendFluid, fluidWarnings } from './hydration';
import {
  recommendSodium,
  sodiumWarnings,
  recommendExtras,
  deliveredIons,
  saltsForTargets,
  compareIons,
} from './electrolytes';
import { planCaffeine } from './caffeine';
import { planBicarbonate } from './bicarbonate';
import { getGelTimes, buildSchedule } from './schedule';
import { buildRecipeItems } from './recipe';
import { isPlainObject } from './objects';
import {
  glucoseSourceOptions,
  fructoseSourceOptions,
  electrolyteSourceOptions,
} from '../constants/constants';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/** @typedef {'easy'|'moderate'|'hard'|'race'} Intensity */
/** @typedef {'auto'|'manual'} Mode */
/** @typedef {{ id: number, percentage: number }} SourceShare */
/** @typedef {{ id: number, amountMg: number }} SaltAmount */

/**
 * Calculator inputs, schema v3. Every field is always present after
 * {@link normalizeInputs}.
 *
 * @typedef {Object} PlanInputs
 * @property {{ durationMin: number, intensity: Intensity, highCarb: boolean }} event
 * @property {{ massKg: number, sex: 'unspecified'|'female'|'male' }} athlete
 * @property {{ tempC: number, humidity: number }} environment
 * @property {{ source: 'preset'|'estimate', rateIndex: number, saltinessIndex: number }} sweat
 * @property {{ mode: Mode, manualGPerHour: number, ratioMode: Mode,
 *   manualRatio: { glucose: number, fructose: number },
 *   glucoseSources: SourceShare[], fructoseSources: SourceShare[] }} carbs
 * @property {{ mode: Mode, manualMgPerHour: number }} sodium
 * @property {{ potassium: boolean, magnesium: boolean, calcium: boolean }} extras
 * @property {{ mode: Mode, sodiumSalt: 'table'|'citrate'|'mix', manual: SaltAmount[] }} salts
 *   `manual` holds whole-activity salt amounts in mg.
 * @property {{ mode: Mode, manualMlPerHour: number }} fluid
 * @property {{ gelsPerHour: number, view: 'total'|'perGel' }} format
 * @property {{ enabled: boolean, mgPerKg: number, asIngredient: boolean, tabletMg: 100|200 }} caffeine
 * @property {{ enabled: boolean, gPerKg: number }} bicarb
 */

/**
 * Recursively freezes plain objects and arrays.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Default inputs: a 3 h moderate event for a 70 kg athlete. Deeply frozen;
 * {@link normalizeInputs} returns fresh, unfrozen copies.
 *
 * @type {Readonly<PlanInputs>}
 */
export const DEFAULT_INPUTS = deepFreeze({
  event: { durationMin: 180, intensity: 'moderate', highCarb: false },
  athlete: { massKg: 70, sex: 'unspecified' },
  environment: { tempC: 20, humidity: 50 },
  sweat: { source: 'preset', rateIndex: 2, saltinessIndex: 2 },
  carbs: {
    mode: 'auto',
    manualGPerHour: 60,
    ratioMode: 'auto',
    manualRatio: { glucose: 1, fructose: 0.8 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
  },
  sodium: { mode: 'auto', manualMgPerHour: 500 },
  extras: { potassium: false, magnesium: false, calcium: false },
  salts: { mode: 'auto', sodiumSalt: 'table', manual: [] },
  fluid: { mode: 'auto', manualMlPerHour: 500 },
  format: { gelsPerHour: 3, view: 'total' },
  caffeine: { enabled: false, mgPerKg: 3, asIngredient: false, tabletMg: 100 },
  bicarb: { enabled: false, gPerKg: 0.3 },
});

/**
 * Inclusive [min, max] bounds that {@link normalizeInputs} clamps numbers to.
 * Exported so input controls can use the same limits.
 */
export const INPUT_LIMITS = deepFreeze({
  durationMin: [0, 2880],
  massKg: [30, 200],
  tempC: [-20, 50],
  humidity: [0, 100],
  presetIndex: [0, 5],
  manualGPerHour: [0, 200],
  ratioPart: [0, 5],
  sourcePercentage: [0, 1000],
  manualMgPerHour: [0, 5000],
  manualMlPerHour: [0, 3000],
  gelsPerHour: [0, 12],
  caffeineMgPerKg: [1, 6],
  bicarbGPerKg: [0.2, 0.3],
  // Whole-activity mg of one salt. Covers the most the auto salts can ask for
  // (48 h at the 5000 mg/h manual sodium limit, all from sodium citrate:
  // 240 g sodium ÷ 0.2345 ≈ 1,023,455 mg), so switching salts to Manual never
  // cuts the amounts it starts from.
  saltAmountMg: [0, 1100000],
});

/** Allowed values of the enumerated inputs. */
export const INPUT_OPTIONS = deepFreeze({
  intensity: [...INTENSITIES],
  sex: ['unspecified', 'female', 'male'],
  sweatSource: ['preset', 'estimate'],
  mode: ['auto', 'manual'],
  sodiumSalt: ['table', 'citrate', 'mix'],
  view: ['total', 'perGel'],
  tabletMg: [100, 200],
});

/** Rough DIY powder cost in currency units per g of carbohydrate. */
const DIY_COST_PER_G = 0.015;
/** Rough commercial gel cost per g of carbohydrate (about 2.50 per 25 g gel). */
const COMMERCIAL_COST_PER_G = 0.1;

const GLUCOSE_IDS = new Set(glucoseSourceOptions.map((o) => o.id));
const FRUCTOSE_IDS = new Set(fructoseSourceOptions.map((o) => o.id));
const SALT_IDS = new Set(electrolyteSourceOptions.map((o) => o.id));

const LEVEL_ORDER = { danger: 0, warning: 1, info: 2 };

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Glucose:fructose ratio in parts (glucose 1) for a fructose share below 1,
 * fructose rounded to 2 decimals like `recommendRatio` (1/3 → 1:0.5, 0.5 → 1:1).
 * @param {number} share
 * @returns {{ glucose: number, fructose: number }}
 */
const ratioForShare = (share) => ({ glucose: 1, fructose: round2(share / (1 - share)) });

/**
 * A ratio as `glucose:fructose` text for messages (`1:0.5`).
 * @param {{ glucose: number, fructose: number }} ratio
 * @returns {string}
 */
const ratioText = ({ glucose, fructose }) => `${round2(glucose)}:${round2(fructose)}`;

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
 * Normalizes a carb source list: entries must be objects whose `id` (number
 * or numeric string) is in `allowedIds`; others are dropped. Percentages are
 * clamped to [0, 1000]; a non-finite percentage becomes 0. A value that is not
 * an array falls back to a copy of `fallback`.
 * @param {unknown} value
 * @param {Set<number>} allowedIds
 * @param {readonly SourceShare[]} fallback
 * @returns {SourceShare[]}
 */
function sourceList(value, allowedIds, fallback) {
  if (!Array.isArray(value)) return fallback.map((s) => ({ ...s }));
  const out = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const id = toNumber(entry.id);
    if (!allowedIds.has(id)) continue;
    out.push({ id, percentage: num(entry.percentage, 0, INPUT_LIMITS.sourcePercentage) });
  }
  return out;
}

/**
 * Normalizes the manual salt list: ids must be electrolyte source ids, amounts
 * are clamped to `INPUT_LIMITS.saltAmountMg` (0–1,100,000 mg; non-finite → 0).
 * Not an array → `[]`.
 * @param {unknown} value
 * @returns {SaltAmount[]}
 */
function saltList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const id = toNumber(entry.id);
    if (!SALT_IDS.has(id)) continue;
    out.push({ id, amountMg: num(entry.amountMg, 0, INPUT_LIMITS.saltAmountMg) });
  }
  return out;
}

/**
 * Turns any value into complete, valid {@link PlanInputs}.
 *
 * Deep-merges `partial` onto {@link DEFAULT_INPUTS} field by field and drops
 * unknown keys. Numbers (and numeric strings) are clamped to
 * {@link INPUT_LIMITS}; non-finite numbers and values of the wrong type fall
 * back to the default for that field. Enums outside {@link INPUT_OPTIONS}
 * fall back to the default. Sweat preset indices are rounded to integers
 * 0–5; gels per hour is rounded to 0.01. Carb source entries whose id is
 * not in the matching list (glucose ids for `glucoseSources`, fructose ids
 * for `fructoseSources`) are dropped, as are manual salt entries whose id is
 * not an electrolyte source; a
 * non-finite percentage or amount in a kept entry becomes 0. A list that is
 * not an array falls back to the default list.
 *
 * Always returns a new object; never mutates `partial`. Idempotent:
 * `normalizeInputs(normalizeInputs(x))` deep-equals `normalizeInputs(x)`.
 *
 * @param {unknown} [partial]  Usually a partial {@link PlanInputs}; anything else counts as `{}`.
 * @returns {PlanInputs}
 */
export function normalizeInputs(partial) {
  const d = DEFAULT_INPUTS;
  const L = INPUT_LIMITS;
  const O = INPUT_OPTIONS;

  const event = sectionOf(partial, 'event');
  const athlete = sectionOf(partial, 'athlete');
  const environment = sectionOf(partial, 'environment');
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

  const tabletMg = toNumber(caffeine.tabletMg);

  return {
    event: {
      durationMin: num(event.durationMin, d.event.durationMin, L.durationMin),
      intensity: oneOf(event.intensity, O.intensity, d.event.intensity),
      highCarb: bool(event.highCarb, d.event.highCarb),
    },
    athlete: {
      massKg: num(athlete.massKg, d.athlete.massKg, L.massKg),
      sex: oneOf(athlete.sex, O.sex, d.athlete.sex),
    },
    environment: {
      tempC: num(environment.tempC, d.environment.tempC, L.tempC),
      humidity: num(environment.humidity, d.environment.humidity, L.humidity),
    },
    sweat: {
      source: oneOf(sweat.source, O.sweatSource, d.sweat.source),
      rateIndex: int(sweat.rateIndex, d.sweat.rateIndex, L.presetIndex),
      saltinessIndex: int(sweat.saltinessIndex, d.sweat.saltinessIndex, L.presetIndex),
    },
    carbs: {
      mode: oneOf(carbs.mode, O.mode, d.carbs.mode),
      manualGPerHour: num(carbs.manualGPerHour, d.carbs.manualGPerHour, L.manualGPerHour),
      ratioMode: oneOf(carbs.ratioMode, O.mode, d.carbs.ratioMode),
      manualRatio: {
        glucose: num(manualRatio.glucose, d.carbs.manualRatio.glucose, L.ratioPart),
        fructose: num(manualRatio.fructose, d.carbs.manualRatio.fructose, L.ratioPart),
      },
      glucoseSources: sourceList(carbs.glucoseSources, GLUCOSE_IDS, d.carbs.glucoseSources),
      fructoseSources: sourceList(carbs.fructoseSources, FRUCTOSE_IDS, d.carbs.fructoseSources),
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
      manual: saltList(salts.manual),
    },
    fluid: {
      mode: oneOf(fluid.mode, O.mode, d.fluid.mode),
      manualMlPerHour: num(fluid.manualMlPerHour, d.fluid.manualMlPerHour, L.manualMlPerHour),
    },
    format: {
      // Snapped to 0.01 gels/h: finer rates mean nothing and only lengthen
      // share links. (getGelTimes also copes with a subnormal rate itself.)
      gelsPerHour: round2(num(format.gelsPerHour, d.format.gelsPerHour, L.gelsPerHour)),
      view: oneOf(format.view, O.view, d.format.view),
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
 * @typedef {Object} Plan
 * @property {PlanInputs} inputs  The normalized inputs the plan was computed from.
 * @property {number} durationMin
 * @property {number} durationH
 * @property {ReturnType<typeof resolveSweat>} sweat
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendCarbs>, gPerHour: number, totalG: number,
 *   deliveredG: number, warnings: Warning[],
 *   ratio: { mode: Mode, recommended: ReturnType<typeof recommendRatio>, value: { glucose: number, fructose: number },
 *     share: number, glucoseGPerHour: number, fructoseGPerHour: number, warnings: Warning[] },
 *   sources: ReturnType<typeof solveCarbSources>, mouthRinse: boolean,
 *   mouthRinseHowTo: ReturnType<typeof recommendCarbs>['mouthRinseHowTo'] }} carbs
 *   `deliveredG` is the carbohydrate the recipe contains (the solved sources; 0 when they cannot
 *   make the ratio). `glucoseGPerHour` and `fructoseGPerHour` split the target by the ratio.
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendSodium>, mgPerHour: number, totalMg: number,
 *   warnings: Warning[] }} sodium
 * @property {Object} extras  `recommendExtras(...)`; each ion entry also has `totalMg`.
 * @property {{ mode: Mode, recommended: ReturnType<typeof recommendFluid>, mlPerHour: number, totalMl: number,
 *   warnings: Warning[] }} fluid
 * @property {{ mode: Mode, sodiumSalt: 'table'|'citrate'|'mix', items: SaltAmount[],
 *   delivered: ReturnType<typeof deliveredIons>, comparison: ReturnType<typeof compareIons>,
 *   warnings: Warning[] }} salts
 * @property {ReturnType<typeof planCaffeine>} caffeine
 * @property {ReturnType<typeof planBicarbonate>} bicarb
 * @property {{ perHour: number, count: number, times: number[] }} gels
 * @property {ReturnType<typeof buildSchedule>} schedule
 * @property {{ view: 'total'|'perGel', items: ReturnType<typeof buildRecipeItems> }} recipe
 * @property {{ kcal: number, deliveredKcal: number }} energy  `kcal` from the carb target,
 *   `deliveredKcal` from the carbs the recipe contains.
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
 * - Ratio: auto → `recommendRatio(gPerHour).ratio`; manual → the manual ratio
 *   plus `checkRatio` warnings. In auto mode, when the carb sources cannot make
 *   the recommended ratio, the ends of the allowed range are tried (the
 *   minimum share, then the maximum); the first the sources can make is used,
 *   with info `plan.ratioSubstituted` in `carbs.ratio.warnings`. So at
 *   ≤ 60 g/h glucose sources alone give a 1:0 plan.
 * - Carb sources: `solveCarbSources` for the whole activity. When they cannot
 *   deliver the ratio (and the ratio is not 0:0, which `checkRatio` already
 *   flags), `carbs.warnings` gets `plan.carbSourcesInfeasible`.
 * - Sodium concentration is checked against the effective fluid intake. A
 *   manual sodium target below the evidence range of an event of 120 min or
 *   more gets info `plan.sodiumBelowRange`.
 * - Salts: auto → `saltsForTargets` from the sodium and extras totals and the
 *   chosen sodium salt; manual → `inputs.salts.manual`. `comparison` covers
 *   the ions that have targets (sodium, potassium, magnesium, calcium);
 *   chloride is a by-product of table salt with no target, so it is left out.
 *   Manual salts also get `sodiumWarnings` for the sodium they deliver per hour.
 * - Gels: `getGelTimes(durationMin, gelsPerHour)`; caffeine is planned on
 *   those gel times and the schedule is built from the same values. A plan
 *   with no carbs (0 g in total, e.g. under 45 min) has no gels:
 *   `gels.perHour` is 0, and the schedule shows the start, the fluid and the
 *   finish.
 * - Recipe: `buildRecipeItems` for `inputs.format.view`.
 * - Energy: 4 kcal per g of the carb target (`kcal`) and of the carbs the
 *   recipe contains (`deliveredKcal`). Cost: rough estimate of 0.015 (DIY)
 *   and 0.10 (commercial) per g of carbs.
 *
 * @param {unknown} rawInputs  Usually {@link PlanInputs}.
 * @returns {Plan}
 */
export function computePlan(rawInputs) {
  const inputs = normalizeInputs(rawInputs);
  const { event, athlete, environment } = inputs;
  const durationMin = event.durationMin;
  const durationH = durationMin / 60;

  const sweat = resolveSweat(inputs.sweat, {
    sex: athlete.sex,
    intensity: event.intensity,
    tempC: environment.tempC,
    humidity: environment.humidity,
  });

  // Carbs
  const carbRecommendation = recommendCarbs({
    durationMin,
    intensity: event.intensity,
    highCarb: event.highCarb,
  });
  const carbMode = inputs.carbs.mode;
  const gPerHour = carbMode === 'manual' ? inputs.carbs.manualGPerHour : carbRecommendation.gPerHour;
  const totalG = gPerHour * durationH;

  const ratioRecommendation = recommendRatio(gPerHour);
  const ratioMode = inputs.carbs.ratioMode;
  const solveFor = (ratio) =>
    solveCarbSources({
      totalCarbsG: totalG,
      ratio,
      glucoseSources: inputs.carbs.glucoseSources,
      fructoseSources: inputs.carbs.fructoseSources,
    });
  let ratioValue =
    ratioMode === 'manual' ? { ...inputs.carbs.manualRatio } : { ...ratioRecommendation.ratio };
  const ratioWarnings = ratioMode === 'manual' ? checkRatio(gPerHour, ratioValue) : [];
  let sources = solveFor(ratioValue);

  // Auto ratio: when the sources cannot make the recommended ratio, use an end
  // of the allowed range they can make (e.g. glucose alone at ≤ 60 g/h).
  if (ratioMode === 'auto' && !sources.canAchieveRatio) {
    const recommendedText = ratioText(ratioValue);
    for (const share of [ratioRecommendation.minShare, ratioRecommendation.maxShare]) {
      const candidate = ratioForShare(share);
      if (ratioText(candidate) === recommendedText) continue;
      const solved = solveFor(candidate);
      if (!solved.canAchieveRatio) continue;
      ratioValue = candidate;
      sources = solved;
      ratioWarnings.push({
        id: 'plan.ratioSubstituted',
        level: 'info',
        message: {
          key: 'plan.warn.ratioSubstituted',
          params: { recommended: recommendedText, used: ratioText(candidate), gPerHour },
        },
        citations: [...ratioRecommendation.why.citations],
      });
      break;
    }
  }
  const deliveredCarbsG = sources.items.reduce((sum, item) => sum + item.carbsG, 0);

  const carbWarnings = dedupeById([
    ...(carbMode === 'auto' ? carbRecommendation.warnings : []),
    ...carbIntakeWarnings(gPerHour, { durationMin, highCarb: event.highCarb }),
  ]);
  if (!sources.canAchieveRatio && ratioValue.glucose + ratioValue.fructose > 0) {
    carbWarnings.push({
      id: 'plan.carbSourcesInfeasible',
      level: 'warning',
      message: {
        key: 'plan.warn.carbSourcesInfeasible',
        params: { glucose: ratioValue.glucose, fructose: ratioValue.fructose },
      },
    });
  }

  // Fluid (before sodium: the sodium concentration check needs it)
  const fluidRecommendation = recommendFluid({
    durationMin,
    sweatRateLph: sweat.rateLph,
    tempC: environment.tempC,
  });
  const fluidMode = inputs.fluid.mode;
  const mlPerHour = fluidMode === 'manual' ? inputs.fluid.manualMlPerHour : fluidRecommendation.mlPerHour;

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
  const saltItems =
    saltMode === 'manual'
      ? inputs.salts.manual.map((s) => ({ ...s }))
      : saltsForTargets({
          sodiumMg: sodiumTotalMg,
          potassiumMg: extras.Potassium.totalMg,
          magnesiumMg: extras.Magnesium.totalMg,
          calciumMg: extras.Calcium.totalMg,
          sodiumSalt: inputs.salts.sodiumSalt,
        });
  const delivered = deliveredIons(saltItems);
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

  // Gels, caffeine, bicarbonate, schedule. No carbs means nothing to put in a
  // gel, so a 0 g plan has no gels (the salts go into the drink).
  const gelsPerHour = totalG > 0 ? inputs.format.gelsPerHour : 0;
  const gelTimes = getGelTimes(durationMin, gelsPerHour);
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
  const schedule = buildSchedule({
    durationMin,
    gelsPerHour,
    fluidMlPerHour: mlPerHour,
    caffeine,
    bicarb,
  });

  const recipeItems = buildRecipeItems({
    carbSources: sources.items,
    salts: saltItems,
    caffeine,
    gelCount: gelTimes.length,
    view: inputs.format.view,
  });

  const share = ratioShare(ratioValue);
  const hasRatio = ratioValue.glucose + ratioValue.fructose > 0;
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
      glucoseGPerHour: hasRatio ? gPerHour * (1 - share) : 0,
      fructoseGPerHour: hasRatio ? gPerHour * share : 0,
      warnings: ratioWarnings,
    },
    sources,
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
    totalMl: mlPerHour * durationH,
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

  const warnings = sortByLevel(
    dedupeById([
      ...carbs.warnings,
      ...carbs.ratio.warnings,
      ...sodium.warnings,
      ...salts.warnings,
      ...fluid.warnings,
      ...caffeine.warnings,
      ...bicarb.warnings,
    ]),
  );

  return {
    inputs,
    durationMin,
    durationH,
    sweat,
    carbs,
    sodium,
    extras,
    fluid,
    salts,
    caffeine,
    bicarb,
    gels: { perHour: gelsPerHour, count: gelTimes.length, times: gelTimes },
    schedule,
    recipe: { view: inputs.format.view, items: recipeItems },
    energy: { kcal: carbCalories(totalG), deliveredKcal: carbCalories(deliveredCarbsG) },
    cost: { diy, commercial, savings: commercial - diy },
    warnings,
  };
}

/**
 * Partial inputs that load a commercial gel template (`src/constants/templates.js`).
 *
 * - Carbs: manual ratio from the template, its glucose and fructose sources.
 *   The carb target itself is left alone.
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
 * @param {{ ratio: { glucose: number, fructose: number }, glucoseSources: SourceShare[],
 *   fructoseSources: SourceShare[], carbsPerGelG: number, sodiumSalt: 'table'|'citrate'|'mix' }} template
 * @param {{ gPerHour: number }} options  The current effective carb target in g/h.
 * @returns {{ carbs: Partial<PlanInputs['carbs']>, format: { gelsPerHour: number },
 *   salts: { mode: 'auto', sodiumSalt: 'table'|'citrate'|'mix' } }}
 */
export function templateToInputs(template, { gPerHour } = {}) {
  const t = template && typeof template === 'object' ? template : {};
  const carbsPerGel = Number.isFinite(t.carbsPerGelG) && t.carbsPerGelG > 0 ? t.carbsPerGelG : 0;
  const g = Number.isFinite(gPerHour) && gPerHour > 0 ? gPerHour : 0;
  const rawGels = carbsPerGel > 0 ? Math.round((g / carbsPerGel) * 2) / 2 : 0;
  const gelsPerHour = clamp(rawGels, 1, INPUT_LIMITS.gelsPerHour[1]);
  const copyList = (list) => (Array.isArray(list) ? list.map((s) => ({ id: s.id, percentage: s.percentage })) : []);

  return {
    carbs: {
      ratioMode: 'manual',
      manualRatio: { glucose: t.ratio?.glucose, fructose: t.ratio?.fructose },
      glucoseSources: copyList(t.glucoseSources),
      fructoseSources: copyList(t.fructoseSources),
    },
    format: { gelsPerHour },
    salts: { mode: 'auto', sodiumSalt: t.sodiumSalt },
  };
}
