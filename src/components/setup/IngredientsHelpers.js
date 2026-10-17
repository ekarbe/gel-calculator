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
 * Helpers shared by the recipe setup sections (`Ingredients*.jsx`,
 * `Salts*.jsx`, `Format*.jsx`): the names of custom ingredients and salts,
 * lists in the UI language, the custom ingredient form check. Amounts and
 * the names of the built-in sources are the shared recipe text
 * (`../recipe/recipeText.js`); focus handling after a form or row goes away
 * is `../ui/useFocusAfterRender.js`. Display only: every amount, share and
 * ratio comes from the plan.
 */

import { formatRatio } from '../../domain/carbs';
import { INPUT_LIMITS } from '../../domain/plan';
import { customFallbackName } from '../recipe/recipeText';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').CustomCarb} CustomCarb */
/** @typedef {import('../../domain/plan').CustomSalt} CustomSalt */

/** Preference weight of an ingredient when it is added to the list (the middle of 0–100). */
export const NEW_INGREDIENT_WEIGHT = 50;

/** Below this many grams of carbs per gram the solver treats an ingredient as carb-free. */
export const MIN_CARBS_PER_GRAM = 1e-6;

/**
 * A fructose share (fructose ÷ all carbs) as ratio text normalised to
 * glucose 1, as the domain writes it (`1/3` → `"1:0.5"`, `1` → `"0:1"`).
 * Pass it to a `{x:ratio}` placeholder, which uses the locale's decimals.
 * @param {number} share
 * @returns {string}
 */
export const shareRatio = (share) => formatRatio({ glucose: 1 - share, fructose: share });

/**
 * Names joined as a list in the UI language ("A and B", "A, B und C").
 * @param {Formatters} f
 * @param {string[]} names
 * @param {'conjunction'|'unit'} [type='conjunction']  `'unit'` joins with commas only.
 * @returns {string}
 */
export function listText(f, names, type = 'conjunction') {
  try {
    return new Intl.ListFormat(f.tag, { type, style: type === 'unit' ? 'short' : 'long' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/**
 * The name a custom ingredient is shown with: its name, else "Custom
 * ingredient N" (a name can only be blank in a share link).
 * @param {TranslateFn} t
 * @param {{ key: string, name?: string }} custom
 * @returns {string}
 */
export function customIngredientName(t, custom) {
  const name = typeof custom?.name === 'string' ? custom.name.trim() : '';
  return name || customFallbackName(t, 'carb', custom?.key);
}

/**
 * The name a custom salt is shown with: its name, else "Custom salt N".
 * @param {TranslateFn} t
 * @param {{ key: string, name?: string }} salt
 * @returns {string}
 */
export function customSaltName(t, salt) {
  const name = typeof salt?.name === 'string' ? salt.name.trim() : '';
  return name || customFallbackName(t, 'salt', salt?.key);
}

/**
 * The first free custom key (`c1`..`c10` or `s1`..`s10`), or null when all are taken.
 * @param {ReadonlyArray<{ key: string }>} custom
 * @param {'c'|'s'} prefix
 * @returns {string|null}
 */
export function freeCustomKey(custom, prefix) {
  const max = prefix === 's' ? INPUT_LIMITS.customSalts[1] : INPUT_LIMITS.customIngredients[1];
  const used = new Set(custom.map((entry) => entry.key));
  for (let n = 1; n <= max; n += 1) {
    if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
  }
  return null;
}

/**
 * The text fields of the custom ingredient form.
 * @typedef {{ name: string, carbsPer100g: string, fructoseSharePct: string, waterPct: string }} IngredientDraft
 */

/** Form fields in screen order (the first invalid one gets the focus). */
export const DRAFT_FIELDS = /** @type {const} */ (['name', 'carbsPer100g', 'fructoseSharePct', 'waterPct']);

/**
 * A draft for the custom ingredient form: empty for a new one, the stored
 * values for an edit (numbers written in the locale, without grouping).
 * @param {Formatters} f
 * @param {CustomCarb|null} custom
 * @returns {IngredientDraft}
 */
export function draftFrom(f, custom) {
  if (!custom) return { name: '', carbsPer100g: '', fructoseSharePct: '', waterPct: '' };
  return {
    name: custom.name,
    carbsPer100g: f.inputValue(custom.carbsPer100g),
    fructoseSharePct: f.inputValue(custom.fructoseSharePct),
    waterPct: typeof custom.waterPct === 'number' ? f.inputValue(custom.waterPct) : '',
  };
}

/**
 * Checks a custom ingredient draft. Numbers are read in the UI locale
 * ("1,5" and "1.5").
 *
 * - Name: required (trimmed).
 * - Carbs per 100 g: more than 0 and at most 100 (an ingredient without carbs adds nothing).
 * - Fructose share of the carbs: 0–100 %.
 * - Water per 100 g: optional; 0–100 and, with the carbs, at most 100 g.
 *
 * @param {Formatters} f
 * @param {IngredientDraft} draft
 * @returns {{ errors: Partial<Record<keyof IngredientDraft, string>>,
 *   value: Omit<CustomCarb, 'key'> | null }} `errors` holds message keys; `value` is null while
 *   there are errors.
 */
export function checkIngredientDraft(f, draft) {
  const [lo, hi] = INPUT_LIMITS.labelPct;
  const read = (text) => (String(text).trim() === '' ? NaN : f.parseNumber(String(text)));
  /** @type {Partial<Record<keyof IngredientDraft, string>>} */
  const errors = {};
  const name = draft.name.trim();
  const carbs = read(draft.carbsPer100g);
  const fructose = read(draft.fructoseSharePct);
  const hasWater = draft.waterPct.trim() !== '';
  const water = read(draft.waterPct);

  if (name === '') errors.name = 'ui-setup-recipe.custom.error.name';
  if (!(carbs > lo && carbs <= hi)) errors.carbsPer100g = 'ui-setup-recipe.custom.error.carbs';
  if (!(fructose >= lo && fructose <= hi)) errors.fructoseSharePct = 'ui-setup-recipe.custom.error.fructose';
  if (hasWater && !(water >= lo && water <= hi)) {
    errors.waterPct = 'ui-setup-recipe.custom.error.water';
  } else if (hasWater && !errors.carbsPer100g && carbs + water > hi) {
    errors.waterPct = 'ui-setup-recipe.custom.error.waterSum';
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: { name, carbsPer100g: carbs, fructoseSharePct: fructose, ...(hasWater ? { waterPct: water } : {}) },
  };
}
