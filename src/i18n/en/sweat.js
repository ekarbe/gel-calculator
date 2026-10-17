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
 * English text for message keys returned by `src/domain/sweat.js`, plus the
 * sweat-test help texts the UI shows next to the test form.
 * Placeholders use `{name}` or typed `{name:type}` syntax (`src/i18n/index.js`).
 * @type {Record<string, string>}
 */
const sweat = {
  // resolveSweat: summary by source
  'sweat.why.test':
    'Your sweat test gives {rateLph:volumeL}/h for this event. A careful test is accurate to about ±{uncertaintyLph:volumeL}/h, so your rate is likely {lo:volumeL:nounit}–{hi:volumeL}/h.',
  'sweat.why.estimate':
    'Your estimated sweat rate is {rateLph:volumeL}/h. The estimate balances the heat your body makes against the heat it loses to the air. Your real rate is likely {lo:volumeL:nounit}–{hi:volumeL}/h.',
  'sweat.why.preset':
    'You picked a sweat rate of {rateLph:volumeL}/h. Self-assessment is rough, so your real rate is likely {lo:volumeL:nounit}–{hi:volumeL}/h.',

  // resolveSweat: details for a sweat test
  'sweat.why.testCorrection':
    'The test result leaves out {correctionL:mass} of mass you lost by burning about {energyKcal} kcal. That loss comes from fuel and breathing, not sweat.',
  'sweat.why.testCalibrated':
    'You measured {testRateLph:volumeL}/h. The model predicts {testModelLph:volumeL}/h for the test conditions and {estimateLph:volumeL}/h for this event, so the plan scales your measured rate by {factor}.',
  'sweat.why.calibrationClamped':
    'By the model, this event changes your sweat rate {ratio} times. The plan limits the scaling to {min}–{max} times and uses {factor}.',
  'sweat.why.calibrationCapped':
    'Scaled to this event, your test gives {scaledLph:volumeL}/h. That is more than the model allows for your body size and more than you measured, so the plan uses {maxLph:volumeL}/h.',
  'sweat.why.calibrationUnavailable':
    'The model predicts almost no sweat for the test conditions, so the plan cannot scale your test to this event. It uses your measured {testRateLph:volumeL}/h.',
  'sweat.why.testDirect':
    'The plan uses your measured {testRateLph:volumeL}/h as it is. This works best when the event conditions match the test.',

  // resolveSweat: details for the estimate
  'sweat.why.estimateDrivers':
    'At this effort you burn about {energyKcalPerHour} kcal/h and your body makes about {heatW} W of heat. Temperature, humidity, sun and air flow decide how much of it sweat must remove.',
  'sweat.why.estimateCapped':
    'The estimate hit the limit of {maxLph:volumeL}/h. Few athletes sweat more than that.',

  // resolveSweat: details for every source
  'sweat.why.sodium':
    'You picked a sweat sodium level of {sodiumMmolL} mmol/L. Most athletes fall in the 10–90 mmol/L range.',
  'sweat.why.measure':
    'Sweat rates vary widely between athletes, so a sweat test gives a better number. Weigh yourself before and after about 60 min at race effort, in little or no clothing on the same scale. Towel dry before the second weighing. Add what you drank and subtract any urine. Count {lossKg:mass} as {sweatL:volumeL}.',

  // resolveSweat: warnings
  'sweat.warn.noTest':
    'You have no sweat test yet. Add one to use your measured rate. The plan uses the estimate for now.',
  'sweat.warn.testUnusable':
    'Your selected sweat test cannot be used. Check its numbers. The plan uses the estimate for now.',
  'sweat.warn.calibrationLimited':
    'Your sweat test was done in very different conditions from this event. The plan scales it by {min}–{max} times at most, so your rate is less certain (±{uncertaintyLph:volumeL}/h). A test in conditions closer to the event gives a better number.',
  'sweat.warn.estimateLow':
    'The model predicts very little sweat here ({rateLph:volumeL}/h). It assumes light race kit and a steady effort, so your real rate may be higher, up to about {hi:volumeL}/h. Drink to thirst, and do a sweat test to get your own rate.',
  'sweat.warn.uncompensable':
    'In these conditions your body cannot lose all the heat it makes, even with maximal sweating. Your core temperature will keep rising. Slow down, cool yourself with water or ice, and stop if you feel dizzy or confused.',

  // sweatTestRate: problems
  'sweat.test.problem.duration': 'Enter a duration above 0 min.',
  'sweat.test.problem.mass': 'Enter your body mass before and after the session.',
  'sweat.test.problem.noLoss':
    'This test gives {rateLph:volumeL}/h. A sweat rate must be above 0. Check the weights and the fluid you drank.',
  'sweat.test.problem.tooHigh':
    'This test gives {rateLph:volumeL}/h. Rates above {maxLph:volumeL}/h are not realistic. Check the weights, the fluid and the duration.',

  // Sweat test form help (UI)
  'sweat.test.protocol':
    'Empty your bladder. Weigh yourself in little or no clothing. Train for about 60 min at race effort in race-like conditions. Towel dry and weigh yourself again on the same scale. Note what you drank and any urine. Repeat the test 2–3 times for a reliable number.',
  'sweat.test.calibrateHelp':
    'Scale the test to the event conditions. The model predicts your sweat rate for the test conditions and for the event. The plan scales your measured rate by the ratio of the two, from 0.5 to 2 times. In the same conditions you get your measured rate.',
};

export default sweat;
