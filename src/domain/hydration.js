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
 * Fluid intake: a planned-drinking target derived from the sweat rate, the
 * drink-to-thirst hint, warnings against over-drinking, and the projected
 * body-mass change over the event.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/fluid.js`.
 */

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * @typedef {Object} FluidRecommendation
 * @property {number} mlPerHour  Planned intake in ml/h (rounded to 50).
 * @property {[number, number]} range  Typical guideline range in ml/h: [400, 800].
 * @property {boolean} drinkToThirst  True when drinking to thirst is a reasonable alternative to a plan.
 * @property {Explanation} why
 * @property {Warning[]} warnings
 */

/** Upper limit for planned drinking in ml/h (sawka2007: 0.4–0.8 L/h). */
export const FLUID_MAX_ML_PER_HOUR = 800;

/** Share of sweat loss the plan replaces. Replacing less than all of it avoids weight gain. */
export const FLUID_SHARE_OF_SWEAT = 0.8;

/** Lower end of the typical guideline range in ml/h (sawka2007). */
const FLUID_MIN_ML_PER_HOUR = 400;

/** Below this duration (min) drinking to thirst is enough (kenefick2018). */
const THIRST_MAX_DURATION_MIN = 90;
/** Below this temperature (°C) drinking to thirst is enough (kenefick2018). */
const THIRST_MAX_TEMP_C = 15;

const FLUID_CITATIONS = ['sawka2007', 'hewbutler2015', 'kenefick2018', 'almond2005'];

const round50 = (x) => Math.round(x / 50) * 50;
const floor50 = (x) => Math.floor(x / 50) * 50;

/**
 * Sweat rate in L/h as a usable number: non-finite or negative values become 0.
 * @param {unknown} sweatRateLph
 * @returns {number}
 */
const sweatOrZero = (sweatRateLph) =>
  Number.isFinite(sweatRateLph) && sweatRateLph > 0 ? sweatRateLph : 0;

/**
 * Recommends a planned fluid intake.
 *
 * - `mlPerHour = min(round50(min(sweatRateLph × 1000 × 0.8, 800)),
 *   floor50(sweat loss in whole ml/h))`; 0 when the sweat rate is ≤ 0 or not a
 *   number (sawka2007, hewbutler2015). Rounding to 50 ml/h never lifts the
 *   plan above the sweat loss: for very low sweat rates (under 0.125 L/h,
 *   which the heat-balance estimate gives in cool conditions) the target is
 *   the sweat loss rounded down to 50 ml/h.
 * - `drinkToThirst = durationMin < 90 || tempC < 15` (kenefick2018). A
 *   non-finite or negative duration counts as 0; a non-finite temperature
 *   does not trigger the cold-weather rule.
 * - `range` is always the guideline range [400, 800] ml/h. Low sweat rates can
 *   give a target below 400.
 * - `warnings` are {@link fluidWarnings} for the recommended value. They are
 *   always empty: the target is never above the sweat loss or 800 ml/h.
 * - `why.summary` params: `mlPerHour`, `sweatMlPerHour` (whole ml), and the
 *   rule constants `sharePct` (80) and `maxMlPerHour` (800) so the text cannot
 *   drift from the rule. Rounding to 50 ml/h means the plan replaces about
 *   80% of sweat loss, and never more than all of it.
 * - A missing or `null` input is treated as `{}`.
 *
 * @param {{ durationMin?: number, sweatRateLph?: number, tempC?: number } | null} [input]
 * @returns {FluidRecommendation}
 */
export function recommendFluid(input) {
  const { durationMin, sweatRateLph, tempC } = input ?? {};
  const sweat = sweatOrZero(sweatRateLph);
  const duration = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 0;
  const sweatMlPerHour = sweat * 1000;
  const mlPerHour =
    sweat > 0
      ? Math.min(round50(Math.min(sweatMlPerHour * FLUID_SHARE_OF_SWEAT, FLUID_MAX_ML_PER_HOUR)), floor50(Math.round(sweatMlPerHour)))
      : 0;
  const drinkToThirst =
    duration < THIRST_MAX_DURATION_MIN || (Number.isFinite(tempC) && tempC < THIRST_MAX_TEMP_C);

  /** @type {Message[]} */
  const details = [];
  if (drinkToThirst) details.push({ key: 'fluid.why.thirst' });

  return {
    mlPerHour,
    range: [FLUID_MIN_ML_PER_HOUR, FLUID_MAX_ML_PER_HOUR],
    drinkToThirst,
    why: {
      summary: {
        key: 'fluid.why.plan',
        params: {
          mlPerHour,
          sweatMlPerHour: Math.round(sweatMlPerHour),
          sharePct: Math.round(FLUID_SHARE_OF_SWEAT * 100),
          maxMlPerHour: FLUID_MAX_ML_PER_HOUR,
        },
      },
      details,
      citations: [...FLUID_CITATIONS],
    },
    warnings: fluidWarnings(mlPerHour, { sweatRateLph: sweat }),
  };
}

/**
 * Warnings for a fluid intake, recommended or manual.
 *
 * - Intake above the sweat rate → danger `fluid.aboveSweat`: drinking more
 *   than you sweat causes weight gain, the main risk factor for
 *   exercise-associated hyponatremia (almond2005, hewbutler2015).
 * - Otherwise intake above 800 ml/h → warning `fluid.aboveCeiling` (sawka2007).
 *
 * The intake and the sweat loss are compared in whole ml/h, the values the
 * messages show. This keeps float noise in estimated rates
 * (0.5499999999999999 L/h) from flagging an intake equal to the sweat loss
 * (550 ml/h), the message never reads as "550 is more than 550", and a
 * manual intake typed in fl oz (34 fl oz/h is stored as 1005.5 ml/h) reads
 * "1,006 ml/h" in metric, as the board shows it.
 *
 * A non-finite sweat rate skips the sweat comparison. A non-finite or
 * non-positive intake returns no warnings. A missing or `null` context is
 * treated as `{}`.
 *
 * @param {number} intakeMlPerHour  Fluid intake in ml/h.
 * @param {{ sweatRateLph?: number } | null} [context]
 * @returns {Warning[]}
 */
export function fluidWarnings(intakeMlPerHour, context) {
  const { sweatRateLph } = context ?? {};
  if (!Number.isFinite(intakeMlPerHour) || intakeMlPerHour <= 0) return [];
  const mlPerHour = Math.round(intakeMlPerHour);

  if (Number.isFinite(sweatRateLph)) {
    const sweatMlPerHour = Math.round(Math.max(0, sweatRateLph) * 1000);
    if (mlPerHour > sweatMlPerHour) {
      return [
        {
          id: 'fluid.aboveSweat',
          level: 'danger',
          message: {
            key: 'fluid.warn.aboveSweat',
            params: { mlPerHour, sweatMlPerHour },
          },
          citations: ['almond2005', 'hewbutler2015'],
        },
      ];
    }
  }

  if (mlPerHour > FLUID_MAX_ML_PER_HOUR) {
    return [
      {
        id: 'fluid.aboveCeiling',
        level: 'warning',
        message: {
          key: 'fluid.warn.aboveCeiling',
          params: { mlPerHour, maxMlPerHour: FLUID_MAX_ML_PER_HOUR },
        },
        citations: ['sawka2007'],
      },
    ];
  }

  return [];
}

/**
 * Mass lost per kcal burned that is not sweat (fuel oxidation and breathing),
 * kg (= L) per kcal: 0.20 g/kcal (cheuvront2017). The sweat test correction
 * (`src/domain/sweat.js`) and the scale projection use this one value.
 */
export const NON_SWEAT_KG_PER_KCAL = 0.0002;

/** Water deficit above which performance starts to suffer, in % of body mass (sawka2007). */
export const DEFICIT_MILD_PCT = 2;
/** Water deficit above which the plan warns, in % of body mass (sawka2007). */
export const DEFICIT_HIGH_PCT = 3;

/**
 * A non-negative finite number: missing, negative or non-finite values count as 0.
 * @param {unknown} x
 * @returns {number}
 */
const nonNegative = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
/** Turns −0 into 0 so results compare and print cleanly. */
const noNegativeZero = (x) => (x === 0 ? 0 : x);

/**
 * @typedef {Object} BodyMassProjection
 * @property {number} waterDeficitL  Sweat loss minus fluid intake over the event in L: ≤ 0 (water gain) when
 *   the level is `'gain'`, else ≥ 0.
 * @property {number} deficitPct  `100 × waterDeficitL / massKg` (0 when the mass is unknown).
 * @property {number} scaleChangeKg  Expected change on the scale in kg: `−waterDeficitL − 0.0002 × kcal`.
 * @property {'ok'|'mild'|'high'|'gain'} level  `'mild'`/`'high'` compare the percentage rounded to 0.1 %.
 * @property {Warning[]} warnings
 */

/** No projection: the result for an unknown sweat rate or a zero duration. */
const NO_PROJECTION = Object.freeze({ waterDeficitL: 0, deficitPct: 0, scaleChangeKg: 0, level: 'ok' });

/**
 * Projects the body-mass change over the event from the sweat rate and the
 * planned fluid intake.
 *
 * - `waterDeficitL = (SR − F/1000) × h`, `deficitPct = 100 × waterDeficitL /
 *   massKg` (0 when the mass is missing or not above 0) and `scaleChangeKg =
 *   −waterDeficitL − 0.0002 × energyKcalPerHour × h`: the scale also drops
 *   about 0.2 g per kcal burned (fuel oxidation and breathing; cheuvront2017),
 *   so a water gain can still show as a small loss on the scale.
 * - `level 'gain'` (danger `fluid.projectedGain`, hewbutler2015, params
 *   `gainL`, at least 0.01) uses the rule of {@link fluidWarnings}: the
 *   intake is above the sweat loss, both in whole ml/h. So the two always agree,
 *   and float noise in an estimated rate (0.5499999999999999 L/h) never turns
 *   an intake equal to the sweat loss (550 ml/h) into a gain. The numbers
 *   keep the sign of the level: when they disagree by less than 0.5 ml/h × h
 *   (rounding of the sweat rate), `waterDeficitL` is 0. With whole-ml/h
 *   intakes this happens only when the intake equals the shown sweat loss.
 * - Otherwise the level follows the percentage rounded to 0.1 %, the value
 *   the message shows (so a message never reads "2% … above 2%"): above 3 %
 *   → `'high'`, warning `fluid.deficitHigh` (sawka2007); above 2 % →
 *   `'mild'`, info `fluid.deficitMild` (sawka2007); else `'ok'`.
 * - A non-finite (unknown) sweat rate gives no projection: zeros and `'ok'`,
 *   the same way {@link fluidWarnings} skips its sweat check. A negative
 *   sweat rate counts as 0. Missing, negative or non-finite intake, duration,
 *   mass or energy count as 0. A missing or `null` input is treated as `{}`.
 *
 * @param {{ sweatRateLph?: number, fluidMlPerHour?: number, durationMin?: number,
 *   massKg?: number, energyKcalPerHour?: number } | null} [input]
 * @returns {BodyMassProjection}
 */
export function projectBodyMass(input) {
  const { sweatRateLph, fluidMlPerHour, durationMin, massKg, energyKcalPerHour } = input ?? {};
  const hours = nonNegative(durationMin) / 60;
  if (!Number.isFinite(sweatRateLph) || hours === 0) return { ...NO_PROJECTION, warnings: [] };

  const sweatLph = Math.max(0, sweatRateLph);
  const fluidMl = nonNegative(fluidMlPerHour);
  // Same comparison as fluidWarnings: the intake and the sweat loss in whole ml/h.
  const gain = Math.round(fluidMl) > Math.round(sweatLph * 1000);
  const deficit = (sweatLph - fluidMl / 1000) * hours;
  const waterDeficitL = noNegativeZero(gain ? Math.min(deficit, 0) : Math.max(deficit, 0));
  const mass = nonNegative(massKg);
  const deficitPct = noNegativeZero(mass > 0 ? (100 * waterDeficitL) / mass : 0);
  const shownPct = round1(deficitPct);
  const scaleChangeKg = noNegativeZero(
    -waterDeficitL - NON_SWEAT_KG_PER_KCAL * nonNegative(energyKcalPerHour) * hours,
  );

  /** @type {BodyMassProjection['level']} */
  let level = 'ok';
  /** @type {Warning[]} */
  const warnings = [];
  if (gain) {
    level = 'gain';
    warnings.push({
      id: 'fluid.projectedGain',
      level: 'danger',
      message: { key: 'fluid.warn.projectedGain', params: { gainL: Math.max(0.01, round2(-waterDeficitL)) } },
      citations: ['hewbutler2015'],
    });
  } else if (shownPct > DEFICIT_HIGH_PCT) {
    level = 'high';
    warnings.push({
      id: 'fluid.deficitHigh',
      level: 'warning',
      message: {
        key: 'fluid.warn.deficitHigh',
        params: { deficitL: round1(waterDeficitL), deficitPct: shownPct, limitPct: DEFICIT_HIGH_PCT },
      },
      citations: ['sawka2007'],
    });
  } else if (shownPct > DEFICIT_MILD_PCT) {
    level = 'mild';
    warnings.push({
      id: 'fluid.deficitMild',
      level: 'info',
      message: {
        key: 'fluid.warn.deficitMild',
        params: { deficitL: round1(waterDeficitL), deficitPct: shownPct, limitPct: DEFICIT_MILD_PCT },
      },
      citations: ['sawka2007'],
    });
  }

  return { waterDeficitL, deficitPct, scaleChangeKg, level, warnings };
}
