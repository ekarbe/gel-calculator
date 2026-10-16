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
 * English text for message keys returned by `src/domain/electrolytes.js`.
 * Placeholders use `{name}` syntax.
 * @type {Record<string, string>}
 */
const electrolytes = {
  // recommendSodium: duration bands
  'electrolytes.why.sodium.short':
    'Under 2 h, sodium is optional. Up to {hi} mg/h is enough. You lose about {loss} mg/h of sodium in sweat. Your target is {mgPerHour} mg/h.',
  'electrolytes.why.sodium.medium':
    'For 2–4 h, take {lo}–{hi} mg/h of sodium. You lose about {loss} mg/h in sweat. The plan starts from half of that and keeps it in the range. Your target is {mgPerHour} mg/h.',
  'electrolytes.why.sodium.long':
    'Over 4 h, sodium matters more. Take {lo}–{hi} mg/h. You lose about {loss} mg/h in sweat. The plan starts from half of that and keeps it in the range. Your target is {mgPerHour} mg/h.',
  'electrolytes.why.partial':
    'No guideline recommends replacing all the sodium you sweat. Drinking too much is the main cause of low blood sodium. Extra salt does not make overdrinking safe.',

  // recommendExtras
  'electrolytes.why.extras':
    'Potassium, magnesium and calcium are optional. Sweat holds only small amounts of them. The plan replaces about half of a typical loss. There is no evidence that they prevent cramps.',

  // Warnings
  'electrolytes.warn.sodiumFarAbove':
    'You plan {mgPerHour} mg/h of sodium. That is far above any guideline. Stay at or below {limitMgPerHour} mg/h. Large salt doses can cause nausea and stomach upset.',
  'electrolytes.warn.sodiumHigh':
    'You plan {mgPerHour} mg/h of sodium. That is above the usual upper limit of {limitMgPerHour} mg/h. Only heavy, salty sweaters in long events may need this much. Test it in training.',
  'electrolytes.warn.concentrationHigh':
    'Your plan has about {mgPerL} mg of sodium per litre of fluid you drink. That is above {limitMgPerL} mg/L. Sports drinks usually hold 460–1,150 mg/L. A lot of salt with little fluid can upset your stomach. Use less sodium or spread it over more fluid.',
};

export default electrolytes;
