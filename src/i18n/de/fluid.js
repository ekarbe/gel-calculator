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
 * German text for message keys returned by `src/domain/hydration.js`
 * (`recommendFluid`, `fluidWarnings`, `projectBodyMass`).
 * Same keys and placeholders as `../en/fluid.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const fluid = {
  // recommendFluid
  'fluid.why.plan':
    'Trink etwa {mlPerHour:volume}/h. Das ersetzt rund {sharePct:percent} deines Schweißverlusts von {sweatMlPerHour:volume}/h, begrenzt auf {maxMlPerHour:volume}/h. Wenn du weniger trinkst, als du schwitzt, vermeidest du eine Gewichtszunahme.',
  'fluid.why.thirst':
    'Bei Events unter 90 min oder bei kühlem Wetter klappt Trinken nach Durst gut. Nutze den Plan als grobe Orientierung.',

  // Warnings
  'fluid.warn.aboveSweat':
    'Du planst {mlPerHour:volume}/h zu trinken. Das ist mehr, als du schwitzt ({sweatMlPerHour:volume}/h). Eine Gewichtszunahme während der Belastung kann zu einer Hyponatriämie führen, einem gefährlichen Abfall des Natriumspiegels im Blut. Trink weniger, als du schwitzt.',
  'fluid.warn.aboveCeiling':
    'Du planst {mlPerHour:volume}/h zu trinken. Leitlinien empfehlen bis zu {maxMlPerHour:volume}/h. Größere Mengen können deinen Magen belasten.',

  // projectBodyMass
  'fluid.warn.projectedGain':
    'Mit diesem Plan würdest du etwa {gainL:volumeL} mehr trinken, als du ausschwitzt. Eine Gewichtszunahme während der Belastung kann zu einer Hyponatriämie führen, einem gefährlichen Abfall des Natriumspiegels im Blut. Trink weniger.',
  'fluid.warn.deficitHigh':
    'Mit diesem Plan würdest du etwa {deficitL:volumeL} Wasser verlieren, {deficitPct:percent} deines Körpergewichts. Verluste über {limitPct:percent} verschlechtern Leistung und Hitzetoleranz. Trink mehr, wenn dein Magen es zulässt, und plane deine Nachfüllstopps.',
  'fluid.warn.deficitMild':
    'Mit diesem Plan würdest du etwa {deficitL:volumeL} Wasser verlieren, {deficitPct:percent} deines Körpergewichts. Verluste über {limitPct:percent} können die Leistung schon beeinträchtigen, vor allem bei Hitze.',
};

export default fluid;
