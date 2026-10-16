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

// Guard rails that keep suggestions inside published guidance. They do not
// stop users from entering their own numbers; they cap what the app
// *recommends* and drive the warnings shown next to the inputs.

// Fluid: ACSM (Sawka et al. 2007) recommends individualised drinking that
// prevents >2% body-mass loss without overdrinking; 0.4–0.8 L/h is the usual
// starting range. Drinking more than you sweat is the main driver of
// exercise-associated hyponatremia (Hew-Butler et al. 2015; Almond et al. 2005),
// and sweat-rate estimates carry about ±0.4 L/h of error, so the plan stays
// well below the estimate.
export const FLUID_MAX_ML_PER_HOUR = 800;
export const FLUID_SHARE_OF_SWEAT = 0.8;

export const FLUID_ADVICE =
  "Drink to thirst in events under 90 minutes or in cool weather. In longer or hot events, aim to lose no more than 2–3% of body weight and never gain weight: drinking more than you sweat risks hyponatremia.";

/** Suggested drinking rate: below the estimated sweat rate and the guideline ceiling. */
export function getSuggestedFluidMlPerHour(sweatRateLitersPerHour) {
  if (!(sweatRateLitersPerHour > 0)) return 0;
  return Math.min(sweatRateLitersPerHour * 1000 * FLUID_SHARE_OF_SWEAT, FLUID_MAX_ML_PER_HOUR);
}

// Sodium: guidance for prolonged exercise is roughly 300–600 mg/h, up to about
// 1,000 mg/h for long events or heavy, salty sweaters. No guideline recommends
// replacing 100% of sweat sodium (Sawka et al. 2007; McCubbin 2023; Hoffman &
// Stuempfle 2015), so estimated targets are capped here.
export const SODIUM_TARGET_MAX_MG_PER_HOUR = 1500;
export const SODIUM_HIGH_MG_PER_HOUR = 1000;

export function getSodiumWarning(sodiumPerHour, { capped = false, uncapped = 0 } = {}) {
  if (capped) {
    return `Estimated sweat sodium loss is ~${Math.round(uncapped)} mg/h. Replacing all of it is not recommended, so the target is capped at ${SODIUM_TARGET_MAX_MG_PER_HOUR} mg/h.`;
  }
  if (sodiumPerHour > SODIUM_TARGET_MAX_MG_PER_HOUR) {
    return `More than ${SODIUM_TARGET_MAX_MG_PER_HOUR} mg/h of sodium is far above published guidance (300–600 mg/h, up to ~1,000 mg/h for salty sweaters in long events).`;
  }
  if (sodiumPerHour > SODIUM_HIGH_MG_PER_HOUR) {
    return `Above ~${SODIUM_HIGH_MG_PER_HOUR} mg/h is only warranted for heavy, salty sweaters in long events. Typical guidance is 300–600 mg/h.`;
  }
  return null;
}

// Carbohydrate: >90 g/h needs a trained gut and multiple transportable
// carbohydrates, with limited evidence of extra performance benefit; 120 g/h is
// the highest intake studied so far (Jeukendrup 2014; Podlogar et al. 2022;
// Hearris et al. 2022).
export const CARBS_GUT_TRAINING_G_PER_HOUR = 90;
export const CARBS_MAX_STUDIED_G_PER_HOUR = 120;

export function getCarbIntakeWarning(carbsPerHour) {
  if (carbsPerHour > CARBS_MAX_STUDIED_G_PER_HOUR) {
    return `Above ${CARBS_MAX_STUDIED_G_PER_HOUR} g/h, the highest intake studied so far. High risk of GI distress.`;
  }
  if (carbsPerHour > CARBS_GUT_TRAINING_G_PER_HOUR) {
    return `Above ${CARBS_GUT_TRAINING_G_PER_HOUR} g/h only works with a trained gut and a glucose:fructose mix (about 1:0.8), and the extra performance benefit is unproven. Practice it in training first.`;
  }
  return null;
}

/**
 * Caps sweat-derived sodium and chloride targets together (they come from the
 * same salt) so the suggested intake stays within guidance.
 */
export function capSodiumTargets(targets) {
  const sodium = targets.Sodium || 0;
  if (sodium <= SODIUM_TARGET_MAX_MG_PER_HOUR) {
    return { targets, sodiumCapped: false, uncappedSodium: sodium };
  }
  const scale = SODIUM_TARGET_MAX_MG_PER_HOUR / sodium;
  return {
    targets: { ...targets, Sodium: sodium * scale, Chloride: (targets.Chloride || 0) * scale },
    sodiumCapped: true,
    uncappedSodium: sodium,
  };
}
