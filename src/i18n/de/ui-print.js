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
 * German UI text for the print layout.
 * Same keys and placeholders as `../en/ui-print.js` (a parity test checks
 * it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiPrint = {
  // Page title and the date of printing ({date} in the locale's long form)
  'ui-print.title': 'Verpflegungsplan für den Wettkampf',
  'ui-print.printedOn': 'Gedruckt am {date}',
  'ui-print.footer':
    'Erstellt mit Gel-Calculator (eikekarbe.com/gel-calculator). Dieser Plan ist eine allgemeine Orientierung, keine medizinische Beratung. Probiere ihn im Training aus, bevor du ihn im Wettkampf nutzt.',

  // Block headings
  'ui-print.block.summary': 'Planübersicht',
  'ui-print.block.recipe': 'Rezept',
  'ui-print.block.mixing': 'Zubereitung',
  'ui-print.block.schedule': 'Zeitplan',
  'ui-print.block.warnings': 'Warnungen und Hinweise',
  'ui-print.block.sources': 'Quellen',

  // Plan summary: terms
  'ui-print.term.activity': 'Aktivität',
  'ui-print.term.conditions': 'Bedingungen',
  'ui-print.term.carbs': 'Kohlenhydrate',
  'ui-print.term.sodium': 'Natrium',
  'ui-print.term.fluid': 'Trinkmenge',
  'ui-print.term.sweat': 'Schweißrate',
  'ui-print.term.bodyMass': 'Körpergewicht',
  'ui-print.term.format': 'Format',
  'ui-print.term.caffeine': 'Koffein',
  'ui-print.term.bicarb': 'Natron (Natriumbicarbonat)',
  'ui-print.term.energy': 'Energie',

  // Plan summary: values
  'ui-print.summary.activity': '{sport} · {duration} · Intensität {intensity}',
  'ui-print.summary.conditions': '{setting} · {tempC:temp} · {humidity:percent} Luftfeuchtigkeit',
  // Outdoors only: the sweat model uses the sun outdoors only
  'ui-print.summary.conditionsSun': '{setting} · {tempC:temp} · {humidity:percent} Luftfeuchtigkeit · {sun}',
  'ui-print.summary.carbs': '{gPerHour} g/h · {deliveredG} g im Rezept · Glukose:Fruktose {ratio:ratio}',
  'ui-print.summary.sodium': '{mgPerHour} mg/h · {deliveredMg} mg im Rezept',
  'ui-print.summary.fluid': '{mlPerHour:volume}/h · {totalMl:volume} insgesamt',
  // ± {uncertainty} is in the same unit as the rate
  'ui-print.summary.sweat': '{rateLph:volumeL}/h ± {uncertaintyLph:volumeL:nounit} ({source})',
  // {scale}: signed change on the scale ("−0,6 kg"); {water}: one of the water texts below; {level}: a level text
  'ui-print.summary.bodyMass': 'Etwa {scale} auf der Waage nach der Aktivität · {water} · {level}',
  'ui-print.summary.caffeine': '{totalMg} mg insgesamt ({mgPerKg} mg/kg)',
  'ui-print.summary.bicarb': '{doseG} g, {minutes} min vor dem Start',
  'ui-print.summary.bicarbNoTime': '{doseG} g',
  'ui-print.summary.energy': '{deliveredKcal} kcal aus Kohlenhydraten · etwa {burnedKcal} kcal verbrannt (Schätzung)',
  // Format row: {gels} and {bottles} are the texts below
  'ui-print.summary.format.gel': 'Gels: {gels}',
  'ui-print.summary.format.drink': 'Getränk: {bottles}',
  'ui-print.summary.format.both': 'Gels: {gels}. Getränk: {bottles}',
  'ui-print.summary.gels.one': '{count} Gel ({perHour} pro Stunde)',
  'ui-print.summary.gels.other': '{count} Gels ({perHour} pro Stunde)',
  'ui-print.summary.gels.none': 'keine Gels',
  'ui-print.summary.drink.none': 'kein Getränk',

  // Words inside the summary values
  'ui-print.intensity.easy': 'locker',
  'ui-print.intensity.moderate': 'moderat',
  'ui-print.intensity.hard': 'hart',
  'ui-print.intensity.race': 'Wettkampf',
  // Mid-sentence, so lower case where German allows it
  'ui-print.sun.none': 'Schatten oder bewölkt',
  'ui-print.sun.partly': 'teils sonnig',
  'ui-print.sun.full': 'volle Sonne',
  'ui-print.sweatSource.test': 'aus deinem Schweißtest',
  'ui-print.sweatSource.estimate': 'Schätzung über die Wärmebilanz',
  'ui-print.sweatSource.preset': 'Selbsteinschätzung',
  // Body mass: water lost or gained over the activity, and its share of body mass
  'ui-print.bodyMass.lost': 'Wasserverlust {waterL:volumeL} ({pct:percent} des Körpergewichts)',
  'ui-print.bodyMass.gained': 'Wasserzunahme {waterL:volumeL} ({pct:percent} des Körpergewichts)',
  'ui-print.bodyMass.level.ok': 'Bis {limit:percent} Verlust',
  'ui-print.bodyMass.level.mild': '{lo}–{hi:percent} Verlust',
  'ui-print.bodyMass.level.high': 'Über {limit:percent} Verlust',
  'ui-print.bodyMass.level.gain': 'Gewichtszunahme',

  // Recipe sections: "Gelmischung: 9 Gels", the ingredient table, the facts per serving
  'ui-print.section.gel': 'Gelmischung',
  'ui-print.section.drink': 'Getränk',
  'ui-print.section.heading': '{title}: {servings}',
  'ui-print.section.caption': 'Zutaten: {title}',
  'ui-print.section.empty': 'Nichts zu mischen.',
  'ui-print.servings.gelNone': 'keine Gels geplant',
  'ui-print.servings.drinkNone': 'keine Flaschen, da keine Trinkmenge geplant ist',
  'ui-print.table.ingredient': 'Zutat',
  'ui-print.amounts.activity': 'Gesamte Dauer',
  'ui-print.amounts.batch': 'Alle Gels',
  'ui-print.amounts.allBottles': 'Alle Flaschen',
  'ui-print.fact.consistency': 'Konsistenz: {consistency}, {pct:percent} Kohlenhydrate.',
  'ui-print.fact.eachGel': 'Jedes Gel: etwa {mass} ({volume}) mit {carbs} Kohlenhydraten.',
  'ui-print.fact.eachBottle':
    'Jede Flasche: {carbs} Kohlenhydrate ({pct:percent} m/V) und {sodiumMg} mg Natrium ({mgPerL} mg/L).',
  'ui-print.fact.osmolality': 'Osmolalität: {value}.',
  // Osmolality ({value} as ui-recipe.osmo.* writes it) and its tonicity in lower case
  'ui-print.osmo.withTonicity': '{value} ({tonicity})',

  // Mixing steps (the steps are ui-recipe.mix.*, as in the mixing dialog): a recipe line as printed
  'ui-print.mix.steps': 'Schritte: {title}',
  'ui-print.mix.line': '{amount} {name}',
  'ui-print.mix.nothing': 'Für diesen Plan gibt es nichts zu mischen.',
  'ui-print.mix.rinse': 'Mundspülung als Option.',
  'ui-print.mix.caffeine.line': '{name}: {amount}',

  // Schedule table
  'ui-print.schedule.caption': 'Zeitplan für den Wettkampf',

  // Warnings and sources
  'ui-print.warnings.list': 'Gedruckte Warnungen',
  'ui-print.warnings.none': 'Keine für diesen Plan.',
  'ui-print.references': 'Literatur',
  // One reference: authors, year, title, journal (as the study gives them), then its link
  'ui-print.reference': '{authors} ({year}). {title}. {journal}.',
  'ui-print.referenceWithUrl': '{authors} ({year}). {title}. {journal}. {url}',
};

export default uiPrint;
