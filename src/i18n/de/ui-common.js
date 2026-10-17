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
 * German UI text shared by the primitives in `src/components/ui/` and by
 * every area. Same keys and placeholders as `../en/ui-common.js` (a parity
 * test checks it).
 * @type {Record<string, string>}
 */
const uiCommon = {
  // Dialog close button (accessible name)
  'ui-common.close': 'Schließen',
  // Why: disclosure button and its citation list
  'ui-common.why': 'Warum?',
  'ui-common.sources': 'Quellen',
  'ui-common.opensInNewTab': '(öffnet in neuem Tab)',
  // WarningList: list name and the level written out for screen readers (no colour-only meaning)
  'ui-common.warnings': 'Warnungen',
  'ui-common.noWarnings': 'Keine Warnungen',
  'ui-common.level.danger': 'Gefahr',
  'ui-common.level.warning': 'Warnung',
  'ui-common.level.info': 'Hinweis',
  // NumberField stepper buttons; {label} is the field's label
  'ui-common.increase': '{label} erhöhen',
  'ui-common.decrease': '{label} verringern',
  // Field: prefix of an error message for screen readers
  'ui-common.error': 'Fehler',
  // SkipLink default text
  'ui-common.skipToContent': 'Zum Hauptinhalt springen',
  // The Auto/Adjust choice every recommendation offers
  'ui-common.auto': 'Auto',
  'ui-common.adjust': 'Anpassen',
  // Switch state text
  'ui-common.on': 'An',
  'ui-common.off': 'Aus',
  // Label of rough estimates (cost)
  'ui-common.approximate': 'ungefähr',
  // The event's options as every view names them
  'ui-common.sport.running': 'Laufen',
  'ui-common.sport.cycling': 'Radfahren',
  'ui-common.sport.other': 'Andere Sportart',
  'ui-common.intensity.easy': 'Locker',
  'ui-common.intensity.moderate': 'Moderat',
  'ui-common.intensity.hard': 'Hart',
  'ui-common.intensity.race': 'Wettkampf',
  'ui-common.setting.outdoor': 'Draußen',
  'ui-common.setting.indoorFan': 'Drinnen mit Ventilator',
  'ui-common.setting.indoorNoFan': 'Drinnen ohne Ventilator',
  'ui-common.sun.none': 'Schatten oder bewölkt',
  'ui-common.sun.partly': 'Teils sonnig',
  'ui-common.sun.full': 'Volle Sonne',
};

export default uiCommon;
