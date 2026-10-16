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
 * (`computePlan`). Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const plan = {
  // computePlan: the carb sources cannot deliver the chosen ratio
  'plan.warn.carbSourcesInfeasible':
    'Your carb sources cannot make a {glucose}:{fructose} glucose to fructose mix. Add a source for the missing sugar or change the ratio.',
  // computePlan: auto ratio switched to an end of the allowed range the sources can make
  'plan.warn.ratioSubstituted':
    'Your carb sources cannot make the recommended {recommended} glucose to fructose mix. The plan uses {used}, which is still in the allowed range at {gPerHour} g/h.',
  // computePlan: a manual sodium target below the evidence range
  'plan.warn.sodiumBelowRange':
    'Your sodium target of {mgPerHour} mg/h is below the {lo}–{hi} mg/h range for this event.',
};

export default plan;
