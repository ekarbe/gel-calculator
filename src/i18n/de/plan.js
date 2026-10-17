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
 * German text for message keys returned by `src/domain/plan.js`
 * (`computePlan`).
 * Same keys and placeholders as `../en/plan.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const plan = {
  // computePlan: a manual sodium target below the evidence range
  'plan.warn.sodiumBelowRange':
    'Dein Natriumziel von {mgPerHour} mg/h liegt unter dem Bereich von {lo}–{hi} mg/h für dieses Event.',
  // computePlan: a gel or both plan without gels puts what the gels would hold in the drink
  'plan.warn.noGelsCarbsInDrink':
    'Es sind keine Gels geplant, daher kommen alle Kohlenhydrate in dein Getränk. Setze „Gels pro Stunde“ über 0, um Gels zu machen.',
  'plan.warn.noGelsSaltsInDrink':
    'Es gibt keine Kohlenhydrate für Gels, daher kommen die Salze in dein Getränk.',
};

export default plan;
