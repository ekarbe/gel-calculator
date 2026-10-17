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
 * Small helpers for plain data objects, shared by the plan and the state
 * layer. Pure: no React, no DOM.
 */

/**
 * Whether `value` is a plain object (`{}` or `Object.create(null)`), not an
 * array, `null`, a class instance or a primitive.
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively freezes plain objects and arrays.
 * @template T
 * @param {T} value
 * @returns {T} The same value, frozen.
 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Deep-merges `partial` onto `base`: plain objects merge key by key, anything
 * else (arrays included) replaces. A `partial` that is not a plain object
 * leaves `base` unchanged. An own `__proto__` key (from JSON) is skipped, so
 * it never sets the prototype. Neither argument is changed.
 * @param {unknown} base
 * @param {unknown} partial
 * @returns {unknown}
 */
export function mergeDeep(base, partial) {
  if (!isPlainObject(partial)) return base;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(partial)) {
    if (key === '__proto__') continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? mergeDeep(out[key], value) : value;
  }
  return out;
}
