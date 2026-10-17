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
 * German text for message keys returned by `src/domain/bicarbonate.js`.
 * Same keys and placeholders as `../en/bicarb.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const bicarb = {
  // planBicarbonate: summary by event length
  'bicarb.why.short':
    'Natron (Natriumbicarbonat) puffert Säure bei harten Belastungen. Dosen von 0,2–0,3 g/kg verbessern die Leistung. Die meisten Belege gibt es für Belastungen von 30 s bis 12 min. Bei harten Events bis etwa 1 h kann es trotzdem helfen.',
  'bicarb.why.medium':
    'Natron (Natriumbicarbonat) puffert Säure bei harten Belastungen. Dosen von 0,2–0,3 g/kg verbessern die Leistung. Die meisten Belege gibt es für Belastungen von 30 s bis 12 min. Für 60–90 min ist die Studienlage dünn.',
  'bicarb.why.long':
    'Natron (Natriumbicarbonat) puffert Säure bei harten Belastungen. Dosen von 0,2–0,3 g/kg verbessern die Leistung. Die meisten Belege gibt es für Belastungen von 30 s bis 12 min. Für Events über mehrere Stunden ist kein Nutzen belegt.',

  // planBicarbonate: details
  'bicarb.why.dose': 'Deine Dosis: {gPerKg} g/kg bei {massKg:mass}, also {doseG} g.',
  'bicarb.why.timing':
    'Nimm es 60–180 min vor dem Start, am besten etwa 90 min vorher. Verteile es auf kleinere Portionen und nimm es mit einer kohlenhydratreichen Mahlzeit, das schont den Magen.',

  // planBicarbonate: warnings
  'bicarb.warn.gi':
    'Magenprobleme sind bei Natron häufig. Aufgeteilte Dosen, magensaftresistente Kapseln oder eine Hydrogel-Form helfen. Teste es zuerst im Training.',
  'bicarb.warn.sodiumLoad':
    'Diese Dosis enthält etwa {sodiumG} g Natrium. Das ist eine große Salzmenge zusätzlich zu deiner normalen Ernährung.',
  'bicarb.warn.medical':
    'Lass das vorher ärztlich abklären, wenn du Bluthochdruck oder eine Nierenerkrankung hast.',
  'bicarb.warn.notInRace':
    'Das Natrium aus Natron zählt nicht zu deinem Natriumziel während der Belastung.',
  'bicarb.warn.longEvent':
    'Es gibt keinen Beleg dafür, dass Natron bei Events über etwa 90 min hilft. Die Nebenwirkungen können einen möglichen Vorteil überwiegen.',
  'bicarb.warn.limitedEvidence':
    'Für Events von 60–90 min ist die Studienlage dünn. Die meisten Studien haben harte Belastungen von 30 s bis 12 min getestet.',
};

export default bicarb;
