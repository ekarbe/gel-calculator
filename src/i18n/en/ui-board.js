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
 * English UI text for the Race board (`src/components/board/*`): the title
 * row and its chips, the four KPI tiles (the carbs "Why?" also gives the
 * pathways and the energy), the recipe lanes with their facts, osmolality
 * and cost, the actions, "Next up", the warnings panel and its polite
 * announcement. Keys start with `ui-board.`; placeholders follow
 * `src/i18n/index.js`. Fluid volumes and percentages use typed placeholders
 * (`{x:volume}`, `{x:volumeL}`, `{x:percent}`, `{x:ratio}`, `{x:currency}`);
 * nutrients (g, mg, mg/L, kcal, mOsm/kg) are plain numbers that the board
 * passes already formatted for the locale.
 * @type {Record<string, string>}
 */
const uiBoard = {
  // The board's heading (a small caption over the event summary)
  'ui-board.title': 'Race board',

  // Title row: event summary, e.g. "3:00 h · Cycling · Moderate" (shown in capitals)
  'ui-board.summary': '{duration} · {sport} · {intensity}',
  'ui-board.summary.duration': '{hours}:{minutes} h',

  // Sweat chip: rate ± its uncertainty (kept short, so it never truncates)
  'ui-board.chip.sweat': 'Sweat {rateL:volumeL}/h ±{uncertaintyL:volumeL:nounit}',
  // Where the sweat rate comes from: wrapping text next to the chip
  'ui-board.chip.sweatSource.test': 'Sweat test',
  'ui-board.chip.sweatSource.testScaled': 'Sweat test, scaled to this event',
  'ui-board.chip.sweatSource.estimate': 'Estimate',
  'ui-board.chip.sweatSource.estimateNoTest': 'Estimate (no usable sweat test)',
  'ui-board.chip.sweatSource.preset': 'Self-assessed',
  // Warnings-count chip (a button that opens the warnings panel)
  'ui-board.chip.warnings.one': '1 warning',
  'ui-board.chip.warnings.other': '{count} warnings',
  // Accessible name of the chip button: the visible count, then what it does
  'ui-board.chip.warnings.show': '{count}: show the list',

  // KPI tiles
  'ui-board.kpi.carbs': 'Carbs',
  'ui-board.kpi.sodium': 'Sodium',
  'ui-board.kpi.fluid': 'Fluid',
  'ui-board.kpi.caffeine': 'Caffeine',
  'ui-board.unit.gPerHour': 'g/h',
  'ui-board.unit.mgPerHour': 'mg/h',
  'ui-board.unit.perHour': '{unit}/h',
  'ui-board.unit.mg': 'mg',
  // After a tile's "Why?" button, for screen readers only: the tile it explains
  'ui-board.kpi.whyFor': '({target})',
  'ui-board.kpi.carbs.sub': '{ratio:ratio} · {g} g total',
  'ui-board.kpi.carbs.none': 'No carb target',
  // Added to the carbs "Why?": the g/h on each pathway the recipe delivers, and the energy line
  'ui-board.kpi.carbs.pathways': 'Your recipe delivers glucose {glucose} g/h and fructose {fructose} g/h.',
  'ui-board.kpi.carbs.energy': 'Energy: {energy}.',
  'ui-board.kpi.carbs.short': '{g} g short: the recipe gives {delivered} g',
  'ui-board.kpi.sodium.sub': '{mg} mg total',
  'ui-board.kpi.sodium.none': 'No sodium target',
  'ui-board.kpi.sodium.short': '{mg} mg short: the salts give {delivered} mg',
  'ui-board.kpi.sodium.over': '{mg} mg over: the salts give {delivered} mg',
  'ui-board.kpi.sodium.belowRange': 'Below the evidence range',
  'ui-board.kpi.fluid.loss': '{ml:volume} total · {pct:percent} loss',
  'ui-board.kpi.fluid.gain': '{ml:volume} total · {pct:percent} gain',
  'ui-board.kpi.fluid.none': 'No fluid planned',
  'ui-board.kpi.fluid.level.mild': '{lo}–{hi:percent} loss',
  'ui-board.kpi.fluid.level.high': 'Over {pct:percent} loss',
  'ui-board.kpi.fluid.level.gain': 'Weight gain',
  'ui-board.kpi.caffeine.sub': '{mgPerKg} mg/kg · {doses}',
  'ui-board.kpi.caffeine.doses.one': '1 dose',
  'ui-board.kpi.caffeine.doses.other': '{count} doses',
  'ui-board.kpi.caffeine.offSub': 'Not in this plan',

  // Energy (in the carbs "Why?"): kcal from the carbs in the recipe, energy the event burns
  'ui-board.energy.delivered': '{kcal} kcal from carbs',
  'ui-board.energy.deliveredOf': '{kcal} of {planned} kcal from carbs',
  'ui-board.energy.burned': 'you burn about {kcal} kcal',
  'ui-board.energy.both': '{delivered} · {burned}',

  // Recipe panel
  'ui-board.recipe.title': 'Recipe',
  'ui-board.recipe.view': 'Recipe view',
  'ui-board.recipe.view.total': 'Total',
  'ui-board.recipe.view.perServing': 'Per serving',
  'ui-board.recipe.empty': 'Nothing to mix for this plan.',
  // Section headings ("Gels ×9", "Bottles ×4"), and without servings
  'ui-board.section.gel': 'Gels ×{count}',
  'ui-board.section.gelNone': 'Gels',
  'ui-board.section.drink': 'Bottles ×{count}',
  'ui-board.section.drinkNone': 'Drink',
  'ui-board.section.empty': 'Nothing goes into this part.',
  // What a section's servings are
  'ui-board.servings.gelNone': 'No gels planned',
  'ui-board.servings.drinkNone': 'No bottles: no fluid planned',
  'ui-board.servings.drinkFull': '{fill:volume} each',
  'ui-board.servings.drinkPartial': '{fill:volume} each ({size:volume} bottle)',
  // Caption above a section's lanes (per serving uses "Per gel" / "Per bottle")
  'ui-board.amounts.batch': 'Whole batch',
  'ui-board.amounts.allBottles': 'All bottles',
  'ui-board.amounts.activity': 'Whole activity',
  'ui-board.lanes.label': 'Ingredients',
  // Lane of a carb ingredient: its carbs split by pathway, and its share of the section's carbs
  'ui-board.lane.carbDetail': '{carbs} carbs · glucose {glucose} · fructose {fructose}',
  'ui-board.lane.share': '{pct:percent} of the carbs in this part',
  // What one serving holds
  'ui-board.facts.label': '{serving} facts',
  'ui-board.facts.gelMass': 'Gel mass',
  'ui-board.facts.gelVolume': 'Gel volume',
  'ui-board.facts.carbsPerGel': 'Carbs per gel',
  'ui-board.facts.carbPct': 'Carbohydrate',
  'ui-board.facts.carbPctValue': '{pct:percent} w/w',
  'ui-board.facts.about': '≈ {value}',
  'ui-board.facts.fill': 'Fill each bottle to',
  'ui-board.facts.carbsPerBottle': 'Carbs per bottle',
  'ui-board.facts.carbsPerBottleValue': '{amount} ({pct:percent} w/v)',
  'ui-board.facts.sodiumPerBottle': 'Sodium per bottle',
  'ui-board.facts.sodiumPerBottleValue': '{amount} ({mgPerL} mg/L)',
  // Osmolality line with its tonicity chip
  'ui-board.osmo.label': 'Osmolality',
  // Cost estimate (rough prices per gram of carbs)
  'ui-board.cost.title': 'Cost estimate',
  'ui-board.cost.diy': 'Mixed at home',
  'ui-board.cost.savings': 'You save',
  'ui-board.cost.savingsValue': '{amount:currency} vs commercial gels',

  // Actions
  'ui-board.actions.label': 'Recipe actions',
  'ui-board.actions.mix': 'Start mixing',
  'ui-board.actions.print': 'Print plan',
  'ui-board.actions.share': 'Share plan',

  // Next up: the first schedule events (times and texts as the full schedule writes them)
  'ui-board.next.title': 'Next up',
  'ui-board.next.full': 'Full schedule',
  'ui-board.next.more.one': '1 more event in the full schedule',
  'ui-board.next.more.other': '{count} more events in the full schedule',
  'ui-board.next.empty': 'Nothing is scheduled for this plan.',

  // Warnings panel (every plan warning, danger first)
  'ui-board.warnings.titleCount': 'Warnings ({count})',
  'ui-board.warnings.empty': 'No warnings for this plan.',
  // Polite announcement (screen readers) when the number of warnings or dangers changes
  'ui-board.live.none': 'No warnings',
  'ui-board.live.withDangers': '{warnings}, {dangers}',
  'ui-board.live.dangers.one': '1 danger',
  'ui-board.live.dangers.other': '{count} dangers',
};

export default uiBoard;
