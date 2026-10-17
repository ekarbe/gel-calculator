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
 * Text of the race-day schedule (`plan.schedule`) in the UI language and
 * unit system: times from the start, the rows of the list and the table,
 * the drink bottles and the fluid advice. Display only: every event, amount
 * and explanation comes from the plan. No React, so the print view (and the
 * board's "Next up") can use the same text.
 */

import { MINUS, finite } from '../../i18n/formatters';
import { pluralOf } from '../../i18n/plural';
import { bottleFill } from '../recipe/recipeText';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/schedule').ScheduleEvent} ScheduleEvent */

/**
 * One schedule row as the views show it.
 * @typedef {Object} ScheduleRow
 * @property {string} key  Unique within the schedule.
 * @property {ScheduleEvent['type']} type
 * @property {number} timeMin  Minutes from the start (negative = before the start).
 * @property {string} time  Short time ("T+20m", "T−1h 30m").
 * @property {string} spokenTime  The time in words for screen readers ("20 minutes after the start").
 * @property {string} title  Event title ("Fuel", "Drink").
 * @property {string} spokenTitle  The title with the spoken time before it, for screen readers
 *   ("20 minutes after the start: Fuel"), so an event heading says when it happens.
 * @property {string} text  What to do ("Take gel 2 with about 270 ml fluid.").
 */

/**
 * Splits minutes from the start into a sign and whole hours and minutes,
 * rounded to whole minutes first (so it never shows "60m").
 * @param {number} minutes
 * @returns {{ total: number, sign: string, hours: number, rest: number }}
 */
function splitElapsed(minutes) {
  const total = Math.round(finite(minutes));
  const abs = Math.abs(total);
  return { total, sign: total < 0 ? MINUS : '+', hours: Math.floor(abs / 60), rest: abs % 60 };
}

/**
 * Time from the start as the schedule shows it: "T+0m", "T+20m", "T+1h",
 * "T+1h 20m"; before the start with a minus sign, "T−1h 30m". The English
 * text is `formatElapsed` from `src/domain/schedule.js`, with locale numbers.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {number} minutes  Minutes from the start (negative = before the start).
 * @returns {string}
 */
export function elapsedText(t, f, minutes) {
  const { sign, hours, rest } = splitElapsed(minutes);
  if (hours === 0) return t('ui-schedule.time.m', { sign, minutes: f.number(rest) });
  if (rest === 0) return t('ui-schedule.time.h', { sign, hours: f.number(hours) });
  return t('ui-schedule.time.hm', { sign, hours: f.number(hours), minutes: f.number(rest) });
}

/**
 * The same time in words, for screen readers: "At the start",
 * "20 minutes after the start", "1 hour 30 minutes before the start". Units
 * are written out with their plural (`ui-schedule.spoken.*`), never
 * abbreviated: screen readers read "h" and "min" letter by letter or expand
 * them inconsistently, and this is the only time a screen-reader user gets
 * (the short form on screen is hidden from them).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {number} minutes
 * @returns {string}
 */
export function spokenElapsedText(t, f, minutes) {
  const { total, hours, rest } = splitElapsed(minutes);
  if (total === 0) return t('ui-schedule.time.atStart');
  const hoursText = hours > 0 ? t(`ui-schedule.spoken.hours.${pluralOf(hours)}`, { count: f.number(hours) }) : null;
  const minutesText = rest > 0 ? t(`ui-schedule.spoken.minutes.${pluralOf(rest)}`, { count: f.number(rest) }) : null;
  const duration =
    hoursText && minutesText
      ? t('ui-schedule.spoken.hoursMinutes', { hours: hoursText, minutes: minutesText })
      : (hoursText ?? minutesText);
  return t(total < 0 ? 'ui-schedule.time.before' : 'ui-schedule.time.after', { duration });
}

/**
 * The rows of a schedule, in the order of `plan.schedule`: time (short and
 * in words), title (`schedule.title.<type>`, also with the spoken time before
 * it) and text (the event's message), all through `t`.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {ScheduleEvent[]|null|undefined} schedule
 * @returns {ScheduleRow[]}
 */
export function scheduleRows(t, f, schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule
    .filter((event) => event && typeof event === 'object')
    .map((event, index) => {
      const spokenTime = spokenElapsedText(t, f, event.timeMin);
      const title = t(`schedule.title.${event.type}`);
      return {
        key: `${event.type}-${event.timeMin}-${index}`,
        type: event.type,
        timeMin: finite(event.timeMin),
        time: elapsedText(t, f, event.timeMin),
        spokenTime,
        title,
        spokenTitle: t('ui-schedule.list.heading', { time: spokenTime, title }),
        text: t(event.message),
      };
    });
}

/**
 * The bottles of a drink section: "4 bottles of 750 ml", or "4 bottles,
 * 600 ml each (750 ml bottle)" when the bottles are not filled to the top
 * (volumes in the unit system; the Phase 2 wording, which the mixing dialog
 * keeps too). The bottle size is added only when the two volumes read
 * differently in the unit system, as on the board: a 740 ml fill of a 750 ml
 * bottle is "3 bottles of 25 fl oz", never "25 fl oz each (25 fl oz
 * bottle)". `null` without bottles.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section  A drink section.
 * @param {number} bottleMl  Bottle size from the inputs.
 * @returns {string|null}
 */
export function bottlesText(t, f, section, bottleMl) {
  const count = finite(section?.servings);
  if (!(count > 0)) return null;
  const { fill, size, partial } = bottleFill(f, section, bottleMl);
  const key = `ui-schedule.bottles.${partial ? 'partial' : 'full'}.${pluralOf(count)}`;
  return t(key, { count: f.number(count), fill, size });
}

/**
 * What the drink sips are drunk from, for plans whose schedule lists drink
 * events: "Drink from 4 bottles, 600 ml each (750 ml bottle), one after the
 * other. …". `null` when the schedule has no drink event or the recipe has
 * no bottles.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {string|null}
 */
export function bottleNote(t, f, plan) {
  const drink = plan.recipe.sections.find((section) => section.kind === 'drink');
  if (!drink || !plan.schedule.some((event) => event.type === 'drink')) return null;
  const bottles = bottlesText(t, f, drink, plan.inputs.format.bottleMl);
  return bottles ? t('ui-schedule.bottleNote', { bottles }) : null;
}

/**
 * The fluid advice under the schedule: the recommendation's explanation, or
 * for a manual target the chosen and the recommended amounts; the details
 * (such as the drink-to-thirst hint) and the citations of the
 * recommendation. `null` when no fluid is planned.
 * @param {TranslateFn} t
 * @param {Plan} plan
 * @returns {{ summary: string, details: string[], citations: string[] }|null}
 */
export function fluidAdvice(t, plan) {
  const { fluid } = plan;
  if (!(fluid.mlPerHour > 0)) return null;
  const why = fluid.recommended?.why;
  const summary =
    fluid.mode === 'manual'
      ? t('ui-schedule.fluid.manual', {
          // Whole ml, as the old view showed them (a manual target may carry decimals).
          mlPerHour: Math.round(finite(fluid.mlPerHour)),
          recommendedMlPerHour: Math.round(finite(fluid.recommended?.mlPerHour)),
        })
      : t(why?.summary);
  const details = (Array.isArray(why?.details) ? why.details : []).map((detail) => t(detail));
  return { summary, details, citations: Array.isArray(why?.citations) ? why.citations : [] };
}
