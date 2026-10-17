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
 * German UI text for the Event and Body & weather sections.
 * Same keys and placeholders as `../en/ui-setup-event.js` (a parity test
 * checks it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiSetupEvent = {
  // Section titles and the one-line summary a collapsed section shows
  'ui-setup-event.event.title': 'Event',
  'ui-setup-event.event.summary': '{duration} · {sport} · {intensity}',
  'ui-setup-event.bodyWeather.title': 'Körper & Wetter',
  'ui-setup-event.bodyWeather.summary': '{mass} · {temp} · {humidity}',
  // Group names inside Body & weather
  'ui-setup-event.bodyWeather.body': 'Körper',
  'ui-setup-event.bodyWeather.weather': 'Wetter',

  // Sport (a segmented choice); `otherShort` is only the visible text of the third option
  'ui-setup-event.sport.label': 'Sportart',
  'ui-setup-event.sport.otherShort': 'Andere',

  // Duration: hours and minutes fields; the units are the field suffixes
  'ui-setup-event.duration.label': 'Dauer',
  'ui-setup-event.duration.hours': 'Stunden',
  'ui-setup-event.duration.minutes': 'Minuten',
  'ui-setup-event.duration.hoursUnit': 'h',
  'ui-setup-event.duration.minutesUnit': 'min',

  // Intensity: option text is "{name} ({zone})"
  'ui-setup-event.intensity.label': 'Intensität',
  'ui-setup-event.intensity.option': '{name} ({zone})',
  'ui-setup-event.intensity.zone.easy': 'Zone 1–2',
  'ui-setup-event.intensity.zone.moderate': 'Zone 3',
  'ui-setup-event.intensity.zone.hard': 'Zone 4',
  'ui-setup-event.intensity.zone.race': 'Zone 4–5',

  // Speed (running and cycling). The running pace follows "Pace" in the field's hint.
  'ui-setup-event.speed.label': 'Geschwindigkeit',
  'ui-setup-event.speed.pace': 'Pace',
  'ui-setup-event.speed.implausible':
    'Das ist schneller als der Marathon-Weltrekord. Prüfe die Geschwindigkeit: Sie bestimmt die Schweißschätzung.',

  // Power (cycling); 0 means "estimate from the speed"
  'ui-setup-event.power.label': 'Leistung',
  'ui-setup-event.power.unit': 'W',
  'ui-setup-event.power.hint': '0 = aus der Geschwindigkeit schätzen.',
  'ui-setup-event.power.estimated': 'Aus deiner Geschwindigkeit geschätzt: etwa {watts:integer} W in der Ebene.',

  // METs (other sports)
  'ui-setup-event.mets.label': 'Belastung',
  'ui-setup-event.mets.unit': 'MET',
  'ui-setup-event.mets.hint':
    '1 MET entspricht ruhigem Sitzen. Beispiele: Wandern 6, Bahnenschwimmen 6–10, Skilanglauf 9–15.',

  // Setting
  'ui-setup-event.setting.label': 'Umgebung',

  // The unit system switch at the top of Body & weather (the app-wide pref)
  'ui-setup-event.units.label': 'Einheiten (ganze App)',
  'ui-setup-event.units.metric': 'Metrisch',
  'ui-setup-event.units.imperial': 'Imperial',
  'ui-setup-event.units.hint': 'Gilt auch für Geschwindigkeit und Flüssigkeitsmengen in der ganzen App. Nährstoffe bleiben in g und mg.',

  // Body mass
  'ui-setup-event.mass.label': 'Körpergewicht',

  // Height
  'ui-setup-event.height.label': 'Körpergröße',

  // Heat acclimatisation (a switch with a description)
  'ui-setup-event.acclimatised.label': 'Hitzeakklimatisiert',
  'ui-setup-event.acclimatised.hint':
    'Du hast 1–2 Wochen bei ähnlicher Hitze trainiert. Das beeinflusst, ab wann die Warnung zur Hitzebelastung erscheint, aber nicht die Schweißschätzung.',

  // Weather
  'ui-setup-event.temperature.label': 'Temperatur',
  'ui-setup-event.temperature.hint': 'Lufttemperatur im Schatten.',
  'ui-setup-event.humidity.label': 'Luftfeuchtigkeit',
  'ui-setup-event.humidity.unit': '%',
  'ui-setup-event.sun.label': 'Sonne',
  'ui-setup-event.sun.indoors': 'Sonne zählt nur draußen.',
};

export default uiSetupEvent;
