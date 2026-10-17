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
 * Race-day schedule: when each gel is taken, how much to drink with it (or,
 * for a drink-only plan, how much to drink from which bottle every 20 min),
 * and when pre-race bicarbonate and caffeine doses fall.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. `buildSchedule`
 * never returns English text; it returns message descriptors whose keys live
 * in `src/i18n/en/schedule.js`. (`formatElapsed` is a plain time formatter
 * kept from the former `src/lib/schedule.js`, extended to format pre-start times.)
 */

import { DEFAULT_BOTTLE_ML } from './concentration';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */

/**
 * One caffeine intake, as returned by `planCaffeine` (`src/domain/caffeine.js`).
 *
 * @typedef {Object} CaffeineDose
 * @property {number} timeMin  Minutes from the start (negative = before the start).
 * @property {number} mg  Caffeine in mg.
 * @property {'pre'|'intra'} kind  `'pre'` before the start, `'intra'` during the event.
 * @property {number|null} gelIndex  Index into the gel times of the gel that carries this dose, or `null`.
 * @property {number|null} tablets  Number of tablets when caffeine is added as an ingredient, else `null`.
 */

/**
 * The parts of a `planCaffeine` result the schedule reads.
 *
 * @typedef {Object} CaffeinePlanLike
 * @property {boolean} enabled
 * @property {CaffeineDose[]} doses
 */

/**
 * The parts of a `planBicarbonate` result the schedule reads.
 *
 * @typedef {Object} BicarbPlanLike
 * @property {boolean} enabled
 * @property {number} doseG  Sodium bicarbonate dose in g.
 * @property {number} sodiumMg  Sodium in that dose in mg.
 * @property {{ recommended: number }} timingMin  Recommended intake time in minutes (negative = before the start).
 */

/**
 * One row of the race-day schedule.
 *
 * @typedef {Object} ScheduleEvent
 * @property {number} timeMin  Minutes from the start (negative = before the start).
 * @property {'bicarb'|'caffeine'|'start'|'fuel'|'drink'|'hydration'|'finish'} type
 * @property {Message} message  What to do at this time (key in `src/i18n/en/schedule.js`).
 * @property {number} [caffeineMg]  Caffeine taken at this event in mg (caffeine events, and gels that carry caffeine).
 * @property {number} [fluidMl]  Fluid in ml, a multiple of 10 ml, omitted when 0: to drink with this gel (the
 *   start gel and fuel events), or the sip of a `drink` event.
 * @property {number} [bottle]  `drink` events only: the 1-based number of the bottle that holds the first ml
 *   of this sip (the bottle being finished).
 * @property {number} [lastBottle]  `drink` events whose sip runs on into a later bottle only: the bottle that
 *   holds the last ml of the sip. The sip finishes every bottle from `bottle` to the one before `lastBottle`.
 */

/**
 * The parts of a `drinkBottles` result (`src/domain/concentration.js`) the
 * schedule reads.
 *
 * @typedef {Object} DrinkLike
 * @property {number} [bottles]  Number of bottles mixed for the event.
 * @property {number} [bottleMl]  Size of one bottle in ml.
 * @property {{ fillMl?: number }} [perBottle]  `fillMl`: how far each bottle is filled in ml (at most
 *   `bottleMl`). `drinkBottles` fills every bottle to `plan's fluid / bottles`, so the plan's fluid
 *   finishes every bottle.
 */

/** Recipe formats `buildSchedule` understands (`inputs.format.type`). */
const FORMAT_TYPES = new Set(['gel', 'drink', 'both']);

/**
 * Minutes between drink events when the drink carries the fluid (format
 * `'drink'`, or `'both'` when no gel carries it).
 */
export const DRINK_INTERVAL_MIN = 20;

/** Bottle size used when `drink.bottleMl` is missing or invalid: `DEFAULT_BOTTLE_ML` from `concentration.js`. */

/**
 * Highest fluid rate `buildSchedule` uses, in ml/h (100 l/h). Higher finite
 * rates are clamped to it so the running totals stay finite. `normalizeInputs`
 * caps the fluid at 3000 ml/h.
 */
const MAX_FLUID_ML_PER_HOUR = 100000;

/**
 * Smallest bottle size `buildSchedule` accepts, in ml: one rounding step of
 * the listed fluid. Smaller sizes count as missing (750 ml), like non-finite
 * ones, so a tiny size never makes the bottle count overflow.
 * `normalizeInputs` keeps sizes in [250, 1500] ml.
 */
const MIN_BOTTLE_ML = 10;

/** Default bicarbonate timing in minutes when a plan has no usable `timingMin.recommended`. */
const BICARB_DEFAULT_TIME_MIN = -90;

/**
 * Longest schedule `buildSchedule` builds, in minutes (7 days). Longer finite
 * durations are clamped to it so the gel list stays small. `normalizeInputs`
 * caps durations at 2880 min, so real plans never reach it.
 */
const MAX_DURATION_MIN = 7 * 24 * 60;

/**
 * Highest gel rate `buildSchedule` uses (one gel per minute). Higher finite
 * rates are clamped to it. `normalizeInputs` caps the rate at 12 gels/h.
 */
const MAX_GELS_PER_HOUR = 60;

/**
 * Most bottles `buildSchedule` numbers (1 680 000): the most fluid it lists
 * (100 l/h for 7 days) in bottles of the smallest size. A count derived from
 * the plan never reaches it. Larger given counts are clamped to it, so bottle
 * numbers stay finite.
 */
const MAX_BOTTLES = Math.ceil((MAX_FLUID_ML_PER_HOUR * MAX_DURATION_MIN) / 60 / MIN_BOTTLE_ML);

/** Message keys for an event that includes a gel, by what the gel carries. */
const START_KEYS = {
  plain: 'schedule.startWithGel',
  fluid: 'schedule.startWithGelAndFluid',
  caffeine: 'schedule.startWithGelAndCaffeine',
  both: 'schedule.startWithGelFluidAndCaffeine',
};
const FUEL_KEYS = {
  plain: 'schedule.fuel',
  fluid: 'schedule.fuelWithFluid',
  caffeine: 'schedule.fuelWithCaffeine',
  both: 'schedule.fuelWithFluidAndCaffeine',
};

const round1 = (x) => Math.round(x * 10) / 10;
const round10 = (x) => Math.round(x / 10) * 10;
/** Down to a multiple of 10; the epsilon keeps float drift (59.999… min) from losing 10 ml. */
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;

/**
 * Fluid for each intake point (a gel, or a drink sip), in ml. Each point
 * covers the time until the next one, or until the finish for the last one,
 * so the amounts add up to the plan's fluid. They are rounded on the running
 * total (down to 10 ml), so every amount is a multiple of 10 ml within 10 ml
 * of its exact share, and the sum is the plan total rounded down to 10 ml: it
 * never exceeds the plan.
 *
 * When a full interval (or the whole event, for a single point) would carry
 * less than 5 ml, no point carries fluid (all zeros) and the schedule shows a
 * hydration event instead.
 *
 * @param {number[]} times  Intake times in minutes, ascending, from {@link getGelTimes}.
 * @param {number} duration  Event duration in minutes.
 * @param {number} fluidRate  Fluid in ml/h (≥ 0).
 * @param {number} intervalMin  Minutes between intake points.
 * @returns {number[]} One amount per intake point.
 */
function fluidPerIntake(times, duration, fluidRate, intervalMin) {
  if (times.length === 0) return [];
  if (round10((fluidRate * Math.min(intervalMin, duration)) / 60) === 0) return times.map(() => 0);
  const listedUpTo = (timeMin) => floor10((fluidRate * Math.min(timeMin, duration)) / 60);
  return times.map((timeMin, i) => {
    const end = i + 1 < times.length ? times[i + 1] : duration;
    return Math.max(0, listedUpTo(end) - listedUpTo(timeMin));
  });
}

/**
 * Bottle size, count and fill for the drink sips. For a size of at least
 * {@link MIN_BOTTLE_ML} they are what `drinkBottles` computes:
 * - size: `drink.bottleMl` when it is finite and at least
 *   {@link MIN_BOTTLE_ML}, else 750 ml;
 * - count: `drink.bottles` (whole bottles) when it is finite and at least 1,
 *   else `max(1, ceil(planned fluid / size))`; at most {@link MAX_BOTTLES};
 * - fill: `drink.perBottle.fillMl` when it is above 0 and at most the size
 *   (the fill the recipe shows), else `min(size, planned fluid / count)`.
 *   Equal bottles of `planned fluid / count` hold the plan's fluid, so the
 *   listed sips finish every bottle. The `min` applies when a given count is
 *   too small for the fluid: the athlete refills the last bottle.
 *
 * @param {DrinkLike|undefined} drink
 * @param {number} plannedMl  The plan's fluid for the whole event in ml.
 * @returns {{ bottleMl: number, bottles: number, fillMl: number }}
 */
function bottleSetup(drink, plannedMl) {
  const size = drink?.bottleMl;
  const bottleMl = Number.isFinite(size) && size >= MIN_BOTTLE_ML ? size : DEFAULT_BOTTLE_ML;
  const given = drink?.bottles;
  const count =
    Number.isFinite(given) && given >= 1
      ? Math.floor(given)
      : Math.max(1, Math.ceil(plannedMl / bottleMl - 1e-9));
  const bottles = Math.min(count, MAX_BOTTLES);
  const fill = drink?.perBottle?.fillMl;
  let fillMl = bottleMl;
  if (Number.isFinite(fill) && fill > 0 && fill <= bottleMl) fillMl = fill;
  else if (plannedMl > 0) fillMl = Math.min(bottleMl, plannedMl / bottles);
  return { bottleMl, bottles, fillMl };
}

/**
 * Event for a drink sip of `ml` that starts in bottle `bottle` and ends in
 * bottle `lastBottle`. The message says which bottles the sip comes from:
 * `schedule.drinkSip` `{ ml, bottle }` within one bottle,
 * `schedule.drinkSipSwitch` `{ ml, bottle, next }` when it finishes `bottle`
 * and goes on with the next one, and `schedule.drinkSipSpan`
 * `{ ml, bottle, finished, next }` when it finishes several bottles.
 *
 * @param {number} timeMin
 * @param {number} ml
 * @param {number} bottle  Bottle holding the first ml of the sip.
 * @param {number} lastBottle  Bottle holding the last ml of the sip (≥ `bottle`).
 * @returns {ScheduleEvent}
 */
function drinkSipEvent(timeMin, ml, bottle, lastBottle) {
  /** @type {Message} */
  let message = { key: 'schedule.drinkSip', params: { ml, bottle } };
  if (lastBottle === bottle + 1) {
    message = { key: 'schedule.drinkSipSwitch', params: { ml, bottle, next: lastBottle } };
  } else if (lastBottle > bottle + 1) {
    message = { key: 'schedule.drinkSipSpan', params: { ml, bottle, finished: lastBottle - 1, next: lastBottle } };
  }
  /** @type {ScheduleEvent} */
  const event = { timeMin, type: 'drink', message, fluidMl: ml, bottle };
  if (lastBottle !== bottle) event.lastBottle = lastBottle;
  return event;
}

/**
 * Drink events, one every {@link DRINK_INTERVAL_MIN} min from the start, each
 * with the plan's fluid until the next sip (or the finish), rounded like the
 * gel fluid ({@link fluidPerIntake}). Sips that round to 0 ml are left out.
 *
 * The bottles are drunk one after the other, each holding `fill` ml
 * ({@link bottleSetup}), so `bottle` is the bottle that holds the first ml of
 * the sip (the one being finished): `floor(fluid listed before this sip /
 * fill) + 1`, and the sip ends in bottle `ceil(fluid listed after it / fill)`
 * (`lastBottle` when it differs), both at most `bottles`. With the fill of
 * `drinkBottles` the listed fluid (the plan's fluid rounded down to 10 ml)
 * empties every bottle, so all the drink's carbohydrate and sodium is taken.
 * All bottles hold the same mix, so the carbohydrate and sodium per ml stay
 * the same from one bottle to the next.
 *
 * @param {number} duration  Event duration in minutes.
 * @param {number} fluidRate  Fluid in ml/h (≥ 0).
 * @param {DrinkLike|undefined} drink
 * @returns {ScheduleEvent[]}
 */
function drinkSipEvents(duration, fluidRate, drink) {
  const times = getGelTimes(duration, 60 / DRINK_INTERVAL_MIN);
  const sips = fluidPerIntake(times, duration, fluidRate, DRINK_INTERVAL_MIN);
  const { bottles, fillMl } = bottleSetup(drink, (fluidRate * duration) / 60);
  /** @type {ScheduleEvent[]} */
  const events = [];
  let listedMl = 0;
  times.forEach((timeMin, i) => {
    const ml = sips[i];
    if (ml > 0) {
      // The epsilons keep float drift (999.9999… ml of three 333.3 ml bottles) from
      // staying on an emptied bottle or reaching into the next one.
      const bottle = Math.min(bottles, Math.floor(listedMl / fillMl + 1e-9) + 1);
      const lastBottle = Math.min(bottles, Math.max(bottle, Math.ceil((listedMl + ml) / fillMl - 1e-9)));
      events.push(drinkSipEvent(timeMin, ml, bottle, lastBottle));
    }
    listedMl += ml;
  });
  return events;
}

/**
 * A non-negative finite number, or 0.
 * @param {unknown} x
 * @returns {number}
 */
const positiveOrZero = (x) => (Number.isFinite(x) && x > 0 ? x : 0);

/**
 * Minutes after the start at which a gel is taken. The first gel is taken at
 * the start, then one every 60 / gelsPerHour minutes while the activity lasts.
 * The per-gel recipe divides the batch by the length of this list, so both
 * always agree.
 *
 * @param {number} durationMinutes  Activity duration in minutes; negative, NaN or infinite → no gels.
 * @param {number} gelsPerHour  Gels per hour; ≤ 0 or not a number → no gels.
 * @returns {number[]} Gel times in minutes, ascending, starting at 0; `[]` when there are no gels.
 */
export function getGelTimes(durationMinutes, gelsPerHour) {
  if (!(gelsPerHour > 0) || !(durationMinutes >= 0) || !Number.isFinite(durationMinutes)) return [];
  const interval = 60 / gelsPerHour;
  // A rate so small that 60 / rate overflows (e.g. 5e-324) still means one gel
  // at the start; i * Infinity would make that first time NaN.
  if (!Number.isFinite(interval)) return [0];
  // Small epsilon so float drift (e.g. 7 gels/hr) never adds a gel at the finish line.
  const count = Math.max(1, Math.ceil(durationMinutes / interval - 1e-9));
  return Array.from({ length: count }, (_, i) => i * interval);
}

/**
 * Number of gels taken during the activity; the length of {@link getGelTimes}.
 *
 * @param {number} durationMinutes  Activity duration in minutes.
 * @param {number} gelsPerHour  Gels per hour.
 * @returns {number}
 */
export function getGelCount(durationMinutes, gelsPerHour) {
  return getGelTimes(durationMinutes, gelsPerHour).length;
}

/**
 * Formats minutes from the start as elapsed time: `T+30m`, `T+1h`,
 * `T+1h 26m`. Rounds to whole minutes first, so it never shows `60m`.
 * Times before the start (negative, as `buildSchedule` returns for bicarbonate
 * and pre-race caffeine) use a minus sign (U+2212) on the absolute value:
 * `-90` → `T−1h 30m`. Anything that rounds to 0 is `T+0m`.
 *
 * @param {number} minutes  Minutes from the start (negative = before the start).
 * @returns {string}
 */
export function formatElapsed(minutes) {
  const total = Math.round(minutes);
  const sign = total < 0 ? "\u2212" : "+";
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours > 0) return `T${sign}${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  return `T${sign}${mins}m`;
}

/**
 * Message for a caffeine dose taken on its own (not in a gel).
 * @param {CaffeineDose} dose
 * @returns {Message}
 */
function caffeineMessage(dose) {
  if (Number.isFinite(dose.tablets) && dose.tablets > 0) {
    return { key: 'schedule.caffeineTablets', params: { mg: dose.mg, tablets: dose.tablets } };
  }
  return { key: 'schedule.caffeine', params: { mg: dose.mg } };
}

/**
 * Event for a gel taken at `timeMin`, with the message variant that matches
 * what it carries (fluid, caffeine, both or neither).
 *
 * @param {number} timeMin
 * @param {'start'|'fuel'} type
 * @param {{ plain: string, fluid: string, caffeine: string, both: string }} keys
 * @param {Record<string, number>} baseParams  Params every variant takes (e.g. `{ gel }`).
 * @param {number} fluidMl  Fluid with this gel in ml; 0 → none.
 * @param {number|undefined} caffeineMg  Caffeine in this gel in mg; `undefined` → none.
 * @returns {ScheduleEvent}
 */
function gelEvent(timeMin, type, keys, baseParams, fluidMl, caffeineMg) {
  const hasFluid = fluidMl > 0;
  const hasCaffeine = caffeineMg !== undefined;
  let key = keys.plain;
  if (hasFluid && hasCaffeine) key = keys.both;
  else if (hasFluid) key = keys.fluid;
  else if (hasCaffeine) key = keys.caffeine;

  const params = { ...baseParams };
  if (hasFluid) params.fluidMl = fluidMl;
  if (hasCaffeine) params.caffeineMg = caffeineMg;

  /** @type {ScheduleEvent} */
  const event = { timeMin, type, message: Object.keys(params).length > 0 ? { key, params } : { key } };
  if (hasFluid) event.fluidMl = fluidMl;
  if (hasCaffeine) event.caffeineMg = caffeineMg;
  return event;
}

/**
 * Builds the race-day schedule from the recipe format, gel plan, fluid target,
 * drink bottles, caffeine plan and bicarbonate plan. Events are sorted by
 * time; events at the same time keep this order: bicarb, pre-race caffeine,
 * start, hydration, drink, fuel, caffeine taken on its own, finish.
 *
 * The format (`type`, as `inputs.format.type`) decides who carries the fluid:
 * - `'gel'` (also when `type` is missing or unknown, so the Phase 1 call
 *   works unchanged): gels, each with the fluid until the next gel, as below.
 *   `drink` is ignored.
 * - `'drink'`: no gels (`gelsPerHour` is ignored). A `drink` event every
 *   {@link DRINK_INTERVAL_MIN} min from the start (`schedule.drinkSip`, params
 *   `{ ml, bottle }`, also as `fluidMl` and `bottle`): `ml` is the plan's fluid
 *   until the next sip (or the finish), rounded like the gel fluid, and
 *   `bottle` the bottle being finished. The bottles (`drink.bottles`, each
 *   filled to `drink.perBottle.fillMl`, else to `min(drink.bottleMl, planned
 *   fluid / drink.bottles)` as `drinkBottles` fills them) are drunk one after
 *   the other, so the bottle is `floor(fluid listed before this sip / fill) +
 *   1`, at most `drink.bottles`, and the listed sips empty every bottle. A sip
 *   that runs on into later bottles also has `lastBottle` (the bottle holding
 *   its last ml) and says so: `schedule.drinkSipSwitch` `{ ml, bottle, next }`
 *   when it finishes one bottle, `schedule.drinkSipSpan`
 *   `{ ml, bottle, finished, next }` when it finishes several. Sips that round
 *   to 0 ml are left out.
 * - `'both'`: gels exactly as in `'gel'` mode, with the fluid to drink with
 *   each gel (the drink holds the electrolytes and part of the carbs). When no
 *   gel carries fluid (no gels, or a gel interval too short for 5 ml), the
 *   fluid is listed as drink sips as in `'drink'` mode instead.
 *
 * Events:
 * - `bicarb` (when `bicarb.enabled` and the dose is > 0) at
 *   `bicarb.timingMin.recommended` (−90 min when missing), params
 *   `{ doseG, sodiumG }` rounded to 0.1 g.
 * - `caffeine` for each pre-race dose at its (negative) time, params `{ mg }`,
 *   or `{ mg, tablets }` when the dose is in tablets; `caffeineMg` is set.
 * - `start` at 0: `schedule.start`, or `schedule.startWithGel` when there are
 *   gels (the first gel is taken at the start). The first gel carries fluid
 *   like every other gel (`fluidMl`, `schedule.startWithGelAndFluid`). If an
 *   intra caffeine dose sits in the first gel (`gelIndex` 0), the start event
 *   carries `caffeineMg` (`schedule.startWithGelAndCaffeine`, or
 *   `schedule.startWithGelFluidAndCaffeine` with fluid).
 * - `fuel` for each gel time after 0 ({@link getGelTimes}), params
 *   `{ gel }` (1-based gel number). `caffeineMg` is the sum of intra caffeine
 *   doses with that `gelIndex`.
 * - Fluid per gel (omitted when 0): the fluid for the time until the next gel,
 *   or until the finish for the last gel, so a gel taken shortly before the
 *   finish gets only a little. That is `fluidMlPerHour × interval / 60` for a
 *   full interval. Amounts are rounded on the running total, so each is a
 *   multiple of 10 ml within 10 ml of its exact share, and together they are
 *   the plan's fluid rounded down to 10 ml. The listed fluid (gels and drink
 *   sips alike) never exceeds `fluidMlPerHour × durationMin / 60`.
 * - `drink` sips as described above.
 * - Intra caffeine doses without a gel (`gelIndex === null`, an index that is
 *   not one of this schedule's gels, or any dose in `'drink'` mode) become
 *   `caffeine` events at their time.
 * - `fluidMlPerHour > 0` but no gel or sip carries fluid (no gels, or a full
 *   interval would carry less than 5 ml) → one `hydration` event at 0
 *   (`schedule.hydrationOnly`, params `{ mlPerHour }`). So a fluid target
 *   always appears in the schedule.
 * - `finish` at `durationMin`.
 *
 * Non-finite or negative `durationMin`, `gelsPerHour` and `fluidMlPerHour`
 * count as 0. Finite `durationMin` above 10080 (7 days), `gelsPerHour` above
 * 60 and `fluidMlPerHour` above 100000 are clamped to those values, so huge
 * inputs never build huge arrays or overflow. A missing `drink`, or a bottle
 * size that is not finite or below 10 ml, uses 750 ml bottles; a missing or
 * invalid count is `max(1, ceil(planned fluid / size))`; counts are clamped
 * to 1 680 000 so bottle numbers stay finite. A
 * missing or disabled caffeine or bicarbonate plan adds no events. Caffeine
 * doses with a non-finite time or a dose ≤ 0 are skipped. Arguments are not
 * mutated.
 *
 * @param {Object} [input]
 * @param {number} [input.durationMin]  Activity duration in minutes.
 * @param {'gel'|'drink'|'both'} [input.type]  Recipe format; missing or unknown → `'gel'`.
 * @param {number} [input.gelsPerHour]  Gels per hour (as passed to {@link getGelTimes}); ignored for `'drink'`.
 * @param {number} [input.fluidMlPerHour]  Planned fluid intake in ml/h.
 * @param {DrinkLike} [input.drink]  The drink bottles (`drinkBottles` result) for `'drink'` and `'both'`.
 * @param {CaffeinePlanLike} [input.caffeine]  Result of `planCaffeine`, computed with the same gel times.
 * @param {BicarbPlanLike} [input.bicarb]  Result of `planBicarbonate`.
 * @returns {ScheduleEvent[]}
 */
export function buildSchedule({ durationMin, type, gelsPerHour, fluidMlPerHour, drink, caffeine, bicarb } = {}) {
  const format = FORMAT_TYPES.has(type) ? type : 'gel';
  const duration = Math.min(positiveOrZero(durationMin), MAX_DURATION_MIN);
  const rate = format === 'drink' ? 0 : Math.min(positiveOrZero(gelsPerHour), MAX_GELS_PER_HOUR);
  const fluidRate = Math.min(positiveOrZero(fluidMlPerHour), MAX_FLUID_ML_PER_HOUR);
  const gelTimes = getGelTimes(duration, rate);
  const intervalMin = gelTimes.length > 0 ? 60 / rate : 0;
  const gelFluidMl = fluidPerIntake(gelTimes, duration, fluidRate, intervalMin);
  const gelsCarryFluid = gelFluidMl.some((ml) => ml > 0);
  // The drink carries the fluid in drink mode, and in 'both' mode when no gel does.
  const sipEvents =
    format === 'drink' || (format === 'both' && !gelsCarryFluid) ? drinkSipEvents(duration, fluidRate, drink) : [];

  const doses =
    caffeine && caffeine.enabled && Array.isArray(caffeine.doses)
      ? caffeine.doses.filter(
          (d) => d && Number.isFinite(d.timeMin) && Number.isFinite(d.mg) && d.mg > 0,
        )
      : [];
  const preDoses = doses.filter((d) => d.kind === 'pre');
  const intraDoses = doses.filter((d) => d.kind !== 'pre');

  /** Caffeine in mg carried by each gel, keyed by gel index. */
  const gelCaffeineMg = new Map();
  /** @type {CaffeineDose[]} */
  const looseIntraDoses = [];
  for (const dose of intraDoses) {
    const i = dose.gelIndex;
    if (Number.isInteger(i) && i >= 0 && i < gelTimes.length) {
      gelCaffeineMg.set(i, (gelCaffeineMg.get(i) ?? 0) + dose.mg);
    } else {
      looseIntraDoses.push(dose);
    }
  }

  /** @type {ScheduleEvent[]} */
  const events = [];

  if (bicarb && bicarb.enabled && Number.isFinite(bicarb.doseG) && bicarb.doseG > 0) {
    const recommended = bicarb.timingMin?.recommended;
    events.push({
      timeMin: Number.isFinite(recommended) ? recommended : BICARB_DEFAULT_TIME_MIN,
      type: 'bicarb',
      message: {
        key: 'schedule.bicarb',
        params: {
          doseG: round1(bicarb.doseG),
          sodiumG: round1(positiveOrZero(bicarb.sodiumMg) / 1000),
        },
      },
    });
  }

  for (const dose of preDoses) {
    events.push({
      timeMin: dose.timeMin,
      type: 'caffeine',
      message: caffeineMessage(dose),
      caffeineMg: dose.mg,
    });
  }

  if (gelTimes.length === 0) {
    events.push({ timeMin: 0, type: 'start', message: { key: 'schedule.start' } });
  } else {
    // The first gel is part of the start event.
    events.push(gelEvent(0, 'start', START_KEYS, {}, gelFluidMl[0], gelCaffeineMg.get(0)));
  }

  if (fluidRate > 0 && !gelsCarryFluid && sipEvents.length === 0) {
    events.push({
      timeMin: 0,
      type: 'hydration',
      message: { key: 'schedule.hydrationOnly', params: { mlPerHour: fluidRate } },
    });
  }

  events.push(...sipEvents);

  gelTimes.forEach((timeMin, i) => {
    if (i === 0) return; // Covered by the start event.
    events.push(gelEvent(timeMin, 'fuel', FUEL_KEYS, { gel: i + 1 }, gelFluidMl[i], gelCaffeineMg.get(i)));
  });

  for (const dose of looseIntraDoses) {
    events.push({
      timeMin: dose.timeMin,
      type: 'caffeine',
      message: caffeineMessage(dose),
      caffeineMg: dose.mg,
    });
  }

  events.push({ timeMin: duration, type: 'finish', message: { key: 'schedule.finish' } });

  // Array.prototype.sort is stable, so events at the same time keep the order above.
  return events.sort((a, b) => a.timeMin - b.timeMin);
}
