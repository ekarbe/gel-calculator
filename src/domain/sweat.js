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
 * Sweat rate and sweat sodium. Three sources:
 *
 * - `'test'`: a sweat test (body mass before and after a session, plus what
 *   was drunk, minus urine), optionally scaled to the event's conditions with
 *   the heat-balance model (baker2017, sawka2007, cheuvront2017).
 * - `'estimate'`: the heat-balance model in `heatBalance.js` (gagnon2013,
 *   cramer2019, jay2024).
 * - `'preset'`: a self-assessed rate (baker2017, barnes2019).
 *
 * Sweat sodium always comes from the self-assessed saltiness preset.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/sweat.js`.
 */

import { SWEAT_RATES, ELECTROLYTE_CONCENTRATIONS } from '../constants/constants';
import {
  estimateSweatRate,
  SWEAT_MODEL_UNCERTAINTY_LPH,
  SUN_ERF_W_M2,
  SPORTS,
  SETTINGS,
} from './heatBalance';
import { NON_SWEAT_KG_PER_KCAL } from './hydration';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */
/** @typedef {import('./heatBalance').SweatEstimate} SweatEstimate */
/** @typedef {import('./heatBalance').Sport} Sport */
/** @typedef {import('./heatBalance').Setting} Setting */
/** @typedef {import('./heatBalance').Sun} Sun */

/** @typedef {'test'|'estimate'|'preset'} SweatSource */

/**
 * Conditions of a sweat test session (same fields as the plan's event and
 * environment sections). A field that is missing or that the model cannot
 * use (not a finite number, an unknown sport, setting or sun value) is taken
 * from the fallback conditions: the event and environment in
 * {@link resolveSweat}, the optional third argument of {@link sweatTestRate}.
 * Fields neither provides use the model defaults.
 *
 * @typedef {Object} SweatTestConditions
 * @property {Sport} [sport]
 * @property {number} [speedKmh]
 * @property {number} [powerW]  0 = unknown (derived from the speed).
 * @property {number} [mets]
 * @property {Setting} [setting]
 * @property {number} [tempC]
 * @property {number} [humidity]
 * @property {Sun} [sun]
 */

/**
 * One sweat test as stored in the plan inputs (`sweat.tests`).
 *
 * @typedef {Object} SweatTest
 * @property {string} id
 * @property {string} [date]  'YYYY-MM-DD' or ''.
 * @property {string} [label]  At most 60 characters.
 * @property {number} preKg  Body mass before, in kg (minimal clothing, bladder empty).
 * @property {number} postKg  Body mass after, in kg (towel dried, same scale).
 * @property {number} fluidL  Fluid drunk during the session in L (1 kg = 1 L).
 * @property {number} urineL  Urine passed during the session in L.
 * @property {number} durationMin  Session length in minutes.
 * @property {SweatTestConditions} [conditions]
 */

/**
 * @typedef {Object} SweatTestResult
 * @property {boolean} valid  The result can be used as a sweat rate.
 * @property {number} rateLph  Sweat rate in L/h after the metabolic correction (0 when it cannot be computed).
 * @property {number} rawLph  `(pre − post + fluid − urine) / h` in L/h (0 when it cannot be computed).
 * @property {number} correctionL  Mass lost by burning fuel and breathing in L (`0.0002 × energyKcal`, cheuvront2017).
 * @property {number} energyKcal  Energy used during the test in kcal (heat-balance model for the test conditions).
 * @property {Message[]} problems  Why the test is not valid; empty when valid.
 */

/**
 * @typedef {Object} SweatInputs  The plan's `sweat` section (inputs schema v4).
 * @property {SweatSource} [source]  Unknown values use `'estimate'`.
 * @property {number} [rateIndex]  Index into {@link SWEAT_RATE_PRESETS_LPH} (0–5).
 * @property {number} [saltinessIndex]  Index into {@link SWEAT_SODIUM_PRESETS_MMOL} (0–5); used by every source.
 * @property {SweatTest[]} [tests]
 * @property {string|null} [selectedTestId]  `null` (or an id not in the list) means the last test.
 * @property {boolean} [calibrate]  Scale the test to the event's conditions with the model. Default true.
 */

/**
 * The v4 plan input sections the sweat model reads.
 *
 * @typedef {Object} SweatContext
 * @property {{ sport?: Sport, speedKmh?: number, powerW?: number, mets?: number, setting?: Setting }} [event]
 * @property {{ massKg?: number, heightCm?: number, acclimatised?: boolean }} [athlete]
 * @property {{ tempC?: number, humidity?: number, sun?: Sun }} [environment]
 */

/**
 * @typedef {Object} SweatCalibration
 * @property {number} factor  `clamp(ratio, 0.5, 2)`: what the plan scales the measured rate by.
 * @property {number} ratio  `model(event) / model(test conditions)`, unclamped: how much the model says the
 *   event's conditions change the sweat rate. 1 when the model predicts no sweat for the test.
 * @property {number} testRatio  `testRate / model(test conditions)`: how the athlete compares with the model
 *   (information only; it does not limit the result).
 * @property {boolean} applied  The plan rate is `min(factor × testRate, limitLph)`.
 * @property {boolean} clamped  The ratio was outside 0.5–2.
 * @property {boolean} capped  Applied, and `factor × testRate` was above `limitLph`.
 * @property {number} limitLph  Highest calibrated rate: the higher of the model ceiling (`estimate.maxRateLph`) and the test rate.
 * @property {number} testModelLph  The model's rate for the test conditions in L/h.
 */

/**
 * @typedef {Object} SweatResolution
 * @property {number} rateLph  Sweat rate in L/h (unrounded).
 * @property {number} sodiumMmolL  Sweat sodium concentration in mmol/L.
 * @property {SweatSource} source  The source actually used (`'estimate'` when the test cannot be used).
 * @property {number} uncertaintyLph  Typical error of the source in L/h (±).
 * @property {SweatEstimate} estimate  Heat-balance estimate for the event conditions.
 * @property {(SweatTestResult & { id: string|null }) | null} test  The selected test whenever the requested
 *   source is `'test'`, also when it is invalid and the plan fell back to the estimate (`source` then says
 *   `'estimate'`); null when no test is selected or another source was requested.
 * @property {(SweatTestResult & { id: string|null })[]} tests  One result per entry of `sweat.tests`, in list
 *   order, so `tests[i]` belongs to `sweat.tests[i]`. An entry that is not an object gives an invalid result
 *   with id null.
 * @property {SweatCalibration | null} calibration  Set when a valid test is used, else null.
 * @property {Explanation} why
 * @property {Warning[]} warnings
 */

/** Self-assessed sweat rate presets in L/h, lightest to heaviest (from constants). */
export const SWEAT_RATE_PRESETS_LPH = SWEAT_RATES;

/** Self-assessed sweat sodium presets in mmol/L, least to most salty (from constants). */
export const SWEAT_SODIUM_PRESETS_MMOL = ELECTROLYTE_CONCENTRATIONS.Sodium;

/** Typical error of a careful sweat test in L/h. */
export const SWEAT_TEST_UNCERTAINTY_LPH = 0.15;

/** Typical error of a self-assessed preset in L/h. */
const PRESET_UNCERTAINTY_LPH = 0.5;

/** Highest plausible measured sweat rate in L/h. */
const TEST_MAX_LPH = 5;

/** Allowed range of the calibration factor. */
const CALIBRATION_MIN = 0.5;
const CALIBRATION_MAX = 2;

/**
 * Below this estimate (L/h) the model predicts very little sweat. The model
 * assumes light race kit and a steady effort, so in cool conditions it can
 * predict no sweat at all; info `sweat.estimateLow` says so.
 */
const LOW_ESTIMATE_LPH = 0.1;

const SOURCES = ['test', 'estimate', 'preset'];

const CITATIONS_BY_SOURCE = {
  test: ['baker2017', 'sawka2007', 'cheuvront2017'],
  estimate: ['gagnon2013', 'cramer2019', 'jay2024'],
  preset: ['baker2017', 'barnes2019'],
};

/** Middle preset, also the default in the plan inputs. */
const DEFAULT_INDEX = 2;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round2 = (x) => Math.round(x * 100) / 100;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Turns a preset index into a valid integer index for a list of `length`
 * entries. Non-numbers and non-finite values fall back to the middle preset.
 * @param {unknown} index
 * @param {number} length
 * @returns {number}
 */
function presetIndex(index, length) {
  if (!Number.isFinite(index)) return Math.min(DEFAULT_INDEX, length - 1);
  return clamp(Math.round(index), 0, length - 1);
}

/**
 * A fluid or urine volume: missing, negative or non-finite values count as 0.
 * @param {unknown} litres
 * @returns {number}
 */
const volume = (litres) => (Number.isFinite(litres) && litres > 0 ? litres : 0);

/**
 * Athlete fields the model needs, from the plan's `athlete` section.
 * @param {unknown} athlete
 * @returns {{ massKg: unknown, heightCm: unknown, acclimatised: boolean }}
 */
function athleteOf(athlete) {
  const a = isObject(athlete) ? athlete : {};
  return { massKg: a.massKg, heightCm: a.heightCm, acclimatised: a.acclimatised === true };
}

/** Fields of {@link SweatTestConditions}. */
const CONDITION_FIELDS = ['sport', 'speedKmh', 'powerW', 'mets', 'setting', 'tempC', 'humidity', 'sun'];

/**
 * Whether the heat-balance model can use `value` for a condition field.
 * @param {string} field
 * @param {unknown} value
 * @returns {boolean}
 */
function usableCondition(field, value) {
  if (field === 'sport') return SPORTS.includes(value);
  if (field === 'setting') return SETTINGS.includes(value);
  if (field === 'sun') return typeof value === 'string' && Object.hasOwn(SUN_ERF_W_M2, value);
  return Number.isFinite(value);
}

/**
 * The plan's event and environment sections as sweat test conditions.
 * @param {Record<string, unknown>} event
 * @param {Record<string, unknown>} environment
 * @returns {SweatTestConditions}
 */
const eventConditions = (event, environment) => ({
  sport: event.sport,
  speedKmh: event.speedKmh,
  powerW: event.powerW,
  mets: event.mets,
  setting: event.setting,
  tempC: environment.tempC,
  humidity: environment.humidity,
  sun: environment.sun,
});

/**
 * Model input for a sweat test session. Each condition comes from the test
 * when the model can use it, else from `fallback`. The body mass is the
 * athlete's current mass; when that is missing, the test's pre-session mass.
 * @param {Partial<SweatTest>} test
 * @param {{ massKg: unknown, heightCm: unknown, acclimatised: boolean }} athlete
 * @param {Record<string, unknown>} fallback
 */
function testModelInput(test, athlete, fallback) {
  const c = isObject(test.conditions) ? test.conditions : {};
  /** @type {Record<string, unknown>} */
  const conditions = {};
  for (const field of CONDITION_FIELDS) {
    conditions[field] = usableCondition(field, c[field]) ? c[field] : fallback[field];
  }
  const massKg =
    Number.isFinite(athlete.massKg) && athlete.massKg > 0 ? athlete.massKg : test.preKg;
  return {
    ...conditions,
    massKg,
    heightCm: athlete.heightCm,
    acclimatised: athlete.acclimatised,
  };
}

/**
 * Sweat test result plus the model estimate for the test conditions (null
 * when the test cannot be computed).
 * @param {unknown} rawTest
 * @param {{ massKg: unknown, heightCm: unknown, acclimatised: boolean }} athlete
 * @param {Record<string, unknown>} fallback  Conditions for fields the test does not set.
 * @returns {{ result: SweatTestResult, model: SweatEstimate | null }}
 */
function evaluateTest(rawTest, athlete, fallback) {
  const test = isObject(rawTest) ? rawTest : {};
  const { preKg, postKg, fluidL, urineL, durationMin } = test;
  /** @type {Message[]} */
  const problems = [];
  // Checked in hours so a tiny duration that underflows to 0 h is invalid too.
  const durationOk = Number.isFinite(durationMin) && durationMin / 60 > 0;
  const massOk = Number.isFinite(preKg) && preKg > 0 && Number.isFinite(postKg) && postKg > 0;
  if (!durationOk) problems.push({ key: 'sweat.test.problem.duration' });
  if (!massOk) problems.push({ key: 'sweat.test.problem.mass' });
  if (!durationOk || !massOk) {
    return {
      result: { valid: false, rateLph: 0, rawLph: 0, correctionL: 0, energyKcal: 0, problems },
      model: null,
    };
  }

  const hours = durationMin / 60;
  const rawLph = (preKg - postKg + volume(fluidL) - volume(urineL)) / hours;
  const model = estimateSweatRate(testModelInput(test, athlete, fallback));
  const energyKcal = model.energyKcalPerHour * hours;
  const correctionL = NON_SWEAT_KG_PER_KCAL * energyKcal;
  const rateLph = rawLph - correctionL / hours;

  // Written as negations so a non-number rate is never valid.
  if (!(rateLph > 0)) {
    problems.push({ key: 'sweat.test.problem.noLoss', params: { rateLph: round2(rateLph) } });
  } else if (!(rateLph <= TEST_MAX_LPH)) {
    problems.push({
      key: 'sweat.test.problem.tooHigh',
      params: { rateLph: round2(rateLph), maxLph: TEST_MAX_LPH },
    });
  }

  return {
    result: { valid: problems.length === 0, rateLph, rawLph, correctionL, energyKcal, problems },
    model,
  };
}

/**
 * Sweat rate from a sweat test (baker2017, sawka2007, cheuvront2017).
 *
 * - `rawLph = (preKg − postKg + fluidL − urineL) / h`, 1 kg = 1 L.
 * - `energyKcal = estimateSweatRate(test conditions).energyKcalPerHour × h`,
 *   with the athlete's mass and height (the test's `preKg` when the athlete
 *   mass is missing). A condition the test does not set (or sets to a value
 *   the model cannot use) comes from `fallbackConditions`, else the model
 *   default. {@link resolveSweat} passes the event conditions, so call this
 *   with them too to get the same numbers.
 * - `correctionL = 0.0002 × energyKcal`: about 0.2 g of body mass per kcal
 *   is lost by burning fuel and breathing, not by sweating (cheuvront2017).
 * - `rateLph = rawLph − correctionL / h`.
 * - Invalid when the duration is not above 0 (`sweat.test.problem.duration`),
 *   a body mass is not above 0 (`sweat.test.problem.mass`), the rate is not
 *   above 0 (`sweat.test.problem.noLoss`, params `rateLph`) or above 5 L/h
 *   (`sweat.test.problem.tooHigh`, params `rateLph`, `maxLph`). When the
 *   duration or a mass is invalid, the numbers are 0.
 * - A missing, negative or non-finite fluid or urine volume counts as 0.
 * - A missing or `null` test, athlete or fallback is treated as `{}`.
 *
 * @param {Partial<SweatTest> | null} test
 * @param {{ massKg?: number, heightCm?: number, acclimatised?: boolean } | null} [athlete]
 * @param {SweatTestConditions | null} [fallbackConditions]  Conditions for fields the test does not set
 *   (an addition to the spec signature; optional).
 * @returns {SweatTestResult}
 */
export function sweatTestRate(test, athlete, fallbackConditions) {
  const fallback = isObject(fallbackConditions) ? fallbackConditions : {};
  return evaluateTest(test, athleteOf(athlete), fallback).result;
}

/**
 * The selected test: the one whose id is `selectedTestId`, else the last
 * entry that is an object. Entries that are not objects are never selected.
 * @param {unknown[]} tests
 * @param {unknown} selectedTestId
 * @returns {number}  Index into `tests`, or −1 when no entry is an object.
 */
function selectedIndex(tests, selectedTestId) {
  if (selectedTestId !== null && selectedTestId !== undefined) {
    const index = tests.findIndex((test) => isObject(test) && test.id === selectedTestId);
    if (index >= 0) return index;
  }
  for (let i = tests.length - 1; i >= 0; i -= 1) {
    if (isObject(tests[i])) return i;
  }
  return -1;
}

/**
 * Summary params shared by every source.
 * @param {number} rateLph
 * @param {number} uncertaintyLph
 */
const rangeParams = (rateLph, uncertaintyLph) => ({
  rateLph: round2(rateLph),
  lo: round2(Math.max(0, rateLph - uncertaintyLph)),
  hi: round2(rateLph + uncertaintyLph),
  uncertaintyLph,
});

/**
 * Resolves the sweat rate and sweat sodium concentration the rest of the plan
 * uses.
 *
 * New signature (inputs schema v4): `resolveSweat(inputs.sweat, { event,
 * athlete, environment })`, with the plan's v4 `event` (`sport`, `speedKmh`,
 * `powerW`, `mets`, `setting`), `athlete` (`massKg`, `heightCm`,
 * `acclimatised`) and `environment` (`tempC`, `humidity`, `sun`) sections.
 * The v3 flat context (`{ sex, intensity, tempC, humidity }`) is not read:
 * with it the estimate uses the plan defaults, so callers must pass the v4
 * sections.
 *
 * - `estimate` is always {@link estimateSweatRate} for the event conditions.
 * - `source: 'test'`: the selected test (`selectedTestId`, else the last).
 *   When there is no test or it is invalid, the plan falls back to the
 *   estimate with warning `sweat.testUnusable`. Test conditions the test does
 *   not set come from the event and environment (so missing conditions make
 *   the calibration neutral instead of comparing with a default session).
 *   With `calibrate` (default true): `ratio = model(event) / model(test
 *   conditions)`, `factor = clamp(ratio, 0.5, 2)` and `rateLph = min(factor ×
 *   testRate, max(estimate.maxRateLph, testRate))`. Unclamped this equals the
 *   spec's `testRate / model(test) × model(event)`; the clamp limits how far
 *   the model may move the measurement, not how far the athlete may differ
 *   from the model, so a test in the event's own conditions always gives the
 *   measured rate. (Deviation from spec section 2, which clamped `testRate /
 *   model(test)`: a measurement more than twice the model was then cut to
 *   twice the model.) When the factor hits a limit there is a note
 *   (`sweat.why.calibrationClamped`), warning `sweat.calibrationLimited`, and
 *   the uncertainty widens to the model's ±0.5 L/h. A note says when the
 *   bound applied (`sweat.why.calibrationCapped`); the bound keeps a scaled
 *   rate within the model ceiling unless the athlete measured more than
 *   that. When the model predicts no sweat for the test conditions the test
 *   rate is used as it is. Without `calibrate`: `rateLph = testRate`.
 *   Uncertainty ±0.15 L/h. Citations: baker2017, sawka2007, cheuvront2017.
 * - `source: 'estimate'` (and any unknown source): the heat-balance estimate,
 *   uncertainty ±0.5 L/h. Citations: gagnon2013, cramer2019, jay2024. Below
 *   0.1 L/h (`LOW_ESTIMATE_LPH`) info `sweat.estimateLow` (params `rateLph`, `hi`)
 *   says the model predicts very little sweat and suggests drinking to thirst
 *   and a sweat test.
 * - `source: 'preset'`: `SWEAT_RATE_PRESETS_LPH[rateIndex]`, uncertainty
 *   ±0.5 L/h. Citations: baker2017, barnes2019.
 * - Every source: danger `sweat.uncompensable` when the event conditions are
 *   uncompensable (wettedness above 0.85, or 1.0 when acclimatised), because
 *   heat stress does not depend on how the sweat rate was found.
 * - `sodiumMmolL` always comes from `SWEAT_SODIUM_PRESETS_MMOL[saltinessIndex]`.
 *   Indices are rounded and clamped to 0–5; non-finite indices use preset 2.
 * - A missing or `null` argument or section is treated as `{}`; missing model
 *   inputs use the plan defaults.
 *
 * @param {SweatInputs | null} [sweatInputs]
 * @param {SweatContext | null} [context]
 * @returns {SweatResolution}
 */
export function resolveSweat(sweatInputs, context) {
  const sweat = isObject(sweatInputs) ? sweatInputs : {};
  const ctx = isObject(context) ? context : {};
  const event = isObject(ctx.event) ? ctx.event : {};
  const environment = isObject(ctx.environment) ? ctx.environment : {};
  const athlete = athleteOf(ctx.athlete);

  const estimate = estimateSweatRate({
    sport: event.sport,
    speedKmh: event.speedKmh,
    powerW: event.powerW,
    mets: event.mets,
    setting: event.setting,
    tempC: environment.tempC,
    humidity: environment.humidity,
    sun: environment.sun,
    ...athlete,
  });

  const sodiumMmolL =
    SWEAT_SODIUM_PRESETS_MMOL[presetIndex(sweat.saltinessIndex, SWEAT_SODIUM_PRESETS_MMOL.length)];
  const requested = SOURCES.includes(sweat.source) ? sweat.source : 'estimate';

  const fallback = eventConditions(event, environment);
  const list = Array.isArray(sweat.tests) ? sweat.tests : [];
  const evaluated = list.map((test) => evaluateTest(test, athlete, fallback));
  const tests = evaluated.map(({ result }, i) => ({
    id: isObject(list[i]) && typeof list[i].id === 'string' ? list[i].id : null,
    ...result,
  }));

  /** @type {Warning[]} */
  const warnings = [];
  /** @type {Message[]} */
  const details = [];
  /** @type {SweatSource} */
  let source = requested;
  let test = null;
  let calibration = null;
  let rateLph;
  let uncertaintyLph;

  if (requested === 'test') {
    const index = selectedIndex(list, sweat.selectedTestId);
    test = index >= 0 ? tests[index] : null;
    if (test && test.valid) {
      const model = evaluated[index].model;
      const testModelLph = model.rateLph;
      const available = testModelLph > 0;
      // How much the model says the event's conditions change the sweat rate.
      const ratio = available ? estimate.rateLph / testModelLph : 1;
      const testRatio = available ? test.rateLph / testModelLph : 1;
      const factor = clamp(ratio, CALIBRATION_MIN, CALIBRATION_MAX);
      const clamped = factor !== ratio;
      const applied = available && sweat.calibrate !== false;
      const scaledLph = factor * test.rateLph;
      const limitLph = Math.max(estimate.maxRateLph, test.rateLph);
      const capped = applied && scaledLph > limitLph;
      calibration = { factor, ratio, testRatio, applied, clamped, capped, limitLph, testModelLph };
      if (!applied) rateLph = test.rateLph;
      else rateLph = capped ? limitLph : scaledLph;
      // Beyond the clamp the model cannot carry the test to the event, so the rate is as rough as the model.
      uncertaintyLph = applied && clamped ? SWEAT_MODEL_UNCERTAINTY_LPH : SWEAT_TEST_UNCERTAINTY_LPH;

      details.push({
        key: 'sweat.why.testCorrection',
        params: { correctionL: round2(test.correctionL), energyKcal: Math.round(test.energyKcal) },
      });
      if (applied) {
        details.push({
          key: 'sweat.why.testCalibrated',
          params: {
            testRateLph: round2(test.rateLph),
            testModelLph: round2(testModelLph),
            estimateLph: round2(estimate.rateLph),
            ratio: round2(ratio),
            factor: round2(factor),
          },
        });
        if (clamped) {
          details.push({
            key: 'sweat.why.calibrationClamped',
            params: { ratio: round2(ratio), factor: round2(factor), min: CALIBRATION_MIN, max: CALIBRATION_MAX },
          });
          warnings.push({
            id: 'sweat.calibrationLimited',
            level: 'warning',
            message: {
              key: 'sweat.warn.calibrationLimited',
              params: { min: CALIBRATION_MIN, max: CALIBRATION_MAX, uncertaintyLph: SWEAT_MODEL_UNCERTAINTY_LPH },
            },
            citations: ['baker2017'],
          });
        }
        if (capped) {
          details.push({
            key: 'sweat.why.calibrationCapped',
            params: { scaledLph: round2(scaledLph), maxLph: round2(limitLph) },
          });
        }
      } else if (!available && sweat.calibrate !== false) {
        details.push({ key: 'sweat.why.calibrationUnavailable', params: { testRateLph: round2(test.rateLph) } });
      } else {
        details.push({ key: 'sweat.why.testDirect', params: { testRateLph: round2(test.rateLph) } });
      }
    } else {
      source = 'estimate';
      warnings.push({
        id: 'sweat.testUnusable',
        level: 'warning',
        message: { key: test ? 'sweat.warn.testUnusable' : 'sweat.warn.noTest' },
        citations: ['baker2017'],
      });
    }
  }

  if (source === 'estimate') {
    rateLph = estimate.rateLph;
    uncertaintyLph = SWEAT_MODEL_UNCERTAINTY_LPH;
    details.push({
      key: 'sweat.why.estimateDrivers',
      params: {
        heatW: Math.round(estimate.heatProductionW),
        energyKcalPerHour: Math.round(estimate.energyKcalPerHour),
      },
    });
    if (estimate.capped) {
      details.push({ key: 'sweat.why.estimateCapped', params: { maxLph: round2(estimate.maxRateLph) } });
    }
    if (estimate.rateLph < LOW_ESTIMATE_LPH) {
      warnings.push({
        id: 'sweat.estimateLow',
        level: 'info',
        message: {
          key: 'sweat.warn.estimateLow',
          params: { rateLph: round2(estimate.rateLph), hi: round2(estimate.rateLph + SWEAT_MODEL_UNCERTAINTY_LPH) },
        },
        citations: ['jay2024', 'kenefick2018'],
      });
    }
  } else if (source === 'preset') {
    rateLph = SWEAT_RATE_PRESETS_LPH[presetIndex(sweat.rateIndex, SWEAT_RATE_PRESETS_LPH.length)];
    uncertaintyLph = PRESET_UNCERTAINTY_LPH;
  }

  details.push({ key: 'sweat.why.sodium', params: { sodiumMmolL } });
  // 1 kg of body mass lost is about 1 L of sweat (both typed, so imperial reads lb and fl oz).
  if (source !== 'test') details.push({ key: 'sweat.why.measure', params: { lossKg: 1, sweatL: 1 } });

  if (estimate.uncompensable) {
    warnings.push({
      id: 'sweat.uncompensable',
      level: 'danger',
      message: { key: 'sweat.warn.uncompensable' },
      citations: ['gagnon2013', 'cramer2019'],
    });
  }

  return {
    rateLph,
    sodiumMmolL,
    source,
    uncertaintyLph,
    estimate,
    test,
    tests,
    calibration,
    why: {
      summary: { key: `sweat.why.${source}`, params: rangeParams(rateLph, uncertaintyLph) },
      details,
      citations: [...CITATIONS_BY_SOURCE[source]],
    },
    warnings,
  };
}
