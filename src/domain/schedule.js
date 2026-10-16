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
 * Race-day schedule: when each gel is taken, how much to drink with it, and
 * when pre-race bicarbonate and caffeine doses fall.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. `buildSchedule`
 * never returns English text; it returns message descriptors whose keys live
 * in `src/i18n/en/schedule.js`. (`formatElapsed` is a plain time formatter
 * kept from the former `src/lib/schedule.js`, extended to format pre-start times.)
 */

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
 * @property {'bicarb'|'caffeine'|'start'|'fuel'|'hydration'|'finish'} type
 * @property {Message} message  What to do at this time (key in `src/i18n/en/schedule.js`).
 * @property {number} [caffeineMg]  Caffeine taken at this event in mg (caffeine events, and gels that carry caffeine).
 * @property {number} [fluidMl]  Fluid to drink with this gel in ml (the start gel and fuel events, a multiple of 10 ml; omitted when 0).
 */

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
 * Fluid to drink with each gel, in ml. Each gel covers the time until the
 * next gel, or until the finish for the last one, so the amounts add up to the
 * plan's fluid. They are rounded on the running total (down to 10 ml), so
 * every amount is a multiple of 10 ml within 10 ml of its exact share, and
 * the sum is the plan total rounded down to 10 ml: it never exceeds the plan.
 *
 * When a full gel interval (or the whole event, for a single gel) would carry
 * less than 5 ml, no gel carries fluid (all zeros) and the schedule shows a
 * hydration event instead.
 *
 * @param {number[]} gelTimes  From {@link getGelTimes}.
 * @param {number} duration  Event duration in minutes.
 * @param {number} fluidRate  Fluid in ml/h (≥ 0).
 * @param {number} intervalMin  Minutes between gels.
 * @returns {number[]} One amount per gel.
 */
function fluidPerGel(gelTimes, duration, fluidRate, intervalMin) {
  if (gelTimes.length === 0) return [];
  if (round10((fluidRate * Math.min(intervalMin, duration)) / 60) === 0) return gelTimes.map(() => 0);
  const listedUpTo = (timeMin) => floor10((fluidRate * Math.min(timeMin, duration)) / 60);
  return gelTimes.map((timeMin, i) => {
    const end = i + 1 < gelTimes.length ? gelTimes[i + 1] : duration;
    return Math.max(0, listedUpTo(end) - listedUpTo(timeMin));
  });
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
 * Builds the race-day schedule from the gel plan, fluid target, caffeine plan
 * and bicarbonate plan. Events are sorted by time; events at the same time
 * keep this order: bicarb, pre-race caffeine, start, hydration, fuel, caffeine
 * taken on its own, finish.
 *
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
 *   the plan's fluid rounded down to 10 ml. The listed fluid never exceeds
 *   `fluidMlPerHour × durationMin / 60`.
 * - Intra caffeine doses without a gel (`gelIndex === null`, or an index that
 *   is not one of this schedule's gels) become `caffeine` events at their time.
 * - `fluidMlPerHour > 0` but no gel carries fluid (no gels, or a full gel
 *   interval would carry less than 5 ml) → one `hydration` event at 0
 *   (`schedule.hydrationOnly`, params `{ mlPerHour }`). So a fluid target
 *   always appears in the schedule.
 * - `finish` at `durationMin`.
 *
 * Non-finite or negative `durationMin`, `gelsPerHour` and `fluidMlPerHour`
 * count as 0. Finite `durationMin` above 10080 (7 days) and `gelsPerHour`
 * above 60 are clamped to those values, so huge inputs never build huge
 * arrays. A missing or disabled caffeine or bicarbonate plan adds no events.
 * Caffeine doses with a non-finite time or a dose ≤ 0 are skipped. Arguments
 * are not mutated.
 *
 * @param {Object} [input]
 * @param {number} [input.durationMin]  Activity duration in minutes.
 * @param {number} [input.gelsPerHour]  Gels per hour (as passed to {@link getGelTimes}).
 * @param {number} [input.fluidMlPerHour]  Planned fluid intake in ml/h.
 * @param {CaffeinePlanLike} [input.caffeine]  Result of `planCaffeine`, computed with the same gel times.
 * @param {BicarbPlanLike} [input.bicarb]  Result of `planBicarbonate`.
 * @returns {ScheduleEvent[]}
 */
export function buildSchedule({ durationMin, gelsPerHour, fluidMlPerHour, caffeine, bicarb } = {}) {
  const duration = Math.min(positiveOrZero(durationMin), MAX_DURATION_MIN);
  const rate = Math.min(positiveOrZero(gelsPerHour), MAX_GELS_PER_HOUR);
  const fluidRate = positiveOrZero(fluidMlPerHour);
  const gelTimes = getGelTimes(duration, rate);
  const intervalMin = gelTimes.length > 0 ? 60 / rate : 0;
  const gelFluidMl = fluidPerGel(gelTimes, duration, fluidRate, intervalMin);

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

  if (fluidRate > 0 && !gelFluidMl.some((ml) => ml > 0)) {
    events.push({
      timeMin: 0,
      type: 'hydration',
      message: { key: 'schedule.hydrationOnly', params: { mlPerHour: fluidRate } },
    });
  }

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
