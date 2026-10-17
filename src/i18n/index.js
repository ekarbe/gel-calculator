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
 * Message catalogs and translation.
 *
 * Domain modules return message descriptors (`{ key, params }`); the UI turns
 * them into text with a translate function from {@link createT} (in React:
 * `useT()` from `./useT.js`, which follows the UI preferences). The module
 * level {@link t} is English with metric units, for non-React callers and
 * tests. This module has no React and no browser dependency.
 *
 * Catalogs live in `src/i18n/<locale>/<namespace>.js`: one per domain module
 * (`carbs`, `fluid`, …) and one per UI area (`ui-common`, `ui-board`, …).
 * Every key starts with its namespace and a dot (`ui-board.kpi.carbs`). They
 * are imported one by one because Next/Turbopack has no `import.meta.glob`:
 * register a new catalog in `EN_CATALOGS` / `DE_CATALOGS` below. A key
 * missing in German falls back to English (with a warning once per key
 * outside production).
 *
 * Placeholders:
 * - `{name}`: a number in the locale's format (up to 3 decimals, thousands
 *   separators, a real minus sign "−"), a string as it is.
 * - `{name:type}`: a typed quantity, converted to the unit system and written
 *   with its unit. Values come in the plan's metric units:
 *   `volume` (ml → "800 ml" / "27 fl oz"), `volumeL` (L → "1.25 L" /
 *   "42 fl oz"), `mass` (kg → "70 kg" / "154.3 lb"), `temp` (°C → "20 °C" /
 *   "68 °F"), `speed` (km/h → "30 km/h" / "18.6 mph"), `pace` (min/km →
 *   "4:30 min/km" / "7:15 min/mi"), `height` (cm → "175 cm" / "5 ft 9 in"),
 *   `percent` (60 → "60%" / "60 %"), `ratio` ("1:0.5" → "1:0,5" in German),
 *   `integer`, `currency` (in the chosen currency). Nutrients (g, mg, mg/L,
 *   kcal) are plain numbers with the unit written in the text.
 * - `{name:type:nounit}`: the converted number without its unit, for ranges:
 *   `{lo:volumeL:nounit}–{hi:volumeL}/h` → "0.65–1.65 L/h" / "22–56 fl oz/h".
 * In metric, quantities show the value as given (up to 3 decimals), so the
 * English text reads exactly as before the types were added; in imperial
 * the converted value is rounded per kind (`./formatters.js`).
 * A placeholder without a value (or with `null`/`undefined`) stays as written.
 */

import bicarb from './en/bicarb';
import caffeine from './en/caffeine';
import carbs from './en/carbs';
import concentration from './en/concentration';
import electrolytes from './en/electrolytes';
import fluid from './en/fluid';
import plan from './en/plan';
import recipe from './en/recipe';
import schedule from './en/schedule';
import sweat from './en/sweat';
import uiCommon from './en/ui-common';
import uiSetup from './en/ui-setup';
import uiSetupEvent from './en/ui-setup-event';
import uiSetupSweat from './en/ui-setup-sweat';
import uiSetupTargets from './en/ui-setup-targets';
import uiSetupRecipe from './en/ui-setup-recipe';
import uiRecipe from './en/ui-recipe';
import uiBoard from './en/ui-board';
import uiSchedule from './en/ui-schedule';
import uiPrint from './en/ui-print';
import uiDialogs from './en/ui-dialogs';
import uiGuided from './en/ui-guided';
import uiShell from './en/ui-shell';
import deBicarb from './de/bicarb';
import deCaffeine from './de/caffeine';
import deCarbs from './de/carbs';
import deConcentration from './de/concentration';
import deElectrolytes from './de/electrolytes';
import deFluid from './de/fluid';
import dePlan from './de/plan';
import deRecipe from './de/recipe';
import deSchedule from './de/schedule';
import deSweat from './de/sweat';
import deUiCommon from './de/ui-common';
import deUiSetup from './de/ui-setup';
import deUiSetupEvent from './de/ui-setup-event';
import deUiSetupSweat from './de/ui-setup-sweat';
import deUiSetupTargets from './de/ui-setup-targets';
import deUiSetupRecipe from './de/ui-setup-recipe';
import deUiRecipe from './de/ui-recipe';
import deUiBoard from './de/ui-board';
import deUiSchedule from './de/ui-schedule';
import deUiPrint from './de/ui-print';
import deUiDialogs from './de/ui-dialogs';
import deUiGuided from './de/ui-guided';
import deUiShell from './de/ui-shell';
import { DEFAULT_LOCALE, resolveLocale } from './locales';
import { createFormat } from './formatters';

export { LOCALES, DEFAULT_LOCALE, LOCALE_TAGS, resolveLocale } from './locales';

/** @typedef {{ key: string, params?: Record<string, unknown> }} Message */

/**
 * A translate function: text for a message descriptor or key, in one locale
 * and unit system.
 * @typedef {((messageOrKey: Message|string|null|undefined, params?: Record<string, unknown>) => string)
 *   & { locale: 'en'|'de', unitSystem: 'metric'|'imperial', currency: 'EUR'|'USD'|'GBP' }} TranslateFn
 */

/**
 * The English catalogs by namespace (domain modules first, then UI areas).
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const EN_CATALOGS = Object.freeze({
  bicarb,
  caffeine,
  carbs,
  concentration,
  electrolytes,
  fluid,
  plan,
  recipe,
  schedule,
  sweat,
  'ui-common': uiCommon,
  'ui-setup': uiSetup,
  'ui-setup-event': uiSetupEvent,
  'ui-setup-sweat': uiSetupSweat,
  'ui-setup-targets': uiSetupTargets,
  'ui-setup-recipe': uiSetupRecipe,
  'ui-recipe': uiRecipe,
  'ui-board': uiBoard,
  'ui-schedule': uiSchedule,
  'ui-print': uiPrint,
  'ui-dialogs': uiDialogs,
  'ui-guided': uiGuided,
  'ui-shell': uiShell,
});

/**
 * The German catalogs by namespace: one twin per English catalog, with the
 * same keys and placeholders (`./index.test.js` checks the parity). A key
 * that is ever missing here still falls back to English.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const DE_CATALOGS = Object.freeze({
  bicarb: deBicarb,
  caffeine: deCaffeine,
  carbs: deCarbs,
  concentration: deConcentration,
  electrolytes: deElectrolytes,
  fluid: deFluid,
  plan: dePlan,
  recipe: deRecipe,
  schedule: deSchedule,
  sweat: deSweat,
  'ui-common': deUiCommon,
  'ui-setup': deUiSetup,
  'ui-setup-event': deUiSetupEvent,
  'ui-setup-sweat': deUiSetupSweat,
  'ui-setup-targets': deUiSetupTargets,
  'ui-setup-recipe': deUiSetupRecipe,
  'ui-recipe': deUiRecipe,
  'ui-board': deUiBoard,
  'ui-schedule': deUiSchedule,
  'ui-print': deUiPrint,
  'ui-dialogs': deUiDialogs,
  'ui-guided': deUiGuided,
  'ui-shell': deUiShell,
});

/**
 * The English catalogs by namespace, as imported. Exported for tests (for
 * example to check that no two catalogs define the same key).
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const CATALOGS = EN_CATALOGS;

/**
 * Catalogs by locale, then namespace.
 * @type {Readonly<Record<'en'|'de', Readonly<Record<string, Readonly<Record<string, string>>>>>>}
 */
export const LOCALE_CATALOGS = Object.freeze({ en: EN_CATALOGS, de: DE_CATALOGS });

/**
 * Merges a locale's catalogs into one flat, frozen object keyed by message key.
 * @param {Readonly<Record<string, Readonly<Record<string, string>>>>} catalogs
 * @returns {Readonly<Record<string, string>>}
 */
const flatten = (catalogs) => Object.freeze(Object.assign({}, ...Object.values(catalogs)));

/**
 * All English messages merged into one flat, frozen object keyed by message key.
 * @type {Readonly<Record<string, string>>}
 */
export const MESSAGES = flatten(EN_CATALOGS);

/**
 * Flat messages per locale.
 * @type {Readonly<Record<'en'|'de', Readonly<Record<string, string>>>>}
 */
export const LOCALE_MESSAGES = Object.freeze({ en: MESSAGES, de: flatten(DE_CATALOGS) });

/**
 * Whether a locale's catalog has its own text for `key` (no fallback).
 * @param {unknown} key
 * @param {string} [locale='en']
 * @returns {boolean}
 */
export function hasMessage(key, locale = DEFAULT_LOCALE) {
  return typeof key === 'string' && Object.hasOwn(LOCALE_MESSAGES[resolveLocale(locale)], key);
}

/** Matches `{name}`, `{name:type}` and `{name:type:nounit}`. */
const PLACEHOLDER = /\{(\w+)((?::\w+)*)\}/g;

/**
 * The placeholders of a message text, as written without the braces
 * (`'mlPerHour:volume'`), in order of appearance. For tests that compare the
 * placeholders of two catalogs or of a message and its params.
 * @param {string} text
 * @returns {string[]}
 */
export function placeholdersOf(text) {
  return typeof text === 'string' ? [...text.matchAll(PLACEHOLDER)].map((m) => `${m[1]}${m[2]}`) : [];
}

/**
 * The parameter names a message text uses (`'mlPerHour'` for
 * `{mlPerHour:volume}`), in order of appearance.
 * @param {string} text
 * @returns {string[]}
 */
export function placeholderNames(text) {
  return typeof text === 'string' ? [...text.matchAll(PLACEHOLDER)].map((m) => m[1]) : [];
}

/** The placeholder types {@link createT} understands. */
export const PLACEHOLDER_TYPES = Object.freeze([
  'volume',
  'volumeL',
  'mass',
  'temp',
  'speed',
  'pace',
  'height',
  'percent',
  'ratio',
  'integer',
  'currency',
]);

/** Messages already reported as missing (`locale:key`), so each is logged once. */
const reportedMissing = new Set();

/**
 * Logs a missing message once per locale and key, outside production builds.
 * @param {string} locale
 * @param {string} key
 * @param {boolean} fellBack  True when English text was used instead.
 */
function reportMissing(locale, key, fellBack) {
  const id = `${locale}:${key}`;
  if (reportedMissing.has(id)) return;
  reportedMissing.add(id);
  if (process.env.NODE_ENV !== 'production') {
    console.warn(fellBack ? `[i18n] Missing ${locale} message: ${key} (using en)` : `[i18n] Missing message: ${key}`);
  }
}

/**
 * A param as a number, when it is one or a numeric string; else `null`.
 * @param {unknown} value
 * @returns {number|null}
 */
function asNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/**
 * Formats one placeholder value.
 * @param {import('./formatters').Formatters} format
 * @param {unknown} value
 * @param {string|undefined} type
 * @param {string[]} flags
 * @returns {string}
 */
function formatParam(format, value, type, flags) {
  if (type === 'ratio') {
    return typeof value === 'string' || (value && typeof value === 'object') ? format.ratio(/** @type {any} */ (value)) : String(value);
  }
  const n = typeof value === 'number' || type ? asNumber(value) : null;
  if (n === null) return String(value);
  // Metric shows the value as given (up to 3 decimals), exactly as the
  // English text did before the types existed; imperial rounds per kind.
  const asGiven = format.unitSystem === 'metric' ? { digits: 3 } : {};
  const unit = !flags.includes('nounit');
  switch (type) {
    case undefined:
      return format.number(n, 3);
    case 'integer':
      return format.integer(n);
    case 'percent':
      return format.percent(n, { digits: 3 });
    case 'currency':
      return format.currency(n);
    case 'pace':
      return format.pace(n, { unit });
    case 'volume':
    case 'volumeL':
    case 'mass':
    case 'temp':
    case 'speed':
    case 'height':
      return format[type](n, { ...asGiven, unit });
    default:
      return format.number(n, 3);
  }
}

/**
 * Fills the placeholders of `template` with `params` (see the module
 * comment), formatted for a locale, unit system and currency. Placeholders
 * without a value stay as written. Used by every translate function; also
 * useful for a template that is not in a catalog (tests, composed labels).
 *
 * @param {string} template
 * @param {Record<string, unknown>|null|undefined} params
 * @param {{ locale?: string, unitSystem?: string, currency?: string }} [options]  Default English, metric, EUR.
 * @returns {string}
 */
export function fillPlaceholders(template, params, { locale, unitSystem, currency } = {}) {
  return fill(createFormat(locale, { unitSystem, currency }), String(template), params);
}

/**
 * @param {import('./formatters').Formatters} format
 * @param {string} template
 * @param {Record<string, unknown>|null|undefined} values
 * @returns {string}
 */
function fill(format, template, values) {
  if (!values) return template;
  return template.replace(PLACEHOLDER, (match, name, modifiers) => {
    if (!Object.hasOwn(values, name) || values[name] == null) return match;
    const [type, ...flags] = modifiers.split(':').filter(Boolean);
    return formatParam(format, values[name], type, flags);
  });
}

/** Translate functions by locale, unit system and currency. */
const translators = new Map();

/**
 * Creates (or returns the cached) translate function for a locale and unit
 * system.
 *
 * `t(messageOrKey, params)` accepts a message descriptor (`{ key, params }`,
 * as the domain modules return) or a key string. `params` passed as the
 * second argument are merged over the descriptor's own params. Placeholders
 * are filled as described in the module comment. A key the locale lacks uses
 * the English text (logged once outside production); a key no catalog has
 * returns the key itself (logged once). A value that is neither a string nor
 * a descriptor returns `''`.
 *
 * @param {string} [locale='en']  `'en'` or `'de'`; anything else is English.
 * @param {{ unitSystem?: 'metric'|'imperial', currency?: 'EUR'|'USD'|'GBP' }} [options]
 *   Unit system for typed quantities (default metric) and currency for `{x:currency}` (default EUR).
 * @returns {TranslateFn}
 */
export function createT(locale = DEFAULT_LOCALE, { unitSystem = 'metric', currency = 'EUR' } = {}) {
  const format = createFormat(locale, { unitSystem, currency });
  const id = `${format.locale}|${format.unitSystem}|${format.currencyCode}`;
  const cached = translators.get(id);
  if (cached) return cached;

  const messages = LOCALE_MESSAGES[format.locale];
  /** @type {any} */
  const translate = (messageOrKey, params) => {
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

    let template;
    if (Object.hasOwn(messages, key)) {
      template = messages[key];
    } else if (Object.hasOwn(MESSAGES, key)) {
      reportMissing(format.locale, key, true);
      template = MESSAGES[key];
    } else {
      reportMissing(format.locale, key, false);
      return key;
    }

    return fill(format, template, values);
  };
  translate.locale = format.locale;
  translate.unitSystem = format.unitSystem;
  translate.currency = format.currencyCode;
  const fn = /** @type {TranslateFn} */ (Object.freeze(translate));
  translators.set(id, fn);
  return fn;
}

/**
 * English text with metric units, for code outside React and for tests.
 * Components use `useT()` (`./useT.js`) so the text follows the chosen
 * language and units.
 * @type {TranslateFn}
 */
export const t = createT(DEFAULT_LOCALE, { unitSystem: 'metric' });
