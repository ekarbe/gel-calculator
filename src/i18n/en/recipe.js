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
 * English text for message keys returned by `src/domain/recipe.js`
 * (`buildRecipe`). Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const recipe = {
  // Label of a caffeine line: tablets added to one specific gel (the amount shows the tablet count)
  'recipe.caffeineForGel': 'Caffeine for gel {gel} ({tabletMg} mg tablets)',
  // Water line of a gel batch: added to the whole batch to dissolve the powders
  'recipe.water.gel': 'Warm water',
  // Water line of a drink: each bottle is topped up to its mark
  'recipe.water.drink': 'Water, to fill each bottle to {ml} ml',
  // Heading of the per-serving column of a gel section
  'recipe.serving.gel': 'Per gel',
  // Heading of the per-serving column of a drink section
  'recipe.serving.bottle': 'Per bottle',
};

export default recipe;
