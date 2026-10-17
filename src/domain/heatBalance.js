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
 * Heat-balance sweat-rate estimate (partitional calorimetry).
 *
 * The body must get rid of the heat it produces. Whatever dry heat loss
 * (convection and radiation) and breathing cannot remove has to be evaporated
 * as sweat. That evaporative requirement (Ereq) sets the sweat rate when the
 * air can take it up; when the skin gets wetter (wettedness w = Ereq/Emax),
 * more sweat drips off without cooling (ISO 7933 efficiency `r`).
 *
 * Sources: Gagnon, Jay & Kenny 2013 (Ereq determines whole-body sweat rate,
 * gagnon2013), Cramer & Jay 2019 (partitional calorimetry, cramer2019), Jay et
 * al. 2024 (outdoor running and cycling prediction, limits of agreement about
 * ±0.4 L/h, jay2024), ISO 7933:2023 (Predicted Heat Strain: skin temperature,
 * sweat efficiency). Formulas follow the verified Phase 2 research notes,
 * section A, one to one.
 *
 * Inputs follow the plan's v4 schema. Every function is total: a missing or
 * non-finite value uses the plan default ({@link MODEL_DEFAULTS}) and values
 * outside the plan's input limits are clamped to them, so every result is a
 * finite number with one exception: `estimateSweatRate().wettedness` is
 * `Infinity` when the body must lose heat by sweating (Ereq > 0) but the air
 * cannot take up any sweat (Emax ≤ 0, e.g. 50 °C at 60 % humidity). That
 * case is always `uncompensable`; `JSON.stringify` writes it as `null`, so
 * check `Number.isFinite` before showing or serialising it.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no text.
 */

/** @typedef {'running'|'cycling'|'other'} Sport */
/** @typedef {'outdoor'|'indoorFan'|'indoorNoFan'} Setting */
/** @typedef {'none'|'partly'|'full'} Sun */

/**
 * Conditions of one session (race or sweat test) for the heat-balance model.
 *
 * @typedef {Object} SweatModelInput
 * @property {Sport} [sport]
 * @property {number} [speedKmh]  Running or cycling speed in km/h (3–70).
 * @property {number} [powerW]  Cycling power in W (0–2000). 0 means unknown: derived from the speed.
 * @property {number} [mets]  Compendium METs for `'other'` sports (1–20).
 * @property {Setting} [setting]
 * @property {number} [massKg]  Body mass in kg (30–200).
 * @property {number} [heightCm]  Height in cm (120–220).
 * @property {number} [tempC]  Air temperature in °C (−20–50).
 * @property {number} [humidity]  Relative humidity in % (0–100).
 * @property {Sun} [sun]  Sunshine outdoors. Indoors there is no sun load.
 * @property {boolean} [acclimatised]  Heat acclimatised: raises the wettedness limit from 0.85 to 1.0.
 */

/**
 * @typedef {Object} SweatEstimate
 * @property {number} rateLph  Predicted whole-body sweat rate in L/h (0 to `maxRateLph`).
 * @property {number} ereqW  Evaporative requirement for heat balance in W.
 * @property {number} emaxW  Maximum evaporative capacity of the environment in W.
 * @property {number} wettedness  Ereq/Emax; 0 when Ereq ≤ 0; `Infinity` when Ereq > 0 and Emax ≤ 0 (the only
 *   non-finite field of the result; always `uncompensable`).
 * @property {boolean} uncompensable  Wettedness above 0.85 (1.0 when acclimatised): heat balance is not possible.
 * @property {number} metabolicW  Metabolic rate (gross energy turnover) in W.
 * @property {number} energyKcalPerHour  Energy expenditure in kcal/h (`metabolicW × 3600 / 4184`).
 * @property {number} uncertaintyLph  Typical error of the model in L/h (±0.5).
 * @property {boolean} capped  The rate hit `maxRateLph`.
 * @property {number} externalWorkW  Mechanical power leaving the body in W (cycling power, else 0).
 * @property {number} heatProductionW  Metabolic heat production `metabolicW − externalWorkW` in W.
 * @property {number} powerW  Cycling power the model used in W (0 for other sports).
 * @property {boolean} powerFromSpeed  Cycling power was derived from the speed.
 * @property {number} bsaM2  Body surface area in m².
 * @property {number} airSpeedMs  Relative air speed in m/s.
 * @property {number} dryAirSpeedMs  Air speed used for the dry heat exchange in m/s: for cycling at most 3 while
 *   the skin loses heat to the air (Tsk > Ta), else `airSpeedMs`.
 * @property {number} skinTempC  Mean skin temperature in °C.
 * @property {number} dryHeatLossW  Convection and radiation from the skin in W (negative when the air is hotter than the skin).
 * @property {number} respiratoryHeatLossW  Heat lost by breathing in W.
 * @property {number} solarGainW  Heat gained from the sun in W.
 * @property {number} maxRateLph  Physiological ceiling `min(3, 1.5 × BSA)` in L/h.
 */

/** Typical error of the heat-balance estimate in L/h (jay2024: limits of agreement about ±0.4 L/h). */
export const SWEAT_MODEL_UNCERTAINTY_LPH = 0.5;

/**
 * Effective radiant field of the sun on the body in W/m² (outdoors only):
 * shade or overcast 0, partly sunny 75, full sun 150.
 * @type {Readonly<Record<Sun, number>>}
 */
export const SUN_ERF_W_M2 = Object.freeze({ none: 0, partly: 75, full: 150 });

/**
 * Plan defaults (inputs schema v4) used for a missing or non-finite value.
 * @type {Readonly<Required<SweatModelInput>>}
 */
export const MODEL_DEFAULTS = Object.freeze({
  sport: 'cycling',
  speedKmh: 30,
  powerW: 0,
  mets: 8,
  setting: 'outdoor',
  massKg: 70,
  heightCm: 175,
  tempC: 20,
  humidity: 50,
  sun: 'none',
  acclimatised: false,
});

/** Plan input limits (inputs schema v4) the model clamps to. */
const LIMITS = Object.freeze({
  speedKmh: [3, 70],
  powerW: [0, 2000],
  mets: [1, 20],
  massKg: [30, 200],
  heightCm: [120, 220],
  tempC: [-20, 50],
  humidity: [0, 100],
});

/** Sports the model knows (inputs schema v4 `event.sport`). @type {readonly Sport[]} */
export const SPORTS = Object.freeze(['running', 'cycling', 'other']);
/** Settings the model knows (inputs schema v4 `event.setting`). @type {readonly Setting[]} */
export const SETTINGS = Object.freeze(['outdoor', 'indoorFan', 'indoorNoFan']);

/** Latent heat of vaporisation of sweat in J/g; 2426 J/g ÷ 3.6 ≈ 673.9 W per L/h. */
const LATENT_HEAT_J_PER_G = 2426;
const W_PER_LPH = LATENT_HEAT_J_PER_G / 3.6;
/** Lewis relation in K/kPa. */
const LEWIS = 16.5;
/** Radiative heat transfer coefficient in W/(m²·K). */
const HR = 4.7;
/** Gross cycling efficiency (external work / metabolic rate). */
const CYCLING_EFFICIENCY = 0.2;
/** Energy equivalent of oxygen in J/ml (ACSM). */
const J_PER_ML_O2 = 20.9;
/** 1 MET = 1 kcal/kg/h = 1.163 W/kg. */
const W_PER_KG_PER_MET = 1.163;
/** Cycling: drag area CdA (m²), rolling resistance, air density (kg/m³), bike + kit mass (kg). */
const CDA_M2 = 0.36;
const CRR = 0.005;
const AIR_DENSITY = 1.2;
const BIKE_KG = 10;
const G = 9.81;
/** Air speed for other sports outdoors, with a fan indoors, and the floor (m/s). */
const AIR_SPEED_OTHER_OUTDOOR = 1.0;
const AIR_SPEED_FAN = 1.5;
const AIR_SPEED_MIN = 0.2;
/**
 * Air speed indoors without a fan (m/s), for every sport (trainer, treadmill,
 * other sports): the working body still moves the air around it. The reason
 * is not sport-specific (ISO 7933, when no walking speed is given, likewise
 * lowers the air-layer insulation of any worker with a movement speed of
 * 0.0052 (M − 58) m/s, M in W/m², at most 0.7 m/s), but the measured check is
 * cycling only: Brown & Banister 1985 (Eur J Appl Physiol 54:125) measured
 * about 1.0–1.1 L/h after the 0.2 g/kcal correction (1.2–1.3 raw) on a
 * trainer without a fan at about 216 W and 20–23 °C (70 kg/178 cm), where the
 * model gives 1.28 L/h at 21.5 °C with 0.5 m/s (slightly high) and the 2.8 L/h
 * ceiling with 0.2 m/s (still air). Other sports change too: 8 METs at
 * 20 °C/50 % goes from 1.40 L/h (uncompensable) at 0.2 m/s to 0.72 L/h
 * (compensable), a 12 km/h treadmill run from the 2.77 L/h ceiling to
 * 2.61 L/h (still uncompensable).
 */
const AIR_SPEED_NO_FAN = 0.5;
/**
 * ISO 7933 validity limit for air speed (m/s). The skin-temperature regression
 * caps its wind term here. For cycling the dry (convective + radiative) heat
 * loss and the sun gain use the air speed capped at the same limit;
 * evaporation keeps the full riding speed.
 *
 * - Evidence: in hot lab trials measured dry heat loss did not rise with air
 *   flow (Otani et al. 2018, Appl Physiol Nutr Metab, doi
 *   10.1139/apnm-2017-0448: similar across 0–30 km/h of headwind at 30 °C
 *   while skin temperature fell; Saunders et al. 2005, Acta Physiol Scand
 *   183:241: no thermal difference between 100 % and 150 % of road speed at
 *   33 °C). At cooler temperatures, where the cap matters most, it rests on
 *   two outdoor field comparisons that run above the model even with the cap
 *   (Jay et al. 2024; Brown & Banister 1985). Lab trials with strong air flow
 *   point the other way: on the same 0.2 g/kcal basis the capped model
 *   over-predicts Jenkins et al. 2023 (about 180 W, 4.5 m/s, 18–36 °C) by
 *   about 0.15–0.2 L/h, and the cap made the 18 °C and 27 °C fit worse than
 *   without it (CORE.md sections 5.5 and 13).
 * - Loss only: the cap applies only while the skin loses heat to the air
 *   (Tsk > Ta). Air hotter than the skin keeps the full speed for its
 *   convective heat gain, so the cap never lowers a hot-weather estimate. The
 *   sun gain uses the capped speed at every temperature, which only raises
 *   it and keeps the rate continuous where Ta crosses Tsk.
 * - Cycling only, because the cap was checked only against cycling sweat
 *   data. Running faster than 10.8 km/h (e.g. the 12 km/h reference run) is
 *   also outside ISO 7933's range and keeps the uncapped dry heat loss, not
 *   yet checked against running field data.
 */
const AIR_SPEED_ISO_MAX = 3;
/** Clothing insulation in clo: race kit for running and cycling, light sportswear otherwise. */
const CLO_RACE_KIT = 0.15;
const CLO_OTHER = 0.3;
/** Wettedness limit above which heat balance fails (ISO 7933): 0.85, or 1.0 when acclimatised. */
const W_LIMIT = 0.85;
const W_LIMIT_ACCLIMATISED = 1.0;
/** Hard ceiling for the predicted sweat rate in L/h, and per m² of body surface. */
const SR_CEILING_LPH = 3.0;
const SR_PER_M2_LPH = 1.5;
const KCAL_J = 4184;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * A finite number from `value`, clamped to the limits of `field`; the plan
 * default when `value` is not a finite number.
 * @param {unknown} value
 * @param {keyof typeof LIMITS} field
 * @returns {number}
 */
function num(value, field) {
  const [lo, hi] = LIMITS[field];
  return Number.isFinite(value) ? clamp(value, lo, hi) : MODEL_DEFAULTS[field];
}

/**
 * `value` when it is one of `options`, else `fallback`.
 * @template T
 * @param {unknown} value
 * @param {readonly T[]} options
 * @param {T} fallback
 * @returns {T}
 */
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);

/**
 * Saturated water vapour pressure in kPa (Tetens).
 * @param {number} tempC
 * @returns {number}
 */
const psat = (tempC) => 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));

/**
 * Body surface area in m² (DuBois & DuBois 1916):
 * `0.007184 × kg^0.425 × cm^0.725`.
 *
 * @param {number} massKg  Body mass in kg (clamped to 30–200; default 70).
 * @param {number} heightCm  Height in cm (clamped to 120–220; default 175).
 * @returns {number}
 */
export function bodySurfaceArea(massKg, heightCm) {
  return 0.007184 * num(massKg, 'massKg') ** 0.425 * num(heightCm, 'heightCm') ** 0.725;
}

/**
 * Cycling power on flat ground with no wind for a given speed:
 * `P = 0.5 × 1.2 × 0.36 × v³ + 0.005 × (m + 10) × 9.81 × v`, with `v` in m/s
 * and `m + 10` the rider plus bike and kit. A rough default for when the power
 * is unknown; real power varies with position, road, wind and climbing.
 *
 * @param {number} speedKmh  Speed in km/h (clamped to 3–70; default 30).
 * @param {number} massKg  Rider mass in kg (clamped to 30–200; default 70).
 * @returns {number} Power in W.
 */
export function cyclingPowerFromSpeed(speedKmh, massKg) {
  const v = num(speedKmh, 'speedKmh') / 3.6;
  const m = num(massKg, 'massKg') + BIKE_KG;
  return 0.5 * AIR_DENSITY * CDA_M2 * v ** 3 + CRR * m * G * v;
}

/**
 * Metabolic rate and external work for a sport.
 *
 * - `running`: ACSM gross running equation,
 *   `VO2 = 3.5 + 0.2 × speed (m/min)` ml/kg/min (= `3.5 + 3.333 × km/h`),
 *   `M = kg × VO2 × 20.9 / 60` W; no external work.
 * - `cycling`: `M = P / 0.20` (gross efficiency 20 %), `W = P`. When
 *   `powerW` is 0 (unknown), `P` = {@link cyclingPowerFromSpeed}.
 * - `other`: `M = 1.163 × METs × kg` (1 MET = 1 kcal/kg/h); no external work.
 *
 * An unknown sport is treated as cycling (the plan default).
 *
 * @param {Pick<SweatModelInput, 'sport'|'speedKmh'|'powerW'|'mets'|'massKg'> | null} [input]
 * @returns {{ metabolicW: number, externalWorkW: number, powerW: number, powerFromSpeed: boolean }}
 *   `powerW` and `powerFromSpeed` describe the cycling power used (0 and false for other sports).
 */
export function metabolicRate(input) {
  const { sport, speedKmh, powerW, mets, massKg } = input ?? {};
  const s = oneOf(sport, SPORTS, MODEL_DEFAULTS.sport);
  const kg = num(massKg, 'massKg');
  if (s === 'running') {
    const metersPerMin = (num(speedKmh, 'speedKmh') * 1000) / 60;
    const vo2 = 3.5 + 0.2 * metersPerMin;
    return { metabolicW: (kg * vo2 * J_PER_ML_O2) / 60, externalWorkW: 0, powerW: 0, powerFromSpeed: false };
  }
  if (s === 'cycling') {
    const given = num(powerW, 'powerW');
    const powerFromSpeed = !(given > 0);
    const p = powerFromSpeed ? cyclingPowerFromSpeed(speedKmh, kg) : given;
    return { metabolicW: p / CYCLING_EFFICIENCY, externalWorkW: p, powerW: p, powerFromSpeed };
  }
  return {
    metabolicW: W_PER_KG_PER_MET * num(mets, 'mets') * kg,
    externalWorkW: 0,
    powerW: 0,
    powerFromSpeed: false,
  };
}

/**
 * Relative air speed over the body in m/s.
 *
 * - Outdoors, running and cycling: the speed (`km/h ÷ 3.6`); other sports 1.0.
 * - Indoors with a fan 1.5; indoors without a fan 0.5 (moving limbs).
 * - Never below 0.2 (free convection from a moving body).
 *
 * An unknown setting is treated as outdoors, an unknown sport as cycling.
 *
 * @param {Pick<SweatModelInput, 'sport'|'speedKmh'|'setting'> | null} [input]
 * @returns {number}
 */
export function airSpeed(input) {
  const { sport, speedKmh, setting } = input ?? {};
  const s = oneOf(sport, SPORTS, MODEL_DEFAULTS.sport);
  const where = oneOf(setting, SETTINGS, MODEL_DEFAULTS.setting);
  let v;
  if (where === 'indoorFan') v = AIR_SPEED_FAN;
  else if (where === 'indoorNoFan') v = AIR_SPEED_NO_FAN;
  else if (s === 'other') v = AIR_SPEED_OTHER_OUTDOOR;
  else v = num(speedKmh, 'speedKmh') / 3.6;
  return Math.max(AIR_SPEED_MIN, v);
}

/**
 * Sweat efficiency `r` (ISO 7933) for a wettedness `w` > 0: the share of
 * sweat that evaporates. `null` when `w ≥ 1.7` (no useful evaporation).
 * @param {number} w
 * @returns {number|null}
 */
function sweatEfficiency(w) {
  if (w <= 1) return 1 - (w * w) / 2;
  if (w < 1.7) return Math.max(0.05, (2 - w) ** 2 / 2);
  return null;
}

/**
 * Predicts the whole-body sweat rate from the heat balance (gagnon2013,
 * cramer2019, jay2024), with the formulas of the Phase 2 research notes:
 *
 * ```
 * A    = DuBois BSA;  pa = rh/100 × psat(Ta);  v = airSpeed (≥ 0.2)
 * Tsk  = clamp(30.78 + 0.125 Ta + 0.198 pa − 0.348 min(v, 3), 30, 36)
 * hc   = 8.3 v^0.6;  Rcl = 0.155 clo;  fcl = 1 + 0.28 clo;  Ra(u) = 1/(fcl (8.3 u^0.6 + 4.7))
 * vCap = cycling ? min(v, 3) : v;  vDry = Tsk > Ta ? vCap : v     (see AIR_SPEED_ISO_MAX)
 * CR   = A (Tsk − Ta)/(Rcl + Ra(vDry))
 * Resp = 0.0173 M (5.87 − pa) + 0.0014 M (34 − Ta)
 * S    = ERF A Ra(vCap)/(Ra(vCap) + Rcl)   (ERF from SUN_ERF_W_M2, outdoors only)
 * Ereq = (M − W) − CR − Resp + S
 * Emax = A (psat(Tsk) − pa) / (1/(16.5 hc fcl) + (clo > 0.3 ? Rcl/(16.5 × 0.38) : 0))
 * Ereq ≤ 0 → 0;  Emax ≤ 0 → SR_MAX;  else w = Ereq/Emax, r = ISO 7933 efficiency,
 * SR = r ? min(SR_MAX, Ereq/(673.9 r)) : SR_MAX
 * SR_MAX = min(3.0, 1.5 A) L/h
 * ```
 *
 * Clothing is 0.15 clo for running and cycling (race kit) and 0.3 clo for
 * other sports. `uncompensable` is `w > 0.85` (`w > 1.0` when acclimatised).
 *
 * Reference values (research notes, `final_model.py`): run 70 kg/175 cm at
 * 12 km/h, 20 °C/50 % in the shade → 0.95 L/h (full sun 1.27); 30 °C/60 % →
 * 1.59; other sport at 8 METs, 25 °C/50 % → 0.75 (0.3 clo; the research
 * table's 0.70 used race kit); cycling 75 kg/180 cm at 200 W and 30 km/h,
 * 25 °C/50 % → 0.60, before the cycling dry-path cap. Regression value of
 * the capped model (not a research-script golden): that ride → 0.73 L/h.
 *
 * In cool conditions the air flow of race kit at speed can carry all the heat
 * away (`ereqW ≤ 0`), so the model predicts no sweat at all: the default
 * 30 km/h ride gives 0 L/h from about 11 °C down (under 0.1 L/h below about
 * 14 °C). Real athletes still sweat a little; `resolveSweat` notes low
 * estimates (`sweat.estimateLow`).
 *
 * A missing or `null` input uses the plan defaults.
 *
 * @param {SweatModelInput | null} [input]
 * @returns {SweatEstimate}
 */
export function estimateSweatRate(input) {
  const raw = input ?? {};
  const sport = oneOf(raw.sport, SPORTS, MODEL_DEFAULTS.sport);
  const setting = oneOf(raw.setting, SETTINGS, MODEL_DEFAULTS.setting);
  const sun = Object.hasOwn(SUN_ERF_W_M2, raw.sun) ? raw.sun : MODEL_DEFAULTS.sun;
  const massKg = num(raw.massKg, 'massKg');
  const ta = num(raw.tempC, 'tempC');
  const rh = num(raw.humidity, 'humidity');
  const acclimatised = raw.acclimatised === true;

  const A = bodySurfaceArea(massKg, raw.heightCm);
  const { metabolicW: M, externalWorkW: W, powerW, powerFromSpeed } = metabolicRate({
    sport,
    speedKmh: raw.speedKmh,
    powerW: raw.powerW,
    mets: raw.mets,
    massKg,
  });
  const v = airSpeed({ sport, speedKmh: raw.speedKmh, setting });
  const clo = sport === 'other' ? CLO_OTHER : CLO_RACE_KIT;
  const erf = setting === 'outdoor' ? SUN_ERF_W_M2[sun] : 0;

  const pa = (rh / 100) * psat(ta);
  const tsk = clamp(30.78 + 0.125 * ta + 0.198 * pa - 0.348 * Math.min(v, AIR_SPEED_ISO_MAX), 30, 36);
  const hc = 8.3 * v ** 0.6;
  const rcl = 0.155 * clo;
  const fcl = 1 + 0.28 * clo;
  /** Air-layer resistance Ra at air speed `u` (convection 8.3 u^0.6 + radiation). */
  const airResistance = (u) => 1 / (fcl * (8.3 * u ** 0.6 + HR));
  // Cycling: dry heat loss and sun gain at most at the ISO 7933 limit; heat gained
  // from air hotter than the skin keeps the full speed (AIR_SPEED_ISO_MAX).
  const cappedAirSpeedMs = sport === 'cycling' ? Math.min(v, AIR_SPEED_ISO_MAX) : v;
  const dryAirSpeedMs = tsk > ta ? cappedAirSpeedMs : v;
  const raDry = airResistance(dryAirSpeedMs);
  const raSun = airResistance(cappedAirSpeedMs);
  const dryHeatLossW = (A * (tsk - ta)) / (rcl + raDry);
  const respiratoryHeatLossW = 0.0173 * M * (5.87 - pa) + 0.0014 * M * (34 - ta);
  const solarGainW = (erf * A * raSun) / (raSun + rcl);
  const ereqW = M - W - dryHeatLossW - respiratoryHeatLossW + solarGainW;
  const evapResistance = 1 / (LEWIS * hc * fcl) + (clo > 0.3 ? rcl / (LEWIS * 0.38) : 0);
  const emaxW = (A * (psat(tsk) - pa)) / evapResistance;
  const maxRateLph = Math.min(SR_CEILING_LPH, SR_PER_M2_LPH * A);

  let rateLph;
  let wettedness;
  if (ereqW <= 0) {
    rateLph = 0;
    wettedness = 0;
  } else if (emaxW <= 0) {
    rateLph = maxRateLph;
    wettedness = Infinity;
  } else {
    wettedness = ereqW / emaxW;
    const r = sweatEfficiency(wettedness);
    rateLph = r === null ? maxRateLph : Math.min(maxRateLph, ereqW / (W_PER_LPH * r));
  }

  return {
    rateLph,
    ereqW,
    emaxW,
    wettedness,
    uncompensable: wettedness > (acclimatised ? W_LIMIT_ACCLIMATISED : W_LIMIT),
    metabolicW: M,
    energyKcalPerHour: (M * 3600) / KCAL_J,
    uncertaintyLph: SWEAT_MODEL_UNCERTAINTY_LPH,
    capped: rateLph >= maxRateLph,
    externalWorkW: W,
    heatProductionW: M - W,
    powerW,
    powerFromSpeed,
    bsaM2: A,
    airSpeedMs: v,
    dryAirSpeedMs,
    skinTempC: tsk,
    dryHeatLossW,
    respiratoryHeatLossW,
    solarGainW,
    maxRateLph,
  };
}
