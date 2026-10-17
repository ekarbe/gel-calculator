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
 * English UI text of the recipe itself, shared by every view that shows it
 * (`src/components/recipe/recipeText.js`: the race board, the mixing dialog,
 * the share image, the print view, the setup sections and the guided
 * pantry): amounts of recipe lines, the names of the built-in carb sources
 * and salts (by their id in `src/constants/constants.js`), the names of
 * unnamed custom ones, the osmolality and the mixing steps. Keys start with
 * `ui-recipe.`; placeholders follow `src/i18n/index.js`. `{value}`,
 * `{water}`, `{volume}`, `{mass}`, `{mark}` and `{bottle}` hold amounts
 * that are already formatted ("158 g", "140 ml", "25 fl oz"), so every view
 * writes an amount the same way.
 * @type {Record<string, string>}
 */
const uiRecipe = {
  // Amounts of recipe lines. {value} is a number in the locale's format; "below" wraps a formatted amount ("<0.1 g").
  'ui-recipe.amount.g': '{value} g',
  'ui-recipe.amount.mg': '{value} mg',
  'ui-recipe.amount.below': '<{value}',
  'ui-recipe.amount.tablets.one': '{value} tablet',
  'ui-recipe.amount.tablets.other': '{value} tablets',

  // Custom ingredients and salts without a name (a name can only be blank in a share link)
  'ui-recipe.custom.carb': 'Custom ingredient {number}',
  'ui-recipe.custom.salt': 'Custom salt {number}',

  // The built-in carb sources, by id (src/constants/constants.js)
  'ui-recipe.source.1': 'Dextrose (anhydrous)',
  'ui-recipe.source.2': 'Glucose Syrup',
  'ui-recipe.source.3': 'Maltodextrin',
  'ui-recipe.source.4': 'Maltose',
  'ui-recipe.source.5': 'Highly Branched Cyclic Dextrin (HBCD)',
  'ui-recipe.source.6': 'Rice Syrup',
  'ui-recipe.source.7': 'Barley Malt Extract',
  'ui-recipe.source.8': 'Dextrose (monohydrate)',
  'ui-recipe.source.11': 'Crystalline Fructose',
  'ui-recipe.source.12': 'High Fructose Corn Syrup',
  'ui-recipe.source.13': 'Agave Syrup',
  'ui-recipe.source.14': 'Honey',
  'ui-recipe.source.15': 'Date Syrup',
  'ui-recipe.source.16': 'Grape Juice Concentrate',
  'ui-recipe.source.17': 'Maple Syrup',
  'ui-recipe.source.18': 'Sucrose (Cane Sugar)',
  'ui-recipe.source.19': 'Coconut Sugar',
  'ui-recipe.source.20': 'Apple Juice Concentrate',
  // The built-in salts, by id
  'ui-recipe.source.31': 'Sodium Chloride (Table Salt)',
  'ui-recipe.source.32': 'Potassium Chloride',
  'ui-recipe.source.33': 'Sodium Citrate (dihydrate)',
  'ui-recipe.source.34': 'Magnesium Citrate (anhydrous)',
  'ui-recipe.source.35': 'Calcium Citrate (tetrahydrate)',
  'ui-recipe.source.36': 'Magnesium Chloride (hexahydrate flakes)',
  'ui-recipe.source.37': 'Calcium Chloride (anhydrous)',
  'ui-recipe.source.38': 'Sodium Bicarbonate',
  'ui-recipe.source.39': 'Potassium Citrate (monohydrate)',
  'ui-recipe.source.40': 'Magnesium Sulfate (Epsom Salt, heptahydrate)',

  // Osmolality of a gel or a drink. {mOsm} is already formatted ("4,300").
  'ui-recipe.osmo.value': '≈ {mOsm} mOsm/kg',
  'ui-recipe.osmo.valueHigher': '≈ {mOsm} mOsm/kg, likely higher',

  // Counts of servings
  'ui-recipe.servings.gels.one': '{count} gel',
  'ui-recipe.servings.gels.other': '{count} gels',
  'ui-recipe.servings.bottles.one': '{count} bottle',
  'ui-recipe.servings.bottles.other': '{count} bottles',

  // Mixing steps of a gel batch. {gels} is a gel count ("9 gels"); {water}, {volume} and {mass} are amounts ("140 ml", "32 ml", "42 g").
  'ui-recipe.mix.weigh.title': 'Weigh the Ingredients',
  'ui-recipe.mix.weigh.text': 'Weigh these for the whole batch of {gels}:',
  'ui-recipe.mix.weigh.list': 'Gel ingredients',
  'ui-recipe.mix.dissolve.title': 'Dissolve',
  'ui-recipe.mix.dissolve.water':
    'Warm {water} of water. Stir in the powders and syrups until they dissolve and the gel is smooth.',
  'ui-recipe.mix.dissolve.noWater':
    'Add no water: your syrups bring enough. Stir the powders into the syrups until they dissolve and the gel is smooth.',
  'ui-recipe.mix.fill.title': 'Fill the Flasks',
  'ui-recipe.mix.fill.one': 'Fill the batch into 1 flask.',
  'ui-recipe.mix.fill.oneVolume': 'Fill the batch into 1 flask of about {volume}.',
  'ui-recipe.mix.fill.oneVolumeMass': 'Fill the batch into 1 flask of about {volume} ({mass}).',
  'ui-recipe.mix.fill.other': 'Divide the batch into {count} flasks.',
  'ui-recipe.mix.fill.otherVolume': 'Divide the batch into {count} flasks of about {volume} each.',
  'ui-recipe.mix.fill.otherVolumeMass': 'Divide the batch into {count} flasks of about {volume} ({mass}) each.',
  'ui-recipe.mix.fill.keepOne': 'Keep it closed and cool until the start.',
  'ui-recipe.mix.fill.keepOther': 'Keep them closed and cool until the start.',
  'ui-recipe.mix.caffeine.title': 'Add Caffeine Tablets',
  'ui-recipe.mix.caffeine.text':
    'Crush each tablet into a fine powder and stir it into its gel until it dissolves. Never use pure caffeine powder. Mark these gels so you take them at the right time. Gel 1 is the one you take at the start:',
  'ui-recipe.mix.caffeine.list': 'Caffeine tablets',
  // Mixing steps of the drink. {bottles} is a bottle count ("4 bottles"); {water}, {mark} and {bottle} are volumes ("562 ml", "25 fl oz").
  'ui-recipe.mix.add.title': 'Add the Powders',
  'ui-recipe.mix.add.text': 'Make {bottles}. Put this in each bottle:',
  'ui-recipe.mix.add.list': 'Drink ingredients',
  'ui-recipe.mix.shake.title': 'Fill and Shake',
  'ui-recipe.mix.shake.water': 'Make {bottles} of water.',
  'ui-recipe.mix.shake.addWater': 'Add about {water} of water, up to the {mark} mark.',
  'ui-recipe.mix.shake.toMark': 'Fill to the {mark} mark.',
  'ui-recipe.mix.shake.notFull': 'Your {bottle} bottle will not be full: that is all the fluid the plan needs from it.',
  'ui-recipe.mix.shake.shake': 'Shake until nothing is left at the bottom.',
};

export default uiRecipe;
