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
 * English text for message keys returned by `src/domain/hydration.js`.
 * Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const fluid = {
  // recommendFluid
  'fluid.why.plan':
    'Drink about {mlPerHour} ml/h. This replaces roughly {sharePct}% of your sweat loss of {sweatMlPerHour} ml/h, capped at {maxMlPerHour} ml/h. Drinking less than you sweat avoids weight gain.',
  'fluid.why.thirst':
    'For events under 90 min or in cool weather, drinking to thirst works well. Use the plan as a rough guide.',

  // Warnings
  'fluid.warn.aboveSweat':
    'You plan to drink {mlPerHour} ml/h. That is more than you sweat ({sweatMlPerHour} ml/h). Weight gain during exercise can cause hyponatremia, a dangerous drop in blood sodium. Drink less than you sweat.',
  'fluid.warn.aboveCeiling':
    'You plan to drink {mlPerHour} ml/h. Guidelines suggest up to {maxMlPerHour} ml/h. Larger amounts can upset your stomach.',
};

export default fluid;
