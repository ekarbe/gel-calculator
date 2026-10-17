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
 * English text for message keys returned by `src/domain/plan.js`
 * (`computePlan`). Placeholders use `{name}` or typed
 * `{name:type}` syntax (`src/i18n/index.js`).
 * @type {Record<string, string>}
 */
const plan = {
  // computePlan: a manual sodium target below the evidence range
  'plan.warn.sodiumBelowRange':
    'Your sodium target of {mgPerHour} mg/h is below the {lo}–{hi} mg/h range for this event.',
  // computePlan: a gel or both plan without gels puts what the gels would hold in the drink
  'plan.warn.noGelsCarbsInDrink':
    'No gels are planned, so the recipe puts all the carbs in your drink. Set gels per hour above 0 to make gels.',
  'plan.warn.noGelsSaltsInDrink':
    'There are no carbs to put in gels, so the recipe puts the salts in your drink.',
};

export default plan;
