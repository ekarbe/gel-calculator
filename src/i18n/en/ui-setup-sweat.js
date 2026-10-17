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
 * English UI text for the Sweat section.
 * Owned by the setup-sweat area (`src/components/setup/SweatSection.jsx` and
 * its `Sweat*` parts). Keys start with `ui-setup-sweat.`; placeholders follow
 * `src/i18n/index.js`: rates are `{x:volumeL}/h` (L/h or fl oz/h), masses
 * `{x:mass}`, temperatures `{x:temp}`, speeds `{x:speed}`, shares
 * `{x:percent}`. Sodium (mg/L), power (W) and energy (kcal) stay plain numbers.
 * The domain texts (why, warnings, test problems, the test protocol) are in
 * `sweat.js`.
 * @type {Record<string, string>}
 */
const uiSetupSweat = {
  // Panel title row
  'ui-setup-sweat.title': 'Sweat',
  'ui-setup-sweat.description': 'Your sweat rate and saltiness set the fluid and sodium targets.',
  // Chip in the title row: the sweat rate the plan uses (visible when the panel is collapsed)
  'ui-setup-sweat.headerRate': '{rateLph:volumeL}/h',

  // Where the sweat rate comes from (tabs)
  'ui-setup-sweat.source.label': 'Sweat source',
  'ui-setup-sweat.source.test': 'Test',
  'ui-setup-sweat.source.estimate': 'Estimate',
  'ui-setup-sweat.source.preset': 'Presets',

  // Presets: self-assessed sweat rate (index 0–5, lightest to heaviest)
  'ui-setup-sweat.preset.label': 'Sweat rate',
  'ui-setup-sweat.preset.intro': 'Pick the description that matches you in training at race effort.',
  'ui-setup-sweat.preset.option': '{name} ({rateLph:volumeL}/h)',
  'ui-setup-sweat.preset.0.name': 'Light sweating',
  'ui-setup-sweat.preset.0.description': 'Skin feels slightly damp.',
  'ui-setup-sweat.preset.1.name': 'Moderate sweating',
  'ui-setup-sweat.preset.1.description': 'Noticeable moisture on skin, shirt may show small damp patches.',
  'ui-setup-sweat.preset.2.name': 'Active sweating',
  'ui-setup-sweat.preset.2.description': 'Clothing shows distinct wet patches, sweat begins to drip occasionally.',
  'ui-setup-sweat.preset.3.name': 'Heavy sweating',
  'ui-setup-sweat.preset.3.description': 'Clothing widely soaked, continuous dripping of sweat.',
  'ui-setup-sweat.preset.4.name': 'Very heavy sweating',
  'ui-setup-sweat.preset.4.description': 'Clothes completely saturated, sweat constantly dripping or running.',
  'ui-setup-sweat.preset.5.name': 'Extreme sweating',
  'ui-setup-sweat.preset.5.description': 'Excessive sweating with clothes completely drenched.',

  // Saltiness: self-assessed sweat sodium (index 0–5, least to most salty)
  'ui-setup-sweat.saltiness.label': 'Sweat saltiness',
  'ui-setup-sweat.saltiness.option': '{name} ({mgPerL} mg/L)',
  'ui-setup-sweat.saltiness.0.name': 'Very low salt content',
  'ui-setup-sweat.saltiness.0.description': 'Sweat barely tastes salty, minimal salt marks on clothing.',
  'ui-setup-sweat.saltiness.1.name': 'Low salt content',
  'ui-setup-sweat.saltiness.1.description': 'Slight salty taste, faint white marks may appear on dark clothing.',
  'ui-setup-sweat.saltiness.2.name': 'Moderate salt content',
  'ui-setup-sweat.saltiness.2.description': 'Clearly salty taste, visible white marks on dried clothing.',
  'ui-setup-sweat.saltiness.3.name': 'High salt content',
  'ui-setup-sweat.saltiness.3.description': 'Strong salty taste, prominent white marks after drying.',
  'ui-setup-sweat.saltiness.4.name': 'Very high salt content',
  'ui-setup-sweat.saltiness.4.description': 'Very strong salty taste, thick white residue on clothing.',
  'ui-setup-sweat.saltiness.5.name': 'Extreme salt content',
  'ui-setup-sweat.saltiness.5.description': 'Extremely salty, heavy white crystallization on skin and clothing.',
  'ui-setup-sweat.saltiness.about': 'About sweat saltiness',
  'ui-setup-sweat.saltiness.aboutText':
    'Saltiness is the sodium in each litre of sweat. Most athletes lose 0.5–1.5 g of sodium per litre. White salt marks on dark clothing suggest saltier sweat. Every sweat source uses this level.',

  // Estimate tab: the heat-balance estimate and what drives it
  'ui-setup-sweat.estimate.label': 'Estimated sweat rate',
  'ui-setup-sweat.estimate.value': '{rateLph:volumeL}/h ± {uncertaintyLph:volumeL}/h',
  'ui-setup-sweat.estimate.heatProduction': 'Heat production',
  'ui-setup-sweat.estimate.energyUse': 'Energy use',
  'ui-setup-sweat.estimate.heatToLose': 'Heat to lose by sweating',
  'ui-setup-sweat.estimate.watts': '{watts} W',
  'ui-setup-sweat.estimate.kcalPerHour': '{kcal} kcal/h',
  'ui-setup-sweat.estimate.uses': 'Uses: {conditions}.',
  'ui-setup-sweat.estimate.usesAcclimatised': 'Uses: {conditions}, heat acclimatised.',
  'ui-setup-sweat.estimate.changeHint': 'Change these under Event and Body & weather.',
  'ui-setup-sweat.estimate.capped': 'This is the most the model allows for your body size ({maxLph:volumeL}/h).',
  'ui-setup-sweat.estimate.details': 'Heat balance details',
  'ui-setup-sweat.estimate.airSpeed': 'Air speed over the skin',
  'ui-setup-sweat.estimate.airSpeedValue': '{speed:speed}',
  'ui-setup-sweat.estimate.skinTemp': 'Skin temperature',
  'ui-setup-sweat.estimate.skinTempValue': '{tempC:temp}',
  'ui-setup-sweat.estimate.dryHeatLoss': 'Heat lost to the air',
  // Shown instead when the air is hotter than the skin (the body takes up heat from it)
  'ui-setup-sweat.estimate.dryHeatGain': 'Heat gained from the air',
  'ui-setup-sweat.estimate.breathing': 'Heat lost by breathing',
  'ui-setup-sweat.estimate.sun': 'Heat from the sun',

  // Exercise conditions as one line (estimate and test list)
  'ui-setup-sweat.conditions.running': 'Running at {speedKmh:speed}',
  'ui-setup-sweat.conditions.cyclingPower': 'Cycling at {powerW} W',
  'ui-setup-sweat.conditions.cyclingSpeed': 'Cycling at {speedKmh:speed}',
  'ui-setup-sweat.conditions.cyclingSpeedPower': 'Cycling at {speedKmh:speed} (about {powerW} W)',
  'ui-setup-sweat.conditions.other': 'Other sport at {mets} METs',
  'ui-setup-sweat.conditions.temp': '{tempC:temp}',
  'ui-setup-sweat.conditions.humidity': '{humidity:percent} humidity',
  'ui-setup-sweat.conditions.setting.outdoor': 'outdoors',
  'ui-setup-sweat.conditions.setting.indoorFan': 'indoors with a fan',
  'ui-setup-sweat.conditions.setting.indoorNoFan': 'indoors without a fan',
  'ui-setup-sweat.conditions.sun.none': 'shade or overcast',
  'ui-setup-sweat.conditions.sun.partly': 'partly sunny',
  'ui-setup-sweat.conditions.sun.full': 'full sun',

  // Test tab: the list of sweat tests
  'ui-setup-sweat.tests.intro':
    'Weigh yourself before and after a training session to measure your own sweat rate. The plan uses the test you pick.',
  'ui-setup-sweat.tests.empty': 'No sweat tests yet.',
  'ui-setup-sweat.tests.legend': 'Test to use',
  'ui-setup-sweat.tests.listLabel': 'Sweat tests',
  'ui-setup-sweat.tests.defaultName': 'Sweat test {number}',
  'ui-setup-sweat.tests.inUse': 'In use',
  'ui-setup-sweat.tests.noDate': 'No date',
  'ui-setup-sweat.tests.duration': '{minutes} min',
  'ui-setup-sweat.tests.measured': 'Measured',
  'ui-setup-sweat.tests.measuredValue': '{rateLph:volumeL}/h',
  'ui-setup-sweat.tests.cannotUse': 'Cannot be used:',
  'ui-setup-sweat.tests.edit': 'Edit {name}',
  'ui-setup-sweat.tests.delete': 'Delete {name}',
  'ui-setup-sweat.tests.deleteQuestion': 'Delete {name}? You cannot undo this.',
  'ui-setup-sweat.tests.confirmDelete': 'Yes, delete',
  'ui-setup-sweat.tests.cancelDelete': 'Cancel',
  'ui-setup-sweat.tests.add': 'Add a sweat test',
  'ui-setup-sweat.tests.limit': 'You can keep up to {max} tests. Delete one to add another.',

  // Test tab: scaling the test to the event
  'ui-setup-sweat.calibration.label': 'Scale the test to this event',
  'ui-setup-sweat.calibration.scaled':
    'Measured {measuredLph:volumeL}/h. Scaled to this event: {rateLph:volumeL}/h (factor {factor}).',
  'ui-setup-sweat.calibration.scaledAtLimit':
    'Measured {measuredLph:volumeL}/h. Scaled to this event: {rateLph:volumeL}/h (factor {factor}, at its limit).',
  'ui-setup-sweat.calibration.direct': 'Measured {measuredLph:volumeL}/h, used as it is.',

  // Test tab: the add/edit form
  'ui-setup-sweat.form.addTitle': 'Add a sweat test',
  'ui-setup-sweat.form.editTitle': 'Edit sweat test',
  'ui-setup-sweat.form.howTo': 'How to test:',
  'ui-setup-sweat.form.date': 'Date',
  'ui-setup-sweat.form.name': 'Name (optional)',
  'ui-setup-sweat.form.namePlaceholder': 'Hot turbo session',
  'ui-setup-sweat.form.preMass': 'Body mass before',
  'ui-setup-sweat.form.postMass': 'Body mass after',
  // Read after a body-mass label by screen readers only (the field starts empty, so its unit suffix is all that shows it)
  'ui-setup-sweat.form.unitInName': '({unit})',
  'ui-setup-sweat.form.fluid': 'Fluid drunk',
  'ui-setup-sweat.form.urine': 'Urine passed',
  'ui-setup-sweat.form.duration': 'Duration',
  'ui-setup-sweat.form.conditions': 'Conditions during the test',
  'ui-setup-sweat.form.sport': 'Sport',
  'ui-setup-sweat.form.speed': 'Speed',
  'ui-setup-sweat.form.power': 'Power',
  'ui-setup-sweat.form.powerHint': '0 = estimate from speed',
  'ui-setup-sweat.form.mets': 'Effort',
  'ui-setup-sweat.form.setting': 'Setting',
  'ui-setup-sweat.form.temp': 'Temperature',
  'ui-setup-sweat.form.humidity': 'Humidity',
  'ui-setup-sweat.form.sun': 'Sun',
  'ui-setup-sweat.form.preview': 'This test gives {rateLph:volumeL}/h of sweat.',
  'ui-setup-sweat.form.save': 'Save test',
  'ui-setup-sweat.form.cancel': 'Cancel',


  // Unit suffixes of number fields that do not depend on the unit system
  'ui-setup-sweat.unit.minutes': 'min',
  'ui-setup-sweat.unit.watts': 'W',
  'ui-setup-sweat.unit.mets': 'METs',
  'ui-setup-sweat.unit.percent': '%',

  // The sweat numbers the plan uses
  'ui-setup-sweat.summary.label': 'Sweat in the plan',
  'ui-setup-sweat.summary.rate': 'Sweat rate used',
  'ui-setup-sweat.summary.rateValue': '{rateLph:volumeL}/h',
  'ui-setup-sweat.summary.range': 'likely {lo:volumeL:nounit}–{hi:volumeL}/h',
  'ui-setup-sweat.summary.sodium': 'Sweat sodium',
  'ui-setup-sweat.summary.sodiumValue': '{mgPerL} mg/L',
  'ui-setup-sweat.summary.source.test': 'From your sweat test',
  'ui-setup-sweat.summary.source.estimate': 'From the estimate',
  'ui-setup-sweat.summary.source.preset': 'From your self-assessment',

  // Projected body-mass change over the event
  'ui-setup-sweat.projection.title': 'Projected body-mass change',
  'ui-setup-sweat.projection.level.ok': 'Up to {pct:percent} loss',
  'ui-setup-sweat.projection.level.mild': '{lo}–{hi:percent} loss',
  'ui-setup-sweat.projection.level.high': 'Over {pct:percent} loss',
  'ui-setup-sweat.projection.level.gain': 'Weight gain',
  'ui-setup-sweat.projection.scale': 'On the scale after the event',
  'ui-setup-sweat.projection.waterLost': 'Water lost',
  'ui-setup-sweat.projection.waterGained': 'Water gained',
  'ui-setup-sweat.projection.waterValue': '{waterL:volumeL} ({pct:percent} of body mass)',
  'ui-setup-sweat.projection.note':
    'The scale also drops by the fuel you burn. Try to keep the water loss under {pct:percent} of your body mass and never gain weight.',
};

export default uiSetupSweat;
