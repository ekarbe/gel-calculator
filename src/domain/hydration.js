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
 * drink-to-thirst hint, and warnings against over-drinking.
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
 * - `mlPerHour = round50(min(sweatRateLph × 1000 × 0.8, 800))`; 0 when the
 *   sweat rate is ≤ 0 or not a number (sawka2007, hewbutler2015).
 * - `drinkToThirst = durationMin < 90 || tempC < 15` (kenefick2018). A
 *   non-finite or negative duration counts as 0; a non-finite temperature
 *   does not trigger the cold-weather rule.
 * - `range` is always the guideline range [400, 800] ml/h. Low sweat rates can
 *   give a target below 400.
 * - `warnings` are {@link fluidWarnings} for the recommended value. They are
 *   empty for every sweat rate of 0.125 L/h or more; below that, rounding to
 *   50 ml/h can lift the plan above the sweat loss and the warning says so.
 * - `why.summary` params: `mlPerHour`, `sweatMlPerHour` (whole ml), and the
 *   rule constants `sharePct` (80) and `maxMlPerHour` (800) so the text cannot
 *   drift from the rule. Rounding to 50 ml/h means the plan replaces about,
 *   not at most, 80% of sweat loss.
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
    sweat > 0 ? round50(Math.min(sweatMlPerHour * FLUID_SHARE_OF_SWEAT, FLUID_MAX_ML_PER_HOUR)) : 0;
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
 * The sweat loss is compared in whole ml/h, the same value the message
 * shows. This keeps float noise in estimated rates (0.5499999999999999 L/h)
 * from flagging an intake equal to the sweat loss (550 ml/h), and the message
 * never reads as "550 is more than 550".
 *
 * A non-finite sweat rate skips the sweat comparison. A non-finite or
 * non-positive intake returns no warnings. A missing or `null` context is
 * treated as `{}`.
 *
 * @param {number} mlPerHour  Fluid intake in ml/h.
 * @param {{ sweatRateLph?: number } | null} [context]
 * @returns {Warning[]}
 */
export function fluidWarnings(mlPerHour, context) {
  const { sweatRateLph } = context ?? {};
  if (!Number.isFinite(mlPerHour) || mlPerHour <= 0) return [];

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
