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
 * Sweat rate and sweat sodium. Interim module for Phase 1: it offers the
 * self-assessed presets and the legacy rough estimate. Phase 2 adds a sweat
 * test (body mass before and after) and a heat-balance estimate.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/sweat.js`.
 */

import { SWEAT_RATES, ELECTROLYTE_CONCENTRATIONS } from '../constants/constants';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */

/** @typedef {'unspecified'|'female'|'male'} Sex */
/** @typedef {'easy'|'moderate'|'hard'|'race'} Intensity */
/** @typedef {'preset'|'estimate'} SweatSource */

/**
 * @typedef {Object} SweatInputs
 * @property {SweatSource} [source]  `'preset'` uses the rate the athlete picked; `'estimate'` uses {@link estimateSweatRateLegacy}.
 * @property {number} [rateIndex]  Index into {@link SWEAT_RATE_PRESETS_LPH} (0–5).
 * @property {number} [saltinessIndex]  Index into {@link SWEAT_SODIUM_PRESETS_MMOL} (0–5).
 */

/**
 * @typedef {Object} SweatContext
 * @property {Sex} [sex]
 * @property {Intensity} [intensity]
 * @property {number} [tempC]  Air temperature in °C.
 * @property {number} [humidity]  Relative humidity in %.
 */

/**
 * @typedef {Object} SweatResolution
 * @property {number} rateLph  Sweat rate in L/h (unrounded).
 * @property {number} sodiumMmolL  Sweat sodium concentration in mmol/L.
 * @property {SweatSource} source  The source actually used.
 * @property {number} uncertaintyLph  Typical error of the source in L/h (±).
 * @property {Explanation} why
 */

/** Self-assessed sweat rate presets in L/h, lightest to heaviest (from constants). */
export const SWEAT_RATE_PRESETS_LPH = SWEAT_RATES;

/** Self-assessed sweat sodium presets in mmol/L, least to most salty (from constants). */
export const SWEAT_SODIUM_PRESETS_MMOL = ELECTROLYTE_CONCENTRATIONS.Sodium;

const SWEAT_CITATIONS = ['baker2017', 'barnes2019'];

const SEX_BASE_LPH = { male: 0.8, female: 0.5, unspecified: 0.65 };
const INTENSITY_FACTOR = { easy: 0.8, moderate: 1.2, hard: 1.5, race: 1.8 };

const LEGACY_MIN_LPH = 0.3;
const LEGACY_MAX_LPH = 3.5;
/** Reference temperature (°C) and humidity (%) at which the legacy formula adds no adjustment. */
const REFERENCE_TEMP_C = 15;
const REFERENCE_HUMIDITY = 50;

const UNCERTAINTY_LPH = { preset: 0.5, estimate: 0.4 };
/** Middle preset, also the default in the plan inputs. */
const DEFAULT_INDEX = 2;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round2 = (x) => Math.round(x * 100) / 100;

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
 * Rough sweat-rate estimate carried over from the original calculator.
 *
 * Interim: this is a simple linear proxy, not a validated model. Phase 2
 * replaces it with a sweat test and a heat-balance estimate. Real sweat rates
 * vary widely between athletes (Baker 2017; Barnes et al. 2019).
 *
 * Formula: `base(sex) × factor(intensity) + (tempC − 15) × 0.03 + (humidity − 50) × 0.005`,
 * clamped to [0.3, 3.5] L/h. Base: male 0.8, female 0.5, unspecified 0.65.
 * Factor: easy 0.8, moderate 1.2, hard 1.5, race 1.8.
 *
 * Unknown `sex` is treated as `'unspecified'` and unknown `intensity` as
 * `'moderate'`. A non-finite `tempC` or `humidity` adds no adjustment (it is
 * treated as the formula's reference value, 15 °C or 50 %).
 *
 * @param {SweatContext} [context]
 * @returns {number} Estimated sweat rate in L/h (unrounded).
 */
export function estimateSweatRateLegacy({ sex, intensity, tempC, humidity } = {}) {
  const base = Object.hasOwn(SEX_BASE_LPH, sex) ? SEX_BASE_LPH[sex] : SEX_BASE_LPH.unspecified;
  const factor = Object.hasOwn(INTENSITY_FACTOR, intensity)
    ? INTENSITY_FACTOR[intensity]
    : INTENSITY_FACTOR.moderate;
  const t = Number.isFinite(tempC) ? tempC : REFERENCE_TEMP_C;
  const h = Number.isFinite(humidity) ? humidity : REFERENCE_HUMIDITY;
  const rate = base * factor + (t - REFERENCE_TEMP_C) * 0.03 + (h - REFERENCE_HUMIDITY) * 0.005;
  return clamp(rate, LEGACY_MIN_LPH, LEGACY_MAX_LPH);
}

/**
 * Resolves the sweat rate and sweat sodium concentration the rest of the plan
 * uses.
 *
 * - `source: 'preset'` → `SWEAT_RATE_PRESETS_LPH[rateIndex]`, uncertainty ±0.5 L/h.
 * - `source: 'estimate'` → {@link estimateSweatRateLegacy}, uncertainty ±0.4 L/h.
 * - Any other source falls back to `'preset'`.
 * - `sodiumMmolL` always comes from `SWEAT_SODIUM_PRESETS_MMOL[saltinessIndex]`.
 * - Indices are rounded and clamped to 0–5; non-finite indices use preset 2.
 *
 * Citations: baker2017, barnes2019.
 *
 * @param {SweatInputs} [sweat]
 * @param {SweatContext} [context]  Only used for `'estimate'`.
 * @returns {SweatResolution}
 */
export function resolveSweat({ source, rateIndex, saltinessIndex } = {}, context = {}) {
  const resolvedSource = source === 'estimate' ? 'estimate' : 'preset';
  const sodiumMmolL =
    SWEAT_SODIUM_PRESETS_MMOL[presetIndex(saltinessIndex, SWEAT_SODIUM_PRESETS_MMOL.length)];
  const rateLph =
    resolvedSource === 'estimate'
      ? estimateSweatRateLegacy(context ?? {})
      : SWEAT_RATE_PRESETS_LPH[presetIndex(rateIndex, SWEAT_RATE_PRESETS_LPH.length)];
  const uncertaintyLph = UNCERTAINTY_LPH[resolvedSource];

  return {
    rateLph,
    sodiumMmolL,
    source: resolvedSource,
    uncertaintyLph,
    why: {
      summary: {
        key: `sweat.why.${resolvedSource}`,
        params: {
          rateLph: round2(rateLph),
          lo: round2(Math.max(0, rateLph - uncertaintyLph)),
          hi: round2(rateLph + uncertaintyLph),
          uncertaintyLph,
        },
      },
      details: [
        { key: 'sweat.why.sodium', params: { sodiumMmolL } },
        { key: 'sweat.why.variability' },
      ],
      citations: [...SWEAT_CITATIONS],
    },
  };
}
