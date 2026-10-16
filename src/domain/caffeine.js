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
 * Caffeine plan: a pre-race dose plus late or top-up doses for longer events,
 * kept below 6 mg/kg of caffeine in the body at any time.
 *
 * Evidence: Guest et al. 2021 (ISSN position stand, 3–6 mg/kg), Carvalho et
 * al. 2022 (habitual intake does not blunt the effect), EFSA 2015 (safety of
 * single doses up to 200 mg), Talanian & Spriet 2016 (late doses work).
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/caffeine.js`.
 */

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * One caffeine intake.
 *
 * @typedef {Object} CaffeineDose
 * @property {number} timeMin  Minutes from the start (negative = before the start).
 * @property {number} mg  Caffeine in mg (rounded to 5 mg, or to half tablets when `tablets` is set).
 * @property {'pre'|'intra'} kind  `'pre'` before the start, `'intra'` during the event.
 * @property {number|null} gelIndex  Index into `gelTimesMin` of the gel that carries this dose, or `null`.
 * @property {number|null} tablets  Number of tablets (in 0.5 steps) when caffeine is added as an ingredient, else `null`.
 */

/**
 * Inputs for {@link planCaffeine}.
 *
 * @typedef {Object} CaffeineInputs
 * @property {boolean} [enabled]  Whether the athlete uses caffeine at all.
 * @property {number} [massKg]  Body mass in kg; clamped to [30, 200], non-finite → 70.
 * @property {number} [mgPerKg]  Total target dose in mg/kg; clamped to [1, 6], non-finite → 3.
 * @property {number} [durationMin]  Event duration in minutes; non-finite or negative → 0, capped at 2880.
 * @property {number[]} [gelTimesMin]  Gel times in minutes from the start (ascending), used when `asIngredient`.
 * @property {boolean} [asIngredient]  Add intra doses to the gels as tablets.
 * @property {number} [tabletMg]  Caffeine per tablet in mg; non-finite or ≤ 0 → 100.
 */

/**
 * Result of {@link planCaffeine}.
 *
 * @typedef {Object} CaffeinePlan
 * @property {boolean} enabled
 * @property {CaffeineDose[]} doses  Sorted by time.
 * @property {number} totalMg  Sum of all doses in mg.
 * @property {number} totalMgPerKg  `totalMg / massKg` (unrounded).
 * @property {number} peakBodyLoadMgPerKg  Highest body load in mg/kg, reached just after a dose (unrounded).
 * @property {Explanation} why
 * @property {Warning[]} warnings
 */

/** Caffeine elimination half-life in minutes (about 5 h). */
export const CAFFEINE_HALF_LIFE_MIN = 300;

const MAX_BODY_LOAD_MG_PER_KG = 6;
const HIGH_TOTAL_MG_PER_KG = 9;
const SINGLE_DOSE_LIMIT_MG = 200;

const MG_PER_KG_RANGE = [1, 6];
const MG_PER_KG_DEFAULT = 3;
const MASS_RANGE_KG = [30, 200];
const MASS_DEFAULT_KG = 70;
const TABLET_DEFAULT_MG = 100;
/** Longest event the plan supports (48 h); also bounds the number of top-ups. */
const MAX_DURATION_MIN = 2880;

const SHORT_MAX_MIN = 75;
const MEDIUM_MAX_MIN = 180;
const PRE_TIME_MIN = -60;
const TOP_UP_INTERVAL_MIN = 150;
const TOP_UP_STOP_BEFORE_FINISH_MIN = 30;
/** Largest single top-up in mg/kg for long events. */
const TOP_UP_MAX_MG_PER_KG = 1.5;

/** Tolerance for floating-point comparisons against the body-load cap. */
const EPS = 1e-9;

const BASE_CITATIONS = ['guest2021', 'carvalho2022', 'efsa2015'];
const LATE_DOSE_CITATIONS = [...BASE_CITATIONS, 'talanian2016'];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;
const round5 = (x) => Math.round(x / 5) * 5;

/**
 * Caffeine still in the body at `timeMin`, in mg. Sums every dose taken at or
 * before `timeMin`, each decayed with a 300 min half-life:
 * `Σ mg × 0.5 ** ((t − tᵢ) / 300)` for `tᵢ ≤ t`. Doses with non-finite
 * `timeMin` or `mg` are ignored.
 *
 * @param {Array<{ timeMin: number, mg: number }>} doses
 * @param {number} timeMin  Minutes from the start.
 * @returns {number} Body load in mg (unrounded); 0 when no dose was taken yet.
 */
export function bodyLoadAt(doses, timeMin) {
  if (!Array.isArray(doses)) return 0;
  let load = 0;
  for (const dose of doses) {
    if (!dose || !Number.isFinite(dose.timeMin) || !Number.isFinite(dose.mg)) continue;
    if (dose.timeMin <= timeMin) {
      load += dose.mg * 0.5 ** ((timeMin - dose.timeMin) / CAFFEINE_HALF_LIFE_MIN);
    }
  }
  return load;
}

/**
 * Duration band of the plan.
 * @param {number} durationMin
 * @returns {'short'|'medium'|'long'}
 */
function bandFor(durationMin) {
  if (durationMin <= SHORT_MAX_MIN) return 'short';
  if (durationMin <= MEDIUM_MAX_MIN) return 'medium';
  return 'long';
}

/**
 * Unrounded doses for the band.
 * @param {'short'|'medium'|'long'} band
 * @param {{ durationMin: number, massKg: number, mgPerKg: number }} p
 * @returns {Array<{ timeMin: number, mg: number, kind: 'pre'|'intra' }>}
 */
function rawDoses(band, { durationMin, massKg, mgPerKg }) {
  const total = mgPerKg * massKg;
  if (band === 'short') return [{ timeMin: PRE_TIME_MIN, mg: total, kind: 'pre' }];

  const doses = [{ timeMin: PRE_TIME_MIN, mg: (total * 2) / 3, kind: 'pre' }];
  if (band === 'medium') {
    doses.push({ timeMin: Math.round((durationMin * 2) / 3), mg: total / 3, kind: 'intra' });
    return doses;
  }

  const topUpMg = Math.min(TOP_UP_MAX_MG_PER_KG, mgPerKg / 2) * massKg;
  const lastMin = durationMin - TOP_UP_STOP_BEFORE_FINISH_MIN;
  for (let t = Math.round(durationMin / 2); t <= lastMin; t += TOP_UP_INTERVAL_MIN) {
    doses.push({ timeMin: t, mg: topUpMg, kind: 'intra' });
  }
  return doses;
}

/**
 * Rounds a dose: to whole half tablets (at least one) when caffeine is an
 * ingredient, otherwise to 5 mg.
 * @param {number} mg
 * @param {{ asIngredient: boolean, tabletMg: number }} opts
 * @returns {{ mg: number, tablets: number|null }}
 */
function roundDose(mg, { asIngredient, tabletMg }) {
  if (asIngredient) {
    const step = tabletMg / 2;
    const halves = Math.max(1, Math.round(mg / step));
    return { mg: halves * step, tablets: halves / 2 };
  }
  return { mg: round5(mg), tablets: null };
}

/**
 * Largest rounded dose that fits in `roomMg`, or `null` when not even the
 * smallest step (half a tablet or 5 mg) fits.
 * @param {number} roomMg
 * @param {{ asIngredient: boolean, tabletMg: number }} opts
 * @returns {{ mg: number, tablets: number|null }|null}
 */
function largestAllowedDose(roomMg, { asIngredient, tabletMg }) {
  if (asIngredient) {
    const step = tabletMg / 2;
    const halves = Math.floor(roomMg / step + EPS);
    return halves >= 1 ? { mg: halves * step, tablets: halves / 2 } : null;
  }
  const mg = Math.floor(roomMg / 5 + EPS) * 5;
  return mg >= 5 ? { mg, tablets: null } : null;
}

/**
 * Index of the last gel time at or before `timeMin`, or the first gel when
 * every gel comes later. Non-finite gel times are skipped. Returns -1 when
 * there is no usable gel time.
 * @param {number} timeMin
 * @param {number[]} gelTimesMin
 * @returns {number}
 */
function gelIndexFor(timeMin, gelTimesMin) {
  let first = -1;
  let last = -1;
  for (let i = 0; i < gelTimesMin.length; i++) {
    const g = gelTimesMin[i];
    if (!Number.isFinite(g)) continue;
    if (first < 0) first = i;
    if (g <= timeMin) last = i;
  }
  return last >= 0 ? last : first;
}

/**
 * Plans caffeine for an event.
 *
 * Total dose `D = mgPerKg × massKg` (1–6 mg/kg; habitual intake does not
 * change the dose, carvalho2022):
 * - `durationMin ≤ 75`: one `pre` dose of D at −60 min.
 * - `75 < durationMin ≤ 180`: `pre` D × 2/3 at −60 min and `intra` D × 1/3 at
 *   `round(durationMin × 2/3)` (late doses work, talanian2016).
 * - `durationMin > 180`: `pre` D × 2/3 at −60 min, then `intra` top-ups of
 *   `min(1.5, mgPerKg / 2) × massKg` from `round(durationMin / 2)` every
 *   150 min while `t ≤ durationMin − 30`.
 *
 * Doses are rounded to 5 mg, or to half tablets (at least one half) when
 * `asIngredient`; then `tablets` is set. With `asIngredient` and gel times,
 * each `intra` dose moves to the last gel at or before its time (or the first
 * gel) and gets that `gelIndex`; doses landing on the same gel are combined.
 *
 * Body-load cap: walking the doses in time order, any dose that would lift
 * {@link bodyLoadAt} above 6 mg/kg is reduced to the largest rounded amount
 * that fits, or dropped, and warning `caffeine.capped` is added.
 *
 * Warnings when enabled: `caffeine.exclusions` and `caffeine.tryInTraining`
 * (info, always); `caffeine.noPowder` (danger) when `asIngredient`;
 * `caffeine.singleDoseAbove200` (info) when any dose exceeds 200 mg;
 * `caffeine.highTotal` (warning) when the total exceeds 9 mg/kg;
 * `caffeine.capped` (warning) when the cap changed a dose.
 *
 * @param {CaffeineInputs} [inputs]
 * @returns {CaffeinePlan}
 */
export function planCaffeine({
  enabled,
  massKg,
  mgPerKg = MG_PER_KG_DEFAULT,
  durationMin,
  gelTimesMin = [],
  asIngredient = false,
  tabletMg = TABLET_DEFAULT_MG,
} = {}) {
  if (!enabled) {
    return {
      enabled: false,
      doses: [],
      totalMg: 0,
      totalMgPerKg: 0,
      peakBodyLoadMgPerKg: 0,
      why: {
        summary: { key: 'caffeine.why.disabled' },
        citations: ['guest2021'],
      },
      warnings: [],
    };
  }

  const mass = Number.isFinite(massKg) ? clamp(massKg, ...MASS_RANGE_KG) : MASS_DEFAULT_KG;
  const perKg = Number.isFinite(mgPerKg) ? clamp(mgPerKg, ...MG_PER_KG_RANGE) : MG_PER_KG_DEFAULT;
  const d = Number.isFinite(durationMin) && durationMin > 0 ? Math.min(durationMin, MAX_DURATION_MIN) : 0;
  const tablet = Number.isFinite(tabletMg) && tabletMg > 0 ? tabletMg : TABLET_DEFAULT_MG;
  const ingredient = Boolean(asIngredient);
  const gels = Array.isArray(gelTimesMin) ? gelTimesMin : [];
  const rounding = { asIngredient: ingredient, tabletMg: tablet };

  const band = bandFor(d);

  // 1. Unrounded doses, then rounding.
  let doses = rawDoses(band, { durationMin: d, massKg: mass, mgPerKg: perKg }).map((dose) => ({
    timeMin: dose.timeMin,
    kind: dose.kind,
    gelIndex: null,
    ...roundDose(dose.mg, rounding),
  }));

  // 2. Intra doses ride on gels when caffeine is an ingredient.
  if (ingredient && gels.length > 0) {
    const merged = [];
    for (const dose of doses) {
      const index = dose.kind === 'intra' ? gelIndexFor(dose.timeMin, gels) : -1;
      if (index < 0) {
        merged.push(dose);
        continue;
      }
      const sameGel = merged.find((m) => m.kind === 'intra' && m.gelIndex === index);
      if (sameGel) {
        sameGel.mg += dose.mg;
        sameGel.tablets += dose.tablets;
      } else {
        merged.push({ ...dose, timeMin: gels[index], gelIndex: index });
      }
    }
    doses = merged;
  }
  doses.sort((a, b) => a.timeMin - b.timeMin);

  // 3. Body-load cap, walking in time order.
  const capMg = MAX_BODY_LOAD_MG_PER_KG * mass;
  const kept = [];
  let capped = false;
  for (const dose of doses) {
    const before = bodyLoadAt(kept, dose.timeMin);
    if ((before + dose.mg) / mass <= MAX_BODY_LOAD_MG_PER_KG + EPS) {
      kept.push(dose);
      continue;
    }
    capped = true;
    const reduced = largestAllowedDose(capMg - before, rounding);
    if (reduced) kept.push({ ...dose, ...reduced });
  }

  const planned = kept.map(({ timeMin, mg, kind, gelIndex, tablets }) => ({
    timeMin,
    mg,
    kind,
    gelIndex,
    tablets,
  }));

  const totalMg = planned.reduce((sum, dose) => sum + dose.mg, 0);
  const totalMgPerKg = totalMg / mass;
  const peakBodyLoadMgPerKg = planned.reduce(
    (peak, dose) => Math.max(peak, bodyLoadAt(planned, dose.timeMin) / mass),
    0,
  );
  const preMg = planned.filter((dose) => dose.kind === 'pre').reduce((sum, dose) => sum + dose.mg, 0);
  const intraDoses = planned.filter((dose) => dose.kind === 'intra');
  const intraMg = intraDoses.reduce((sum, dose) => sum + dose.mg, 0);
  const largestMg = planned.reduce((max, dose) => Math.max(max, dose.mg), 0);

  /** @type {Warning[]} */
  const warnings = [
    {
      id: 'caffeine.exclusions',
      level: 'info',
      message: { key: 'caffeine.warn.exclusions' },
      citations: ['efsa2015'],
    },
    {
      id: 'caffeine.tryInTraining',
      level: 'info',
      message: { key: 'caffeine.warn.tryInTraining' },
      citations: ['guest2021'],
    },
  ];
  if (ingredient) {
    warnings.push({
      id: 'caffeine.noPowder',
      level: 'danger',
      message: { key: 'caffeine.warn.noPowder', params: { tabletMg: tablet } },
    });
  }
  if (largestMg > SINGLE_DOSE_LIMIT_MG) {
    warnings.push({
      id: 'caffeine.singleDoseAbove200',
      level: 'info',
      message: { key: 'caffeine.warn.singleDoseAbove200', params: { mg: largestMg } },
      citations: ['efsa2015'],
    });
  }
  if (totalMgPerKg > HIGH_TOTAL_MG_PER_KG) {
    warnings.push({
      id: 'caffeine.highTotal',
      level: 'warning',
      message: {
        key: 'caffeine.warn.highTotal',
        params: { totalMg, totalMgPerKg: round1(totalMgPerKg) },
      },
      citations: ['guest2021'],
    });
  }
  if (capped) {
    warnings.push({
      id: 'caffeine.capped',
      level: 'warning',
      message: { key: 'caffeine.warn.capped', params: { maxMgPerKg: MAX_BODY_LOAD_MG_PER_KG } },
      citations: ['guest2021'],
    });
  }

  return {
    enabled: true,
    doses: planned,
    totalMg,
    totalMgPerKg,
    peakBodyLoadMgPerKg,
    why: {
      summary: {
        key: `caffeine.why.${band}`,
        params: { preMg, intraMg, totalMg, topUps: intraDoses.length },
      },
      details: [
        {
          key: 'caffeine.why.dose',
          params: { mgPerKg: round1(perKg), massKg: round1(mass), doseMg: Math.round(perKg * mass) },
        },
        { key: 'caffeine.why.habitual' },
      ],
      citations: band === 'short' ? [...BASE_CITATIONS] : [...LATE_DOSE_CITATIONS],
    },
    warnings,
  };
}
