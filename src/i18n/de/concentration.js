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
 * German text for message keys returned by `src/domain/concentration.js`
 * (`gelBatch`, `drinkBottles`), plus labels for its tonicity bands and gel
 * consistency presets.
 * Same keys and placeholders as `../en/concentration.js` (a parity test checks it).
 * @type {Record<string, string>}
 */
const concentration = {
  // Labels for the codes the module returns
  'concentration.tonicity.hypotonic': 'Hypoton',
  'concentration.tonicity.isotonic': 'Isoton',
  'concentration.tonicity.hypertonic': 'Hyperton',
  // Named by consistency, not tonicity: with most sugars a 33% gel is still hypertonic (research notes D).
  'concentration.consistency.isotonic': 'Isotonischer Typ',
  'concentration.consistency.isotonicNote':
    'Nur mit HBCD oder Maltodextrin mit niedrigem DE annähernd isoton. Mit anderen Zuckern ist es immer noch deutlich konzentrierter als deine Körperflüssigkeiten.',
  'concentration.consistency.liquid': 'Flüssig',
  'concentration.consistency.standard': 'Standard',
  'concentration.consistency.thick': 'Dickflüssig',

  // gelBatch
  'concentration.warn.syrupsThinner':
    'Deine Zutaten wiegen schon mehr als ein Gel mit {targetPct:percent} dieser Kohlenhydrate. Es kommt kein Wasser dazu, und das Gel hat etwa {pct:percent} Kohlenhydrate.',
  'concentration.warn.crystallise':
    'Die Dextrose ergibt mit dem Wasser in diesem Gel eine Lösung von {glucosePct:percent}. Über {limitPct:percent} kann sie auskristallisieren, und das Gel wird körnig. Ersetze etwas Dextrose durch Maltodextrin oder Fruktose oder wähle ein dünnflüssigeres Gel.',
  'concentration.warn.gelTakeWithWater':
    'Dieses Gel ist viel konzentrierter als deine Körperflüssigkeiten. Trink zu jedem Gel etwa {waterMl:volume} Wasser. So entleert sich dein Magen schneller.',

  // drinkBottles
  'concentration.warn.noFluidForDrink':
    'Dein Plan sieht keine Trinkmenge vor, daher gibt es kein Getränk zum Anmischen. Lege eine Trinkmenge fest oder nimm deine Kohlenhydrate als Gels.',
  'concentration.warn.drinkDoesNotFit':
    'Die Pulver und Sirupe für jede Flasche nehmen etwa {ingredientsMl:volume} ein. Das passt nicht in die {fillMl:volume}, die du aus jeder Flasche trinkst. Plane eine größere Trinkmenge ein oder nimm einen Teil der Kohlenhydrate als Gels.',
  'concentration.warn.drinkStrong':
    'Jede Flasche enthält {pct:percent} Kohlenhydrate. Über {limitPct:percent} verlässt ein Getränk den Magen langsamer. Teste es im Training.',
  'concentration.warn.drinkTooStrong':
    'Jede Flasche enthält {pct:percent} Kohlenhydrate. Über {limitPct:percent} liegt ein Getränk oft schwer im Magen und kann ihn reizen. Nimm einen Teil der Kohlenhydrate als Gels oder plane eine größere Trinkmenge ein.',
  'concentration.warn.hypertonic':
    'Das Getränk hat etwa {mOsm} mOsm/kg. Das liegt über dem isotonen Bereich (bis {limit} mOsm/kg), daher wird Wasser etwas langsamer aufgenommen.',
  'concentration.warn.veryHypertonic':
    'Das Getränk hat etwa {mOsm} mOsm/kg. Ab {limit} mOsm/kg verlässt ein Getränk den Magen langsam und kann Wasser in den Darm ziehen. Nimm weniger Zucker pro Flasche, mehr Flaschen oder Maltodextrin statt Dextrose.',
  'concentration.warn.sodiumBelowEfsa':
    'Das Getränk enthält {mgPerL} mg Natrium pro Liter. Der EFSA-Bereich für Sportgetränke liegt bei {lo}–{hi} mg/L. Mit weniger ersetzt es weniger von dem Salz, das du ausschwitzt.',
  'concentration.warn.sodiumAboveEfsa':
    'Das Getränk enthält {mgPerL} mg Natrium pro Liter. Der EFSA-Bereich für Sportgetränke liegt bei {lo}–{hi} mg/L. Ein salzigeres Getränk kann unangenehm schmecken. Teste es im Training.',
};

export default concentration;
