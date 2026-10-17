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
 * English text for message keys returned by `src/domain/carbs.js` and
 * `src/domain/solver.js`.
 * Placeholders use `{name}` or typed `{name:type}` syntax (`src/i18n/index.js`).
 * @type {Record<string, string>}
 */
const carbs = {
  // recommendCarbs: duration bands
  'carbs.why.none':
    'Events under 45 min need no carbs during exercise. Your glycogen stores cover the effort.',
  'carbs.why.rinse':
    'For 45–75 min, a carb mouth rinse or a small amount of carbs can help. The range is {lo}–{hi} g/h. Your target is {gPerHour} g/h.',
  'carbs.why.short':
    'For 75–120 min, the evidence range is {lo}–{hi} g/h of carbs. Your target is {gPerHour} g/h.',
  'carbs.why.medium':
    'For 2–2.5 h, the evidence range is {lo}–{hi} g/h of carbs. Your target is {gPerHour} g/h.',
  'carbs.why.long':
    'Over 2.5 h, the evidence range is {lo}–{hi} g/h of carbs from mixed glucose and fructose. Your target is {gPerHour} g/h.',
  'carbs.why.veryHigh':
    'For events over 2.5 h, gut-trained mode uses a range of {lo}–{hi} g/h. Studies tested this in trained athletes. Your target is {gPerHour} g/h.',

  // recommendCarbs: how to do the mouth rinse (45–75 min)
  'carbs.mouthRinse.howTo':
    'Rinsing your mouth with a carb drink can improve performance even when you swallow little or no carbs. Swish {rinseMl:volume} of a 6–8% maltodextrin drink in your mouth for 5–10 s, then spit it out. Repeat every 5–10 min.',

  // recommendCarbs: position inside the range
  'carbs.why.intensity.easy':
    'Easy intensity sets your target to about 80% of the low end of the range. You burn less carbohydrate at low intensity.',
  'carbs.why.intensity.moderate':
    'Moderate intensity puts your target in the middle of the range.',
  'carbs.why.intensity.hard':
    'Hard intensity puts your target at the top of the range.',
  'carbs.why.intensity.race':
    'Race intensity puts your target at the top of the range.',

  // recommendRatio
  'carbs.ratio.why.low':
    'At {gPerHour} g/h, glucose alone works. A 1:{fructose} glucose to fructose mix can still feel easier on the gut.',
  'carbs.ratio.why.medium':
    'Above 60 g/h, glucose uptake reaches its limit. Use 1:{fructose} glucose to fructose so fructose adds a second uptake route.',
  'carbs.ratio.why.high':
    'Above 90 g/h, you need more fructose. At {gPerHour} g/h, use 1:{fructose} glucose to fructose. At 120 g/h this reaches 1:0.8.',

  // Warnings
  'carbs.warn.highCarbLongOnly':
    'Gut-trained mode only applies to events over 150 min. The standard range is used instead.',
  'carbs.warn.gutTraining':
    'Intakes above 90 g/h need 2–4 weeks of gut training. Extra benefit above 90 g/h is unproven.',
  'carbs.warn.aboveStudied':
    '{gPerHour} g/h is above 120 g/h, the highest intake studied. Gut problems become more likely.',
  'carbs.warn.noRatio':
    'Set at least one ratio part above zero. Without a ratio, no carb sources can be calculated.',
  'carbs.warn.tooLittleFructose':
    'At {gPerHour} g/h, use at least {minRatio:ratio} glucose to fructose. Glucose alone cannot be absorbed fast enough.',
  'carbs.warn.tooMuchFructose':
    'Use no more fructose than glucose. Extra fructose often causes gut problems.',

  // solveIngredients (src/domain/solver.js)
  'carbs.warn.ratioNotReachable':
    'Your ingredients cannot make {target:ratio} glucose to fructose. The recipe uses {achievable:ratio}, the closest they can make. Add an ingredient with more glucose or more fructose to get closer.',
  'carbs.warn.noIngredients':
    'Add at least one carb ingredient. Without one, the recipe has no carbs.',
};

export default carbs;
