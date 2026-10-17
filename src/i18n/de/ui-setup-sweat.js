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
 * German UI text for the Sweat section.
 * Same keys and placeholders as `../en/ui-setup-sweat.js` (a parity test
 * checks it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiSetupSweat = {
  // Panel title row
  'ui-setup-sweat.title': 'Schweiß',
  'ui-setup-sweat.description': 'Deine Schweißrate und der Salzgehalt deines Schweißes bestimmen die Ziele für Trinkmenge und Natrium.',
  // Chip in the title row: the sweat rate the plan uses (visible when the panel is collapsed)
  'ui-setup-sweat.headerRate': '{rateLph:volumeL}/h',

  // Where the sweat rate comes from (tabs)
  'ui-setup-sweat.source.label': 'Quelle der Schweißrate',
  'ui-setup-sweat.source.test': 'Test',
  'ui-setup-sweat.source.estimate': 'Schätzung',
  'ui-setup-sweat.source.preset': 'Vorgaben',

  // Presets: self-assessed sweat rate (index 0–5, lightest to heaviest)
  'ui-setup-sweat.preset.label': 'Schweißrate',
  'ui-setup-sweat.preset.intro': 'Wähle die Beschreibung, die im Training bei Wettkampfintensität auf dich zutrifft.',
  'ui-setup-sweat.preset.option': '{name} ({rateLph:volumeL}/h)',
  'ui-setup-sweat.preset.0.name': 'Leichtes Schwitzen',
  'ui-setup-sweat.preset.0.description': 'Die Haut fühlt sich leicht feucht an.',
  'ui-setup-sweat.preset.1.name': 'Mäßiges Schwitzen',
  'ui-setup-sweat.preset.1.description': 'Spürbar feuchte Haut, auf dem Shirt eventuell kleine feuchte Stellen.',
  'ui-setup-sweat.preset.2.name': 'Deutliches Schwitzen',
  'ui-setup-sweat.preset.2.description': 'Deutliche nasse Stellen auf der Kleidung, ab und zu tropft Schweiß.',
  'ui-setup-sweat.preset.3.name': 'Starkes Schwitzen',
  'ui-setup-sweat.preset.3.description': 'Kleidung großflächig durchnässt, Schweiß tropft ständig.',
  'ui-setup-sweat.preset.4.name': 'Sehr starkes Schwitzen',
  'ui-setup-sweat.preset.4.description': 'Kleidung komplett durchnässt, Schweiß tropft oder läuft ständig.',
  'ui-setup-sweat.preset.5.name': 'Extremes Schwitzen',
  'ui-setup-sweat.preset.5.description': 'Übermäßiges Schwitzen, die Kleidung ist völlig durchtränkt.',

  // Saltiness: self-assessed sweat sodium (index 0–5, least to most salty)
  'ui-setup-sweat.saltiness.label': 'Salzgehalt im Schweiß',
  'ui-setup-sweat.saltiness.option': '{name} ({mgPerL} mg/L)',
  'ui-setup-sweat.saltiness.0.name': 'Sehr niedriger Salzgehalt',
  'ui-setup-sweat.saltiness.0.description': 'Schweiß schmeckt kaum salzig, kaum Salzränder auf der Kleidung.',
  'ui-setup-sweat.saltiness.1.name': 'Niedriger Salzgehalt',
  'ui-setup-sweat.saltiness.1.description': 'Leicht salziger Geschmack, auf dunkler Kleidung eventuell schwache weiße Ränder.',
  'ui-setup-sweat.saltiness.2.name': 'Mittlerer Salzgehalt',
  'ui-setup-sweat.saltiness.2.description': 'Deutlich salziger Geschmack, sichtbare weiße Ränder auf getrockneter Kleidung.',
  'ui-setup-sweat.saltiness.3.name': 'Hoher Salzgehalt',
  'ui-setup-sweat.saltiness.3.description': 'Stark salziger Geschmack, auffällige weiße Ränder nach dem Trocknen.',
  'ui-setup-sweat.saltiness.4.name': 'Sehr hoher Salzgehalt',
  'ui-setup-sweat.saltiness.4.description': 'Sehr stark salziger Geschmack, dicke weiße Rückstände auf der Kleidung.',
  'ui-setup-sweat.saltiness.5.name': 'Extremer Salzgehalt',
  'ui-setup-sweat.saltiness.5.description': 'Extrem salzig, starke weiße Salzkrusten auf Haut und Kleidung.',
  'ui-setup-sweat.saltiness.about': 'Zum Salzgehalt im Schweiß',
  'ui-setup-sweat.saltiness.aboutText':
    'Der Salzgehalt gibt an, wie viel Natrium ein Liter Schweiß enthält. Die meisten verlieren 0,5–1,5 g Natrium pro Liter. Weiße Salzränder auf dunkler Kleidung deuten auf salzigeren Schweiß hin. Diese Stufe gilt für jede Quelle der Schweißrate.',

  // Estimate tab: the heat-balance estimate and what drives it
  'ui-setup-sweat.estimate.label': 'Geschätzte Schweißrate',
  'ui-setup-sweat.estimate.value': '{rateLph:volumeL}/h ± {uncertaintyLph:volumeL}/h',
  'ui-setup-sweat.estimate.heatProduction': 'Wärmeproduktion',
  'ui-setup-sweat.estimate.energyUse': 'Energieverbrauch',
  'ui-setup-sweat.estimate.heatToLose': 'Über Schweiß abzugebende Wärme',
  'ui-setup-sweat.estimate.watts': '{watts} W',
  'ui-setup-sweat.estimate.kcalPerHour': '{kcal} kcal/h',
  'ui-setup-sweat.estimate.uses': 'Grundlage: {conditions}.',
  'ui-setup-sweat.estimate.usesAcclimatised': 'Grundlage: {conditions}, hitzeakklimatisiert.',
  'ui-setup-sweat.estimate.changeHint': 'Ändern kannst du das unter „Event“ und „Körper & Wetter“.',
  'ui-setup-sweat.estimate.capped': 'Das ist das Maximum, das das Modell für deine Körpermaße zulässt ({maxLph:volumeL}/h).',
  'ui-setup-sweat.estimate.details': 'Details zur Wärmebilanz',
  'ui-setup-sweat.estimate.airSpeed': 'Luftgeschwindigkeit an der Haut',
  'ui-setup-sweat.estimate.airSpeedValue': '{speed:speed}',
  'ui-setup-sweat.estimate.skinTemp': 'Hauttemperatur',
  'ui-setup-sweat.estimate.skinTempValue': '{tempC:temp}',
  'ui-setup-sweat.estimate.dryHeatLoss': 'Wärmeabgabe an die Luft',
  // Shown instead when the air is hotter than the skin (the body takes up heat from it)
  'ui-setup-sweat.estimate.dryHeatGain': 'Wärmeaufnahme aus der Luft',
  'ui-setup-sweat.estimate.breathing': 'Wärmeabgabe über die Atmung',
  'ui-setup-sweat.estimate.sun': 'Wärme durch die Sonne',
  // Cycling faster than 10.8 km/h: the dry heat flows use the capped air speed (ISO 7933 limit)
  'ui-setup-sweat.estimate.dryAirSpeedCapped':
    'Die Wärmeabgabe an die Luft und die Wärme durch die Sonne berechnet das Modell mit höchstens {speed:speed} Luftgeschwindigkeit, der Grenze der Hitzestress-Norm ISO 7933. Für die Verdunstung von Schweiß nutzt es die volle Luftgeschwindigkeit.',

  // Exercise conditions as one line (estimate and test list)
  'ui-setup-sweat.conditions.running': 'Laufen mit {speedKmh:speed}',
  'ui-setup-sweat.conditions.cyclingPower': 'Radfahren mit {powerW} W',
  'ui-setup-sweat.conditions.cyclingSpeed': 'Radfahren mit {speedKmh:speed}',
  'ui-setup-sweat.conditions.cyclingSpeedPower': 'Radfahren mit {speedKmh:speed} (etwa {powerW} W)',
  'ui-setup-sweat.conditions.other': 'Andere Sportart mit {mets} MET',
  'ui-setup-sweat.conditions.temp': '{tempC:temp}',
  'ui-setup-sweat.conditions.humidity': '{humidity:percent} Luftfeuchtigkeit',
  'ui-setup-sweat.conditions.setting.outdoor': 'draußen',
  'ui-setup-sweat.conditions.setting.indoorFan': 'drinnen mit Ventilator',
  'ui-setup-sweat.conditions.setting.indoorNoFan': 'drinnen ohne Ventilator',
  'ui-setup-sweat.conditions.sun.none': 'Schatten oder bewölkt',
  'ui-setup-sweat.conditions.sun.partly': 'teils sonnig',
  'ui-setup-sweat.conditions.sun.full': 'volle Sonne',

  // Test tab: the list of sweat tests
  'ui-setup-sweat.tests.intro':
    'Wiege dich vor und nach einer Trainingseinheit, um deine eigene Schweißrate zu messen. Der Plan nutzt den Test, den du auswählst.',
  'ui-setup-sweat.tests.empty': 'Noch keine Schweißtests.',
  'ui-setup-sweat.tests.legend': 'Test für den Plan',
  'ui-setup-sweat.tests.listLabel': 'Schweißtests',
  'ui-setup-sweat.tests.defaultName': 'Schweißtest {number}',
  'ui-setup-sweat.tests.inUse': 'Aktiv',
  'ui-setup-sweat.tests.noDate': 'Kein Datum',
  'ui-setup-sweat.tests.duration': '{minutes} min',
  'ui-setup-sweat.tests.measured': 'Gemessen',
  'ui-setup-sweat.tests.measuredValue': '{rateLph:volumeL}/h',
  'ui-setup-sweat.tests.cannotUse': 'Nicht verwendbar:',
  'ui-setup-sweat.tests.edit': '{name} bearbeiten',
  'ui-setup-sweat.tests.delete': '{name} löschen',
  'ui-setup-sweat.tests.deleteQuestion': '{name} löschen? Das lässt sich nicht rückgängig machen.',
  'ui-setup-sweat.tests.confirmDelete': 'Ja, löschen',
  'ui-setup-sweat.tests.cancelDelete': 'Abbrechen',
  'ui-setup-sweat.tests.add': 'Schweißtest hinzufügen',
  'ui-setup-sweat.tests.limit': 'Du kannst bis zu {max} Tests speichern. Lösche einen, um einen neuen hinzuzufügen.',

  // Test tab: scaling the test to the event
  'ui-setup-sweat.calibration.label': 'Test auf dieses Event skalieren',
  'ui-setup-sweat.calibration.scaled':
    'Gemessen: {measuredLph:volumeL}/h. Auf dieses Event skaliert: {rateLph:volumeL}/h (Faktor {factor}).',
  'ui-setup-sweat.calibration.scaledAtLimit':
    'Gemessen: {measuredLph:volumeL}/h. Auf dieses Event skaliert: {rateLph:volumeL}/h (Faktor {factor}, an der Grenze).',
  'ui-setup-sweat.calibration.direct': 'Gemessen: {measuredLph:volumeL}/h, unverändert verwendet.',

  // Test tab: the add/edit form
  'ui-setup-sweat.form.addTitle': 'Schweißtest hinzufügen',
  'ui-setup-sweat.form.editTitle': 'Schweißtest bearbeiten',
  'ui-setup-sweat.form.howTo': 'So testest du:',
  'ui-setup-sweat.form.date': 'Datum',
  'ui-setup-sweat.form.name': 'Name (optional)',
  'ui-setup-sweat.form.namePlaceholder': 'Rollentraining bei Hitze',
  'ui-setup-sweat.form.preMass': 'Körpergewicht vorher',
  'ui-setup-sweat.form.postMass': 'Körpergewicht nachher',
  // Read after a body-mass label by screen readers only
  'ui-setup-sweat.form.unitInName': '({unit})',
  'ui-setup-sweat.form.fluid': 'Getrunkene Flüssigkeit',
  'ui-setup-sweat.form.urine': 'Ausgeschiedener Urin',
  'ui-setup-sweat.form.duration': 'Dauer',
  'ui-setup-sweat.form.conditions': 'Bedingungen beim Test',
  'ui-setup-sweat.form.sport': 'Sportart',
  'ui-setup-sweat.form.speed': 'Geschwindigkeit',
  'ui-setup-sweat.form.power': 'Leistung',
  'ui-setup-sweat.form.powerHint': '0 = aus der Geschwindigkeit schätzen',
  'ui-setup-sweat.form.mets': 'Belastung',
  'ui-setup-sweat.form.setting': 'Umgebung',
  'ui-setup-sweat.form.temp': 'Temperatur',
  'ui-setup-sweat.form.humidity': 'Luftfeuchtigkeit',
  'ui-setup-sweat.form.sun': 'Sonne',
  'ui-setup-sweat.form.preview': 'Dieser Test ergibt {rateLph:volumeL}/h Schweiß.',
  'ui-setup-sweat.form.save': 'Test speichern',
  'ui-setup-sweat.form.cancel': 'Abbrechen',


  // Unit suffixes of number fields that do not depend on the unit system
  'ui-setup-sweat.unit.minutes': 'min',
  'ui-setup-sweat.unit.watts': 'W',
  'ui-setup-sweat.unit.mets': 'MET',
  'ui-setup-sweat.unit.percent': '%',

  // The sweat numbers the plan uses
  'ui-setup-sweat.summary.label': 'Schweiß im Plan',
  'ui-setup-sweat.summary.rate': 'Verwendete Schweißrate',
  'ui-setup-sweat.summary.rateValue': '{rateLph:volumeL}/h',
  'ui-setup-sweat.summary.range': 'wahrscheinlich {lo:volumeL:nounit}–{hi:volumeL}/h',
  'ui-setup-sweat.summary.sodium': 'Natrium im Schweiß',
  'ui-setup-sweat.summary.sodiumValue': '{mgPerL} mg/L',
  'ui-setup-sweat.summary.source.test': 'Aus deinem Schweißtest',
  'ui-setup-sweat.summary.source.estimate': 'Aus der Schätzung',
  'ui-setup-sweat.summary.source.preset': 'Aus deiner Selbsteinschätzung',

  // Projected body-mass change over the event
  'ui-setup-sweat.projection.title': 'Erwartete Gewichtsänderung',
  'ui-setup-sweat.projection.level.ok': 'Bis {pct:percent} Verlust',
  'ui-setup-sweat.projection.level.mild': '{lo}–{hi:percent} Verlust',
  'ui-setup-sweat.projection.level.high': 'Über {pct:percent} Verlust',
  'ui-setup-sweat.projection.level.gain': 'Gewichtszunahme',
  'ui-setup-sweat.projection.scale': 'Auf der Waage nach dem Event',
  'ui-setup-sweat.projection.waterLost': 'Wasserverlust',
  'ui-setup-sweat.projection.waterGained': 'Wasserzunahme',
  'ui-setup-sweat.projection.waterValue': '{waterL:volumeL} ({pct:percent} des Körpergewichts)',
  'ui-setup-sweat.projection.note':
    'Die Waage zeigt zusätzlich den Verlust durch verbrauchte Energiespeicher. Halte den Wasserverlust möglichst unter {pct:percent} deines Körpergewichts und nimm nie zu.',
};

export default uiSetupSweat;
