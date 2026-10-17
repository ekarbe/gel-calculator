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
 * German UI text for the Targets and Caffeine & bicarbonate sections.
 * Same keys and placeholders as `../en/ui-setup-targets.js` (a parity test
 * checks it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiSetupTargets = {
  // Section titles and the one-line summary a collapsed section shows
  'ui-setup-targets.targets.title': 'Ziele',
  'ui-setup-targets.targets.summary':
    'Kohlenhydrate {g} g/h · {ratio:ratio} · Natrium {mg} mg/h · Trinkmenge {ml:volume}/h',
  'ui-setup-targets.supplements.title': 'Koffein & Natron',
  'ui-setup-targets.supplements.summary': '{caffeine} · {bicarb}',
  'ui-setup-targets.supplements.summary.caffeineOff': 'Koffein aus',
  'ui-setup-targets.supplements.summary.caffeineOn': 'Koffein {mg} mg',
  'ui-setup-targets.supplements.summary.bicarbOff': 'Natron aus',
  'ui-setup-targets.supplements.summary.bicarbOn': 'Natron {g} g',

  // Units written after a number (nutrients are never converted); {unit} is "ml" or "fl oz"
  'ui-setup-targets.unit.gPerHour': 'g/h',
  'ui-setup-targets.unit.mgPerHour': 'mg/h',
  'ui-setup-targets.unit.perHour': '{unit}/h',
  'ui-setup-targets.unit.mgPerKg': 'mg/kg',
  'ui-setup-targets.unit.gPerKg': 'g/kg',

  // Carbohydrate target
  'ui-setup-targets.carbs.title': 'Kohlenhydrate',
  'ui-setup-targets.carbs.mode': 'Modus Kohlenhydratziel',
  'ui-setup-targets.carbs.target': 'Dein Ziel',
  'ui-setup-targets.carbs.total': '{g} g insgesamt',
  'ui-setup-targets.carbs.recommended': 'Empfohlen',
  'ui-setup-targets.carbs.perHour': '{g} g/h',
  'ui-setup-targets.carbs.range': 'Bereich laut Studien',
  'ui-setup-targets.carbs.rangeValue': '{lo}–{hi} g/h',
  'ui-setup-targets.carbs.band': 'Dauerbereich',
  'ui-setup-targets.carbs.band.none': 'Unter 45 min',
  'ui-setup-targets.carbs.band.rinse': '45–75 min',
  'ui-setup-targets.carbs.band.short': '75–120 min',
  'ui-setup-targets.carbs.band.medium': '2–2,5 h',
  'ui-setup-targets.carbs.band.long': 'Über 2,5 h',
  'ui-setup-targets.carbs.band.veryHigh': 'Über 2,5 h, darmtrainiert',
  'ui-setup-targets.carbs.highCarb.label': 'Darmtrainiert: 90–120 g/h erlauben',
  'ui-setup-targets.carbs.highCarb.hint': 'Nur wenn du deinen Darm 2–4 Wochen lang an hohe Mengen gewöhnt hast.',
  'ui-setup-targets.carbs.mouthRinse.title': 'Mundspülung als Option',

  // Glucose:fructose ratio
  'ui-setup-targets.ratio.title': 'Glukose:Fruktose-Verhältnis',
  'ui-setup-targets.ratio.mode': 'Modus Verhältnis',
  'ui-setup-targets.ratio.recommendedLabel': 'Empfohlenes Verhältnis',
  'ui-setup-targets.ratio.yourLabel': 'Dein Verhältnis',
  'ui-setup-targets.ratio.at': 'Glukose : Fruktose bei deinem Ziel von {g} g/h',
  'ui-setup-targets.ratio.recommended': 'Empfohlen',
  'ui-setup-targets.ratio.allowed': 'Erlaubter Bereich',
  'ui-setup-targets.ratio.allowedValue': '{lo:ratio}–{hi:ratio}',
  'ui-setup-targets.ratio.share': 'Fruktoseanteil',
  // The share and its allowed range; the range is kept on one line after it.
  'ui-setup-targets.ratio.shareValue': '{pct:percent}',
  'ui-setup-targets.ratio.shareAllowed': '(erlaubt {lo}–{hi:percent})',
  'ui-setup-targets.ratio.glucoseParts': 'Teile Glukose',
  'ui-setup-targets.ratio.fructoseParts': 'Teile Fruktose',
  // Hints of the part fields; {parts} is 1 or 0.5 and {ratio} the example 1:0.5
  'ui-setup-targets.ratio.glucoseHint': 'Die Glukoseseite des Verhältnisses, z. B. {parts} in {ratio:ratio}.',
  'ui-setup-targets.ratio.fructoseHint': 'Die Fruktoseseite des Verhältnisses, z. B. {parts} in {ratio:ratio}.',

  // Sodium target
  'ui-setup-targets.sodium.title': 'Natrium',
  'ui-setup-targets.sodium.mode': 'Modus Natriumziel',
  'ui-setup-targets.sodium.optional': 'Optional',
  'ui-setup-targets.sodium.target': 'Dein Ziel',
  'ui-setup-targets.sodium.manual': 'Dein Natriumziel',
  'ui-setup-targets.sodium.total': '{mg} mg insgesamt',
  'ui-setup-targets.sodium.recommended': 'Empfohlen',
  'ui-setup-targets.sodium.perHour': '{mg} mg/h',
  'ui-setup-targets.sodium.range': 'Bereich',
  'ui-setup-targets.sodium.rangeValue': '{lo}–{hi} mg/h',
  'ui-setup-targets.sodium.loss': 'Geschätzter Verlust über den Schweiß',
  'ui-setup-targets.sodium.lossValue': 'etwa {mg} mg/h',

  // Fluid target
  'ui-setup-targets.fluid.title': 'Trinkmenge',
  'ui-setup-targets.fluid.mode': 'Modus Trinkmenge',
  'ui-setup-targets.fluid.target': 'Dein Ziel',
  'ui-setup-targets.fluid.manual': 'Deine Trinkmenge',
  'ui-setup-targets.fluid.total': '{ml:volume} insgesamt',
  'ui-setup-targets.fluid.recommended': 'Empfohlen',
  'ui-setup-targets.fluid.perHour': '{ml:volume}/h',
  'ui-setup-targets.fluid.range': 'Bereich laut Leitlinien',
  'ui-setup-targets.fluid.rangeValue': '{lo:volume:nounit}–{hi:volume}/h',
  'ui-setup-targets.fluid.sweat': 'Schweißverlust',
  'ui-setup-targets.fluid.sweatValue': 'etwa {ml:volume}/h',
  'ui-setup-targets.fluid.thirst': 'Bei diesem Event klappt Trinken nach Durst gut. Nutze diesen Wert als grobe Orientierung.',
  'ui-setup-targets.fluid.bodyMass': 'Auf der Waage nach dem Event',

  // Advanced: optional ions
  'ui-setup-targets.extras.title': 'Erweitert: Kalium, Magnesium, Calcium',
  'ui-setup-targets.extras.potassium': 'Kalium',
  'ui-setup-targets.extras.magnesium': 'Magnesium',
  'ui-setup-targets.extras.calcium': 'Calcium',
  'ui-setup-targets.extras.perHour': '{mg} mg/h',

  // Caffeine
  'ui-setup-targets.caffeine.title': 'Koffein',
  'ui-setup-targets.caffeine.include': 'Koffein einplanen',
  'ui-setup-targets.caffeine.dose': 'Koffeindosis',
  'ui-setup-targets.caffeine.doseHint': 'Pro kg Körpergewicht ({massKg:mass}).',
  'ui-setup-targets.caffeine.asTablets': 'Als Tabletten in die Gels',
  'ui-setup-targets.caffeine.asTabletsHint': 'Zerdrücke Koffeintabletten und rühre sie in die Gels, die du während der Belastung nimmst.',
  'ui-setup-targets.caffeine.tabletSize': 'Tablettengröße',
  'ui-setup-targets.caffeine.tabletOption': '{mg} mg',
  'ui-setup-targets.caffeine.doses': 'Geplante Dosen',
  'ui-setup-targets.caffeine.dosesList': 'Geplante Koffeindosen',
  'ui-setup-targets.caffeine.when.pre': 'Vor dem Start',
  'ui-setup-targets.caffeine.when.gel': 'Mit Gel {gel}',
  'ui-setup-targets.caffeine.when.intra': 'Während der Belastung',
  'ui-setup-targets.caffeine.mg': '{mg} mg',
  'ui-setup-targets.caffeine.tablets': '({tablets} × {tabletMg}-mg-Tablette)',
  'ui-setup-targets.caffeine.total': 'Insgesamt {mg} mg ({mgPerKg} mg/kg)',

  // Sodium bicarbonate (behind a link for events over 90 min)
  'ui-setup-targets.bicarb.title': 'Natron (Natriumbicarbonat)',
  'ui-setup-targets.bicarb.show': 'Natron anzeigen (für Belastungen unter ~60 min)',
  'ui-setup-targets.bicarb.include': 'Natron einplanen',
  'ui-setup-targets.bicarb.includeHint': 'Ein Puffer vor dem Start für harte Belastungen bis etwa 60 min.',
  'ui-setup-targets.bicarb.dose': 'Natrondosis',
  'ui-setup-targets.bicarb.doseHint': 'Pro kg Körpergewicht ({massKg:mass}).',
  'ui-setup-targets.bicarb.doseFact': 'Dosis',
  'ui-setup-targets.bicarb.grams': '{g} g',
  'ui-setup-targets.bicarb.sodium': 'Natriummenge',
  'ui-setup-targets.bicarb.timing': 'Einnahme',
  // Times from the start as the schedule writes them, and in words for screen readers
  'ui-setup-targets.bicarb.timingValue': '{time} (Zeitfenster {earliest} bis {latest})',
  'ui-setup-targets.bicarb.timingSpoken': '{time}, in einem Zeitfenster von {earliest} bis {latest}',
};

export default uiSetupTargets;
