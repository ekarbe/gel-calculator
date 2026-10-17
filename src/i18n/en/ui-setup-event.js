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
 * English UI text for the Event and Body & weather sections.
 * Owned by the setup-event area (`src/components/setup/EventSection.jsx`,
 * `BodyWeatherSection.jsx` and their field groups `EventFields.jsx`,
 * `BodyWeatherFields.jsx`). Keys start with `ui-setup-event.`; placeholders
 * follow `src/i18n/index.js` (quantities are typed, so they follow the unit
 * system; units the formatter does not know, such as W and MET, are text).
 * @type {Record<string, string>}
 */
const uiSetupEvent = {
  // Section titles and the one-line summary a collapsed section shows. Every value comes
  // formatted in the chosen units: {duration} "3 h" / "2 h 30 min", {sport} and {intensity}
  // the names below, {mass} "70 kg" / "154.3 lb", {temp} "20 °C" / "68 °F", {humidity} "50%".
  'ui-setup-event.event.title': 'Event',
  'ui-setup-event.event.summary': '{duration} · {sport} · {intensity}',
  'ui-setup-event.bodyWeather.title': 'Body & weather',
  'ui-setup-event.bodyWeather.summary': '{mass} · {temp} · {humidity}',
  // Group names inside Body & weather
  'ui-setup-event.bodyWeather.body': 'Body',
  'ui-setup-event.bodyWeather.weather': 'Weather',

  // Sport (a segmented choice). The names are the full ones (also in the summary, as on the
  // board); `otherShort` is only the visible text of the third option, so three fit on a
  // phone (the option is still named "Other sport" for screen readers).
  'ui-setup-event.sport.label': 'Sport',
  'ui-setup-event.sport.otherShort': 'Other',

  // Duration: hours and minutes fields; the units are the field suffixes
  'ui-setup-event.duration.label': 'Duration',
  'ui-setup-event.duration.hours': 'Hours',
  'ui-setup-event.duration.minutes': 'Minutes',
  'ui-setup-event.duration.hoursUnit': 'h',
  'ui-setup-event.duration.minutesUnit': 'min',

  // Intensity: option text is "{name} ({zone})"
  'ui-setup-event.intensity.label': 'Intensity',
  'ui-setup-event.intensity.option': '{name} ({zone})',
  'ui-setup-event.intensity.zone.easy': 'Zone 1–2',
  'ui-setup-event.intensity.zone.moderate': 'Zone 3',
  'ui-setup-event.intensity.zone.hard': 'Zone 4',
  'ui-setup-event.intensity.zone.race': 'Zone 4–5',

  // Speed (running and cycling). The running pace follows "Pace" in the field's hint.
  'ui-setup-event.speed.label': 'Speed',
  'ui-setup-event.speed.pace': 'Pace',
  'ui-setup-event.speed.implausible':
    'That is faster than the marathon world record. Check the speed: it drives the sweat estimate.',

  // Power (cycling); 0 means "estimate from the speed"
  'ui-setup-event.power.label': 'Power',
  'ui-setup-event.power.unit': 'W',
  'ui-setup-event.power.hint': '0 = estimate from speed.',
  'ui-setup-event.power.estimated': 'Estimated from your speed: about {watts:integer} W on flat ground.',

  // METs (other sports)
  'ui-setup-event.mets.label': 'Effort',
  'ui-setup-event.mets.unit': 'MET',
  'ui-setup-event.mets.hint':
    '1 MET is sitting at rest. Examples: hiking 6, swimming laps 6–10, cross-country skiing 9–15.',

  // Setting
  'ui-setup-event.setting.label': 'Setting',

  // The unit system switch at the top of Body & weather. It is the app-wide pref (also in
  // Settings), so its name says so.
  'ui-setup-event.units.label': 'Units (whole app)',
  'ui-setup-event.units.metric': 'Metric',
  'ui-setup-event.units.imperial': 'Imperial',
  'ui-setup-event.units.hint': 'Also changes speed and fluid everywhere. Nutrients stay in g and mg.',

  // Body mass
  'ui-setup-event.mass.label': 'Body mass',

  // Height
  'ui-setup-event.height.label': 'Height',

  // Heat acclimatisation (a switch with a description)
  'ui-setup-event.acclimatised.label': 'Heat acclimatised',
  'ui-setup-event.acclimatised.hint':
    'You have trained in similar heat for 1–2 weeks. This changes when the heat strain warning appears, not the sweat estimate.',

  // Weather
  'ui-setup-event.temperature.label': 'Temperature',
  'ui-setup-event.temperature.hint': 'Air temperature in the shade.',
  'ui-setup-event.humidity.label': 'Humidity',
  'ui-setup-event.humidity.unit': '%',
  'ui-setup-event.sun.label': 'Sun',
  'ui-setup-event.sun.indoors': 'Sun only counts outdoors.',
};

export default uiSetupEvent;
