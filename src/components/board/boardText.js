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
 * Display helpers of the Race board (`src/components/board/*`): text built
 * from the `ui-board.*` catalog in the UI language and unit system. Display
 * only: they pick and format what the plan already holds and never compute
 * nutrition. No React. The recipe text every view shares (amounts, names,
 * colours, osmolality, bottle fill) is in `../recipe/recipeText.js`; this
 * module adds only the board's own wording around it.
 */

import { finite } from '../../i18n/formatters';
import { countText } from '../../i18n/plural';
import { bottleFill } from '../recipe/recipeText';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: object, citations?: string[] }} Warning */

/** Order of warning levels, worst first. */
const LEVEL_ORDER = Object.freeze(['danger', 'warning', 'info']);

/**
 * A duration as hours and minutes on a clock face: "3:00 h", "5:30 h",
 * "0:45 h". The board's title row and the share image (a picture of the
 * board) write the plan's duration this way.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {number} minutes
 * @returns {string}
 */
export function durationText(t, f, minutes) {
  const total = Math.max(0, Math.round(finite(minutes)));
  return t('ui-board.summary.duration', {
    hours: f.number(Math.floor(total / 60)),
    minutes: String(total % 60).padStart(2, '0'),
  });
}

/**
 * The event summary of the title row (and of the share image):
 * "3:00 h · Cycling · Moderate".
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {{ durationMin: number, sport: string, intensity: string }} event
 * @returns {string}
 */
export function eventSummary(t, f, event) {
  return t('ui-board.summary', {
    duration: durationText(t, f, event?.durationMin),
    sport: t(`ui-common.sport.${event?.sport}`),
    intensity: t(`ui-common.intensity.${event?.intensity}`),
  });
}

/**
 * Where the sweat rate comes from, for the sweat chip: the source the plan
 * used, noting a sweat test that was chosen but cannot be used, and a test
 * scaled to the event conditions.
 * @param {Plan} plan
 * @param {string} requested  `inputs.sweat.source`.
 * @returns {string}  A `ui-board.chip.sweatSource.*` key.
 */
export function sweatSourceKey(plan, requested) {
  const { source, calibration } = plan.sweat;
  if (requested === 'test' && source !== 'test') return 'ui-board.chip.sweatSource.estimateNoTest';
  if (source === 'test') {
    return calibration?.applied ? 'ui-board.chip.sweatSource.testScaled' : 'ui-board.chip.sweatSource.test';
  }
  return source === 'preset' ? 'ui-board.chip.sweatSource.preset' : 'ui-board.chip.sweatSource.estimate';
}

/**
 * How many warnings there are, the worst level among them and how many are
 * dangers.
 * @param {Warning[]|null|undefined} warnings
 * @returns {{ count: number, worst: 'danger'|'warning'|'info'|null, dangers: number }}
 */
export function warningsSummary(warnings) {
  const list = Array.isArray(warnings) ? warnings.filter((w) => w && typeof w === 'object') : [];
  const worst = LEVEL_ORDER.find((level) => list.some((w) => w.level === level)) ?? (list.length > 0 ? 'info' : null);
  return { count: list.length, worst, dangers: list.filter((w) => w.level === 'danger').length };
}

/**
 * The short text the board announces politely when the warnings change:
 * "No warnings", "4 warnings", "4 warnings, 1 danger".
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {{ count: number, dangers: number }} summary  From {@link warningsSummary}.
 * @returns {string}
 */
export function warningsAnnouncement(t, f, { count, dangers }) {
  if (!(count > 0)) return t('ui-board.live.none');
  const warnings = countText(t, f, 'ui-board.chip.warnings', count);
  if (!(dangers > 0)) return warnings;
  return t('ui-board.live.withDangers', { warnings, dangers: countText(t, f, 'ui-board.live.dangers', dangers) });
}

/**
 * Heading of a recipe section: "Gels ×9", "Bottles ×4", or "Gels" /
 * "Drink" without servings.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @returns {string}
 */
export function sectionTitle(t, f, section) {
  const gel = section.kind === 'gel';
  if (!(section.servings > 0)) return t(gel ? 'ui-board.section.gelNone' : 'ui-board.section.drinkNone');
  return t(gel ? 'ui-board.section.gel' : 'ui-board.section.drink', { count: f.number(section.servings) });
}

/**
 * What a section's servings are, beyond the count in its heading: for a
 * drink the fill of each bottle (with the bottle size when the bottles are
 * not filled to the top); why there are no gels or bottles. `null` for gels
 * (the heading says how many). The bottle size is added only when the two
 * volumes read differently in the unit system (a 740 ml fill of a 750 ml
 * bottle is "25 fl oz each", never "25 fl oz each (25 fl oz bottle)").
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {string|null}
 */
export function servingsText(t, f, section, bottleMl) {
  if (section.kind === 'gel') return section.servings > 0 ? null : t('ui-board.servings.gelNone');
  if (!(section.servings > 0)) return t('ui-board.servings.drinkNone');
  const { fill, size, partial } = bottleFill(f, section, bottleMl);
  return partial ? t('ui-board.servings.drinkPartial', { fill, size }) : t('ui-board.servings.drinkFull', { fill });
}

/**
 * Caption above a section's lanes: the whole section, or one serving
 * ("Per gel" / "Per bottle"). A section without servings always shows the
 * whole amount.
 * @param {TranslateFn} t
 * @param {RecipeSection} section
 * @param {'total'|'perServing'} view
 * @returns {string}
 */
export function amountsCaption(t, section, view) {
  if (!(section.servings > 0)) return t('ui-board.amounts.activity');
  if (view === 'perServing') return t(section.servingLabelKey);
  return t(section.kind === 'gel' ? 'ui-board.amounts.batch' : 'ui-board.amounts.allBottles');
}
