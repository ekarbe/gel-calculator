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
 * The mixing steps of a recipe section, written once for every view: the
 * mixing modal renders them with a list, the print view as numbered text.
 * Display only: amounts come from the recipe section (`buildRecipe`).
 */

import { fmt } from "./format";
import { countText, recipeItemLabel } from "./recipe";
import { formatAmount } from "../../domain/recipe";

/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */

/**
 * One step of the mixing instructions.
 * @typedef {Object} MixStep
 * @property {'weigh'|'dissolve'|'fill'|'caffeine'|'add'|'shake'} key  Stable id of the step.
 * @property {string} title  Short heading ("Weigh the Ingredients").
 * @property {string} text  The instruction. When `lines` follow, it ends with a colon.
 * @property {string[]} lines  Recipe lines to list under the text ("158 g Maltodextrin"); may be empty.
 * @property {string} [listLabel]  Accessible name of the list of `lines` ("Gel ingredients").
 */

/**
 * Whether a section adds water: the rule of the recipe's water line
 * (`Math.round(ml) > 0`), so no step mentions water the recipe does not list.
 * @param {number} ml
 * @returns {boolean}
 */
const addsWater = (ml) => Number.isFinite(ml) && Math.round(ml) > 0;

/**
 * The carbs and salts of a section.
 * @param {RecipeSection} section
 * @returns {RecipeItem[]}
 */
const ingredientsOf = (section) => section.items.filter((item) => item.kind === "carb" || item.kind === "salt");

/**
 * Steps for a gel batch: weigh the whole batch, dissolve the powders in the
 * warm added water (or in the syrups when no water is added), divide it into
 * the flasks, then stir caffeine tablets into their gels.
 * @param {RecipeSection} section
 * @returns {MixStep[]}
 */
function gelSteps(section) {
  const ingredients = ingredientsOf(section);
  const tablets = section.items.filter((item) => item.kind === "caffeine");
  /** @type {MixStep[]} */
  const steps = [];
  if (ingredients.length > 0) {
    const waterMl = section.water.totalMl;
    const { volumeMl, massG } = section.perServing ?? {};
    const each =
      Number.isFinite(volumeMl) && volumeMl > 0
        ? ` of about ${formatAmount(volumeMl, "ml")}${Number.isFinite(massG) && massG > 0 ? ` (${formatAmount(massG, "g")})` : ""}`
        : "";
    steps.push(
      {
        key: "weigh",
        title: "Weigh the Ingredients",
        text: `Weigh these for the whole batch of ${countText(section.servings, "gel", "gels")}:`,
        lines: ingredients.map((item) => `${item.display} ${recipeItemLabel(item)}`),
        listLabel: "Gel ingredients",
      },
      {
        key: "dissolve",
        title: "Dissolve",
        text: addsWater(waterMl)
          ? `Warm ${formatAmount(waterMl, "ml")} of water. Stir in the powders and syrups until they dissolve and the gel is smooth.`
          : "Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.",
        lines: [],
      },
      {
        key: "fill",
        title: "Fill the Flasks",
        text: `${
          section.servings === 1 ? `Fill the batch into 1 flask${each}.` : `Divide the batch into ${fmt(section.servings)} flasks${each} each.`
        } Keep them closed and cool until the start.`,
        lines: [],
      },
    );
  }
  if (tablets.length > 0) {
    steps.push({
      key: "caffeine",
      title: "Add Caffeine Tablets",
      text: "Crush each tablet into a fine powder and stir it into its gel until it dissolves. Never use pure caffeine powder. Mark these gels so you take them at the right time. Gel 1 is the one you take at the start:",
      lines: tablets.map((item) => `${recipeItemLabel(item)}: ${item.display}`),
      listLabel: "Caffeine tablets",
    });
  }
  return steps;
}

/**
 * Steps for the drink: what goes into each bottle, then fill to the mark and
 * shake.
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {MixStep[]}
 */
function drinkSteps(section, bottleMl) {
  const ingredients = ingredientsOf(section);
  const fillMl = section.perServing?.volumeMl ?? bottleMl;
  const waterMl = section.water.perServingMl;
  const notFull = Math.round(fillMl) < Math.round(bottleMl);
  /** @type {MixStep[]} */
  const steps = [];
  if (ingredients.length > 0) {
    steps.push({
      key: "add",
      title: "Add the Powders",
      text: `Make ${countText(section.servings, "bottle", "bottles")}. Put this in each bottle:`,
      lines: ingredients.map((item) => `${item.perServingDisplay} ${recipeItemLabel(item)}`),
      listLabel: "Drink ingredients",
    });
  }
  const fill = addsWater(waterMl)
    ? `Add about ${formatAmount(waterMl, "ml")} of water, up to the ${formatAmount(fillMl, "ml")} mark.`
    : `Fill to the ${formatAmount(fillMl, "ml")} mark.`;
  const full = notFull ? ` Your ${fmt(bottleMl)} ml bottle will not be full: that is all the fluid the plan needs from it.` : "";
  steps.push({
    key: "shake",
    title: "Fill and Shake",
    text: `${ingredients.length > 0 ? "" : `Make ${countText(section.servings, "bottle", "bottles")} of water. `}${fill}${full} Shake until nothing is left at the bottom.`,
    lines: [],
  });
  return steps;
}

/**
 * Mixing steps for one recipe section.
 *
 * - Gel: weigh the whole batch (each line's whole amount), dissolve the
 *   powders in the warm added water and stir (no water when the recipe adds
 *   none: the syrups bring it), divide into N flasks of about X ml (Y g),
 *   then stir each caffeine tablet into its gel.
 * - Drink: per bottle add the powders (each line's per-bottle amount), add
 *   the water up to the fill mark, shake. A bottle that is not filled to the
 *   top says so.
 * - A section without servings (no gels, or no fluid for a drink) has no
 *   steps; its warnings say why.
 *
 * Water follows the recipe's water line: a step adds water only when the
 * recipe lists it (at least 0.5 ml, `Math.round(ml) > 0`).
 *
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs (`inputs.format.bottleMl`).
 * @returns {MixStep[]}
 */
export function mixingSteps(section, bottleMl) {
  if (!(section?.servings > 0)) return [];
  return section.kind === "drink" ? drinkSteps(section, bottleMl) : gelSteps(section);
}
