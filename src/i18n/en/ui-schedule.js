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
 * English UI text for the full schedule.
 * Owned by the schedule-print area (`src/components/schedule/*`; the print
 * view reuses the times, the table headings and the bottle text). Keys start
 * with `ui-schedule.`; placeholders follow `src/i18n/index.js`. Event titles
 * and texts come from the domain catalog (`schedule.*`).
 * @type {Record<string, string>}
 */
const uiSchedule = {
  // Panel heading; also the name of the event list and the table caption
  'ui-schedule.title': 'Schedule',
  'ui-schedule.description': 'Every gel, sip and dose by time from the start.',
  // List ↔ table switch (a radio group)
  'ui-schedule.view.label': 'Schedule view',
  'ui-schedule.view.list': 'List',
  'ui-schedule.view.table': 'Table',
  // Table column headings
  'ui-schedule.table.time': 'Time',
  'ui-schedule.table.action': 'Action',
  'ui-schedule.table.details': 'Details',
  // Shown when the plan has no events at all
  'ui-schedule.empty': 'Nothing to schedule for this plan.',

  // Time from the start as shown: {sign} is "+" or "−" (before the start); "T+20m", "T+1h", "T−1h 30m"
  'ui-schedule.time.m': 'T{sign}{minutes}m',
  'ui-schedule.time.h': 'T{sign}{hours}h',
  'ui-schedule.time.hm': 'T{sign}{hours}h {minutes}m',
  // The same time in words for screen readers; {duration} is built from the spoken keys below
  // ("20 minutes", "1 hour", "1 hour 30 minutes"). Write the units out: screen readers spell abbreviations.
  'ui-schedule.time.atStart': 'At the start',
  'ui-schedule.time.before': '{duration} before the start',
  'ui-schedule.time.after': '{duration} after the start',
  'ui-schedule.spoken.hours.one': '{count} hour',
  'ui-schedule.spoken.hours.other': '{count} hours',
  'ui-schedule.spoken.minutes.one': '{count} minute',
  'ui-schedule.spoken.minutes.other': '{count} minutes',
  // {hours} and {minutes} are the texts above
  'ui-schedule.spoken.hoursMinutes': '{hours} {minutes}',
  // Screen-reader name of an event heading in the list: the spoken time, then the event title
  // ("20 minutes after the start: Fuel"), so moving by heading says when each event happens
  'ui-schedule.list.heading': '{time}: {title}',

  // The drink bottles the sips come from ({count} bottles, each filled to {fill}; {size} is the bottle)
  'ui-schedule.bottles.full.one': '{count} bottle of {fill:volume}',
  'ui-schedule.bottles.full.other': '{count} bottles of {fill:volume}',
  // Same wording as the mixing dialog ('ui-dialogs.servings.drinkPartial'), so the bottle reads the same everywhere
  'ui-schedule.bottles.partial.one': '{count} bottle, {fill:volume} each ({size:volume} bottle)',
  'ui-schedule.bottles.partial.other': '{count} bottles, {fill:volume} each ({size:volume} bottle)',
  // Note above the events when drink sips carry the fluid; {bottles} is one of the texts above
  'ui-schedule.bottleNote': 'Drink from {bottles}, one after the other. Each sip lists the bottle it comes from.',

  // Fluid advice under the events
  'ui-schedule.fluid.title': 'Fluid advice',
  'ui-schedule.fluid.manual':
    'You set your own fluid target of {mlPerHour:volume}/h. The recommendation is {recommendedMlPerHour:volume}/h.',
};

export default uiSchedule;
