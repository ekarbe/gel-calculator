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
 * German text for message keys returned by `src/domain/recipe.js`
 * (`buildRecipe`).
 * Same keys and placeholders as `../en/recipe.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const recipe = {
  // Label of a caffeine line: tablets added to one specific gel (the amount shows the tablet count)
  'recipe.caffeineForGel': 'Koffein für Gel {gel} ({tabletMg}-mg-Tabletten)',
  // Water line of a gel batch: added to the whole batch to dissolve the powders
  'recipe.water.gel': 'Warmes Wasser',
  // Water line of a drink: each bottle is topped up to its mark
  'recipe.water.drink': 'Wasser, jede Flasche auf {ml:volume} auffüllen',
  // Heading of the per-serving column of a gel section
  'recipe.serving.gel': 'Pro Gel',
  // Heading of the per-serving column of a drink section
  'recipe.serving.bottle': 'Pro Flasche',
};

export default recipe;
