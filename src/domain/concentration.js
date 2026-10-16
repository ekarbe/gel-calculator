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
 * Water, concentration and osmolality of a gel batch or of drink bottles.
 *
 * - Density of a sugar solution from the dissolved-solids mass fraction
 *   (specific-volume fit: water 1/0.9982 ml/g, solids 0.625 ml/g; within
 *   0.6 % of the ICUMSA sucrose table up to 70 % w/w).
 * - Osmolality as `1000 × Σ(g·q) / water g` with the solutes' osmoles per
 *   gram as purchased (`osmPerG`) and the water in the ingredients
 *   (`waterFraction`) counted as solvent. Sugars are taken as ideal
 *   (osmotic coefficient 1): this matches Vist & Maughan 1995 at 40 g/L and
 *   reads about 10 % low at gel strength.
 * - A gel batch is made up to a carbohydrate % w/w preset; a drink is split
 *   into equal bottles that together hold the plan's fluid, so drinking the
 *   plan's fluid finishes every bottle and delivers all of its carbs and salts.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Arguments are
 * never mutated. Functions never return English text; they return message
 * descriptors whose keys live in `src/i18n/en/concentration.js`.
 */

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */
/** @typedef {'isotonic'|'liquid'|'standard'|'thick'} GelConsistency */
/** @typedef {'hypotonic'|'isotonic'|'hypertonic'} Tonicity */

/**
 * One solute-carrying ingredient for {@link osmolality}.
 * @typedef {Object} OsmoComponent
 * @property {number} grams  Mass as purchased, g.
 * @property {number} osmPerG  Effective mOsm per gram as purchased.
 * @property {number} [waterFraction]  Share of the mass that is water (syrups, crystal water), 0–1. Default 0.
 */

/**
 * A carb ingredient in a batch: a solver item merged with its profile.
 * @typedef {Object} CarbItem
 * @property {number|string} [ref]  Source id (number) or custom key ('c1').
 * @property {string} [label]
 * @property {number} [carbsG]  Carbohydrate it delivers, g.
 * @property {number} [glucoseG]
 * @property {number} [fructoseG]
 * @property {number} grams  Mass as purchased, g.
 * @property {number} osmPerG  mOsm per gram as purchased.
 * @property {number} waterFraction  Share of the mass that is water, 0–1.
 */

/**
 * A salt in a batch.
 * @typedef {Object} SaltItem
 * @property {number} grams  Mass, g.
 * @property {number} osmPerG  Effective mOsm per gram.
 * @property {number} [waterFraction]  Optional crystal water share, 0–1. Default 0.
 */

/**
 * @typedef {Object} OsmolalityResult
 * @property {number} mOsmPerKg  Osmolality, mOsm per kg of water. 0 without solutes; `Infinity` with solutes but no water.
 * @property {number} waterG  Water in the mix: added water plus the water inside the ingredients, g.
 * @property {Tonicity} tonicity
 */

/** Carbohydrate % w/w of each gel consistency preset (research notes D; Maurten 62.5 %, GU ~69 %, SiS ~32 %). */
export const GEL_CONSISTENCY_PCT = Object.freeze({ isotonic: 33, liquid: 45, standard: 60, thick: 70 });

/** Consistency used when the input names none or an unknown one. */
export const DEFAULT_GEL_CONSISTENCY = 'standard';

/**
 * Upper bounds of the tonicity bands in mOsm/kg: below 270 hypotonic,
 * 270–330 isotonic, above 330 hypertonic (efsa2011: 200–330 mOsm/kg for
 * carbohydrate-electrolyte solutions).
 */
export const TONICITY_BANDS = Object.freeze({ hypotonic: 270, isotonic: 330 });

/** Density of water at 20 °C, g/ml. */
export const WATER_DENSITY_G_PER_ML = 0.9982;

/** Apparent specific volume of dissolved sugars and salts, ml/g (fit to the ICUMSA sucrose table). */
export const SOLIDS_SPECIFIC_VOLUME_ML_PER_G = 0.625;

/** Gel osmolality above which the gel should be taken with water, mOsm/kg (vist1995). */
export const GEL_WITH_WATER_MOSM = 600;

/** Carbohydrate concentration a gel plus its water should reach in the stomach, g/ml (pfeiffer2010: about 10 %). */
export const GEL_WATER_CARB_FRACTION = 0.1;

/** Dextrose source ids that can crystallise out of a gel: anhydrous (1) and monohydrate (8). Glucose syrup is not included. */
export const CRYSTALLISING_GLUCOSE_REFS = Object.freeze([1, 8]);

/**
 * Dextrose concentration in the gel's water, `dextrose / (dextrose + water)`,
 * above which it may crystallise. Glucose dissolves to about 48 % w/w at
 * 25 °C (research notes D); solubility is a limit relative to the water, so
 * the other sugars in the gel are not counted. 0.45 leaves a small margin.
 */
export const CRYSTALLISE_GLUCOSE_FRACTION = 0.45;

/** Drink strength in % w/v above which the drink is strong (research notes D: 4–8 % default). */
export const DRINK_STRONG_PCT = 8;

/** Drink strength in % w/v above which the drink is too strong (research notes D: up to 10–12 % with glucose+fructose). */
export const DRINK_TOO_STRONG_PCT = 12;

/** Drink osmolality from which it is very hypertonic, mOsm/kg (vist1995, shi1995). */
export const VERY_HYPERTONIC_MOSM = 600;

/** Sodium range of a carbohydrate-electrolyte drink in mg/L: 20–50 mmol/L (efsa2011). */
export const EFSA_SODIUM_MG_PER_L = Object.freeze([460, 1150]);

/** Bottle size used when the input has none (or not above 0), ml. */
export const DEFAULT_BOTTLE_ML = 750;

const DRINK_CITATIONS = ['vist1995', 'shi1995'];

/** Grams below which a shortfall of added water is float noise, not syrup water. */
const MASS_EPSILON_G = 1e-6;

const round1 = (x) => Math.round(x * 10) / 10;
const round10 = (x) => Math.round(x / 10) * 10;

/**
 * A non-negative finite number: missing, negative or non-finite values count as 0.
 * @param {unknown} x
 * @returns {number}
 */
const nonNegative = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

/**
 * A fraction in [0, 1]: missing or non-finite values count as 0.
 * @param {unknown} x
 * @returns {number}
 */
const unitFraction = (x) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * The plain-object entries of a list; anything else counts as an empty list.
 * @param {unknown} list
 * @returns {Object[]}
 */
const entries = (list) => (Array.isArray(list) ? list.filter((x) => x !== null && typeof x === 'object') : []);

/**
 * Normalises an ingredient to `{ grams, osmPerG, waterFraction }` with safe numbers.
 * @param {Object} item
 * @returns {{ grams: number, osmPerG: number, waterFraction: number }}
 */
const component = (item) => ({
  grams: nonNegative(item.grams),
  osmPerG: nonNegative(item.osmPerG),
  waterFraction: unitFraction(item.waterFraction),
});

/** Dissolved solids of normalised components, g. */
const solidsOf = (components) => components.reduce((sum, c) => sum + c.grams * (1 - c.waterFraction), 0);
/** Water inside normalised components, g. */
const waterOf = (components) => components.reduce((sum, c) => sum + c.grams * c.waterFraction, 0);
/** Mass of normalised components as purchased, g. */
const massOf = (components) => components.reduce((sum, c) => sum + c.grams, 0);

/**
 * Volume (ml) that ingredients take up in a solution: `0.625 × dry solids g
 * + the water inside them` (1 g of water = 1 ml). The drink's added water is
 * the fill mark minus this volume.
 * @param {OsmoComponent[]} components  `{ grams, waterFraction }` (other fields are ignored). Bad numbers count
 *   as 0; entries that are not objects are skipped.
 * @returns {number}
 */
export function ingredientVolumeMl(components) {
  const list = entries(components).map(component);
  return SOLIDS_SPECIFIC_VOLUME_ML_PER_G * solidsOf(list) + waterOf(list);
}

/**
 * The carbohydrate total: `totalCarbsG` when it is a finite number (negative
 * counts as 0), else the sum of the items' `carbsG`.
 * @param {unknown} totalCarbsG
 * @param {Object[]} items
 * @returns {number}
 */
function carbTotal(totalCarbsG, items) {
  if (Number.isFinite(totalCarbsG)) return Math.max(0, totalCarbsG);
  return items.reduce((sum, item) => sum + nonNegative(item.carbsG), 0);
}

/**
 * Density of a sugar or salt solution from its dissolved-solids mass fraction:
 * `ρ = 1 / ((1 − w)/0.9982 + 0.625·w)` g/ml (research notes D). Gives 1.037 at
 * 10 %, 1.229 at 50 % and 1.355 at 70 % w/w. `w` is clamped to [0, 1];
 * missing or non-finite counts as 0 (pure water).
 *
 * @param {number} solidsFraction  Dissolved solids / total mass, 0–1.
 * @returns {number} Density in g/ml.
 */
export function solutionDensity(solidsFraction) {
  const w = unitFraction(solidsFraction);
  return 1 / ((1 - w) / WATER_DENSITY_G_PER_ML + SOLIDS_SPECIFIC_VOLUME_ML_PER_G * w);
}

/** From this osmolality (mOsm/kg) values are shown rounded to 100 (research notes C: gels read about 10 % low). */
export const OSMOLALITY_COARSE_FROM_MOSM = 1000;

/**
 * An osmolality as every view and message shows it: whole mOsm/kg, and from
 * {@link OSMOLALITY_COARSE_FROM_MOSM} rounded to 100 (4,237 → 4,200). Non-finite
 * values other than `Infinity` count as 0.
 * @param {number} mOsmPerKg
 * @returns {number}
 */
export function roundOsmolality(mOsmPerKg) {
  if (mOsmPerKg === Infinity) return Infinity;
  const value = nonNegative(mOsmPerKg);
  return value >= OSMOLALITY_COARSE_FROM_MOSM ? Math.round(value / 100) * 100 : Math.round(value);
}

/**
 * Tonicity band of an osmolality: below 270 hypotonic, 270–330 isotonic,
 * above 330 hypertonic ({@link TONICITY_BANDS}). The value is classified in
 * whole mOsm/kg, as it is shown, so 330.4 is isotonic. Non-finite values
 * other than `Infinity` count as 0.
 *
 * @param {number} mOsmPerKg
 * @returns {Tonicity}
 */
export function tonicityOf(mOsmPerKg) {
  const value = mOsmPerKg === Infinity ? Infinity : Math.round(nonNegative(mOsmPerKg));
  if (value < TONICITY_BANDS.hypotonic) return 'hypotonic';
  if (value <= TONICITY_BANDS.isotonic) return 'isotonic';
  return 'hypertonic';
}

/**
 * Osmolality of a mix (research notes C):
 * `mOsm/kg = 1000 × Σ(g_i × q_i) / (addedWaterG + Σ g_i × waterFraction_i)`.
 *
 * - The water inside syrups and crystal water count as solvent.
 * - Sugars are ideal (φ = 1); salts carry their effective osmotic
 *   coefficient in `osmPerG`.
 * - Without solutes the osmolality is 0. With solutes but no water at all it
 *   is `Infinity` (tonicity `'hypertonic'`).
 * - Missing, negative or non-finite numbers count as 0; entries that are not
 *   objects are skipped; a `waterFraction` is clamped to [0, 1].
 *
 * @param {OsmoComponent[]} components
 * @param {number} addedWaterG  Water added on top of the ingredients, g.
 * @returns {OsmolalityResult}
 */
export function osmolality(components, addedWaterG) {
  const list = entries(components).map(component);
  const solutes = list.reduce((sum, c) => sum + c.grams * c.osmPerG, 0);
  const waterG = nonNegative(addedWaterG) + waterOf(list);
  let mOsmPerKg = 0;
  if (waterG > 0) mOsmPerKg = (1000 * solutes) / waterG;
  else if (solutes > 0) mOsmPerKg = Infinity;
  return { mOsmPerKg, waterG, tonicity: tonicityOf(mOsmPerKg) };
}

/**
 * @typedef {Object} GelBatch
 * @property {number} addedWaterMl  Water to add to the ingredients, ml (1 g = 1 ml).
 * @property {number} totalMassG  Ingredients plus added water, g.
 * @property {number} solidsFraction  Dissolved solids (dry carbs and salts) / total mass.
 * @property {number} densityGPerMl  {@link solutionDensity} of the batch.
 * @property {number} volumeMl  Total mass / density.
 * @property {{ massG: number, volumeMl: number, carbsG: number }} perServing
 * @property {OsmolalityResult} osmolality
 * @property {number} waterToDrinkMlPerServing  Water to drink with each gel, ml (rounded to 10).
 * @property {number} targetPct  Carbohydrate % w/w of the consistency preset.
 * @property {number} carbPct  Carbohydrate % w/w the batch reaches (below the target when syrups bring more water).
 * @property {GelConsistency} consistency  The preset used.
 * @property {Warning[]} warnings
 */

/**
 * Water and concentration of a gel batch made up to a consistency preset.
 *
 * - Target mass `= totalCarbsG / (pct/100)` with `pct` from
 *   {@link GEL_CONSISTENCY_PCT} (unknown consistency → `'standard'`, 60 %).
 * - Added water `= max(0, target − Σ ingredient grams)`, carbs and salts as
 *   purchased, so syrup water counts toward the water. When the ingredients
 *   alone are heavier than the target, no water is added and the batch is
 *   thinner than the preset → info `concentration.syrupsThinner` (params
 *   `pct` reached and `targetPct`, one decimal).
 * - Solids = dry carbs (`grams × (1 − waterFraction)`) + salts. Density from
 *   {@link solutionDensity}, volume = mass / density.
 * - Per serving = totals / `servings` (missing, non-finite or ≤ 0 → 1).
 * - `waterToDrinkMlPerServing = round10(max(0, carbsPerServing/0.10 −
 *   massPerServing))`, so gel plus water is about 10 % carbohydrate
 *   (pfeiffer2010).
 * - Osmolality of the whole batch from {@link osmolality} with the added water.
 * - Warnings: osmolality above 600 (whole mOsm/kg) → info
 *   `concentration.gelTakeWithWater` (params `waterMl`; vist1995,
 *   pfeiffer2010). Dextrose (ids 1 and 8, not glucose syrup) above 45 % of
 *   the solution it makes with the gel's water, `dextrose / (dextrose +
 *   water)` in whole %, → warning `concentration.crystallise` (params
 *   `glucosePct`, `limitPct`). The water is the added water plus the water
 *   inside the ingredients (crystal water included); the dextrose mass is
 *   the item's `carbsG`, or its dry grams without one.
 * - `totalCarbsG` missing or non-finite → the sum of the items' `carbsG`;
 *   negative → 0. Without carbohydrate no water is added and there are no
 *   warnings. Bad numbers in the items count as 0. A missing or `null` input
 *   is treated as `{}`.
 *
 * @param {{ carbItems?: CarbItem[], saltItems?: SaltItem[], totalCarbsG?: number, servings?: number,
 *   consistency?: GelConsistency } | null} [input]
 * @returns {GelBatch}
 */
export function gelBatch(input) {
  const { carbItems, saltItems, totalCarbsG, servings, consistency } = input ?? {};
  const carbEntries = entries(carbItems);
  const carbs = carbEntries.map(component);
  const salts = entries(saltItems).map(component);
  const all = [...carbs, ...salts];

  const carbsG = carbTotal(totalCarbsG, carbEntries);
  const preset = Object.hasOwn(GEL_CONSISTENCY_PCT, consistency) ? consistency : DEFAULT_GEL_CONSISTENCY;
  const targetPct = GEL_CONSISTENCY_PCT[preset];

  const ingredientG = massOf(all);
  const shortfallG = carbsG > 0 ? carbsG / (targetPct / 100) - ingredientG : 0;
  const addedWaterG = Math.max(0, shortfallG);
  const totalMassG = ingredientG + addedWaterG;
  const solidsFraction = totalMassG > 0 ? Math.min(1, solidsOf(all) / totalMassG) : 0;
  const densityGPerMl = solutionDensity(solidsFraction);
  const volumeMl = totalMassG / densityGPerMl;
  const carbPct = totalMassG > 0 ? (100 * carbsG) / totalMassG : 0;

  const count = Number.isFinite(servings) && servings > 0 ? servings : 1;
  const perServing = { massG: totalMassG / count, volumeMl: volumeMl / count, carbsG: carbsG / count };
  const waterToDrinkMlPerServing = round10(
    Math.max(0, perServing.carbsG / GEL_WATER_CARB_FRACTION - perServing.massG),
  );
  const osmo = osmolality(all, addedWaterG);

  /** @type {Warning[]} */
  const warnings = [];
  if (carbsG > 0) {
    if (shortfallG < -MASS_EPSILON_G && round1(carbPct) < targetPct) {
      warnings.push({
        id: 'concentration.syrupsThinner',
        level: 'info',
        message: { key: 'concentration.warn.syrupsThinner', params: { pct: round1(carbPct), targetPct } },
      });
    }
    const dextroseG = carbEntries.reduce((sum, item, i) => {
      if (!CRYSTALLISING_GLUCOSE_REFS.includes(item.ref)) return sum;
      const dry = Number.isFinite(item.carbsG) ? nonNegative(item.carbsG) : carbs[i].grams * (1 - carbs[i].waterFraction);
      return sum + dry;
    }, 0);
    // Solubility is relative to the water, so fructose and maltodextrin do not
    // dilute the dextrose here (they only lower its solubility further).
    const glucosePct = dextroseG > 0 ? Math.round((100 * dextroseG) / (dextroseG + osmo.waterG)) : 0;
    const limitPct = Math.round(CRYSTALLISE_GLUCOSE_FRACTION * 100);
    if (glucosePct > limitPct) {
      warnings.push({
        id: 'concentration.crystallise',
        level: 'warning',
        message: { key: 'concentration.warn.crystallise', params: { glucosePct, limitPct } },
      });
    }
    if (Math.round(osmo.mOsmPerKg) > GEL_WITH_WATER_MOSM) {
      warnings.push({
        id: 'concentration.gelTakeWithWater',
        level: 'info',
        message: { key: 'concentration.warn.gelTakeWithWater', params: { waterMl: waterToDrinkMlPerServing } },
        citations: ['vist1995', 'pfeiffer2010'],
      });
    }
  }

  return {
    addedWaterMl: addedWaterG,
    totalMassG,
    solidsFraction,
    densityGPerMl,
    volumeMl,
    perServing,
    osmolality: osmo,
    waterToDrinkMlPerServing,
    targetPct,
    carbPct,
    consistency: preset,
    warnings,
  };
}

/**
 * @typedef {Object} DrinkBottles
 * @property {number} bottles  Number of bottles; 0 without fluid.
 * @property {number} bottleMl  Bottle size used, ml.
 * @property {{ carbsG: number, sodiumMg: number, carbPctWv: number, sodiumMgPerL: number,
 *   osmolality: OsmolalityResult, addedWaterMl: number, fillMl: number }} perBottle
 *   `fillMl` is how far to fill each bottle (`totalFluidMl / bottles`, at most `bottleMl`).
 * @property {Warning[]} warnings
 */

/**
 * Splits the drink's carbs and salts into equal bottles that together hold
 * the plan's fluid.
 *
 * - `bottles = max(1, ceil(totalFluidMl / bottleMl))` when `totalFluidMl > 0`;
 *   otherwise 0 bottles, zero per-bottle values and warning
 *   `concentration.noFluidForDrink`.
 * - Each bottle is filled to `fillMl = totalFluidMl / bottles` (at most
 *   `bottleMl`), so the plan's fluid finishes every bottle and delivers all
 *   the carbs and sodium. When the fluid is a multiple of the bottle size this
 *   is the bottle mark. (Deviation from spec section 4, which filled every
 *   bottle to `bottleMl`: the athlete then drank only part of the mix.)
 * - Per bottle = totals / bottles (carbs, sodium and every ingredient).
 *   `carbPctWv = carbsG / fillMl × 100`, `sodiumMgPerL = sodiumMg / fillMl × 1000`,
 *   which equal the plan's totals per litre of fluid.
 * - Filled to `fillMl`, the bottle holds `fillMl − 0.625 × dry solids g` of
 *   water. Water inside syrups is part of it, so
 *   `addedWaterMl = max(0, fillMl − 0.625 × dry solids − ingredient water)`.
 *   The osmolality uses that added water.
 * - When the ingredients alone take up the whole fill (`0.625 × dry solids +
 *   ingredient water ≥ fillMl`), the drink cannot be mixed: warning
 *   `concentration.drinkDoesNotFit` (params `ingredientsMl`, `fillMl`, whole
 *   ml) and no other composition warnings, so no message shows an infinite
 *   osmolality.
 * - Otherwise: `carbPctWv > 12` → warning `concentration.drinkTooStrong`, else
 *   `> 8` → info `concentration.drinkStrong` (params `pct`, `limitPct`);
 *   osmolality ≥ 600 → warning `concentration.veryHypertonic`, else `> 330` →
 *   info `concentration.hypertonic` (params `mOsm`, `limit`; vist1995,
 *   shi1995); sodium below 460 or above 1150 mg/L → info
 *   `concentration.sodiumOutsideEfsa` (params `mgPerL`, `lo`, `hi`; efsa2011).
 *   Thresholds compare the values the messages show (% to one decimal,
 *   mOsm/kg from {@link roundOsmolality}, as the recipe shows it, and whole
 *   mg/L). A bottle of plain water (no carbs, no sodium, no
 *   solutes) gets no composition warnings.
 * - `bottleMl` missing or not above 0 → 750. `totalCarbsG` missing or
 *   non-finite → the sum of the items' `carbsG`. Other missing, negative or
 *   non-finite numbers count as 0. A missing or `null` input is treated as `{}`.
 *
 * @param {{ carbItems?: CarbItem[], saltItems?: SaltItem[], totalCarbsG?: number, totalSodiumMg?: number,
 *   totalFluidMl?: number, bottleMl?: number } | null} [input]
 * @returns {DrinkBottles}
 */
export function drinkBottles(input) {
  const { carbItems, saltItems, totalCarbsG, totalSodiumMg, totalFluidMl, bottleMl } = input ?? {};
  const bottle = Number.isFinite(bottleMl) && bottleMl > 0 ? bottleMl : DEFAULT_BOTTLE_ML;
  const fluidMl = nonNegative(totalFluidMl);

  if (fluidMl <= 0) {
    return {
      bottles: 0,
      bottleMl: bottle,
      perBottle: {
        carbsG: 0,
        sodiumMg: 0,
        carbPctWv: 0,
        sodiumMgPerL: 0,
        osmolality: osmolality([], 0),
        addedWaterMl: 0,
        fillMl: 0,
      },
      warnings: [
        { id: 'concentration.noFluidForDrink', level: 'warning', message: { key: 'concentration.warn.noFluidForDrink' } },
      ],
    };
  }

  // The tiny tolerance keeps float noise (1500.0000000002 ml) from adding a bottle.
  const bottles = Math.max(1, Math.ceil(fluidMl / bottle - 1e-9));
  // Equal bottles that hold exactly the plan's fluid (the min() only absorbs that float noise).
  const fillMl = Math.min(bottle, fluidMl / bottles);
  const carbEntries = entries(carbItems);
  const share = (c) => ({ ...c, grams: c.grams / bottles });
  const all = [...carbEntries.map(component), ...entries(saltItems).map(component)].map(share);

  const carbsG = carbTotal(totalCarbsG, carbEntries) / bottles;
  const sodiumMg = nonNegative(totalSodiumMg) / bottles;
  const carbPctWv = (carbsG / fillMl) * 100;
  const sodiumMgPerL = (sodiumMg / fillMl) * 1000;
  const ingredientsMl = ingredientVolumeMl(all);
  const roomMl = fillMl - ingredientsMl;
  const addedWaterMl = Math.max(0, roomMl);
  const osmo = osmolality(all, addedWaterMl);

  /** @type {Warning[]} */
  const warnings = [];
  const plainWater = carbsG <= 0 && sodiumMg <= 0 && osmo.mOsmPerKg <= 0;
  if (roomMl <= 0) {
    // The powders and syrups alone fill the bottle: there is no drink to describe.
    warnings.push({
      id: 'concentration.drinkDoesNotFit',
      level: 'warning',
      message: {
        key: 'concentration.warn.drinkDoesNotFit',
        params: { ingredientsMl: Math.round(ingredientsMl), fillMl: Math.round(fillMl) },
      },
    });
  } else if (!plainWater) {
    // Thresholds compare the values the messages show (one decimal for %,
    // whole mOsm/kg and mg/L), so a message never reads "8% is above 8%".
    const pct = round1(carbPctWv);
    if (pct > DRINK_TOO_STRONG_PCT) {
      warnings.push({
        id: 'concentration.drinkTooStrong',
        level: 'warning',
        message: { key: 'concentration.warn.drinkTooStrong', params: { pct, limitPct: DRINK_TOO_STRONG_PCT } },
        citations: [...DRINK_CITATIONS],
      });
    } else if (pct > DRINK_STRONG_PCT) {
      warnings.push({
        id: 'concentration.drinkStrong',
        level: 'info',
        message: { key: 'concentration.warn.drinkStrong', params: { pct, limitPct: DRINK_STRONG_PCT } },
        citations: [...DRINK_CITATIONS],
      });
    }

    const mOsm = roundOsmolality(osmo.mOsmPerKg);
    if (mOsm >= VERY_HYPERTONIC_MOSM) {
      warnings.push({
        id: 'concentration.veryHypertonic',
        level: 'warning',
        message: { key: 'concentration.warn.veryHypertonic', params: { mOsm, limit: VERY_HYPERTONIC_MOSM } },
        citations: [...DRINK_CITATIONS],
      });
    } else if (mOsm > TONICITY_BANDS.isotonic) {
      warnings.push({
        id: 'concentration.hypertonic',
        level: 'info',
        message: { key: 'concentration.warn.hypertonic', params: { mOsm, limit: TONICITY_BANDS.isotonic } },
        citations: [...DRINK_CITATIONS],
      });
    }

    const [lo, hi] = EFSA_SODIUM_MG_PER_L;
    const mgPerL = Math.round(sodiumMgPerL);
    if (mgPerL < lo || mgPerL > hi) {
      warnings.push({
        id: 'concentration.sodiumOutsideEfsa',
        level: 'info',
        message: {
          key: mgPerL < lo ? 'concentration.warn.sodiumBelowEfsa' : 'concentration.warn.sodiumAboveEfsa',
          params: { mgPerL, lo, hi },
        },
        citations: ['efsa2011'],
      });
    }
  }

  return {
    bottles,
    bottleMl: bottle,
    perBottle: { carbsG, sodiumMg, carbPctWv, sodiumMgPerL, osmolality: osmo, addedWaterMl, fillMl },
    warnings,
  };
}
