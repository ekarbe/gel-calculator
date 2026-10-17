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
 * English UI text for the print layout.
 * Owned by the schedule-print area (`src/components/print/*`). Keys start
 * with `ui-print.`; placeholders follow `src/i18n/index.js`. Amount values
 * such as {amount}, {mass} or {water} arrive already formatted ("158 g",
 * "140 ml" / "4.7 fl oz"); numbers such as {gPerHour} arrive as locale text.
 * The schedule table reuses `ui-schedule.*` (times, column headings,
 * bottles) and the warning levels `ui-common.level.*`.
 * @type {Record<string, string>}
 */
const uiPrint = {
  // Page title and the date of printing ({date} in the locale's long form)
  'ui-print.title': 'Race-day fuel plan',
  'ui-print.printedOn': 'Printed on {date}',
  'ui-print.footer':
    'Made with Gel-Calculator (eikekarbe.com/gel-calculator). This plan is general guidance, not medical advice. Try it in training before you race with it.',

  // Block headings
  'ui-print.block.summary': 'Plan summary',
  'ui-print.block.recipe': 'Recipe',
  'ui-print.block.mixing': 'Mixing',
  'ui-print.block.schedule': 'Schedule',
  'ui-print.block.warnings': 'Warnings and notes',
  'ui-print.block.sources': 'Sources',

  // Plan summary: terms
  'ui-print.term.activity': 'Activity',
  'ui-print.term.conditions': 'Conditions',
  'ui-print.term.carbs': 'Carbohydrate',
  'ui-print.term.sodium': 'Sodium',
  'ui-print.term.fluid': 'Fluid',
  'ui-print.term.sweat': 'Sweat rate',
  'ui-print.term.bodyMass': 'Body mass',
  'ui-print.term.format': 'Format',
  'ui-print.term.caffeine': 'Caffeine',
  'ui-print.term.bicarb': 'Sodium bicarbonate',
  'ui-print.term.energy': 'Energy',

  // Plan summary: values
  'ui-print.summary.activity': '{sport} · {duration} · {intensity} intensity',
  'ui-print.summary.conditions': '{setting} · {tempC:temp} · {humidity:percent} humidity',
  // Outdoors only: the sweat model uses the sun outdoors only
  'ui-print.summary.conditionsSun': '{setting} · {tempC:temp} · {humidity:percent} humidity · {sun}',
  'ui-print.summary.carbs': '{gPerHour} g/h · {deliveredG} g in the recipe · glucose:fructose {ratio:ratio}',
  'ui-print.summary.sodium': '{mgPerHour} mg/h · {deliveredMg} mg in the recipe',
  'ui-print.summary.fluid': '{mlPerHour:volume}/h · {totalMl:volume} in total',
  // ± {uncertainty} is in the same unit as the rate
  'ui-print.summary.sweat': '{rateLph:volumeL}/h ± {uncertaintyLph:volumeL:nounit} ({source})',
  // {scale}: signed change on the scale ("−0.6 kg"); {water}: one of the water texts below; {level}: a level text
  'ui-print.summary.bodyMass': 'About {scale} on the scale after the activity · {water} · {level}',
  'ui-print.summary.caffeine': '{totalMg} mg in total ({mgPerKg} mg/kg)',
  'ui-print.summary.bicarb': '{doseG} g, {minutes} min before the start',
  'ui-print.summary.bicarbNoTime': '{doseG} g',
  'ui-print.summary.energy': '{deliveredKcal} kcal from carbohydrate · about {burnedKcal} kcal burned (estimate)',
  // Format row: {gels} and {bottles} are the texts below
  'ui-print.summary.format.gel': 'Gels: {gels}',
  'ui-print.summary.format.drink': 'Drink: {bottles}',
  'ui-print.summary.format.both': 'Gels: {gels}. Drink: {bottles}',
  'ui-print.summary.gels.one': '{count} gel ({perHour} per hour)',
  'ui-print.summary.gels.other': '{count} gels ({perHour} per hour)',
  'ui-print.summary.gels.none': 'no gels',
  'ui-print.summary.drink.none': 'no drink',

  // Words inside the summary values
  'ui-print.intensity.easy': 'Easy',
  'ui-print.intensity.moderate': 'Moderate',
  'ui-print.intensity.hard': 'Hard',
  'ui-print.intensity.race': 'Race',
  // Mid-sentence, so lower case in English
  'ui-print.sun.none': 'shade or overcast',
  'ui-print.sun.partly': 'partly sunny',
  'ui-print.sun.full': 'full sun',
  'ui-print.sweatSource.test': 'from your sweat test',
  'ui-print.sweatSource.estimate': 'heat-balance estimate',
  'ui-print.sweatSource.preset': 'self-assessed preset',
  // Body mass: water lost or gained over the activity, and its share of body mass
  'ui-print.bodyMass.lost': 'Water lost {waterL:volumeL} ({pct:percent} of body mass)',
  'ui-print.bodyMass.gained': 'Water gained {waterL:volumeL} ({pct:percent} of body mass)',
  'ui-print.bodyMass.level.ok': 'Up to {limit:percent} loss',
  'ui-print.bodyMass.level.mild': '{lo}–{hi:percent} loss',
  'ui-print.bodyMass.level.high': 'Over {limit:percent} loss',
  'ui-print.bodyMass.level.gain': 'Weight gain',

  // Recipe sections: "Gel batch: 9 gels", the ingredient table, the facts per serving
  'ui-print.section.gel': 'Gel batch',
  'ui-print.section.drink': 'Drink',
  'ui-print.section.heading': '{title}: {servings}',
  'ui-print.section.caption': '{title} ingredients',
  'ui-print.section.empty': 'Nothing to mix.',
  'ui-print.servings.gelNone': 'no gels planned',
  'ui-print.servings.drinkNone': 'no bottles, because no fluid is planned',
  'ui-print.table.ingredient': 'Ingredient',
  'ui-print.amounts.activity': 'Whole activity',
  'ui-print.amounts.batch': 'Whole batch',
  'ui-print.amounts.allBottles': 'All bottles',
  'ui-print.fact.consistency': 'Consistency: {consistency}, {pct:percent} carbohydrate.',
  'ui-print.fact.eachGel': 'Each gel: about {mass} ({volume}) with {carbs} carbohydrate.',
  'ui-print.fact.eachBottle':
    'Each bottle: {carbs} carbohydrate ({pct:percent} w/v) and {sodiumMg} mg sodium ({mgPerL} mg/L).',
  'ui-print.fact.osmolality': 'Osmolality: {value}.',
  // Osmolality ({value} as ui-recipe.osmo.* writes it) and its tonicity in lower case
  'ui-print.osmo.withTonicity': '{value} ({tonicity})',

  // Mixing steps (the steps are ui-recipe.mix.*, as in the mixing dialog): a recipe line as printed
  'ui-print.mix.steps': '{title} steps',
  'ui-print.mix.line': '{amount} {name}',
  'ui-print.mix.nothing': 'Nothing to mix for this plan.',
  'ui-print.mix.rinse': 'Mouth rinse option.',
  'ui-print.mix.caffeine.line': '{name}: {amount}',

  // Schedule table
  'ui-print.schedule.caption': 'Race-day schedule',

  // Warnings and sources
  'ui-print.warnings.list': 'Printed warnings',
  'ui-print.warnings.none': 'None for this plan.',
  'ui-print.references': 'References',
  // One reference: authors, year, title, journal (as the study gives them), then its link
  'ui-print.reference': '{authors} ({year}). {title}. {journal}.',
  'ui-print.referenceWithUrl': '{authors} ({year}). {title}. {journal}. {url}',
};

export default uiPrint;
