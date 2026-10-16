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
 * Sodium bicarbonate plan: one pre-race dose of 0.2–0.3 g/kg for short,
 * high-intensity events.
 *
 * Evidence: Grgic et al. 2021 (ISSN position stand), de Oliveira et al. 2022
 * (meta-analysis of extracellular buffers). The benefit is shown for hard
 * efforts up to about 1 h; there is no evidence for multi-hour events.
 *
 * Pure module: no React, no DOM, no clocks, no randomness. Functions never
 * return English text; they return message descriptors whose keys live in
 * `src/i18n/en/bicarb.js`.
 */

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * Inputs for {@link planBicarbonate}.
 *
 * @typedef {Object} BicarbInputs
 * @property {boolean} [enabled]  Whether the athlete uses bicarbonate.
 * @property {number} [massKg]  Body mass in kg; clamped to [30, 200], non-finite → 70.
 * @property {number} [gPerKg]  Dose in g/kg; clamped to [0.2, 0.3], non-finite → 0.3.
 * @property {number} [durationMin]  Event duration in minutes; non-finite or negative → 0.
 */

/**
 * When to take the dose, in minutes from the start (negative = before).
 *
 * @typedef {Object} BicarbTiming
 * @property {number} earliest  −180
 * @property {number} latest  −60
 * @property {number} recommended  −90
 */

/**
 * Result of {@link planBicarbonate}.
 *
 * @typedef {Object} BicarbPlan
 * @property {boolean} enabled
 * @property {boolean} eligible  `durationMin ≤ 60`: the event is in the range where bicarbonate is shown to help.
 * @property {boolean} visibleByDefault  `durationMin ≤ 90`: the UI shows the option without a "Show" link.
 * @property {number} doseG  Sodium bicarbonate in g (unrounded); 0 when disabled.
 * @property {number} sodiumMg  Sodium in the dose in mg (unrounded); 0 when disabled.
 * @property {BicarbTiming} timingMin
 * @property {Explanation} why
 * @property {Warning[]} warnings  Empty when disabled.
 */

const G_PER_KG_RANGE = [0.2, 0.3];
const G_PER_KG_DEFAULT = 0.3;
const MASS_RANGE_KG = [30, 200];
const MASS_DEFAULT_KG = 70;
/** Mass fraction of sodium in sodium bicarbonate (NaHCO₃): 22.99 / 84.01. */
const SODIUM_FRACTION = 0.2737;

const ELIGIBLE_MAX_MIN = 60;
const VISIBLE_MAX_MIN = 90;

const CITATIONS = ['grgic2021', 'deoliveira2022'];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Duration tier used for the explanation.
 * @param {number} durationMin
 * @returns {'short'|'medium'|'long'}
 */
function tierFor(durationMin) {
  if (durationMin <= ELIGIBLE_MAX_MIN) return 'short';
  if (durationMin <= VISIBLE_MAX_MIN) return 'medium';
  return 'long';
}

/**
 * Plans a pre-race sodium bicarbonate dose.
 *
 * - `eligible = durationMin ≤ 60`; `visibleByDefault = durationMin ≤ 90`.
 *   Both are computed even when disabled.
 * - `doseG = gPerKg × massKg` (0.2–0.3 g/kg); `sodiumMg = doseG × 1000 × 0.2737`.
 * - Timing: 60–180 min before the start, 90 min recommended.
 * - Disabled → dose and sodium 0, no warnings.
 * - Enabled warnings: `bicarb.gi` (warning), `bicarb.sodiumLoad` (info,
 *   params `{ sodiumG }`), `bicarb.medical` (warning), `bicarb.notInRace`
 *   (info); plus `bicarb.longEvent` (warning) when `durationMin > 90` or
 *   `bicarb.limitedEvidence` (info) when `60 < durationMin ≤ 90`.
 *
 * Citations: grgic2021, deoliveira2022.
 *
 * @param {BicarbInputs} [inputs]
 * @returns {BicarbPlan}
 */
export function planBicarbonate({ enabled, massKg, gPerKg = G_PER_KG_DEFAULT, durationMin } = {}) {
  const d = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 0;
  const eligible = d <= ELIGIBLE_MAX_MIN;
  const visibleByDefault = d <= VISIBLE_MAX_MIN;
  const tier = tierFor(d);
  const timingMin = { earliest: -180, latest: -60, recommended: -90 };

  if (!enabled) {
    return {
      enabled: false,
      eligible,
      visibleByDefault,
      doseG: 0,
      sodiumMg: 0,
      timingMin,
      why: {
        summary: { key: `bicarb.why.${tier}` },
        details: [{ key: 'bicarb.why.timing' }],
        citations: [...CITATIONS],
      },
      warnings: [],
    };
  }

  const mass = Number.isFinite(massKg) ? clamp(massKg, ...MASS_RANGE_KG) : MASS_DEFAULT_KG;
  const perKg = Number.isFinite(gPerKg) ? clamp(gPerKg, ...G_PER_KG_RANGE) : G_PER_KG_DEFAULT;
  const doseG = perKg * mass;
  const sodiumMg = doseG * 1000 * SODIUM_FRACTION;

  /** @type {Warning[]} */
  const warnings = [
    {
      id: 'bicarb.gi',
      level: 'warning',
      message: { key: 'bicarb.warn.gi' },
      citations: [...CITATIONS],
    },
    {
      id: 'bicarb.sodiumLoad',
      level: 'info',
      message: { key: 'bicarb.warn.sodiumLoad', params: { sodiumG: round1(sodiumMg / 1000) } },
      citations: ['grgic2021'],
    },
    {
      id: 'bicarb.medical',
      level: 'warning',
      message: { key: 'bicarb.warn.medical' },
    },
    {
      id: 'bicarb.notInRace',
      level: 'info',
      message: { key: 'bicarb.warn.notInRace' },
    },
  ];
  if (d > VISIBLE_MAX_MIN) {
    warnings.push({
      id: 'bicarb.longEvent',
      level: 'warning',
      message: { key: 'bicarb.warn.longEvent' },
      citations: [...CITATIONS],
    });
  } else if (d > ELIGIBLE_MAX_MIN) {
    warnings.push({
      id: 'bicarb.limitedEvidence',
      level: 'info',
      message: { key: 'bicarb.warn.limitedEvidence' },
      citations: [...CITATIONS],
    });
  }

  return {
    enabled: true,
    eligible,
    visibleByDefault,
    doseG,
    sodiumMg,
    timingMin,
    why: {
      summary: { key: `bicarb.why.${tier}` },
      details: [
        {
          key: 'bicarb.why.dose',
          params: { gPerKg: round2(perKg), massKg: round1(mass), doseG: round1(doseG) },
        },
        { key: 'bicarb.why.timing' },
      ],
      citations: [...CITATIONS],
    },
    warnings,
  };
}
