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
 * Display helpers of the dialogs (`src/components/dialogs/*`): text from the
 * `ui-dialogs.*` catalog in the UI language and unit system, picked from
 * what the plan already holds. They never compute nutrition. No React. The
 * recipe text every view shares (amounts, names, colours, osmolality,
 * bottle fill, mixing steps, the recipe warnings) is in
 * `../recipe/recipeText.js`; the event summary is the board's
 * (`../board/boardText.js`), so the share image reads like the board.
 *
 * Every function takes the translate function `t` (`useT()`) and, where it
 * formats numbers, the formatter set `f` (`useFormat()`).
 */

import { durationText } from '../board/boardText';
import { finite } from '../../i18n/formatters';
import { countText } from '../../i18n/plural';
import { bottleFill } from '../recipe/recipeText';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */

/**
 * The heading of a recipe section ("Gels" / "Drink").
 * @param {TranslateFn} t
 * @param {RecipeSection} section
 * @returns {string}
 */
export function sectionTitle(t, section) {
  return t(section?.kind === 'drink' ? 'ui-dialogs.section.drink' : 'ui-dialogs.section.gel');
}

/**
 * What a section's servings are: "9 gels", "2 bottles of 750 ml", "4
 * bottles, 600 ml each (750 ml bottle)" when the bottles are not filled to
 * the top, or why there are none. The bottle size is added only when the
 * fill and the bottle read differently in the unit system (`bottleFill`):
 * a 740 ml fill of a 750 ml bottle is "3 bottles of 25 fl oz".
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {string}
 */
export function servingsText(t, f, section, bottleMl) {
  if (section.kind !== 'drink') {
    return section.servings > 0 ? countText(t, f, 'ui-recipe.servings.gels', section.servings) : t('ui-dialogs.servings.gelNone');
  }
  if (!(section.servings > 0)) return t('ui-dialogs.servings.drinkNone');
  const { fill, size, partial } = bottleFill(f, section, bottleMl);
  const bottles = countText(t, f, 'ui-recipe.servings.bottles', section.servings);
  return partial
    ? t('ui-dialogs.servings.drinkPartial', { bottles, fill, size })
    : t('ui-dialogs.servings.drinkFull', { bottles, fill });
}

/**
 * Caption of a section's amounts in a view: the whole batch, all bottles,
 * or one serving ("Per gel" / "Per bottle"). A section without servings
 * always shows the whole amount.
 * @param {TranslateFn} t
 * @param {RecipeSection} section
 * @param {'total'|'perServing'} view
 * @returns {string}
 */
export function amountsCaption(t, section, view) {
  if (!(section.servings > 0)) return t('ui-dialogs.amounts.activity');
  if (view === 'perServing') return t(section.servingLabelKey);
  return t(section.kind === 'gel' ? 'ui-dialogs.amounts.batch' : 'ui-dialogs.amounts.allBottles');
}

/**
 * One-line summary of a plan: duration (as on the board, "3:00 h"), carb
 * target and the format its recipe uses (`plan.format.type`):
 * "3:00 h · 75 g/h · Gel".
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {string}
 */
export function planSummary(t, f, plan) {
  const type = ['gel', 'drink', 'both'].includes(plan?.format?.type) ? plan.format.type : 'gel';
  return t('ui-dialogs.recipes.summary', {
    duration: durationText(t, f, finite(plan?.durationMin)),
    gPerHour: f.number(finite(plan?.carbs?.gPerHour)),
    format: t(`ui-dialogs.format.${type}`),
  });
}

/**
 * When a recipe was saved, as a date and time in the locale and the
 * visitor's time zone ("Oct 16, 2026, 8:15 PM"); `''` for a time that cannot
 * be read.
 * @param {Formatters} f
 * @param {string} savedAt  ISO 8601.
 * @returns {string}
 */
export function formatSavedAt(f, savedAt) {
  const time = typeof savedAt === 'string' ? Date.parse(savedAt) : NaN;
  return Number.isFinite(time) ? f.date(time, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

/**
 * A month given as `'YYYY-MM'` (when a template source was checked) in the
 * locale ("Oct 2026" / "Okt. 2026"); anything else as it is.
 * @param {Formatters} f
 * @param {string} month
 * @returns {string}
 */
export function formatMonth(f, month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month ?? ''));
  if (!match) return String(month ?? '');
  // A local date, so the month never shifts with the time zone.
  return f.date(new Date(Number(match[1]), Number(match[2]) - 1, 1), { year: 'numeric', month: 'short' });
}

/** Marks where a React node goes in a translated text (see {@link splitAround}). */
const SLOT = '⁣';

/**
 * Splits a message around one placeholder, so a component can put an
 * element there (a `<time>`, a link) in any language's word order:
 * `splitAround(t, 'ui-dialogs.recipes.saved', 'time')` → `['Saved ', '']`.
 * Other params are filled as usual.
 * @param {TranslateFn} t
 * @param {string} key
 * @param {string} name  The placeholder that the element replaces.
 * @param {Record<string, unknown>} [params]
 * @returns {[string, string]}
 */
export function splitAround(t, key, name, params = {}) {
  const text = t(key, { ...params, [name]: SLOT });
  const index = text.indexOf(SLOT);
  if (index === -1) return [text, ''];
  return [text.slice(0, index), text.slice(index + SLOT.length)];
}
