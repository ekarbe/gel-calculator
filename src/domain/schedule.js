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
 * kept from `src/lib/schedule.js`.)
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
 * @property {number} [fluidMl]  Fluid to drink with this gel in ml (fuel events, rounded to 10 ml; omitted when 0).
 */

/** Default bicarbonate timing in minutes when a plan has no usable `timingMin.recommended`. */
const BICARB_DEFAULT_TIME_MIN = -90;

const round1 = (x) => Math.round(x * 10) / 10;
const round10 = (x) => Math.round(x / 10) * 10;

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
 * @param {number} durationMinutes  Activity duration in minutes.
 * @param {number} gelsPerHour  Gels per hour; ≤ 0 or not a number → no gels.
 * @returns {number[]} Gel times in minutes, ascending, starting at 0; `[]` when there are no gels.
 */
export function getGelTimes(durationMinutes, gelsPerHour) {
  if (!(gelsPerHour > 0) || !(durationMinutes >= 0)) return [];
  const interval = 60 / gelsPerHour;
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
 * Formats minutes after the start as elapsed time: `T+30m`, `T+1h`,
 * `T+1h 26m`. Rounds to whole minutes first, so it never shows `60m`.
 *
 * @param {number} minutes  Minutes after the start.
 * @returns {string}
 */
export function formatElapsed(minutes) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return `T+${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  return `T+${mins}m`;
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
 *   gels (the first gel is taken at the start). If an intra caffeine dose sits
 *   in the first gel (`gelIndex` 0), the start event carries `caffeineMg` and
 *   uses `schedule.startWithGelAndCaffeine`.
 * - `fuel` for each gel time after 0 ({@link getGelTimes}), params
 *   `{ gel }` (1-based gel number). `fluidMl = fluidMlPerHour × interval / 60`
 *   rounded to 10 ml (omitted when 0). `caffeineMg` is the sum of intra caffeine
 *   doses with that `gelIndex`.
 * - Intra caffeine doses without a gel (`gelIndex === null`, or an index that
 *   is not one of this schedule's gels) become `caffeine` events at their time.
 * - No gels and `fluidMlPerHour > 0` → one `hydration` event at 0
 *   (`schedule.hydrationOnly`, params `{ mlPerHour }`).
 * - `finish` at `durationMin`.
 *
 * Non-finite or negative `durationMin` and `fluidMlPerHour` count as 0. A
 * missing or disabled caffeine or bicarbonate plan adds no events. Caffeine
 * doses with a non-finite time or a dose ≤ 0 are skipped. Arguments are not
 * mutated.
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
  const duration = positiveOrZero(durationMin);
  const fluidRate = positiveOrZero(fluidMlPerHour);
  const gelTimes = getGelTimes(duration, gelsPerHour);
  const intervalMin = gelTimes.length > 0 ? 60 / gelsPerHour : 0;

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
  } else if (gelCaffeineMg.has(0)) {
    const caffeineMg = gelCaffeineMg.get(0);
    events.push({
      timeMin: 0,
      type: 'start',
      message: { key: 'schedule.startWithGelAndCaffeine', params: { caffeineMg } },
      caffeineMg,
    });
  } else {
    events.push({ timeMin: 0, type: 'start', message: { key: 'schedule.startWithGel' } });
  }

  if (gelTimes.length === 0 && fluidRate > 0) {
    events.push({
      timeMin: 0,
      type: 'hydration',
      message: { key: 'schedule.hydrationOnly', params: { mlPerHour: fluidRate } },
    });
  }

  const fluidMl = round10((fluidRate * intervalMin) / 60);
  gelTimes.forEach((timeMin, i) => {
    if (i === 0) return; // The first gel is part of the start event.
    const gel = i + 1;
    const caffeineMg = gelCaffeineMg.get(i);
    /** @type {ScheduleEvent} */
    const event = { timeMin, type: 'fuel', message: { key: 'schedule.fuel', params: { gel } } };
    if (fluidMl > 0 && caffeineMg !== undefined) {
      event.message = {
        key: 'schedule.fuelWithFluidAndCaffeine',
        params: { gel, fluidMl, caffeineMg },
      };
    } else if (fluidMl > 0) {
      event.message = { key: 'schedule.fuelWithFluid', params: { gel, fluidMl } };
    } else if (caffeineMg !== undefined) {
      event.message = { key: 'schedule.fuelWithCaffeine', params: { gel, caffeineMg } };
    }
    if (fluidMl > 0) event.fluidMl = fluidMl;
    if (caffeineMg !== undefined) event.caffeineMg = caffeineMg;
    events.push(event);
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
