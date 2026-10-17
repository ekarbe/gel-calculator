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
 * German text for message keys returned by `src/domain/carbs.js` and
 * `src/domain/solver.js`.
 * Same keys and placeholders as `../en/carbs.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const carbs = {
  // recommendCarbs: duration bands
  'carbs.why.none':
    'Bei Belastungen unter 45 min brauchst du währenddessen keine Kohlenhydrate. Deine Glykogenspeicher reichen dafür aus.',
  'carbs.why.rinse':
    'Bei 45–75 min kann eine Kohlenhydrat-Mundspülung oder eine kleine Menge Kohlenhydrate helfen. Der Bereich liegt bei {lo}–{hi} g/h. Dein Ziel: {gPerHour} g/h.',
  'carbs.why.short':
    'Bei 75–120 min liegt der Bereich laut Studien bei {lo}–{hi} g/h Kohlenhydraten. Dein Ziel: {gPerHour} g/h.',
  'carbs.why.medium':
    'Bei 2–2,5 h liegt der Bereich laut Studien bei {lo}–{hi} g/h Kohlenhydraten. Dein Ziel: {gPerHour} g/h.',
  'carbs.why.long':
    'Über 2,5 h liegt der Bereich laut Studien bei {lo}–{hi} g/h Kohlenhydraten aus einer Mischung von Glukose und Fruktose. Dein Ziel: {gPerHour} g/h.',
  'carbs.why.veryHigh':
    'Bei Events über 2,5 h gilt mit der Option „Darmtrainiert“ ein Bereich von {lo}–{hi} g/h. Studien haben das an trainierten Sportlerinnen und Sportlern getestet. Dein Ziel: {gPerHour} g/h.',

  // recommendCarbs: how to do the mouth rinse (45–75 min)
  'carbs.mouthRinse.howTo':
    'Eine Mundspülung mit einem Kohlenhydratgetränk kann die Leistung verbessern, auch wenn du kaum oder gar keine Kohlenhydrate schluckst. Spül {rinseMl:volume} eines 6- bis 8-prozentigen Maltodextrin-Getränks 5–10 s im Mund und spuck es dann aus. Wiederhole das alle 5–10 min.',

  // recommendCarbs: position inside the range
  'carbs.why.intensity.easy':
    'Bei lockerer Intensität liegt dein Ziel bei etwa 80\u00a0% der Untergrenze des Bereichs. Bei niedriger Intensität verbrennst du weniger Kohlenhydrate.',
  'carbs.why.intensity.moderate':
    'Bei moderater Intensität liegt dein Ziel in der Mitte des Bereichs.',
  'carbs.why.intensity.hard':
    'Bei harter Intensität liegt dein Ziel am oberen Ende des Bereichs.',
  'carbs.why.intensity.race':
    'Bei Wettkampfintensität liegt dein Ziel am oberen Ende des Bereichs.',

  // recommendRatio
  'carbs.ratio.why.low':
    'Bei {gPerHour} g/h reicht Glukose allein. Eine Mischung von 1:{fructose} Glukose zu Fruktose kann trotzdem bekömmlicher sein.',
  'carbs.ratio.why.medium':
    'Über 60 g/h stößt die Glukoseaufnahme an ihre Grenze. Nimm 1:{fructose} Glukose zu Fruktose, damit die Fruktose einen zweiten Aufnahmeweg nutzt.',
  'carbs.ratio.why.high':
    'Über 90 g/h brauchst du mehr Fruktose. Nimm bei {gPerHour} g/h 1:{fructose} Glukose zu Fruktose. Bei 120 g/h sind es 1:0,8.',

  // Warnings
  'carbs.warn.highCarbLongOnly':
    'Die Option „Darmtrainiert“ gilt nur für Events über 150 min. Der Plan nutzt stattdessen den Standardbereich.',
  'carbs.warn.gutTraining':
    'Mengen über 90 g/h erfordern 2–4 Wochen Darmtraining. Ein zusätzlicher Nutzen über 90 g/h ist nicht belegt.',
  'carbs.warn.aboveStudied':
    '{gPerHour} g/h liegen über 120 g/h, der höchsten untersuchten Menge. Magen-Darm-Probleme werden wahrscheinlicher.',
  'carbs.warn.noRatio':
    'Setze mindestens einen Teil des Verhältnisses über null. Ohne Verhältnis lassen sich keine Kohlenhydratquellen berechnen.',
  'carbs.warn.tooLittleFructose':
    'Nimm bei {gPerHour} g/h mindestens {minRatio:ratio} Glukose zu Fruktose. Glukose allein kann nicht schnell genug aufgenommen werden.',
  'carbs.warn.tooMuchFructose':
    'Nimm nicht mehr Fruktose als Glukose. Zu viel Fruktose führt oft zu Magen-Darm-Problemen.',

  // solveIngredients (src/domain/solver.js)
  'carbs.warn.ratioNotReachable':
    'Mit deinen Zutaten ist {target:ratio} Glukose zu Fruktose nicht möglich. Das Rezept nutzt {achievable:ratio}, das nächstmögliche Verhältnis. Füge eine Zutat mit mehr Glukose oder mehr Fruktose hinzu, um näher heranzukommen.',
  'carbs.warn.noIngredients':
    'Füge mindestens eine Kohlenhydrat-Zutat hinzu. Ohne sie enthält das Rezept keine Kohlenhydrate.',
};

export default carbs;
