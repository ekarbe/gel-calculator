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
 * Carbohydrate domain logic: evidence-based g/h targets, glucose:fructose ratio
 * guidance and intake warnings. (The ingredient solver is `src/domain/solver.js`.)
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/carbs.js`.
 */

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/** @typedef {'easy'|'moderate'|'hard'|'race'} Intensity */
/** @typedef {'none'|'rinse'|'short'|'medium'|'long'|'veryHigh'} CarbBand */
/** @typedef {{ glucose: number, fructose: number }} Ratio */

/**
 * @typedef {Object} CarbRecommendation
 * @property {number} gPerHour  Recommended intake in g/h (rounded to 5).
 * @property {[number, number]} range  Evidence range [lo, hi] in g/h for the band.
 * @property {CarbBand} band
 * @property {boolean} mouthRinse  True when a carbohydrate mouth rinse is a useful option.
 * @property {{ summary: Message, citations: string[] }|null} mouthRinseHowTo  How to do the mouth
 *   rinse (one message and its studies) when `mouthRinse` is true, else `null`. Every view that
 *   mentions the rinse shows this one text.
 * @property {Explanation} why
 * @property {Warning[]} warnings
 */

/**
 * @typedef {Object} RatioRecommendation
 * @property {number} minShare  Lowest acceptable fructose share of total carbs.
 * @property {number} maxShare  Highest acceptable fructose share (always 0.5).
 * @property {number} recommendedShare  Recommended fructose share.
 * @property {{ glucose: 1, fructose: number }} ratio  Recommended ratio in parts (fructose rounded to 2 decimals).
 * @property {Explanation} why
 */

/** Exercise intensities understood by {@link recommendCarbs}. */
export const INTENSITIES = ['easy', 'moderate', 'hard', 'race'];

const BAND_DEFS = {
  none: { range: [0, 0], citations: ['thomas2016', 'jeukendrup2014'] },
  rinse: { range: [0, 30], citations: ['jeukendrup2014', 'carter2004', 'brietzke2019'] },
  short: { range: [30, 45], citations: ['jeukendrup2014', 'thomas2016'] },
  medium: { range: [45, 60], citations: ['jeukendrup2014', 'thomas2016', 'burke2011'] },
  long: { range: [60, 90], citations: ['jeukendrup2014', 'burke2011', 'smith2013'] },
  veryHigh: { range: [90, 120], citations: ['podlogar2022', 'hearris2022', 'jeukendrup2017'] },
};

/** Studies behind the glucose:fructose ratio rules (also cited by the ingredient solver). */
export const RATIO_CITATIONS = Object.freeze(['jeukendrup2014', 'rowlands2015', 'obrien2013', 'podlogar2022', 'wallis2005']);

/** Fructose share of 2:1 (1:0.5) glucose:fructose. */
const SHARE_2_TO_1 = 1 / 3;
/** Fructose share of 1:0.8 glucose:fructose. */
const SHARE_1_TO_08 = 0.8 / 1.8;
const MAX_FRUCTOSE_SHARE = 0.5;
const RATIO_TOLERANCE = 0.02;

const STUDIED_MAX_G_PER_HOUR = 120;
const GUT_TRAINING_ABOVE_G_PER_HOUR = 90;

/**
 * The high-carb (gut-trained) opt-in only applies to events longer than this,
 * in minutes (the `veryHigh` band). Exported so the UI shows its switch on the
 * same rule.
 */
export const HIGH_CARB_MIN_DURATION_MIN = 150;

/** Studies behind the carbohydrate mouth rinse protocol. */
const MOUTH_RINSE_CITATIONS = ['carter2004', 'brietzke2019'];

const round5 = (x) => Math.round(x / 5) * 5;
const round2 = (x) => Math.round(x * 100) / 100;

/** Non-negative finite number or 0. */
const nonNegative = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

/**
 * Hourly intake for threshold checks: NaN, non-numbers and negatives → 0.
 * +Infinity is kept, so a larger intake never produces fewer warnings.
 */
const intake = (x) => (typeof x === 'number' && x > 0 ? x : 0);

const gutTrainingWarning = () => ({
  id: 'carbs.gutTraining',
  level: 'warning',
  message: { key: 'carbs.warn.gutTraining' },
  citations: ['jeukendrup2017', 'cox2010'],
});

/**
 * Picks the duration band for an event.
 * @param {number} durationMin  Sanitised duration (finite, >= 0).
 * @param {boolean} highCarb
 * @returns {CarbBand}
 */
function bandFor(durationMin, highCarb) {
  if (durationMin < 45) return 'none';
  if (durationMin < 75) return 'rinse';
  if (durationMin < 120) return 'short';
  if (durationMin <= HIGH_CARB_MIN_DURATION_MIN) return 'medium';
  return highCarb ? 'veryHigh' : 'long';
}

/**
 * Recommends an hourly carbohydrate intake from event duration and intensity.
 *
 * Duration picks an evidence band (jeukendrup2014, thomas2016, burke2011; the
 * optional high-carb band follows podlogar2022 and hearris2022). Intensity
 * places the target inside the band and never pushes it above the band:
 * easy → lo × 0.8, moderate → midpoint, hard and race → hi. The result is
 * rounded to the nearest 5 g/h.
 *
 * Warnings: info `carbs.highCarbLongOnly` when `highCarb` is set for an event
 * of 150 min or less (it is ignored); warning `carbs.gutTraining`
 * (jeukendrup2017, cox2010) when the target is above 90 g/h. In the
 * `veryHigh` band that is every intensity except easy, whose 80% of the low end
 * (70 g/h) needs no gut training.
 *
 * @param {Object} input
 * @param {number} input.durationMin  Event duration in minutes. Non-finite or negative → 0.
 * @param {Intensity|string} [input.intensity]  Unknown values are treated as `moderate`.
 * @param {boolean} [input.highCarb=false]  Opt in to 90–120 g/h for events longer than 150 min.
 * @returns {CarbRecommendation}
 */
export function recommendCarbs({ durationMin, intensity, highCarb = false } = {}) {
  const d = nonNegative(durationMin);
  const level = INTENSITIES.includes(intensity) ? intensity : 'moderate';
  const wantsHighCarb = Boolean(highCarb);
  const band = bandFor(d, wantsHighCarb);
  const { range, citations } = BAND_DEFS[band];
  const [lo, hi] = range;

  let raw;
  if (level === 'easy') raw = lo * 0.8;
  else if (level === 'moderate') raw = (lo + hi) / 2;
  else raw = hi;
  const gPerHour = round5(raw);

  /** @type {Warning[]} */
  const warnings = [];
  if (wantsHighCarb && d <= HIGH_CARB_MIN_DURATION_MIN) {
    warnings.push({
      id: 'carbs.highCarbLongOnly',
      level: 'info',
      message: { key: 'carbs.warn.highCarbLongOnly' },
    });
  }
  // The warning is about the intake, not the band: easy intensity in the
  // high-carb band stays at 70 g/h, where no gut training is needed.
  if (gPerHour > GUT_TRAINING_ABOVE_G_PER_HOUR) warnings.push(gutTrainingWarning());

  const mouthRinse = band === 'rinse';
  return {
    gPerHour,
    range: [lo, hi],
    band,
    mouthRinse,
    mouthRinseHowTo: mouthRinse
      ? { summary: { key: 'carbs.mouthRinse.howTo' }, citations: [...MOUTH_RINSE_CITATIONS] }
      : null,
    why: {
      summary: { key: `carbs.why.${band}`, params: { lo, hi, gPerHour } },
      details: [{ key: `carbs.why.intensity.${level}` }],
      citations: [...citations],
    },
    warnings,
  };
}

/**
 * Recommends a glucose:fructose ratio for an hourly carbohydrate intake
 * (jeukendrup2014, rowlands2015, obrien2013, podlogar2022, wallis2005).
 *
 * Fructose share = fructose-pathway carbs / total carbs. Up to 60 g/h glucose
 * alone works (minShare 0) and 2:1 is recommended. Above 60 g/h 2:1 is the
 * minimum. Above 90 g/h the share rises linearly to 1:0.8 at 120 g/h. The
 * maximum share is always 0.5 (never more fructose than glucose).
 *
 * @param {number} gPerHour  Hourly carbohydrate intake. NaN, non-numbers or negative → 0.
 *   +Infinity falls in the top tier, with the share capped at the 120 g/h value.
 * @returns {RatioRecommendation}
 */
export function recommendRatio(gPerHour) {
  const g = intake(gPerHour);
  let minShare;
  let recommendedShare;
  let tier;
  if (g <= 60) {
    minShare = 0;
    recommendedShare = SHARE_2_TO_1;
    tier = 'low';
  } else if (g <= 90) {
    minShare = SHARE_2_TO_1;
    recommendedShare = SHARE_2_TO_1;
    tier = 'medium';
  } else {
    const t = (Math.min(g, 120) - 90) / 30;
    minShare = SHARE_2_TO_1 + t * (SHARE_1_TO_08 - SHARE_2_TO_1);
    recommendedShare = minShare;
    tier = 'high';
  }
  const fructose = round2(recommendedShare / (1 - recommendedShare));
  return {
    minShare,
    maxShare: MAX_FRUCTOSE_SHARE,
    recommendedShare,
    ratio: { glucose: 1, fructose },
    why: {
      summary: { key: `carbs.ratio.why.${tier}`, params: { gPerHour: g, fructose } },
      citations: [...RATIO_CITATIONS],
    },
  };
}

/**
 * Fructose share of a glucose:fructose ratio given in parts.
 * Negative or non-finite parts count as 0.
 *
 * @param {Ratio} ratio
 * @returns {number} fructose / (glucose + fructose); 0 when both are 0.
 */
export function ratioShare({ glucose, fructose } = {}) {
  const g = nonNegative(glucose);
  const f = nonNegative(fructose);
  const total = g + f;
  return total > 0 ? f / total : 0;
}

/**
 * A glucose:fructose ratio as text, normalised to glucose 1 with the fructose
 * part rounded to 2 decimals and trailing zeros trimmed: `{ glucose: 2,
 * fructose: 1 }` → `"1:0.5"`, `{ glucose: 0.95, fructose: 0.85 }` → `"1:0.89"`.
 * Without glucose it is `"0:1"`; without either part `"0:0"`. Negative or
 * non-finite parts count as 0. Every view and message that shows a ratio uses
 * this one form.
 *
 * @param {Ratio|null|undefined} ratio  Ratio in parts.
 * @returns {string}
 */
export function formatRatio(ratio) {
  const g = nonNegative(ratio?.glucose);
  const f = nonNegative(ratio?.fructose);
  const parts = g > 0 ? round2(f / g) : Infinity;
  // A glucose part so small that the quotient overflows reads as no glucose.
  if (Number.isFinite(parts)) return `1:${parts}`;
  return f > 0 ? '0:1' : '0:0';
}

/**
 * Checks a user-chosen glucose:fructose ratio against {@link recommendRatio}.
 * Allows 0.02 of slack on the fructose share at both ends.
 *
 * @param {number} gPerHour  Hourly carbohydrate intake. NaN, non-numbers or negative → 0.
 * @param {Ratio} ratio  Ratio in parts.
 * @returns {Warning[]}
 */
export function checkRatio(gPerHour, { glucose, fructose } = {}) {
  const g = nonNegative(glucose);
  const f = nonNegative(fructose);
  if (g + f <= 0) {
    return [{
      id: 'carbs.noRatio',
      level: 'danger',
      message: { key: 'carbs.warn.noRatio' },
      citations: [...RATIO_CITATIONS],
    }];
  }
  const share = ratioShare({ glucose: g, fructose: f });
  const { minShare } = recommendRatio(gPerHour);
  /** @type {Warning[]} */
  const warnings = [];
  if (share < minShare - RATIO_TOLERANCE) {
    warnings.push({
      id: 'carbs.tooLittleFructose',
      level: 'warning',
      message: {
        key: 'carbs.warn.tooLittleFructose',
        params: { gPerHour: intake(gPerHour), minRatio: `1:${round2(minShare / (1 - minShare))}` },
      },
      citations: [...RATIO_CITATIONS],
    });
  }
  if (share > MAX_FRUCTOSE_SHARE + RATIO_TOLERANCE) {
    warnings.push({
      id: 'carbs.tooMuchFructose',
      level: 'warning',
      message: { key: 'carbs.warn.tooMuchFructose' },
      citations: [...RATIO_CITATIONS],
    });
  }
  return warnings;
}

/**
 * Evidence warnings for an hourly carbohydrate intake, whether recommended or
 * entered manually.
 *
 * - above 120 g/h → danger `carbs.aboveStudied` (podlogar2022, hearris2022)
 * - above 90 g/h → warning `carbs.gutTraining` (jeukendrup2017, cox2010). It is
 *   returned even when {@link recommendCarbs} already raised it for the
 *   high-carb band; the plan de-duplicates warnings by id.
 *
 * @param {number} gPerHour  Hourly carbohydrate intake. NaN or non-number → no
 *   warnings. +Infinity gets both warnings.
 * @param {{ durationMin?: number, highCarb?: boolean }} [context]  Accepted for API
 *   symmetry with {@link recommendCarbs}; it does not change the result.
 * @returns {Warning[]}
 */
export function carbIntakeWarnings(gPerHour, context = {}) {
  if (typeof gPerHour !== 'number' || Number.isNaN(gPerHour)) return [];
  /** @type {Warning[]} */
  const warnings = [];
  if (gPerHour > STUDIED_MAX_G_PER_HOUR) {
    warnings.push({
      id: 'carbs.aboveStudied',
      level: 'danger',
      message: { key: 'carbs.warn.aboveStudied', params: { gPerHour } },
      citations: ['podlogar2022', 'hearris2022'],
    });
  }
  if (gPerHour > GUT_TRAINING_ABOVE_G_PER_HOUR) warnings.push(gutTrainingWarning());
  return warnings;
}

/**
 * Energy from carbohydrate at 4 kcal/g.
 * @param {number} totalCarbsG  Grams of carbohydrate. Non-finite or negative → 0.
 * @returns {number} kcal
 */
export function carbCalories(totalCarbsG) {
  return nonNegative(totalCarbsG) * 4;
}
