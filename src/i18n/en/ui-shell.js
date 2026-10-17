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
 * English UI text for the app shell (`src/components/shell/*`): header,
 * mode switch, phone tab bar, landmarks, footer and app-level notices. Owned by the
 * shell step. Keys start with `ui-shell.`; placeholders follow
 * `src/i18n/index.js`.
 * @type {Record<string, string>}
 */
const uiShell = {
  'ui-shell.wordmark': 'Gel Calculator',
  // Header
  'ui-shell.mode.label': 'Mode',
  'ui-shell.mode.guided': 'Guided',
  'ui-shell.mode.expert': 'Expert',
  'ui-shell.actions.recipes': 'My recipes',
  'ui-shell.actions.share': 'Share',
  'ui-shell.actions.settings': 'Settings',
  // Toast when the mode switch would drop an open form; {button} is the mode's name ("Guided")
  'ui-shell.leave.unsaved': 'This form is not saved yet. Save or cancel it first, or select {button} again to leave without it.',
  // Landmarks of the expert layout
  'ui-shell.board.label': 'Race board',
  // Phone tab bar
  'ui-shell.tabs.label': 'Sections',
  'ui-shell.tabs.board': 'Board',
  'ui-shell.tabs.setup': 'Setup',
  'ui-shell.tabs.schedule': 'Schedule',
  // Footer
  'ui-shell.footer.author': 'By Eike Christian Karbe',
  'ui-shell.footer.links': 'Links',
  'ui-shell.footer.strava': 'Strava',
  'ui-shell.footer.github': 'GitHub',
  // Page metadata (title, description, social preview card's alt text); English in the static page
  'ui-shell.meta.title': 'DIY Energy Gel & Sports Drink Calculator | Optimize Your Fuel',
  'ui-shell.meta.description':
    'Calculate precise carb ratios (glucose:fructose) and electrolyte needs for your endurance activity. Create custom DIY energy gel or sports drink recipes.',
  'ui-shell.meta.imageAlt': 'Gel Calculator race board: carbs, sodium, fluid and caffeine targets with the gel recipe',
  // Toast when a ?s= link could not be read
  'ui-shell.shareLinkFailed': 'This share link is from an older version or is damaged, so it could not be opened.',
};

export default uiShell;
