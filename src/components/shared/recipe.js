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
 * Recipe helpers shared by every view of the recipe: the recipe card, the
 * mixing steps, the share image, the print view and the balance analysis.
 * Display only: they pick and format what the plan already holds and never
 * compute nutrition.
 */

import { fmt } from "./format";
import { formatRatio } from "../../domain/carbs";
import { OSMOLALITY_COARSE_FROM_MOSM, roundOsmolality } from "../../domain/concentration";
import { t } from "../../i18n";

/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').Osmolality} Osmolality */
/** @typedef {import('../../domain/plan').Plan} Plan */

/** Heading of each recipe section kind. */
export const SECTION_TITLES = Object.freeze({ gel: "Gels", drink: "Drink" });

/**
 * Plan warnings that explain the recipe: a 0:0 ratio (no carbs), no carb
 * ingredient (no carbs), a ratio the ingredients cannot make (the recipe uses
 * the closest one), or a gel plan without gels whose carbs or salts went into
 * the drink. Every view of the recipe shows them.
 */
export const RECIPE_WARNING_IDS = Object.freeze([
  "carbs.noRatio",
  "carbs.noIngredients",
  "carbs.ratioNotReachable",
  "plan.noGels",
]);

/**
 * The name shown for a custom ingredient or salt: its name, else "Custom
 * ingredient N" / "Custom salt N" from its key ('c1', 's3'). The domain falls
 * back to the bare key, which only a share link without names can produce.
 * @param {'carb'|'salt'} kind
 * @param {{ key: string, name?: string }} custom
 * @returns {string}
 */
export function customDisplayName(kind, custom) {
  const name = typeof custom?.name === "string" ? custom.name.trim() : "";
  if (name !== "") return name;
  const number = String(custom?.key ?? "").slice(1);
  return `${kind === "salt" ? "Custom salt" : "Custom ingredient"} ${number}`;
}

/**
 * The text label of a recipe item. Carb and salt labels are plain strings
 * (source names or the names of custom ingredients; an unnamed custom one
 * reads as {@link customDisplayName}); water and caffeine labels are message
 * descriptors and go through `t()`.
 *
 * @param {RecipeItem|null|undefined} item
 * @returns {string}
 */
export function recipeItemLabel(item) {
  if (typeof item?.label !== "string") return t(item?.label);
  if ((item.kind === "carb" || item.kind === "salt") && typeof item.ref === "string" && item.label === item.ref) {
    return customDisplayName(item.kind, { key: item.ref });
  }
  return item.label;
}

/**
 * "1 gel" / "9 gels".
 * @param {number} count
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
export function countText(count, one, many) {
  return `${fmt(count)} ${count === 1 ? one : many}`;
}

/**
 * The fructose share the recipe delivers: the share of the solved
 * ingredients, else the share the solver chose, else the target. `null` when
 * the recipe delivers no carbs (a 0:0 ratio, or no carb ingredient): there
 * is no ratio to show.
 * @param {Plan} plan
 * @returns {number|null}
 */
export function deliveredShare(plan) {
  const { ratio, ingredients, deliveredG } = plan.carbs;
  if (!(ratio.value.glucose + ratio.value.fructose > 0) || !(deliveredG > 0)) return null;
  return ingredients.achievedShare ?? ingredients.usedShare ?? ratio.share;
}

/**
 * The glucose:fructose ratio the recipe delivers, as text (`1:0.5`); `0:0`
 * when it delivers no carbs.
 * @param {Plan} plan
 * @returns {string}
 */
export function deliveredRatioText(plan) {
  const share = deliveredShare(plan);
  return share === null ? "0:0" : formatRatio({ glucose: 1 - share, fructose: share });
}

/**
 * The plan's warnings about the carbs in the recipe ({@link RECIPE_WARNING_IDS}),
 * plus the "tablets, never powder" danger when a section lists caffeine
 * tablets. In plan order.
 * @param {Plan} plan
 * @returns {Plan['warnings']}
 */
export function recipeWarnings(plan) {
  const hasTablets = plan.recipe.sections.some((section) => section.items.some((item) => item.kind === "caffeine"));
  return plan.warnings.filter(
    (warning) => RECIPE_WARNING_IDS.includes(warning.id) || (hasTablets && warning.id === "caffeine.noPowder"),
  );
}

/**
 * Osmolality as shown: `roundOsmolality` from the domain (whole mOsm/kg, from
 * 1000 rounded to 100), the same value the drink warnings state. Gels from
 * 1000 mOsm/kg are marked "likely higher": sugars are taken as ideal
 * solutes, which reads about 10 % low at gel strength (research notes,
 * section C). `null` without
 * a finite value above 0. `tonicity` falls back to `'hypertonic'` when the
 * value has none.
 * @param {Osmolality|null|undefined} osmolality
 * @param {'gel'|'drink'} kind
 * @returns {{ text: string, likelyHigher: boolean, tonicity: string }|null}
 */
export function osmolalityDisplay(osmolality, kind) {
  const value = osmolality?.mOsmPerKg;
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    text: `≈ ${fmt(roundOsmolality(value))} mOsm/kg`,
    likelyHigher: kind === "gel" && value >= OSMOLALITY_COARSE_FROM_MOSM,
    tonicity: osmolality.tonicity ?? "hypertonic",
  };
}

/**
 * Short description of a section's servings: "9 gels", "2 bottles of 750
 * ml", "2 bottles, 600 ml each (750 ml bottle)" when the bottles are not
 * filled to the top, or why there are none.
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {string}
 */
export function servingsText(section, bottleMl) {
  if (section.kind === "gel") {
    return section.servings > 0 ? countText(section.servings, "gel", "gels") : "No gels planned";
  }
  if (!(section.servings > 0)) return "No bottles: no fluid planned";
  const fill = Math.round(section.perServing?.volumeMl ?? bottleMl);
  const bottles = countText(section.servings, "bottle", "bottles");
  if (fill < Math.round(bottleMl)) return `${bottles}, ${fmt(fill)} ml each (${fmt(bottleMl)} ml bottle)`;
  return `${bottles} of ${fmt(fill)} ml`;
}

/**
 * Heading of a section's amount column for a view: the whole section, or one
 * serving (`servingLabelKey`). A section without servings always shows the
 * whole amount.
 * @param {RecipeSection} section
 * @param {'total'|'perServing'} view
 * @returns {string}
 */
export function amountsCaption(section, view) {
  if (!(section.servings > 0)) return "Whole activity";
  if (view === "perServing") return t(section.servingLabelKey);
  return section.kind === "gel" ? "Whole batch" : "All bottles";
}

/**
 * The amount of a line in a view.
 * @param {RecipeItem} item
 * @param {'total'|'perServing'} view
 * @returns {string}
 */
export function itemAmount(item, view) {
  return view === "perServing" ? item.perServingDisplay : item.display;
}
