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
 * German UI text for the Race board (`src/components/board/*`).
 * Same keys and placeholders as `../en/ui-board.js` (a parity test checks
 * it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiBoard = {
  // The board's heading (a small caption over the event summary)
  'ui-board.title': 'Wettkampfübersicht',

  // Title row: event summary, e.g. "3:00 h · Radfahren · Moderat" (shown in capitals)
  'ui-board.summary': '{duration} · {sport} · {intensity}',
  'ui-board.summary.duration': '{hours}:{minutes} h',

  // Sweat chip: rate ± its uncertainty (kept short, so it never truncates)
  'ui-board.chip.sweat': 'Schweiß {rateL:volumeL}/h ±{uncertaintyL:volumeL:nounit}',
  // Where the sweat rate comes from: wrapping text next to the chip
  'ui-board.chip.sweatSource.test': 'Schweißtest',
  'ui-board.chip.sweatSource.testScaled': 'Schweißtest, auf dieses Event skaliert',
  'ui-board.chip.sweatSource.estimate': 'Schätzung',
  'ui-board.chip.sweatSource.estimateNoTest': 'Schätzung (kein nutzbarer Schweißtest)',
  'ui-board.chip.sweatSource.preset': 'Selbst eingeschätzt',
  // Warnings-count chip (a button that opens the warnings panel)
  'ui-board.chip.warnings.one': '1 Warnung',
  'ui-board.chip.warnings.other': '{count} Warnungen',
  // Accessible name of the chip button: the visible count, then what it does
  'ui-board.chip.warnings.show': '{count}: Liste anzeigen',

  // KPI tiles
  'ui-board.kpi.carbs': 'Kohlenhydrate',
  'ui-board.kpi.sodium': 'Natrium',
  'ui-board.kpi.fluid': 'Trinkmenge',
  'ui-board.kpi.caffeine': 'Koffein',
  'ui-board.unit.gPerHour': 'g/h',
  'ui-board.unit.mgPerHour': 'mg/h',
  'ui-board.unit.perHour': '{unit}/h',
  'ui-board.unit.mg': 'mg',
  // After a tile's "Why?" button, for screen readers only: the tile it explains
  'ui-board.kpi.whyFor': '({target})',
  'ui-board.kpi.carbs.sub': '{ratio:ratio} · {g} g gesamt',
  'ui-board.kpi.carbs.none': 'Kein Kohlenhydratziel',
  // Added to the carbs "Why?": the g/h on each pathway the recipe delivers, and the energy line
  'ui-board.kpi.carbs.pathways': 'Dein Rezept liefert {glucose} g/h Glukose und {fructose} g/h Fruktose.',
  'ui-board.kpi.carbs.energy': 'Energie: {energy}.',
  'ui-board.kpi.carbs.short': '{g} g zu wenig: Das Rezept liefert {delivered} g',
  'ui-board.kpi.sodium.sub': '{mg} mg gesamt',
  'ui-board.kpi.sodium.none': 'Kein Natriumziel',
  'ui-board.kpi.sodium.short': '{mg} mg zu wenig: Die Salze liefern {delivered} mg',
  'ui-board.kpi.sodium.over': '{mg} mg zu viel: Die Salze liefern {delivered} mg',
  'ui-board.kpi.sodium.belowRange': 'Unter dem empfohlenen Bereich',
  'ui-board.kpi.fluid.loss': '{ml:volume} gesamt · {pct:percent} Verlust',
  'ui-board.kpi.fluid.gain': '{ml:volume} gesamt · {pct:percent} Zunahme',
  'ui-board.kpi.fluid.none': 'Keine Trinkmenge geplant',
  'ui-board.kpi.fluid.level.mild': '{lo}–{hi:percent} Verlust',
  'ui-board.kpi.fluid.level.high': 'Über {pct:percent} Verlust',
  'ui-board.kpi.fluid.level.gain': 'Gewichtszunahme',
  'ui-board.kpi.caffeine.sub': '{mgPerKg} mg/kg · {doses}',
  'ui-board.kpi.caffeine.doses.one': '1 Dosis',
  'ui-board.kpi.caffeine.doses.other': '{count} Dosen',
  'ui-board.kpi.caffeine.offSub': 'Nicht in diesem Plan',

  // Energy (in the carbs "Why?"): kcal from the carbs in the recipe, energy the event burns
  'ui-board.energy.delivered': '{kcal} kcal aus Kohlenhydraten',
  'ui-board.energy.deliveredOf': '{kcal} von {planned} kcal aus Kohlenhydraten',
  'ui-board.energy.burned': 'du verbrennst etwa {kcal} kcal',
  'ui-board.energy.both': '{delivered} · {burned}',

  // Recipe panel
  'ui-board.recipe.title': 'Rezept',
  'ui-board.recipe.view': 'Rezeptansicht',
  'ui-board.recipe.view.total': 'Gesamt',
  'ui-board.recipe.view.perServing': 'Pro Portion',
  'ui-board.recipe.empty': 'Für diesen Plan gibt es nichts zu mischen.',
  // Section headings ("Gels ×9", "Trinkflaschen ×4"), and without servings
  'ui-board.section.gel': 'Gels ×{count}',
  'ui-board.section.gelNone': 'Gels',
  'ui-board.section.drink': 'Trinkflaschen ×{count}',
  'ui-board.section.drinkNone': 'Getränk',
  'ui-board.section.empty': 'In diesen Teil kommt nichts.',
  // What a section's servings are
  'ui-board.servings.gelNone': 'Keine Gels geplant',
  'ui-board.servings.drinkNone': 'Keine Flaschen: keine Trinkmenge geplant',
  'ui-board.servings.drinkFull': 'je {fill:volume}',
  'ui-board.servings.drinkPartial': 'je {fill:volume} (Flaschengröße {size:volume})',
  // Caption above a section's lanes (per serving uses "Pro Gel" / "Pro Flasche")
  'ui-board.amounts.batch': 'Alle Gels',
  'ui-board.amounts.allBottles': 'Alle Flaschen',
  'ui-board.amounts.activity': 'Gesamte Dauer',
  'ui-board.lanes.label': 'Zutaten',
  // Lane of a carb ingredient: its carbs split by pathway, and its share of the section's carbs
  'ui-board.lane.carbDetail': '{carbs} Kohlenhydrate · Glukose {glucose} · Fruktose {fructose}',
  'ui-board.lane.share': '{pct:percent} der Kohlenhydrate in diesem Teil',
  // What one serving holds ({serving} is "Pro Gel" / "Pro Flasche")
  'ui-board.facts.label': '{serving}: Angaben',
  'ui-board.facts.gelMass': 'Gelmasse',
  'ui-board.facts.gelVolume': 'Gelvolumen',
  'ui-board.facts.carbsPerGel': 'Kohlenhydrate pro Gel',
  'ui-board.facts.carbPct': 'Kohlenhydratanteil',
  'ui-board.facts.carbPctValue': '{pct:percent} m/m',
  'ui-board.facts.about': '≈ {value}',
  'ui-board.facts.fill': 'Jede Flasche auffüllen auf',
  'ui-board.facts.carbsPerBottle': 'Kohlenhydrate pro Flasche',
  'ui-board.facts.carbsPerBottleValue': '{amount} ({pct:percent} m/V)',
  'ui-board.facts.sodiumPerBottle': 'Natrium pro Flasche',
  'ui-board.facts.sodiumPerBottleValue': '{amount} ({mgPerL} mg/L)',
  // Osmolality line with its tonicity chip
  'ui-board.osmo.label': 'Osmolalität',
  // Cost estimate (rough prices per gram of carbs)
  'ui-board.cost.title': 'Kostenschätzung',
  'ui-board.cost.diy': 'Selbst gemischt',
  'ui-board.cost.savings': 'Du sparst',
  'ui-board.cost.savingsValue': '{amount:currency} gegenüber Fertiggels',

  // Actions
  'ui-board.actions.label': 'Rezeptaktionen',
  'ui-board.actions.mix': 'Zubereitung starten',
  'ui-board.actions.print': 'Plan drucken',
  'ui-board.actions.share': 'Plan teilen',

  // Next up: the first schedule events (times and texts as the full schedule writes them)
  'ui-board.next.title': 'Als Nächstes',
  'ui-board.next.full': 'Vollständiger Zeitplan',
  'ui-board.next.more.one': '1 weiterer Eintrag im vollständigen Zeitplan',
  'ui-board.next.more.other': '{count} weitere Einträge im vollständigen Zeitplan',
  'ui-board.next.empty': 'Für diesen Plan ist nichts geplant.',

  // Warnings panel (every plan warning, danger first)
  'ui-board.warnings.titleCount': 'Warnungen ({count})',
  'ui-board.warnings.empty': 'Keine Warnungen für diesen Plan.',
  // Polite announcement (screen readers) when the number of warnings or dangers changes
  'ui-board.live.none': 'Keine Warnungen',
  'ui-board.live.withDangers': '{warnings}, {dangers}',
  'ui-board.live.dangers.one': '1 Gefahr',
  'ui-board.live.dangers.other': '{count} Gefahren',
};

export default uiBoard;
