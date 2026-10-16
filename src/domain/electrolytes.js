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
 * Electrolytes: the sodium target, optional potassium/magnesium/calcium
 * targets, sodium safety warnings, and the conversion between ion targets and
 * salt amounts.
 *
 * All amounts are ingested amounts. There are no absorption factors anywhere:
 * guidelines state intake as ingested sodium (sawka2007, efsa2011), and
 * mineral absorption varies too much to model per salt (fine1991).
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/electrolytes.js`.
 */

import { sourceDataByIdMap } from '../constants/constants';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/** @typedef {'Sodium'|'Chloride'|'Potassium'|'Magnesium'|'Calcium'} Ion */

/**
 * Ion amounts in mg, one entry per tracked ion.
 * @typedef {{ Sodium: number, Chloride: number, Potassium: number, Magnesium: number, Calcium: number }} IonAmounts
 */

/**
 * A salt and its amount in mg.
 * @typedef {{ id: number, amountMg: number }} SaltAmount
 */

/**
 * @typedef {Object} SodiumRecommendation
 * @property {number} mgPerHour  Sodium target in mg/h (rounded to 10, never above 1500).
 * @property {[number, number]} range  Guideline range for the duration band in mg/h.
 * @property {number} estimatedLossMgPerHour  Estimated sweat sodium loss in mg/h (unrounded).
 * @property {0.5} replacementShare  Share of the estimated loss the plan starts from.
 * @property {boolean} optional  True when sodium is optional for this duration (under 2 h).
 * @property {Explanation} why
 * @property {Warning[]} warnings
 */

/**
 * @typedef {Object} ExtraTarget
 * @property {number} mgPerHour  Target in mg/h; 0 when the ion is disabled.
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} ExtrasRecommendation
 * @property {ExtraTarget} Potassium
 * @property {ExtraTarget} Magnesium
 * @property {ExtraTarget} Calcium
 * @property {Explanation} why
 */

/**
 * @typedef {Object} IonComparison
 * @property {number} target  Target amount in mg.
 * @property {number} delivered  Delivered amount in mg.
 * @property {number} diff  `delivered - target` in mg.
 * @property {'met'|'short'|'over'} status
 */

/** Sodium intake above this (mg/h) is far above any guideline; the plan never recommends more. */
export const SODIUM_HARD_CAP_MG_PER_HOUR = 1500;

/** Upper end of usual sodium guidance in mg/h; above it the plan warns. */
export const SODIUM_HIGH_MG_PER_HOUR = 1000;

/**
 * Typical sweat concentrations in mmol/L for the optional ions (baker2017,
 * montain2007). They do not track sweat sodium.
 */
export const SWEAT_EXTRAS_MMOL = Object.freeze({ Potassium: 4.5, Magnesium: 0.05, Calcium: 0.5 });

/** Molar masses in mg per mmol. */
export const MG_PER_MMOL = Object.freeze({
  Sodium: 22.99,
  Chloride: 35.45,
  Potassium: 39.1,
  Magnesium: 24.31,
  Calcium: 40.08,
});

/** Ions tracked by {@link deliveredIons} and {@link compareIons}, in display order. */
const IONS = /** @type {Ion[]} */ (['Sodium', 'Chloride', 'Potassium', 'Magnesium', 'Calcium']);

/** Share of the estimated sweat sodium loss the plan starts from. */
const REPLACEMENT_SHARE = 0.5;

/** Sodium floor in mg/h for events of 2 h or more. */
const SODIUM_FLOOR_MG_PER_HOUR = 300;
/** Upper end of the sodium range in mg/h for 2–4 h events with normal sweat. */
const SODIUM_MEDIUM_HI_MG_PER_HOUR = 600;
/** From this sweat rate (L/h) a 2–4 h event uses the higher sodium range. */
const HEAVY_SWEAT_LPH = 1.5;
/** From this sweat sodium (mmol/L) a 2–4 h event uses the higher sodium range. */
const SALTY_SWEAT_MMOL = 55;

/** Durations in minutes that split the sodium bands. */
const SODIUM_SHORT_MAX_MIN = 120; // d < 120 → short
const SODIUM_MEDIUM_MAX_MIN = 240; // 120 ≤ d ≤ 240 → medium; d > 240 → long

/** Drink sodium above this (mg/L, 75 mmol/L) triggers a concentration warning. */
const SODIUM_CONCENTRATION_HIGH_MG_PER_L = 1725;

/** Caps in mg/h for the optional ions. */
const EXTRAS_CAP_MG_PER_HOUR = Object.freeze({ Potassium: 300, Magnesium: 50, Calcium: 100 });

/** Salt ids in `electrolyteSourceOptions`. */
const SALT_IDS = Object.freeze({
  table: 31, // Sodium Chloride (Table Salt)
  citrate: 33, // Sodium Citrate (dihydrate)
  potassium: 39, // Potassium Citrate (monohydrate)
  magnesium: 34, // Magnesium Citrate (anhydrous)
  calcium: 35, // Calcium Citrate (tetrahydrate)
});

const SODIUM_CITATIONS = ['sawka2007', 'mccubbin2023', 'hoffman2015', 'delcoso2016', 'baker2017'];
const EXTRAS_CITATIONS = ['baker2017', 'montain2007'];

const round10 = (x) => Math.round(x / 10) * 10;
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/**
 * A usable non-negative number: non-finite or negative values become 0.
 * @param {unknown} x
 * @returns {number}
 */
const nonNegative = (x) => (Number.isFinite(x) && x > 0 ? /** @type {number} */ (x) : 0);

/**
 * Mass fraction of `ion` in the salt with `id`, as sold. 0 when the salt or
 * ion is unknown. Any `absorptionRate` field is ignored.
 * @param {number} id
 * @param {string} ion
 * @returns {number}
 */
function ionRatio(id, ion) {
  const components = sourceDataByIdMap.get(id)?.components;
  if (!Array.isArray(components)) return 0;
  const component = components.find((c) => c.name === ion);
  return component && Number.isFinite(component.ratio) && component.ratio > 0 ? component.ratio : 0;
}

/**
 * Recommends an hourly sodium intake.
 *
 * - `loss = sweatRateLph × sweatSodiumMmolL × 22.99`; the plan starts from half
 *   of it (`base = 0.5 × loss`), because no guideline recommends replacing all
 *   sweat sodium.
 * - `durationMin < 120` (short): range [0, 300], optional, `min(base, 300)`.
 * - `120 ≤ durationMin ≤ 240` (medium): range [300, hi] with hi 1000 for heavy
 *   (≥ 1.5 L/h) or salty (≥ 55 mmol/L) sweaters and 600 otherwise;
 *   `clamp(base, 300, hi)`.
 * - `durationMin > 240` (long): range [300, 1000]; `clamp(base, 300, 1000)`.
 * - Rounded to 10 mg/h and never above {@link SODIUM_HARD_CAP_MG_PER_HOUR}.
 *
 * Non-finite or negative inputs count as 0. `why.summary` is
 * `electrolytes.why.sodium.<short|medium|long>` with params
 * `{ loss, mgPerHour, lo, hi }` (`loss` rounded to whole mg for display);
 * `why.details` is `electrolytes.why.partial`. `warnings` are
 * {@link sodiumWarnings} for the recommended value (no fluid information, so
 * no concentration check).
 *
 * Citations: sawka2007, mccubbin2023, hoffman2015, delcoso2016, baker2017.
 *
 * @param {{ durationMin?: number, sweatRateLph?: number, sweatSodiumMmolL?: number }} [input]
 * @returns {SodiumRecommendation}
 */
export function recommendSodium({ durationMin, sweatRateLph, sweatSodiumMmolL } = {}) {
  const d = nonNegative(durationMin);
  const rate = nonNegative(sweatRateLph);
  const mmol = nonNegative(sweatSodiumMmolL);

  const loss = rate * mmol * MG_PER_MMOL.Sodium;
  const base = REPLACEMENT_SHARE * loss;

  let band;
  let lo;
  let hi;
  let optional = false;
  let mg;
  if (d < SODIUM_SHORT_MAX_MIN) {
    band = 'short';
    lo = 0;
    hi = SODIUM_FLOOR_MG_PER_HOUR;
    optional = true;
    mg = Math.min(base, hi);
  } else if (d <= SODIUM_MEDIUM_MAX_MIN) {
    band = 'medium';
    lo = SODIUM_FLOOR_MG_PER_HOUR;
    hi =
      rate >= HEAVY_SWEAT_LPH || mmol >= SALTY_SWEAT_MMOL
        ? SODIUM_HIGH_MG_PER_HOUR
        : SODIUM_MEDIUM_HI_MG_PER_HOUR;
    mg = clamp(base, lo, hi);
  } else {
    band = 'long';
    lo = SODIUM_FLOOR_MG_PER_HOUR;
    hi = SODIUM_HIGH_MG_PER_HOUR;
    mg = clamp(base, lo, hi);
  }

  const mgPerHour = Math.min(round10(mg), SODIUM_HARD_CAP_MG_PER_HOUR);

  return {
    mgPerHour,
    range: [lo, hi],
    estimatedLossMgPerHour: loss,
    replacementShare: REPLACEMENT_SHARE,
    optional,
    why: {
      summary: {
        key: `electrolytes.why.sodium.${band}`,
        params: { loss: Math.round(loss), mgPerHour, lo, hi },
      },
      details: [{ key: 'electrolytes.why.partial' }],
      citations: [...SODIUM_CITATIONS],
    },
    warnings: sodiumWarnings(mgPerHour),
  };
}

/**
 * Safety warnings for an hourly sodium intake (recommended or manual).
 *
 * - `mgPerHour > 1500` → danger `electrolytes.sodiumFarAbove`; otherwise
 *   `mgPerHour > 1000` → warning `electrolytes.sodiumHigh`. Params
 *   `{ mgPerHour, limitMgPerHour }`.
 * - When `fluidMlPerHour > 0`: the drink concentration
 *   `mgPerL = mgPerHour / (fluidMlPerHour / 1000)`; above 1725 mg/L
 *   (75 mmol/L) → warning `electrolytes.concentrationHigh` with params
 *   `{ mgPerL, limitMgPerL }` (`mgPerL` rounded to whole mg for display;
 *   efsa2011 range 460–1150 mg/L).
 *
 * Non-finite or negative amounts count as 0.
 *
 * @param {number} mgPerHour
 * @param {{ fluidMlPerHour?: number }} [context]
 * @returns {Warning[]}
 */
export function sodiumWarnings(mgPerHour, { fluidMlPerHour } = {}) {
  const mg = nonNegative(mgPerHour);
  const fluid = nonNegative(fluidMlPerHour);
  /** @type {Warning[]} */
  const warnings = [];

  if (mg > SODIUM_HARD_CAP_MG_PER_HOUR) {
    warnings.push({
      id: 'electrolytes.sodiumFarAbove',
      level: 'danger',
      message: {
        key: 'electrolytes.warn.sodiumFarAbove',
        params: { mgPerHour: mg, limitMgPerHour: SODIUM_HARD_CAP_MG_PER_HOUR },
      },
      citations: ['mccubbin2023', 'hoffman2015'],
    });
  } else if (mg > SODIUM_HIGH_MG_PER_HOUR) {
    warnings.push({
      id: 'electrolytes.sodiumHigh',
      level: 'warning',
      message: {
        key: 'electrolytes.warn.sodiumHigh',
        params: { mgPerHour: mg, limitMgPerHour: SODIUM_HIGH_MG_PER_HOUR },
      },
      citations: ['mccubbin2023', 'hoffman2015'],
    });
  }

  if (fluid > 0) {
    const mgPerL = mg / (fluid / 1000);
    if (mgPerL > SODIUM_CONCENTRATION_HIGH_MG_PER_L) {
      warnings.push({
        id: 'electrolytes.concentrationHigh',
        level: 'warning',
        message: {
          key: 'electrolytes.warn.concentrationHigh',
          params: { mgPerL: Math.round(mgPerL), limitMgPerL: SODIUM_CONCENTRATION_HIGH_MG_PER_L },
        },
        citations: ['efsa2011'],
      });
    }
  }

  return warnings;
}

/**
 * Recommends hourly targets for the optional ions (potassium, magnesium,
 * calcium).
 *
 * Each enabled ion replaces half of a typical sweat loss:
 * `0.5 × sweatRateLph × SWEAT_EXTRAS_MMOL[ion] × MG_PER_MMOL[ion]`, capped at
 * K 300, Mg 50, Ca 100 mg/h. Potassium is rounded to 10 mg/h, magnesium and
 * calcium to whole mg/h. Disabled ions get 0. A non-finite or negative sweat
 * rate counts as 0.
 *
 * `why.summary` is `electrolytes.why.extras`: the ions are optional and there
 * is no evidence they prevent cramps. Citations: baker2017, montain2007.
 *
 * @param {{ sweatRateLph?: number, enabled?: { potassium?: boolean, magnesium?: boolean, calcium?: boolean } }} [input]
 * @returns {ExtrasRecommendation}
 */
export function recommendExtras({ sweatRateLph, enabled } = {}) {
  const rate = nonNegative(sweatRateLph);
  const on = {
    Potassium: enabled?.potassium === true,
    Magnesium: enabled?.magnesium === true,
    Calcium: enabled?.calcium === true,
  };

  const target = (ion, round) => {
    if (!on[ion]) return { mgPerHour: 0, enabled: false };
    const raw = REPLACEMENT_SHARE * rate * SWEAT_EXTRAS_MMOL[ion] * MG_PER_MMOL[ion];
    return { mgPerHour: round(Math.min(raw, EXTRAS_CAP_MG_PER_HOUR[ion])), enabled: true };
  };

  return {
    Potassium: target('Potassium', round10),
    Magnesium: target('Magnesium', Math.round),
    Calcium: target('Calcium', Math.round),
    why: {
      summary: { key: 'electrolytes.why.extras' },
      citations: [...EXTRAS_CITATIONS],
    },
  };
}

/**
 * Ion amounts delivered by a list of salts.
 *
 * Uses each salt's component mass fractions as sold (`electrolyteSourceOptions`
 * via `sourceDataByIdMap`); no absorption factors. Unknown ids, carb sources
 * and non-finite or negative amounts contribute nothing. Anions other than
 * chloride (citrate, bicarbonate, sulfate) are not tracked. Results are
 * unrounded.
 *
 * @param {SaltAmount[]} salts
 * @returns {IonAmounts}
 */
export function deliveredIons(salts) {
  /** @type {IonAmounts} */
  const totals = { Sodium: 0, Chloride: 0, Potassium: 0, Magnesium: 0, Calcium: 0 };
  if (!Array.isArray(salts)) return totals;

  for (const salt of salts) {
    const amount = nonNegative(salt?.amountMg);
    if (amount === 0) continue;
    for (const ion of IONS) {
      totals[ion] += amount * ionRatio(salt.id, ion);
    }
  }
  return totals;
}

/**
 * Salt amounts that deliver the given whole-activity ion totals.
 *
 * - Sodium: `sodiumSalt` `'table'` → all from table salt (31); `'citrate'` →
 *   all from sodium citrate dihydrate (33); `'mix'` → half the sodium from
 *   each. Any other value is treated as `'table'`.
 * - Potassium from potassium citrate (39), magnesium from magnesium citrate
 *   (34), calcium from calcium citrate (35).
 *
 * Amounts are rounded to whole mg and zero amounts are omitted. Non-finite or
 * negative targets count as 0. Order: sodium salts (31, 33), then 39, 34, 35.
 *
 * @param {{ sodiumMg?: number, potassiumMg?: number, magnesiumMg?: number, calciumMg?: number, sodiumSalt?: 'table'|'citrate'|'mix' }} [targets]
 * @returns {SaltAmount[]}
 */
export function saltsForTargets({ sodiumMg, potassiumMg, magnesiumMg, calciumMg, sodiumSalt } = {}) {
  const sodium = nonNegative(sodiumMg);
  const tableShare = sodiumSalt === 'citrate' ? 0 : sodiumSalt === 'mix' ? 0.5 : 1;

  /** @type {[number, number, string][]} [saltId, ion mg, ion] */
  const plan = [
    [SALT_IDS.table, sodium * tableShare, 'Sodium'],
    [SALT_IDS.citrate, sodium * (1 - tableShare), 'Sodium'],
    [SALT_IDS.potassium, nonNegative(potassiumMg), 'Potassium'],
    [SALT_IDS.magnesium, nonNegative(magnesiumMg), 'Magnesium'],
    [SALT_IDS.calcium, nonNegative(calciumMg), 'Calcium'],
  ];

  /** @type {SaltAmount[]} */
  const salts = [];
  for (const [id, ionMg, ion] of plan) {
    const ratio = ionRatio(id, ion);
    if (ionMg <= 0 || ratio <= 0) continue;
    const amountMg = Math.round(ionMg / ratio);
    if (amountMg > 0) salts.push({ id, amountMg });
  }
  return salts;
}

/**
 * Compares delivered ion amounts with targets.
 *
 * Returns one entry per tracked ion whose target or delivered amount is above
 * 0. `diff = delivered - target`. Status: `|diff| ≤ max(1, 2% of target)` →
 * `'met'`; otherwise negative → `'short'`, positive → `'over'`. Missing,
 * non-finite or negative amounts count as 0.
 *
 * @param {Partial<IonAmounts>} delivered
 * @param {Partial<IonAmounts>} targets
 * @returns {Partial<Record<Ion, IonComparison>>}
 */
export function compareIons(delivered, targets) {
  /** @type {Partial<Record<Ion, IonComparison>>} */
  const result = {};
  for (const ion of IONS) {
    const target = nonNegative(targets?.[ion]);
    const got = nonNegative(delivered?.[ion]);
    if (target <= 0 && got <= 0) continue;
    const diff = got - target;
    const tolerance = Math.max(1, 0.02 * target);
    const status = Math.abs(diff) <= tolerance ? 'met' : diff < 0 ? 'short' : 'over';
    result[ion] = { target, delivered: got, diff, status };
  }
  return result;
}
