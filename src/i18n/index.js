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
 * Message catalog and translation helper.
 *
 * Domain modules return message descriptors (`{ key, params }`); the UI turns
 * them into text with {@link t}. Each module's English text lives in
 * `src/i18n/en/<module>.js`. The catalogs are imported one by one because
 * Next/Turbopack has no `import.meta.glob`; add new catalogs to `CATALOGS`.
 */

import bicarb from './en/bicarb';
import caffeine from './en/caffeine';
import carbs from './en/carbs';
import electrolytes from './en/electrolytes';
import fluid from './en/fluid';
import plan from './en/plan';
import recipe from './en/recipe';
import schedule from './en/schedule';
import sweat from './en/sweat';

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */

/**
 * The English catalogs by module name, as imported. Exported for tests (for
 * example to check that no two catalogs define the same key).
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const CATALOGS = Object.freeze({
  bicarb,
  caffeine,
  carbs,
  electrolytes,
  fluid,
  plan,
  recipe,
  schedule,
  sweat,
});

/**
 * All English messages merged into one flat, frozen object keyed by message key.
 * @type {Readonly<Record<string, string>>}
 */
export const MESSAGES = Object.freeze(Object.assign({}, ...Object.values(CATALOGS)));

/** Keys already reported as missing, so each is logged once. */
const reportedMissing = new Set();

/**
 * Whether the catalog has text for `key`.
 * @param {unknown} key
 * @returns {boolean}
 */
export function hasMessage(key) {
  return typeof key === 'string' && Object.hasOwn(MESSAGES, key);
}

/**
 * Formats one placeholder value: numbers with `toLocaleString('en-US')`
 * (thousands separators, up to 3 decimals), everything else with `String`.
 * @param {unknown} value
 * @returns {string}
 */
function formatParam(value) {
  return typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
}

/**
 * Logs a missing key once per key, outside production builds.
 * @param {string} key
 */
function reportMissing(key) {
  if (reportedMissing.has(key)) return;
  reportedMissing.add(key);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[i18n] Missing message: ${key}`);
  }
}

/**
 * Returns the text for a message.
 *
 * Accepts a message descriptor (`{ key, params }`, as the domain modules
 * return) or a key string. `params` passed as the second argument are merged
 * over the descriptor's own params. `{name}` placeholders are replaced by the
 * matching param; numbers are formatted with `toLocaleString('en-US')`,
 * strings are used as they are. Placeholders without a param (or with a
 * `null`/`undefined` param) stay as written.
 *
 * A key that is not in the catalog returns the key itself and logs a warning
 * once per key outside production. A value that is neither a string nor a
 * descriptor returns `''`.
 *
 * @param {Message|string|null|undefined} messageOrKey
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(messageOrKey, params) {
  let key;
  let values;
  if (typeof messageOrKey === 'string') {
    key = messageOrKey;
    values = params;
  } else if (messageOrKey && typeof messageOrKey === 'object' && typeof messageOrKey.key === 'string') {
    key = messageOrKey.key;
    values = { ...messageOrKey.params, ...params };
  } else {
    return '';
  }

  if (!hasMessage(key)) {
    reportMissing(key);
    return key;
  }

  const template = MESSAGES[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) && values[name] != null ? formatParam(values[name]) : match,
  );
}
