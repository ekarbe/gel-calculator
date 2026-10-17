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
 * Unit conversions between the metric units the plan uses (kg, cm, °C, km/h,
 * ml, L, min/km) and the US customary units the UI can show (lb, in, ft + in,
 * °F, mph, US fl oz, min/mi), plus rounding helpers.
 *
 * Pure module: no React, no DOM, no clocks, no randomness, no text. The plan
 * inputs always stay metric; the UI converts at its edge (display values and
 * the numbers typed into imperial fields). Every function accepts any value:
 * a missing or non-finite number counts as 0, as in every domain module.
 * The conversions are exact (no rounding), so a round trip gives the value
 * back up to floating-point error; rounding is a separate, explicit step.
 */

/** The unit systems the UI offers. The plan inputs are always metric. */
export const UNIT_SYSTEMS = Object.freeze(['metric', 'imperial']);

/** Kilograms per pound (exact, by definition). */
export const KG_PER_LB = 0.45359237;
/** Pounds per kilogram. */
export const LB_PER_KG = 1 / KG_PER_LB;
/** Centimetres per inch (exact). */
export const CM_PER_IN = 2.54;
/** Inches per foot. */
export const IN_PER_FT = 12;
/** Kilometres per international mile (exact). */
export const KM_PER_MI = 1.609344;
/** Millilitres per US fluid ounce (exact: 1/128 US gallon of 231 in³). */
export const ML_PER_FL_OZ = 29.5735295625;

/**
 * Quantity kinds that differ between the unit systems, with the metric unit
 * the plan stores: `mass` kg, `height` cm, `temp` °C, `speed` km/h, `pace`
 * min/km, `volume` ml, `volumeL` L. Imperial: lb, in, °F, mph, min/mi, US fl
 * oz, US fl oz.
 */
export const QUANTITY_KINDS = Object.freeze(['mass', 'height', 'temp', 'speed', 'pace', 'volume', 'volumeL']);

/**
 * A usable number: non-finite values and non-numbers become 0.
 * @param {unknown} value
 * @returns {number}
 */
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Whether `system` is the imperial unit system. Anything else is metric.
 * @param {unknown} system
 * @returns {boolean}
 */
export const isImperial = (system) => system === 'imperial';

/** @param {number} kg @returns {number} pounds */
export const kgToLb = (kg) => num(kg) * LB_PER_KG;
/** @param {number} lb @returns {number} kilograms */
export const lbToKg = (lb) => num(lb) * KG_PER_LB;

/** @param {number} cm @returns {number} inches */
export const cmToIn = (cm) => num(cm) / CM_PER_IN;
/** @param {number} inches @returns {number} centimetres */
export const inToCm = (inches) => num(inches) * CM_PER_IN;

/** @param {number} c degrees Celsius @returns {number} degrees Fahrenheit */
export const cToF = (c) => (num(c) * 9) / 5 + 32;
/** @param {number} f degrees Fahrenheit @returns {number} degrees Celsius */
export const fToC = (f) => ((num(f) - 32) * 5) / 9;

/** @param {number} kmh @returns {number} miles per hour */
export const kmhToMph = (kmh) => num(kmh) / KM_PER_MI;
/** @param {number} mph @returns {number} kilometres per hour */
export const mphToKmh = (mph) => num(mph) * KM_PER_MI;

/** @param {number} ml @returns {number} US fluid ounces */
export const mlToFlOz = (ml) => num(ml) / ML_PER_FL_OZ;
/** @param {number} flOz US fluid ounces @returns {number} millilitres */
export const flOzToMl = (flOz) => num(flOz) * ML_PER_FL_OZ;
/** @param {number} litres @returns {number} US fluid ounces */
export const lToFlOz = (litres) => mlToFlOz(num(litres) * 1000);
/** @param {number} flOz US fluid ounces @returns {number} litres */
export const flOzToL = (flOz) => flOzToMl(flOz) / 1000;

/** @param {number} minPerKm pace in min/km @returns {number} pace in min/mi */
export const minPerKmToMinPerMi = (minPerKm) => num(minPerKm) * KM_PER_MI;
/** @param {number} minPerMi pace in min/mi @returns {number} pace in min/km */
export const minPerMiToMinPerKm = (minPerMi) => num(minPerMi) / KM_PER_MI;

/**
 * Pace (min per km) for a speed in km/h. A speed that is not above 0 has no
 * pace and gives 0.
 * @param {number} kmh
 * @returns {number}
 */
export function paceFromSpeed(kmh) {
  const v = num(kmh);
  return v > 0 ? 60 / v : 0;
}

/**
 * Speed (km/h) for a pace in min per km. A pace that is not above 0 gives 0.
 * @param {number} minPerKm
 * @returns {number}
 */
export function speedFromPace(minPerKm) {
  const p = num(minPerKm);
  return p > 0 ? 60 / p : 0;
}

/**
 * Rounds to `digits` decimals (half away from zero, so −0.5 → −1 like 0.5 →
 * 1), without the binary drift of `x * 10 ** d` for values such as 1.005.
 * `-0` becomes 0. Negative `digits` round to tens, hundreds, …
 * @param {number} value
 * @param {number} [digits=0]
 * @returns {number}
 */
export function roundTo(value, digits = 0) {
  const v = num(value);
  const d = Number.isInteger(digits) ? digits : 0;
  const abs = Math.abs(v);
  // Shift the decimal point in the string form ("1.005e2" is exactly 100.5);
  // values already written in exponent form fall back to plain arithmetic.
  const shifted = String(abs).includes('e') ? abs * 10 ** d : Number(`${abs}e${d}`);
  const whole = Math.round(shifted);
  const back = String(whole).includes('e') ? whole / 10 ** d : Number(`${whole}e${-d}`);
  const rounded = Math.sign(v) * back;
  return Number.isFinite(rounded) ? rounded + 0 : v;
}

/**
 * Rounds to the nearest multiple of `step` (e.g. 0.5, 5, 50). A step that is
 * not above 0 returns the value unchanged. The result is cleaned of
 * floating-point noise (0.1 × 3 → 0.3).
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
export function roundToStep(value, step) {
  const v = num(value);
  const s = num(step);
  if (s <= 0) return v;
  const decimals = (String(s).split('.')[1] ?? '').length;
  return roundTo(Math.round(v / s) * s, decimals);
}

/**
 * A height as whole feet and inches, rounded to the nearest whole inch first
 * (so 182.8 cm is 6 ft 0 in, never 5 ft 12 in).
 * @param {number} cm
 * @returns {{ ft: number, in: number }}
 */
export function cmToFtIn(cm) {
  const totalIn = Math.round(Math.abs(cmToIn(cm)));
  return { ft: Math.floor(totalIn / IN_PER_FT), in: totalIn % IN_PER_FT };
}

/**
 * Centimetres for a height in feet and inches.
 * @param {number} ft
 * @param {number} [inches=0]
 * @returns {number}
 */
export const ftInToCm = (ft, inches = 0) => inToCm(num(ft) * IN_PER_FT + num(inches));

/**
 * Minutes as whole minutes and seconds (for a pace such as 4:30), rounded to
 * the nearest second first, so 4.999 min is 5:00, not 4:60. Negative values
 * count as 0.
 * @param {number} minutes
 * @returns {{ min: number, sec: number }}
 */
export function splitMinutes(minutes) {
  const totalSec = Math.round(Math.max(0, num(minutes)) * 60);
  return { min: Math.floor(totalSec / 60), sec: totalSec % 60 };
}

/**
 * Converts a stored metric value of `kind` to the unit `system` shows
 * (no rounding). Metric values and unknown kinds pass through unchanged
 * (non-finite → 0).
 *
 * | kind | metric | imperial |
 * | --- | --- | --- |
 * | `mass` | kg | lb |
 * | `height` | cm | in |
 * | `temp` | °C | °F |
 * | `speed` | km/h | mph |
 * | `pace` | min/km | min/mi |
 * | `volume` | ml | US fl oz |
 * | `volumeL` | L | US fl oz |
 *
 * @param {string} kind  One of {@link QUANTITY_KINDS}.
 * @param {number} value  The metric value.
 * @param {'metric'|'imperial'} system
 * @returns {number}
 */
export function toUnitSystem(kind, value, system) {
  if (!isImperial(system)) return num(value);
  switch (kind) {
    case 'mass': return kgToLb(value);
    case 'height': return cmToIn(value);
    case 'temp': return cToF(value);
    case 'speed': return kmhToMph(value);
    case 'pace': return minPerKmToMinPerMi(value);
    case 'volume': return mlToFlOz(value);
    case 'volumeL': return lToFlOz(value);
    default: return num(value);
  }
}

/**
 * The inverse of {@link toUnitSystem}: a value in the unit `system` shows,
 * back to the metric value the plan stores (no rounding).
 * @param {string} kind  One of {@link QUANTITY_KINDS}.
 * @param {number} value  The value in the system's unit.
 * @param {'metric'|'imperial'} system
 * @returns {number}
 */
export function fromUnitSystem(kind, value, system) {
  if (!isImperial(system)) return num(value);
  switch (kind) {
    case 'mass': return lbToKg(value);
    case 'height': return inToCm(value);
    case 'temp': return fToC(value);
    case 'speed': return mphToKmh(value);
    case 'pace': return minPerMiToMinPerKm(value);
    case 'volume': return flOzToMl(value);
    case 'volumeL': return flOzToL(value);
    default: return num(value);
  }
}
