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
 * Share links, version 4. A link stores only the inputs that differ from
 * `DEFAULT_INPUTS`, as JSON `{ v: 4, ...diff }` encoded with base64url
 * (UTF-8, no padding). Decoding runs the payload through `normalizeInputs`,
 * so a link can never put invalid values into the app.
 *
 * Version 3 links (inputs schema v3, Phase 1) still decode: a v3 payload
 * stores its differences from the v3 defaults, so it is merged onto those
 * first and then migrated by `normalizeInputs` (source lists → ingredients,
 * `perGel` → `perServing`, `sex` dropped, manual salt `id` → `ref`). Other
 * versions (the v2 format used before Phase 1) decode to `null`.
 */

import { DEFAULT_INPUTS, normalizeInputs } from '../domain/plan';
import { deepFreeze, isPlainObject, mergeDeep } from '../domain/objects';

/** Version written into every payload; bump it when the inputs schema changes shape. */
export const SHARE_VERSION = 4;

/** Older versions that still decode. */
const LEGACY_VERSIONS = Object.freeze([3]);

/**
 * The v3 default inputs: what a v3 link left out. Kept here, frozen, so v3
 * links keep their meaning however the v4 defaults change.
 */
const V3_DEFAULT_INPUTS = deepFreeze({
  event: { durationMin: 180, intensity: 'moderate', highCarb: false },
  athlete: { massKg: 70, sex: 'unspecified' },
  environment: { tempC: 20, humidity: 50 },
  sweat: { source: 'preset', rateIndex: 2, saltinessIndex: 2 },
  carbs: {
    mode: 'auto',
    manualGPerHour: 60,
    ratioMode: 'auto',
    manualRatio: { glucose: 1, fructose: 0.8 },
    glucoseSources: [{ id: 3, percentage: 100 }],
    fructoseSources: [{ id: 11, percentage: 100 }],
  },
  sodium: { mode: 'auto', manualMgPerHour: 500 },
  extras: { potassium: false, magnesium: false, calcium: false },
  salts: { mode: 'auto', sodiumSalt: 'table', manual: [] },
  fluid: { mode: 'auto', manualMlPerHour: 500 },
  format: { gelsPerHour: 3, view: 'total' },
  caffeine: { enabled: false, mgPerKg: 3, asIngredient: false, tabletMg: 100 },
  bicarb: { enabled: false, gPerKg: 0.3 },
});

/**
 * Deep equality for JSON-like values (plain objects, arrays, primitives).
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The parts of `value` that differ from `base`. Plain objects are compared
 * key by key (recursively); arrays and primitives are kept whole when they
 * differ. Keys that are not in `base` are ignored.
 * @param {Record<string, unknown>} value
 * @param {Record<string, unknown>} base
 * @returns {Record<string, unknown>}
 */
function diff(value, base) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(base)) {
    const v = value[key];
    const b = base[key];
    if (isPlainObject(v) && isPlainObject(b)) {
      const nested = diff(v, b);
      if (Object.keys(nested).length > 0) out[key] = nested;
    } else if (!jsonEqual(v, b)) {
      out[key] = v;
    }
  }
  return out;
}

/**
 * The inputs that differ from {@link DEFAULT_INPUTS}, as a nested partial.
 * The inputs are normalized first. Defaults give `{}`.
 *
 * @param {unknown} inputs
 * @returns {Record<string, unknown>}
 */
export function diffInputs(inputs) {
  return diff(normalizeInputs(inputs), DEFAULT_INPUTS);
}

/**
 * @param {string} text
 * @returns {string} base64url without padding
 */
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * @param {string} encoded  base64url (padding optional; standard base64 also works)
 * @returns {string}  The decoded UTF-8 text. Throws on invalid input.
 */
function fromBase64Url(encoded) {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Encodes inputs into a URL-safe string for the `?s=` parameter. Only the
 * fields that differ from the defaults are stored, so the default inputs
 * encode to the minimal payload `{"v":4}`.
 *
 * @param {unknown} inputs  Usually the provider's inputs; normalized first.
 * @returns {string}
 */
export function encodeShareState(inputs) {
  return toBase64Url(JSON.stringify({ v: SHARE_VERSION, ...diffInputs(inputs) }));
}

/**
 * Decodes a string made by {@link encodeShareState} (v4) or by the v3 codec
 * into complete, normalized v4 inputs. A v3 payload is merged onto the v3
 * defaults and migrated by `normalizeInputs`. Returns `null` when the string
 * is not a valid v4 or v3 share payload (not a string, not base64url, not
 * UTF-8 JSON, not an object, or another version such as an old v2 link).
 *
 * @param {unknown} encoded
 * @returns {import('../domain/plan').PlanInputs | null}
 */
export function decodeShareState(encoded) {
  if (typeof encoded !== 'string' || encoded.trim() === '') return null;
  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encoded.trim()));
  } catch {
    return null;
  }
  if (!isPlainObject(payload)) return null;
  const { v, ...partial } = payload;
  if (v === SHARE_VERSION) return normalizeInputs(partial);
  if (LEGACY_VERSIONS.includes(v)) return normalizeInputs(mergeDeep(V3_DEFAULT_INPUTS, partial));
  return null;
}
