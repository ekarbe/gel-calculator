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
 * German UI text for the app shell (`src/components/shell/*`): header,
 * mode switch, phone tab bar, landmarks, footer and app-level notices.
 * Same keys and placeholders as `../en/ui-shell.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const uiShell = {
  // The product name stays as it is (a wordmark)
  'ui-shell.wordmark': 'Gel Calculator',
  // Header
  'ui-shell.mode.label': 'Modus',
  'ui-shell.mode.guided': 'Geführt',
  'ui-shell.mode.expert': 'Experte',
  'ui-shell.actions.recipes': 'Meine Rezepte',
  'ui-shell.actions.share': 'Teilen',
  'ui-shell.actions.settings': 'Einstellungen',
  // Toast when the mode switch would drop an open form; {button} is the mode's name ("Geführt")
  'ui-shell.leave.unsaved':
    'Dieses Formular ist noch nicht gespeichert. Speichere oder verwirf es zuerst, oder wähle erneut „{button}“, um ohne Speichern zu wechseln.',
  // Landmarks of the expert layout
  'ui-shell.board.label': 'Wettkampfübersicht',
  // Phone tab bar
  'ui-shell.tabs.label': 'Bereiche',
  'ui-shell.tabs.board': 'Übersicht',
  'ui-shell.tabs.setup': 'Eingaben',
  'ui-shell.tabs.schedule': 'Zeitplan',
  // Footer
  'ui-shell.footer.author': 'Von Eike Christian Karbe',
  'ui-shell.footer.links': 'Links',
  'ui-shell.footer.strava': 'Strava',
  'ui-shell.footer.github': 'GitHub',
  // Page metadata (title, description, social preview card's alt text)
  'ui-shell.meta.title': 'Rechner für DIY-Energiegels & Sportgetränke | Optimiere deine Verpflegung',
  'ui-shell.meta.description':
    'Berechne genaue Kohlenhydratverhältnisse (Glukose:Fruktose) und den Elektrolytbedarf für deine Ausdauereinheit. Erstelle eigene Rezepte für DIY-Energiegels und Sportgetränke.',
  'ui-shell.meta.imageAlt':
    'Wettkampfübersicht im Gel Calculator: Ziele für Kohlenhydrate, Natrium, Trinkmenge und Koffein mit dem Gelrezept',
  // Toast when a ?s= link could not be read
  'ui-shell.shareLinkFailed': 'Dieser Link stammt aus einer älteren Version oder ist beschädigt und ließ sich nicht öffnen.',
};

export default uiShell;
