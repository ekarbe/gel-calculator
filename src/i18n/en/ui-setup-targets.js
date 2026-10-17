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
 * English UI text for the Targets and Caffeine & bicarbonate sections.
 * Owned by the setup-targets area (`src/components/setup/TargetsSection.jsx`,
 * `SupplementsSection.jsx` and their field groups `TargetsFields.jsx`,
 * `SupplementsFields.jsx`, `TargetsParts.jsx`). Keys start with
 * `ui-setup-targets.`; placeholders follow `src/i18n/index.js`. Fluid
 * volumes and body mass are typed (`{ml:volume}`, `{litres:volumeL}`,
 * `{massKg:mass}`), so they follow the unit system; nutrients stay in g and
 * mg, written in the text. Ratios are typed (`{x:ratio}`: "1:0.5", "1:0,5"
 * in German).
 * @type {Record<string, string>}
 */
const uiSetupTargets = {
  // Section titles and the one-line summary a collapsed section shows
  'ui-setup-targets.targets.title': 'Targets',
  'ui-setup-targets.targets.summary': 'Carbs {g} g/h · {ratio:ratio} · Sodium {mg} mg/h · Fluid {ml:volume}/h',
  'ui-setup-targets.supplements.title': 'Caffeine & bicarbonate',
  'ui-setup-targets.supplements.summary': '{caffeine} · {bicarb}',
  'ui-setup-targets.supplements.summary.caffeineOff': 'Caffeine off',
  'ui-setup-targets.supplements.summary.caffeineOn': 'Caffeine {mg} mg',
  'ui-setup-targets.supplements.summary.bicarbOff': 'Bicarbonate off',
  'ui-setup-targets.supplements.summary.bicarbOn': 'Bicarbonate {g} g',

  // Units written after a number (nutrients are never converted); {unit} is "ml" or "fl oz"
  'ui-setup-targets.unit.gPerHour': 'g/h',
  'ui-setup-targets.unit.mgPerHour': 'mg/h',
  'ui-setup-targets.unit.perHour': '{unit}/h',
  'ui-setup-targets.unit.mgPerKg': 'mg/kg',
  'ui-setup-targets.unit.gPerKg': 'g/kg',

  // Carbohydrate target
  'ui-setup-targets.carbs.title': 'Carbohydrates',
  'ui-setup-targets.carbs.mode': 'Carb target mode',
  'ui-setup-targets.carbs.target': 'Your target',
  'ui-setup-targets.carbs.total': '{g} g in total',
  'ui-setup-targets.carbs.recommended': 'Recommended',
  'ui-setup-targets.carbs.perHour': '{g} g/h',
  'ui-setup-targets.carbs.range': 'Evidence range',
  'ui-setup-targets.carbs.rangeValue': '{lo}–{hi} g/h',
  'ui-setup-targets.carbs.band': 'Duration band',
  'ui-setup-targets.carbs.band.none': 'Under 45 min',
  'ui-setup-targets.carbs.band.rinse': '45–75 min',
  'ui-setup-targets.carbs.band.short': '75–120 min',
  'ui-setup-targets.carbs.band.medium': '2–2.5 h',
  'ui-setup-targets.carbs.band.long': 'Over 2.5 h',
  'ui-setup-targets.carbs.band.veryHigh': 'Over 2.5 h, gut-trained',
  'ui-setup-targets.carbs.highCarb.label': 'Gut-trained: allow 90–120 g/h',
  'ui-setup-targets.carbs.highCarb.hint': 'Only if you have trained your gut with high intakes for 2–4 weeks.',
  'ui-setup-targets.carbs.mouthRinse.title': 'Mouth rinse option',

  // Glucose:fructose ratio
  'ui-setup-targets.ratio.title': 'Glucose:fructose ratio',
  'ui-setup-targets.ratio.mode': 'Ratio mode',
  'ui-setup-targets.ratio.recommendedLabel': 'Recommended ratio',
  'ui-setup-targets.ratio.yourLabel': 'Your ratio',
  'ui-setup-targets.ratio.at': 'Glucose : fructose at your {g} g/h target',
  'ui-setup-targets.ratio.recommended': 'Recommended',
  'ui-setup-targets.ratio.allowed': 'Allowed range',
  'ui-setup-targets.ratio.allowedValue': '{lo:ratio}–{hi:ratio}',
  'ui-setup-targets.ratio.share': 'Fructose share',
  // The share and its allowed range; the range is kept on one line after it.
  'ui-setup-targets.ratio.shareValue': '{pct:percent}',
  'ui-setup-targets.ratio.shareAllowed': '(allowed {lo}–{hi:percent})',
  'ui-setup-targets.ratio.glucoseParts': 'Glucose parts',
  'ui-setup-targets.ratio.fructoseParts': 'Fructose parts',
  // Hints of the part fields; {parts} is 1 or 0.5 and {ratio} the example 1:0.5
  'ui-setup-targets.ratio.glucoseHint': 'The glucose side of the ratio, such as {parts} in {ratio:ratio}.',
  'ui-setup-targets.ratio.fructoseHint': 'The fructose side of the ratio, such as {parts} in {ratio:ratio}.',

  // Sodium target
  'ui-setup-targets.sodium.title': 'Sodium',
  'ui-setup-targets.sodium.mode': 'Sodium target mode',
  'ui-setup-targets.sodium.optional': 'Optional',
  'ui-setup-targets.sodium.target': 'Your target',
  'ui-setup-targets.sodium.manual': 'Your sodium target',
  'ui-setup-targets.sodium.total': '{mg} mg in total',
  'ui-setup-targets.sodium.recommended': 'Recommended',
  'ui-setup-targets.sodium.perHour': '{mg} mg/h',
  'ui-setup-targets.sodium.range': 'Range',
  'ui-setup-targets.sodium.rangeValue': '{lo}–{hi} mg/h',
  'ui-setup-targets.sodium.loss': 'Estimated sweat loss',
  'ui-setup-targets.sodium.lossValue': 'about {mg} mg/h',

  // Fluid target
  'ui-setup-targets.fluid.title': 'Fluid',
  'ui-setup-targets.fluid.mode': 'Fluid target mode',
  'ui-setup-targets.fluid.target': 'Your target',
  'ui-setup-targets.fluid.manual': 'Your fluid target',
  'ui-setup-targets.fluid.total': '{ml:volume} in total',
  'ui-setup-targets.fluid.recommended': 'Recommended',
  'ui-setup-targets.fluid.perHour': '{ml:volume}/h',
  'ui-setup-targets.fluid.range': 'Guideline range',
  'ui-setup-targets.fluid.rangeValue': '{lo:volume:nounit}–{hi:volume}/h',
  'ui-setup-targets.fluid.sweat': 'Sweat loss',
  'ui-setup-targets.fluid.sweatValue': 'about {ml:volume}/h',
  'ui-setup-targets.fluid.thirst': 'Drinking to thirst works well for this event. Use this number as a rough guide.',
  'ui-setup-targets.fluid.bodyMass': 'On the scale after the event',

  // Advanced: optional ions
  'ui-setup-targets.extras.title': 'Advanced: potassium, magnesium, calcium',
  'ui-setup-targets.extras.potassium': 'Potassium',
  'ui-setup-targets.extras.magnesium': 'Magnesium',
  'ui-setup-targets.extras.calcium': 'Calcium',
  'ui-setup-targets.extras.perHour': '{mg} mg/h',

  // Caffeine
  'ui-setup-targets.caffeine.title': 'Caffeine',
  'ui-setup-targets.caffeine.include': 'Include caffeine',
  'ui-setup-targets.caffeine.dose': 'Caffeine dose',
  'ui-setup-targets.caffeine.doseHint': 'Per kg of body mass ({massKg:mass}).',
  'ui-setup-targets.caffeine.asTablets': 'Add to gels as tablets',
  'ui-setup-targets.caffeine.asTabletsHint': 'Crush caffeine tablets into the gels taken during the event.',
  'ui-setup-targets.caffeine.tabletSize': 'Tablet size',
  'ui-setup-targets.caffeine.tabletOption': '{mg} mg',
  'ui-setup-targets.caffeine.doses': 'Planned doses',
  'ui-setup-targets.caffeine.dosesList': 'Planned caffeine doses',
  'ui-setup-targets.caffeine.when.pre': 'Before the start',
  'ui-setup-targets.caffeine.when.gel': 'With gel {gel}',
  'ui-setup-targets.caffeine.when.intra': 'During the event',
  'ui-setup-targets.caffeine.mg': '{mg} mg',
  'ui-setup-targets.caffeine.tablets': '({tablets} × {tabletMg} mg tablet)',
  'ui-setup-targets.caffeine.total': 'Total {mg} mg ({mgPerKg} mg/kg)',

  // Sodium bicarbonate (behind a link for events over 90 min)
  'ui-setup-targets.bicarb.title': 'Sodium bicarbonate',
  'ui-setup-targets.bicarb.show': 'Show sodium bicarbonate (for efforts under ~60 min)',
  'ui-setup-targets.bicarb.include': 'Include sodium bicarbonate',
  'ui-setup-targets.bicarb.includeHint': 'A pre-race buffer for hard efforts of up to about 60 min.',
  'ui-setup-targets.bicarb.dose': 'Bicarbonate dose',
  'ui-setup-targets.bicarb.doseHint': 'Per kg of body mass ({massKg:mass}).',
  'ui-setup-targets.bicarb.doseFact': 'Dose',
  'ui-setup-targets.bicarb.grams': '{g} g',
  'ui-setup-targets.bicarb.sodium': 'Sodium load',
  'ui-setup-targets.bicarb.timing': 'Take it',
  // Times from the start as the schedule writes them ("T−1h 30m", ui-schedule.time.*), and in words
  // for screen readers ("1 h 30 min before the start", ui-schedule.time.before)
  'ui-setup-targets.bicarb.timingValue': '{time} (window {earliest} to {latest})',
  'ui-setup-targets.bicarb.timingSpoken': '{time}, in a window from {earliest} to {latest}',
};

export default uiSetupTargets;
