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
 * English UI text for guided mode.
 * Owned by the guided integration step (`src/components/guided/*`). Keys start with `ui-guided.`; placeholders follow `src/i18n/index.js`.
 * The fields inside the screens are the setup field groups and keep their own catalogs
 * (`ui-setup-event`, `ui-setup-sweat`, `ui-setup-recipe`); the last step is the Race board (`ui-board`).
 * Fluid volumes are typed (`{x:volume}`) or come from the formatter; nutrients stay g and mg.
 * @type {Record<string, string>}
 */
const uiGuided = {
  // Progress: the four steps (a navigation list), and the caption over each screen's heading
  'ui-guided.progress.label': 'Guided setup',
  'ui-guided.progress.step': 'Step {number} of {total}',
  // Read before each step's name in the step list (screen readers only): "Step 2: Body & weather"
  'ui-guided.progress.stepNumber': 'Step {number}:',
  'ui-guided.step.event': 'Event',
  'ui-guided.step.bodyWeather': 'Body & weather',
  'ui-guided.step.ingredients': 'Ingredients',
  'ui-guided.step.plan': 'Recipe & plan',
  // "Step 2 of 4 · Body & weather" ({step} is ui-guided.progress.step, {name} the step's name)
  'ui-guided.screen.caption': '{step} · {name}',

  // Leaving the guided flow (expert mode shows everything set here)
  'ui-guided.switchToExpert': 'Switch to expert',
  'ui-guided.switchToExpertHint': 'Expert mode keeps everything you entered.',
  // Shown in the dock when "Switch to expert" finds a form that is not saved ({button} is ui-guided.switchToExpert)
  'ui-guided.leave.unsaved': 'This form is not saved yet. Save or cancel it first, or select {button} again to leave without it.',

  // Screen: the event
  'ui-guided.event.title': 'Your event',
  'ui-guided.event.reason': 'How long and how hard you go sets how many carbs you need per hour.',

  // Screen: body and weather (the setting is asked here too: indoors or out changes the air flow)
  'ui-guided.conditions.title': 'Body & weather',
  'ui-guided.conditions.reason': 'Your size and the weather decide how much heat you make and how much you sweat.',

  // Screen: the sweat test question, then the test list or the estimate
  'ui-guided.sweat.title': 'Sweat',
  'ui-guided.sweat.reason': 'Your sweat rate sets how much to drink. How salty your sweat is sets the sodium.',
  'ui-guided.sweat.question': 'Have you done a sweat test?',
  'ui-guided.sweat.yes': 'Yes',
  'ui-guided.sweat.no': 'No',
  'ui-guided.sweat.yesHint': 'Add your test below. The plan uses the test you pick.',
  'ui-guided.sweat.noHint': 'No problem. The plan estimates your sweat rate from your event, your body and the weather.',
  // The sweat source is a self-assessed preset (set in expert mode)
  'ui-guided.sweat.presetHint': 'You picked a sweat rate yourself in expert mode, and the plan uses it.',
  'ui-guided.sweat.useEstimate': 'Use the estimate instead',

  // Screen: the pantry (carb ingredients as a pick-from grid, then the sodium salt)
  'ui-guided.pantry.title': 'Your pantry',
  'ui-guided.pantry.reason':
    'Pick the sugars you have. The mix combines them to reach the glucose:fructose ratio your carbs need.',
  'ui-guided.pantry.carbs': 'Carbohydrates',
  'ui-guided.pantry.carbsHint':
    'Select a tile to add it, and again to remove it. Above 60 g of carbs per hour the mix also needs a sugar with fructose.',
  'ui-guided.pantry.more': 'More ingredients',
  'ui-guided.pantry.powders': 'Powders',
  'ui-guided.pantry.syrups': 'Syrups',
  'ui-guided.pantry.yours': 'Your own',
  'ui-guided.pantry.custom': 'Add your own from a label',
  // On each tile: how its carbs split between the pathways
  'ui-guided.pantry.split': 'Glucose {glucose:percent} · fructose {fructose:percent}',
  // On a picked tile: what the recipe uses of it ({amount} "158 g")
  'ui-guided.pantry.usage.used': '{amount} in the recipe',
  'ui-guided.pantry.usage.notNeeded': 'Not needed for this ratio',
  'ui-guided.pantry.usage.noPlanCarbs': 'Not used: the plan has no carbs',
  // The plan has a carb target, but the mix delivers none (a 0:0 ratio, or only carb-free ingredients)
  'ui-guided.pantry.usage.cannotMix': 'Not used: the mix cannot use it. See the warnings.',
  'ui-guided.pantry.salt': 'Salt',
  'ui-guided.pantry.saltReason': 'Salt replaces part of the sodium you lose in sweat.',
  'ui-guided.pantry.saltLabel': 'Which salt do you have?',
  'ui-guided.pantry.salt.table': 'Table salt',
  'ui-guided.pantry.salt.citrate': 'Sodium citrate',
  'ui-guided.pantry.salt.mix': 'Both, half each',
  // The salts are a manual list (set in expert mode)
  'ui-guided.pantry.saltManual': 'You entered the salts yourself in expert mode, and the plan uses them.',
  'ui-guided.pantry.saltAuto': 'Let the plan choose the salts',

  // Screen: the race board
  'ui-guided.board.title': 'Your plan',
  'ui-guided.board.reason': 'Everything for race morning: what to mix and when to take it.',

  // The dock: live targets per hour and the warnings count
  'ui-guided.dock.label': 'Your plan so far',
  'ui-guided.dock.carbs': 'Carbs',
  'ui-guided.dock.sodium': 'Sodium',
  'ui-guided.dock.fluid': 'Fluid',
  // The visible captions of the three numbers: short enough for a third of a 320 px phone (the full names above
  // stay their names for screen readers)
  'ui-guided.dock.carbs.short': 'Carbs',
  'ui-guided.dock.sodium.short': 'Sodium',
  'ui-guided.dock.fluid.short': 'Fluid',
  'ui-guided.dock.gPerHour': 'g/h',
  'ui-guided.dock.mgPerHour': 'mg/h',
  // {unit} is the volume unit of the unit system ("ml", "fl oz")
  'ui-guided.dock.perHour': '{unit}/h',
  'ui-guided.dock.warnings.one': '1 warning',
  'ui-guided.dock.warnings.other': '{count} warnings',

  // Back and Next; after them, for screen readers only, the screen they go to: "Next (Sweat)"
  'ui-guided.nav.label': 'Step navigation',
  'ui-guided.nav.back': 'Back',
  'ui-guided.nav.next': 'Next',
  'ui-guided.nav.target': '({name})',
};

export default uiGuided;
