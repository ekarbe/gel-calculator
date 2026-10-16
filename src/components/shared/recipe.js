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

import { t } from "../../i18n";

/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {import('../../domain/plan').Plan} Plan */

/** Dot color of a recipe line, by carb pathway or item kind. */
const DOT_CLASSES = {
  glucose: "bg-apple-blue",
  fructose: "bg-apple-purple",
  salt: "bg-apple-teal",
  caffeine: "bg-apple-amber",
};

/**
 * Plan warnings that explain a recipe without carbs: the sources cannot make
 * the ratio, or the ratio is 0:0. Every view of the recipe (card, mixing
 * steps, share image) shows them.
 */
export const CARB_RECIPE_WARNING_IDS = Object.freeze(["plan.carbSourcesInfeasible", "carbs.noRatio"]);

/**
 * The text label of a recipe item. Carb and salt labels are plain English
 * source names; caffeine labels are message descriptors and go through `t()`.
 *
 * @param {RecipeItem|null|undefined} item
 * @returns {string}
 */
export function recipeItemLabel(item) {
  return typeof item?.label === "string" ? item.label : t(item?.label);
}

/**
 * Tailwind background class for a recipe item's color dot.
 *
 * @param {RecipeItem|null|undefined} item
 * @returns {string}
 */
export function recipeItemDotClass(item) {
  const key = item?.kind === "carb" ? item.pathway : item?.kind;
  return DOT_CLASSES[key] ?? "bg-text-secondary";
}

/**
 * The plan's warnings about a recipe that delivers no carbs
 * ({@link CARB_RECIPE_WARNING_IDS}), in plan order.
 *
 * @param {Plan} plan
 * @returns {Plan['warnings']}
 */
export function carbRecipeWarnings(plan) {
  return plan.warnings.filter((warning) => CARB_RECIPE_WARNING_IDS.includes(warning.id));
}
