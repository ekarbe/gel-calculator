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
 * German UI text for guided mode.
 * Same keys and placeholders as `../en/ui-guided.js` (a parity test checks
 * it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiGuided = {
  // Progress: the four steps (a navigation list), and the caption over each screen's heading
  'ui-guided.progress.label': 'Geführte Eingabe',
  'ui-guided.progress.step': 'Schritt {number} von {total}',
  // Read before each step's name in the step list (screen readers only): "Schritt 2: Körper & Wetter"
  'ui-guided.progress.stepNumber': 'Schritt {number}:',
  'ui-guided.step.event': 'Event',
  'ui-guided.step.bodyWeather': 'Körper & Wetter',
  'ui-guided.step.ingredients': 'Zutaten',
  'ui-guided.step.plan': 'Rezept & Plan',
  // "Schritt 2 von 4 · Körper & Wetter"
  'ui-guided.screen.caption': '{step} · {name}',

  // Leaving the guided flow (expert mode shows everything set here)
  'ui-guided.switchToExpert': 'Zum Expertenmodus',
  'ui-guided.switchToExpertHint': 'Der Expertenmodus behält alles, was du eingegeben hast.',
  // Shown in the dock when "Switch to expert" finds a form that is not saved ({button} is ui-guided.switchToExpert)
  'ui-guided.leave.unsaved':
    'Dieses Formular ist noch nicht gespeichert. Speichere oder verwirf es zuerst, oder wähle erneut „{button}“, um ohne Speichern zu wechseln.',

  // Screen: the event
  'ui-guided.event.title': 'Dein Event',
  'ui-guided.event.reason': 'Wie lange und wie hart du unterwegs bist, bestimmt, wie viele Kohlenhydrate du pro Stunde brauchst.',

  // Screen: body and weather
  'ui-guided.conditions.title': 'Körper & Wetter',
  'ui-guided.conditions.reason': 'Deine Körpermaße und das Wetter bestimmen, wie viel Wärme du erzeugst und wie stark du schwitzt.',

  // Screen: the sweat test question, then the test list or the estimate
  'ui-guided.sweat.title': 'Schweiß',
  'ui-guided.sweat.reason': 'Deine Schweißrate bestimmt, wie viel du trinken solltest. Wie salzig dein Schweiß ist, bestimmt die Natriummenge.',
  'ui-guided.sweat.question': 'Hast du einen Schweißtest gemacht?',
  'ui-guided.sweat.yes': 'Ja',
  'ui-guided.sweat.no': 'Nein',
  'ui-guided.sweat.yesHint': 'Füge deinen Test unten hinzu. Der Plan nutzt den Test, den du auswählst.',
  'ui-guided.sweat.noHint': 'Kein Problem. Der Plan schätzt deine Schweißrate aus deinem Event, deinem Körper und dem Wetter.',
  // The sweat source is a self-assessed preset (set in expert mode)
  'ui-guided.sweat.presetHint': 'Du hast im Expertenmodus selbst eine Schweißrate gewählt, und der Plan nutzt sie.',
  'ui-guided.sweat.useEstimate': 'Stattdessen die Schätzung nutzen',

  // Screen: the pantry (carb ingredients as a pick-from grid, then the sodium salt)
  'ui-guided.pantry.title': 'Dein Vorrat',
  'ui-guided.pantry.reason':
    'Wähle die Zuckerarten, die du hast. Die Mischung kombiniert sie so, dass sie das Glukose:Fruktose-Verhältnis erreicht, das deine Kohlenhydratmenge braucht.',
  'ui-guided.pantry.carbs': 'Kohlenhydrate',
  'ui-guided.pantry.carbsHint':
    'Wähle eine Kachel, um sie hinzuzufügen, und noch einmal, um sie zu entfernen. Über 60 g Kohlenhydrate pro Stunde braucht die Mischung auch einen Zucker mit Fruktose.',
  'ui-guided.pantry.more': 'Weitere Zutaten',
  'ui-guided.pantry.powders': 'Pulver',
  'ui-guided.pantry.syrups': 'Sirupe',
  'ui-guided.pantry.yours': 'Eigene',
  'ui-guided.pantry.custom': 'Eigene Zutat vom Etikett hinzufügen',
  // On each tile: how its carbs split between the pathways
  'ui-guided.pantry.split': 'Glukose {glucose:percent} · Fruktose {fructose:percent}',
  // On a picked tile: what the recipe uses of it ({amount} "158 g")
  'ui-guided.pantry.usage.used': '{amount} im Rezept',
  'ui-guided.pantry.usage.notNeeded': 'Für dieses Verhältnis nicht nötig',
  'ui-guided.pantry.usage.noPlanCarbs': 'Nicht verwendet: Der Plan hat keine Kohlenhydrate',
  // The plan has a carb target, but the mix delivers none (a 0:0 ratio, or only carb-free ingredients)
  'ui-guided.pantry.usage.cannotMix': 'Nicht verwendet: Die Mischung kann sie nicht nutzen. Siehe Warnungen.',
  'ui-guided.pantry.salt': 'Salz',
  'ui-guided.pantry.saltReason': 'Salz ersetzt einen Teil des Natriums, das du über den Schweiß verlierst.',
  'ui-guided.pantry.saltLabel': 'Welches Salz hast du?',
  'ui-guided.pantry.salt.table': 'Kochsalz',
  'ui-guided.pantry.salt.citrate': 'Natriumcitrat',
  'ui-guided.pantry.salt.mix': 'Beides, je zur Hälfte',
  // The salts are a manual list (set in expert mode)
  'ui-guided.pantry.saltManual': 'Du hast die Salze im Expertenmodus selbst eingetragen, und der Plan nutzt sie.',
  'ui-guided.pantry.saltAuto': 'Salze vom Plan wählen lassen',

  // Screen: the race board
  'ui-guided.board.title': 'Dein Plan',
  'ui-guided.board.reason': 'Alles für den Wettkampfmorgen: was du mischst und wann du es nimmst.',

  // The dock: live targets per hour and the warnings count
  'ui-guided.dock.label': 'Dein Plan bisher',
  'ui-guided.dock.carbs': 'Kohlenhydrate',
  'ui-guided.dock.sodium': 'Natrium',
  'ui-guided.dock.fluid': 'Trinkmenge',
  // Visible captions (a third of a 320 px phone); the full names above stay their names for screen readers
  'ui-guided.dock.carbs.short': 'KH',
  'ui-guided.dock.sodium.short': 'Natrium',
  'ui-guided.dock.fluid.short': 'Trinken',
  'ui-guided.dock.gPerHour': 'g/h',
  'ui-guided.dock.mgPerHour': 'mg/h',
  // {unit} is the volume unit of the unit system ("ml", "fl oz")
  'ui-guided.dock.perHour': '{unit}/h',
  'ui-guided.dock.warnings.one': '1 Warnung',
  'ui-guided.dock.warnings.other': '{count} Warnungen',

  // Back and Next; after them, for screen readers only, the screen they go to: "Weiter (Schweiß)"
  'ui-guided.nav.label': 'Schrittnavigation',
  'ui-guided.nav.back': 'Zurück',
  'ui-guided.nav.next': 'Weiter',
  'ui-guided.nav.target': '({name})',
};

export default uiGuided;
