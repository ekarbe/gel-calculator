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
 * English text for message keys returned by `src/domain/concentration.js`
 * (`gelBatch`, `drinkBottles`), plus labels for its tonicity bands and gel
 * consistency presets. Placeholders use `{name}` or typed
 * `{name:type}` syntax (`src/i18n/index.js`).
 * @type {Record<string, string>}
 */
const concentration = {
  // Labels for the codes the module returns
  'concentration.tonicity.hypotonic': 'Hypotonic',
  'concentration.tonicity.isotonic': 'Isotonic',
  'concentration.tonicity.hypertonic': 'Hypertonic',
  // Named by consistency, not tonicity: with most sugars a 33% gel is still hypertonic (research notes D).
  'concentration.consistency.isotonic': 'Isotonic-style',
  'concentration.consistency.isotonicNote':
    'Close to isotonic only with HBCD or low-DE maltodextrin. With other sugars it is still much stronger than your body fluids.',
  'concentration.consistency.liquid': 'Liquid',
  'concentration.consistency.standard': 'Standard',
  'concentration.consistency.thick': 'Thick',

  // gelBatch
  'concentration.warn.syrupsThinner':
    'Your ingredients already weigh more than a {targetPct:percent} gel of these carbs. No water is added, and the gel will be about {pct:percent} carbohydrate.',
  'concentration.warn.crystallise':
    'The dextrose in this gel makes a {glucosePct:percent} solution in its water. Above {limitPct:percent} it can crystallise and turn grainy. Swap some dextrose for maltodextrin or fructose, or choose a thinner gel.',
  'concentration.warn.gelTakeWithWater':
    'This gel is much more concentrated than your body fluids. Take each gel with about {waterMl:volume} of water. Your stomach empties it faster that way.',

  // drinkBottles
  'concentration.warn.noFluidForDrink':
    'Your plan has no fluid, so there is no drink to mix. Set a fluid target or take your carbs as gels.',
  'concentration.warn.drinkDoesNotFit':
    'The powders and syrups for each bottle take up about {ingredientsMl:volume}. That does not fit in the {fillMl:volume} you drink from each bottle. Plan more fluid or take some carbs as gels.',
  'concentration.warn.drinkStrong':
    'Each bottle is {pct:percent} carbohydrate. Above {limitPct:percent} a drink leaves the stomach more slowly. Test it in training.',
  'concentration.warn.drinkTooStrong':
    'Each bottle is {pct:percent} carbohydrate. Above {limitPct:percent} a drink often sits in the stomach and can upset it. Take some carbs as gels, or plan more fluid.',
  'concentration.warn.hypertonic':
    'The drink is about {mOsm} mOsm/kg. That is above the isotonic range (up to {limit} mOsm/kg), so water is absorbed a little more slowly.',
  'concentration.warn.veryHypertonic':
    'The drink is about {mOsm} mOsm/kg. From {limit} mOsm/kg a drink leaves the stomach slowly and can pull water into the gut. Use less sugar per bottle, more bottles, or maltodextrin instead of dextrose.',
  'concentration.warn.sodiumBelowEfsa':
    'The drink has {mgPerL} mg sodium per litre. The EFSA range for sports drinks is {lo}–{hi} mg/L. With less, it replaces less of the salt you sweat out.',
  'concentration.warn.sodiumAboveEfsa':
    'The drink has {mgPerL} mg sodium per litre. The EFSA range for sports drinks is {lo}–{hi} mg/L. A saltier drink can taste unpleasant. Try it in training.',
};

export default concentration;
