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
 * German UI text for the full schedule.
 * Same keys and placeholders as `../en/ui-schedule.js` (a parity test
 * checks it); see there for what each placeholder holds.
 * @type {Record<string, string>}
 */
const uiSchedule = {
  // Panel heading; also the name of the event list and the table caption
  'ui-schedule.title': 'Zeitplan',
  'ui-schedule.description': 'Jedes Gel, jeder Schluck und jede Dosis, sortiert nach der Zeit ab dem Start.',
  // List ↔ table switch (a radio group)
  'ui-schedule.view.label': 'Ansicht des Zeitplans',
  'ui-schedule.view.list': 'Liste',
  'ui-schedule.view.table': 'Tabelle',
  // Table column headings
  'ui-schedule.table.time': 'Zeit',
  'ui-schedule.table.action': 'Aktion',
  'ui-schedule.table.details': 'Details',
  // Shown when the plan has no events at all
  'ui-schedule.empty': 'Für diesen Plan gibt es keine Einträge.',

  // Time from the start as shown ("T+20m", "T+1h", "T−1h 30m"). Kept in the compact,
  // language-neutral countdown form: the board's "Next up" time column is narrow.
  'ui-schedule.time.m': 'T{sign}{minutes}m',
  'ui-schedule.time.h': 'T{sign}{hours}h',
  'ui-schedule.time.hm': 'T{sign}{hours}h {minutes}m',
  // The same time in words for screen readers ("20 Minuten nach dem Start")
  'ui-schedule.time.atStart': 'Beim Start',
  'ui-schedule.time.before': '{duration} vor dem Start',
  'ui-schedule.time.after': '{duration} nach dem Start',
  'ui-schedule.spoken.hours.one': '{count} Stunde',
  'ui-schedule.spoken.hours.other': '{count} Stunden',
  'ui-schedule.spoken.minutes.one': '{count} Minute',
  'ui-schedule.spoken.minutes.other': '{count} Minuten',
  // {hours} and {minutes} are the texts above
  'ui-schedule.spoken.hoursMinutes': '{hours} und {minutes}',
  // Screen-reader name of an event heading in the list: the spoken time, then the event title
  'ui-schedule.list.heading': '{time}: {title}',

  // The drink bottles the sips come from ({count} bottles, each filled to {fill}; {size} is the bottle)
  'ui-schedule.bottles.full.one': '{count} Flasche à {fill:volume}',
  'ui-schedule.bottles.full.other': '{count} Flaschen à {fill:volume}',
  // Same wording as the mixing dialog ('ui-dialogs.servings.drinkPartial')
  'ui-schedule.bottles.partial.one': '{count} Flasche à {fill:volume} (Flaschengröße {size:volume})',
  'ui-schedule.bottles.partial.other': '{count} Flaschen à {fill:volume} (Flaschengröße {size:volume})',
  // Note above the events when drink sips carry the fluid; {bottles} is one of the texts above
  'ui-schedule.bottleNote': 'Trink nacheinander aus {bottles}. Bei jedem Schluck steht, aus welcher Flasche er kommt.',

  // Fluid advice under the events
  'ui-schedule.fluid.title': 'Trinkempfehlung',
  'ui-schedule.fluid.manual':
    'Du hast eine eigene Trinkmenge von {mlPerHour:volume}/h festgelegt. Die Empfehlung liegt bei {recommendedMlPerHour:volume}/h.',
};

export default uiSchedule;
