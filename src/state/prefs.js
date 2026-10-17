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
 * UI preferences (language, unit system, currency, mode): their allowed
 * values, the defaults for a browser language, validation, and storage in
 * `localStorage` under {@link PREFS_KEY}, separate from the plan (they are
 * never part of a share link). The theme is stored by next-themes itself.
 *
 * No React. Every storage access is in try/catch: when storage is missing,
 * blocked, full or throws, `loadPrefs` returns `null` and `savePrefs`
 * `false`; they never throw. Stored JSON that cannot be parsed counts as no
 * stored prefs.
 */

import { LOCALES } from '../i18n/locales';
import { UNIT_SYSTEMS } from '../domain/units';
import { CURRENCIES } from '../domain/cost';

/** localStorage key of the stored prefs (JSON `{ locale, unitSystem, currency, mode }`). */
export const PREFS_KEY = 'gel-calculator:prefs';

/** UI modes: the four-step guided flow or the full expert layout. */
export const MODES = Object.freeze(['guided', 'expert']);

/** Phone tabs of the expert layout. */
export const BOARD_TABS = Object.freeze(['board', 'setup', 'schedule']);

/** Number of guided steps (`guidedStep` is 0 to `GUIDED_STEP_COUNT − 1`). */
export const GUIDED_STEP_COUNT = 4;

/**
 * @typedef {Object} Prefs
 * @property {'en'|'de'} locale
 * @property {'metric'|'imperial'} unitSystem
 * @property {'EUR'|'USD'|'GBP'} currency
 * @property {'guided'|'expert'} mode
 */

/**
 * Prefs before anything is known (server render, first client render, and
 * outside a `UiProvider`): English, metric, EUR, expert.
 * @type {Readonly<Prefs>}
 */
export const DEFAULT_PREFS = Object.freeze({ locale: 'en', unitSystem: 'metric', currency: 'EUR', mode: 'expert' });

/** The allowed values per stored field (one list, for loading, normalizing and setting a pref). */
export const PREF_VALUES = Object.freeze({ locale: LOCALES, unitSystem: UNIT_SYSTEMS, currency: CURRENCIES, mode: MODES });

/**
 * Language, units and currency for a browser language (`navigator.language`):
 * `de*` → German, metric, EUR; `en-US` → English, imperial, USD; `en-GB` →
 * English, metric, GBP; anything else → English, metric, EUR. Case and `_`
 * versus `-` do not matter.
 * @param {unknown} language
 * @returns {{ locale: 'en'|'de', unitSystem: 'metric'|'imperial', currency: 'EUR'|'USD'|'GBP' }}
 */
export function prefsForLanguage(language) {
  const tag = typeof language === 'string' ? language.trim().toLowerCase().replace(/_/g, '-') : '';
  if (tag === 'de' || tag.startsWith('de-')) return { locale: 'de', unitSystem: 'metric', currency: 'EUR' };
  if (tag === 'en-us') return { locale: 'en', unitSystem: 'imperial', currency: 'USD' };
  if (tag === 'en-gb') return { locale: 'en', unitSystem: 'metric', currency: 'GBP' };
  return { locale: 'en', unitSystem: 'metric', currency: 'EUR' };
}

/**
 * Complete, valid prefs: each field of `value` when it is allowed, else the
 * field of `fallback` (else {@link DEFAULT_PREFS}). Unknown fields are dropped.
 * @param {unknown} value
 * @param {Partial<Prefs>} [fallback]
 * @returns {Prefs}
 */
export function normalizePrefs(value, fallback = DEFAULT_PREFS) {
  const source = value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {};
  /** @type {Record<string, unknown>} */
  const result = {};
  for (const [field, allowed] of Object.entries(PREF_VALUES)) {
    const candidates = [source[field], fallback?.[field], DEFAULT_PREFS[field]];
    result[field] = candidates.find((candidate) => allowed.includes(/** @type {any} */ (candidate)));
  }
  return /** @type {Prefs} */ (result);
}

/**
 * The browser's localStorage, or `null` when it is missing or access throws.
 * @returns {Storage|null}
 */
function getStorage() {
  try {
    const storage = globalThis.localStorage;
    return storage && typeof storage.getItem === 'function' ? storage : null;
  } catch {
    return null;
  }
}

/**
 * The stored prefs: only the fields that hold an allowed value (an older or
 * damaged entry keeps what is still valid). `null` when nothing usable is
 * stored or storage cannot be read, which counts as a first visit.
 * @returns {Partial<Prefs>|null}
 */
export function loadPrefs() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    /** @type {Record<string, unknown>} */
    const valid = {};
    for (const [field, allowed] of Object.entries(PREF_VALUES)) {
      if (allowed.includes(parsed[field])) valid[field] = parsed[field];
    }
    return /** @type {Partial<Prefs>} */ (valid);
  } catch {
    return null;
  }
}

/**
 * Stores the prefs (normalized; only `locale`, `unitSystem`, `currency` and
 * `mode`).
 * @param {Partial<Prefs>} prefs
 * @returns {boolean}  Whether they were stored.
 */
export function savePrefs(prefs) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(normalizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}
