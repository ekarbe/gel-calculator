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
 * German text for message keys returned by `src/domain/electrolytes.js`.
 * Same keys and placeholders as `../en/electrolytes.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const electrolytes = {
  // recommendSodium: duration bands
  'electrolytes.why.sodium.short':
    'Unter 2 h ist Natrium optional. Bis zu {hi} mg/h reichen. Du verlierst über den Schweiß etwa {loss} mg/h Natrium. Dein Ziel: {mgPerHour} mg/h.',
  'electrolytes.why.sodium.medium':
    'Nimm bei 2–4 h {lo}–{hi} mg/h Natrium. Du verlierst über den Schweiß etwa {loss} mg/h. Der Plan geht von der Hälfte davon aus und bleibt im Bereich. Dein Ziel: {mgPerHour} mg/h.',
  'electrolytes.why.sodium.long':
    'Über 4 h wird Natrium wichtiger. Nimm {lo}–{hi} mg/h. Du verlierst über den Schweiß etwa {loss} mg/h. Der Plan geht von der Hälfte davon aus und bleibt im Bereich. Dein Ziel: {mgPerHour} mg/h.',
  'electrolytes.why.partial':
    'Keine Leitlinie empfiehlt, das gesamte ausgeschwitzte Natrium zu ersetzen. Übermäßiges Trinken ist die Hauptursache für einen zu niedrigen Natriumspiegel im Blut. Zusätzliches Salz macht übermäßiges Trinken nicht ungefährlich.',

  // recommendExtras
  'electrolytes.why.extras':
    'Kalium, Magnesium und Calcium sind optional. Schweiß enthält nur geringe Mengen davon. Der Plan ersetzt etwa die Hälfte eines typischen Verlusts. Es gibt keinen Beleg dafür, dass sie Krämpfe verhindern.',

  // Warnings
  'electrolytes.warn.sodiumFarAbove':
    'Du planst {mgPerHour} mg/h Natrium. Das liegt weit über jeder Leitlinie. Bleib bei höchstens {limitMgPerHour} mg/h. Große Salzmengen können Übelkeit und Magenprobleme auslösen.',
  'electrolytes.warn.sodiumHigh':
    'Du planst {mgPerHour} mg/h Natrium. Das liegt über der üblichen Obergrenze von {limitMgPerHour} mg/h. Nur wer stark und salzig schwitzt, braucht bei langen Events so viel. Teste es im Training.',
  'electrolytes.warn.concentrationHigh':
    'Dein Plan sieht etwa {mgPerL} mg Natrium pro Liter getrunkener Flüssigkeit vor. Das liegt über {limitMgPerL} mg/L. Sportgetränke enthalten meist 460–1.150 mg/L. Viel Salz mit wenig Flüssigkeit kann deinen Magen reizen. Nimm weniger Natrium oder verteile es auf mehr Flüssigkeit.',
};

export default electrolytes;
