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
 * German text for message keys returned by `src/domain/caffeine.js`.
 * Same keys and placeholders as `../en/caffeine.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const caffeine = {
  // planCaffeine: summary when caffeine is off
  'caffeine.why.disabled':
    'Koffein ist optional. Dosen von 3–6 mg/kg verbessern bei den meisten Sportlerinnen und Sportlern die Ausdauerleistung.',

  // planCaffeine: summary by duration band
  'caffeine.why.short':
    'Nimm {preMg} mg etwa 60 min vor dem Start. Koffein erreicht 30–60 min nach der Einnahme seinen Höchstwert im Blut und wirkt über ein kurzes Event hinweg.',
  'caffeine.why.medium':
    'Nimm {preMg} mg etwa 60 min vor dem Start und {intraMg} mg nach etwa zwei Dritteln des Events. Eine späte Dosis verbessert die Leistung noch, wenn die Ermüdung zunimmt.',
  'caffeine.why.long':
    'Nimm {preMg} mg etwa 60 min vor dem Start und ab etwa der Hälfte des Events weitere {intraMg} mg. Koffein hat eine Halbwertszeit von etwa 5 h, daher halten spätere Nachdosen die Wirkung aufrecht.',
  // planCaffeine: summary when the body-load cap removed every dose during the event
  'caffeine.why.preOnly':
    'Nimm {preMg} mg etwa 60 min vor dem Start. Eine Dosis während der Belastung würde die Koffeinmenge in deinem Körper über {maxMgPerKg} mg/kg treiben, deshalb lässt der Plan sie weg.',

  // planCaffeine: details
  'caffeine.why.dose':
    'Du hast {mgPerKg} mg/kg gewählt, das sind {doseMg} mg bei {massKg:mass}. Dein Plan kommt insgesamt auf {totalMg} mg ({totalMgPerKg} mg/kg). In den meisten Studien verbessern 3–6 mg/kg die Leistung. Auch niedrigere Dosen von 1–2 mg/kg können helfen.',
  'caffeine.why.habitual':
    'Wer regelmäßig Kaffee trinkt, profitiert genauso wie jemand ohne Koffein im Alltag. Deine übliche Menge ändert die Dosis also nicht.',

  // planCaffeine: warnings
  'caffeine.warn.exclusions':
    'Verzichte auf Koffein, wenn du schwanger oder unter 18 bist, eine Herzerkrankung hast oder empfindlich auf Koffein reagierst.',
  'caffeine.warn.tryInTraining':
    'Teste deinen Koffeinplan zuerst im Training. Mögliche Nebenwirkungen sind Zittern, Herzrasen, Magenprobleme und schlechter Schlaf.',
  'caffeine.warn.noPowder':
    'Gib Koffein als Tabletten mit {tabletMg} mg dazu. Verwende nie reines Koffeinpulver. Schon ein kleiner Messfehler kann bei Pulver tödlich sein.',
  'caffeine.warn.singleDoseAbove200':
    'Deine größte Einzeldosis beträgt {mg} mg. Einzeldosen bis 200 mg gelten für gesunde Erwachsene als sicher. Darüber werden Nebenwirkungen wahrscheinlicher.',
  'caffeine.warn.highTotal':
    'Du kommst insgesamt auf {totalMg} mg ({totalMgPerKg} mg/kg). Über 9 mg/kg sind Nebenwirkungen häufig, und es gibt keinen zusätzlichen Nutzen.',
  'caffeine.warn.capped':
    'Einige Dosen wurden verringert oder gestrichen, damit die Koffeinmenge in deinem Körper jederzeit unter {maxMgPerKg} mg/kg bleibt.',
};

export default caffeine;
