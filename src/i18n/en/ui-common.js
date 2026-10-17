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
 * English UI text shared by the primitives in `src/components/ui/` (close
 * buttons, steppers, warning levels, "Why?", the skip link) and by every
 * area (Auto/Adjust, On/Off, the sport, intensity, setting and sun
 * options). Keys start with `ui-common.`; placeholders follow
 * `src/i18n/index.js`.
 * @type {Record<string, string>}
 */
const uiCommon = {
  // Dialog close button (accessible name)
  'ui-common.close': 'Close',
  // Why: disclosure button and its citation list
  'ui-common.why': 'Why?',
  'ui-common.sources': 'Sources',
  'ui-common.opensInNewTab': '(opens in a new tab)',
  // WarningList: list name and the level written out for screen readers (no colour-only meaning)
  'ui-common.warnings': 'Warnings',
  'ui-common.noWarnings': 'No warnings',
  'ui-common.level.danger': 'Danger',
  'ui-common.level.warning': 'Warning',
  'ui-common.level.info': 'Note',
  // NumberField stepper buttons; {label} is the field's label
  'ui-common.increase': 'Increase {label}',
  'ui-common.decrease': 'Decrease {label}',
  // Field: prefix of an error message for screen readers
  'ui-common.error': 'Error',
  // SkipLink default text
  'ui-common.skipToContent': 'Skip to main content',
  // The Auto/Adjust choice every recommendation offers
  'ui-common.auto': 'Auto',
  'ui-common.adjust': 'Adjust',
  // Switch state text
  'ui-common.on': 'On',
  'ui-common.off': 'Off',
  // Label of rough estimates (cost)
  'ui-common.approximate': 'approximate',
  // The event's options as every view names them (setup, board, share image, print, sweat tests)
  'ui-common.sport.running': 'Running',
  'ui-common.sport.cycling': 'Cycling',
  'ui-common.sport.other': 'Other sport',
  'ui-common.intensity.easy': 'Easy',
  'ui-common.intensity.moderate': 'Moderate',
  'ui-common.intensity.hard': 'Hard',
  'ui-common.intensity.race': 'Race',
  'ui-common.setting.outdoor': 'Outdoors',
  'ui-common.setting.indoorFan': 'Indoors with a fan',
  'ui-common.setting.indoorNoFan': 'Indoors without a fan',
  'ui-common.sun.none': 'Shade or overcast',
  'ui-common.sun.partly': 'Partly sunny',
  'ui-common.sun.full': 'Full sun',
};

export default uiCommon;
