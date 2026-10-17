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
 * Locale- and unit-aware formatting of numbers and quantities, without React.
 *
 * `createFormat(locale, { unitSystem, currency })` returns the formatter set
 * that `useFormat()` (`./format.js`) hands to components and that `createT`
 * (`./index.js`) uses for typed message placeholders. Values always come in
 * the plan's metric units (kg, cm, °C, km/h, min/km, ml, L); the imperial
 * system converts them for display (`src/domain/units.js`). Nutrient amounts
 * (g, mg, mg/L, kcal) are never converted.
 *
 * Conventions every formatter follows:
 * - Missing or non-finite numbers count as 0 (like `fmt` before).
 * - Values are rounded to the formatter's digits first, so a value that
 *   shows as zero never has a sign; negative values use a real minus sign
 *   (U+2212). `signed: true` adds "+" to positive values.
 * - A number and its unit are separated by a plain space ("800 ml"), so the
 *   English text matches the catalogs character for character.
 */

import { LOCALE_TAGS, dateTagFor, resolveLocale } from './locales';
import {
  cmToFtIn,
  isImperial,
  roundTo,
  splitMinutes,
  toUnitSystem,
  fromUnitSystem,
} from '../domain/units';
import { formatRatio } from '../domain/carbs';
import { CURRENCIES, DEFAULT_CURRENCY } from '../domain/cost';

/** The minus sign every signed number in the app uses (U+2212), not a hyphen. */
export const MINUS = '−';

/** No-break space, used before "%" in German ("60 %"). */
const NBSP = ' ';

/**
 * Unit symbols per quantity kind and system. The same in every language.
 * @type {Readonly<Record<string, Readonly<{ metric: string, imperial: string }>>>}
 */
export const UNIT_SYMBOLS = Object.freeze({
  mass: Object.freeze({ metric: 'kg', imperial: 'lb' }),
  height: Object.freeze({ metric: 'cm', imperial: 'in' }),
  temp: Object.freeze({ metric: '°C', imperial: '°F' }),
  speed: Object.freeze({ metric: 'km/h', imperial: 'mph' }),
  pace: Object.freeze({ metric: 'min/km', imperial: 'min/mi' }),
  volume: Object.freeze({ metric: 'ml', imperial: 'fl oz' }),
  volumeL: Object.freeze({ metric: 'L', imperial: 'fl oz' }),
});

/**
 * Decimals a number field shows for a converted (imperial) value, per kind:
 * 154.3 lb, 68.9 in, 68 °F, 18.6 mph, 25.4 fl oz. Metric fields show the
 * stored value as it is.
 */
export const INPUT_DIGITS = Object.freeze({ mass: 1, height: 1, temp: 1, speed: 1, pace: 2, volume: 1, volumeL: 1 });

/**
 * Default display decimals for a value of `kind` in `system` (the most
 * decimals shown; trailing zeros are dropped).
 * @param {string} kind
 * @param {boolean} imperial
 * @param {number} shown  The value in the displayed unit.
 * @returns {number}
 */
function defaultDigits(kind, imperial, shown) {
  switch (kind) {
    case 'mass':
    case 'temp':
    case 'speed':
      return 1;
    case 'height':
      return 0;
    case 'volume':
      return imperial ? (Math.abs(shown) < 10 ? 1 : 0) : 0;
    case 'volumeL':
      return imperial ? (Math.abs(shown) < 10 ? 1 : 0) : 2;
    default:
      return 1;
  }
}

/**
 * A finite number or 0 (missing, `NaN` and infinite values count as 0, the
 * rule every formatter and display helper follows).
 * @param {unknown} value
 * @returns {number}
 */
export const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * A fraction-digit count usable by `Intl.NumberFormat` (0–20).
 * @param {unknown} digits
 * @param {number} fallback
 * @returns {number}
 */
const clampDigits = (digits, fallback) =>
  typeof digits === 'number' && Number.isInteger(digits) ? Math.min(20, Math.max(0, digits)) : fallback;

/** `Intl.NumberFormat` instances, created once per tag and digit range. */
const numberFormats = new Map();

/**
 * @param {string} tag
 * @param {Intl.NumberFormatOptions} options
 * @returns {Intl.NumberFormat}
 */
function numberFormat(tag, options) {
  const key = `${tag}|${JSON.stringify(options)}`;
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(tag, options);
    numberFormats.set(key, format);
  }
  return format;
}

/**
 * @typedef {Object} NumberOptions
 * @property {number} [digits]  Most decimals shown (default 0 for `number`; per kind for quantities).
 * @property {number} [minDigits]  Fewest decimals shown (default 0: trailing zeros dropped).
 * @property {boolean} [signed]  Prefix positive values with "+".
 */

/**
 * @typedef {NumberOptions & { unit?: boolean }} QuantityOptions
 *   `unit: false` returns the converted, rounded number without its unit (for ranges such as
 *   "0.65–1.65 L/h" or table cells under a unit heading).
 */

/**
 * Formats a number in a locale (see the module conventions).
 * @param {string} tag  BCP 47 tag.
 * @param {unknown} value
 * @param {NumberOptions} [options]
 * @returns {string}
 */
function formatNumber(tag, value, { digits, minDigits, signed = false } = {}) {
  const max = clampDigits(digits, 0);
  const min = Math.min(clampDigits(minDigits, 0), max);
  const rounded = roundTo(finite(value), max);
  const text = numberFormat(tag, { minimumFractionDigits: min, maximumFractionDigits: max }).format(Math.abs(rounded));
  if (rounded < 0) return `${MINUS}${text}`;
  return signed && rounded > 0 ? `+${text}` : text;
}

/**
 * Turns the second argument of `number(value, digitsOrOptions)` into options.
 * @param {number|NumberOptions|undefined} digitsOrOptions
 * @returns {NumberOptions}
 */
const toOptions = (digitsOrOptions) =>
  typeof digitsOrOptions === 'number' ? { digits: digitsOrOptions } : { ...digitsOrOptions };

/**
 * Parses a date for {@link Formatters.date}: a `Date`, a time stamp in ms, an
 * ISO string, or a plain `'YYYY-MM-DD'` day (read as a local date, so it
 * never shifts by a time zone). Anything else gives `null`.
 * @param {unknown} value
 * @returns {Date|null}
 */
function toDate(value) {
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number') date = new Date(value);
  else if (typeof value === 'string') {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  }
  return date && Number.isFinite(date.getTime()) ? date : null;
}

/**
 * The formatter set for one locale, unit system and currency.
 *
 * @typedef {Object} Formatters
 * @property {'en'|'de'} locale
 * @property {'metric'|'imperial'} unitSystem
 * @property {'EUR'|'USD'|'GBP'} currencyCode  The chosen currency (used by `currency()`).
 * @property {string} tag  The `Intl` tag of numbers (`'en-US'`, `'de-DE'`).
 * @property {string} dateTag  The `Intl` tag of dates: the visitor's region of the language (`'en-GB'`), else `tag`.
 * @property {(value: number, digitsOrOptions?: number|NumberOptions) => string} number
 *   Locale number; default 0 decimals (`number(1234.5, 1)` → "1,234.5" / "1.234,5").
 * @property {(value: number, options?: { signed?: boolean }) => string} integer  Rounded to a whole number.
 * @property {(kg: number, options?: QuantityOptions) => string} mass  "70 kg" / "154.3 lb" (1 decimal).
 * @property {(cm: number, options?: QuantityOptions & { inches?: boolean }) => string} height
 *   "175 cm" / "5 ft 9 in" (`inches: true` → "69 in"; `unit: false` → the number of cm or in).
 * @property {(celsius: number, options?: QuantityOptions) => string} temp  "20 °C" / "68 °F" (1 decimal).
 * @property {(kmh: number, options?: QuantityOptions) => string} speed  "30 km/h" / "18.6 mph" (1 decimal).
 * @property {(minPerKm: number, options?: { unit?: boolean }) => string} pace  "4:30 min/km" / "7:15 min/mi".
 * @property {(ml: number, options?: QuantityOptions) => string} volume
 *   "800 ml" / "27 fl oz" (whole ml; fl oz with 1 decimal below 10).
 * @property {(litres: number, options?: QuantityOptions) => string} volumeL  "1.25 L" / "42 fl oz" (2 decimals in L).
 * @property {(percent: number, options?: NumberOptions) => string} percent  A value in % (60 → "60%" / "60 %"); 1 decimal.
 * @property {(amount: number, options?: { digits?: number, currency?: string }) => string} currency
 *   "€3.15" / "3,15 €" in the chosen currency (2 decimals).
 * @property {(value: Date|number|string, options?: Intl.DateTimeFormatOptions) => string} date
 *   Locale date (default `{ dateStyle: 'medium' }`: "Oct 1, 2026" / "01.10.2026"); `''` when invalid.
 * @property {(ratio: string|{ glucose: number, fructose: number }) => string} ratio
 *   A glucose:fructose ratio as `formatRatio` writes it, with locale decimals ("1:0.5" / "1:0,5").
 * @property {(minutes: number) => string} duration  "45 min", "3 h", "2 h 30 min".
 * @property {(kind: string) => string} unit  The unit symbol of a quantity kind in this system ("lb", "fl oz").
 * @property {(kind: string, metricValue: number, options?: { digits?: number }) => number} toDisplay
 *   A stored metric value as the number a field shows: unchanged in metric, converted and rounded to
 *   {@link INPUT_DIGITS} in imperial. Use it as a `NumberField` `toInput` and for a field's min/max.
 * @property {(kind: string, shownValue: number) => number} fromDisplay
 *   A number typed in this system's unit back to the metric value the plan stores (exact). Use it
 *   as a `NumberField` `fromInput`.
 * @property {(value: number, digits?: number) => string} inputValue
 *   A number as an editable field shows it: locale decimal separator, no thousands separators, an
 *   ASCII "-" (default up to 3 decimals; non-finite → `''`).
 * @property {(text: string) => number} parseNumber
 *   Reads a number typed in this locale (see {@link parseLocaleNumber}); `NaN` when it is not one.
 */

/**
 * Reads a number typed by a person: "1.5", "1,5", "1,500", "1.500,5",
 * "−3" or "-3", " 70 ". Spaces (also no-break) are ignored. When both "."
 * and "," appear, the last one is the decimal separator. When only the
 * locale's thousands separator appears ("," in English, "." in German) it is
 * read as one only in a valid grouping ("1,500", "12.345.678": a first group
 * of 1–3 digits that does not start with 0); otherwise it is the decimal
 * separator, so "1,5" and "0,750" are 1.5 and 0.75 in English, and "1.5"
 * and "0.750" are 1.5 and 0.75 in German. Anything else (empty, letters, "1e3", two signs) gives `NaN`.
 *
 * @param {unknown} text
 * @param {'en'|'de'} [locale='en']
 * @returns {number}
 */
export function parseLocaleNumber(text, locale = 'en') {
  if (typeof text === 'number') return Number.isFinite(text) ? text : NaN;
  if (typeof text !== 'string') return NaN;
  let s = text.replace(/[\s\u00a0\u202f]/g, '').replace(/\u2212/g, '-');
  if (!/^[-+]?[\d.,]*\d[\d.,]*$/.test(s)) return NaN;
  const group = resolveLocale(locale) === 'de' ? '.' : ',';
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const other = decimal === '.' ? ',' : '.';
    s = s.split(other).join('');
    if (decimal === ',') s = s.replace(',', '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    // A grouped number never starts with a 0 group: "0,750" is 0.75, not 750.
    const grouping = new RegExp(`^[-+]?[1-9]\\d{0,2}(\\${sep}\\d{3})+$`);
    if (sep === group && grouping.test(s)) s = s.split(sep).join('');
    else if (sep === ',') s = s.replace(',', '.');
  }
  // Number() rejects what is left over: a second "." or a stray ",".
  return (s.match(/\./g) ?? []).length > 1 ? NaN : Number(s);
}

/** Formatter sets by locale, unit system and currency. */
const cache = new Map();

/**
 * Returns the (cached, frozen) formatter set for a locale, unit system and
 * currency. Unknown values fall back to English, metric and EUR.
 * `browserLanguage` (`navigator.language`) only picks how dates read
 * (`dateTagFor`): day first for an en-GB visitor, month first for en-US.
 *
 * @param {string} [locale]
 * @param {{ unitSystem?: string, currency?: string, browserLanguage?: string }} [options]
 * @returns {Formatters}
 */
export function createFormat(locale, { unitSystem, currency, browserLanguage } = {}) {
  const lang = resolveLocale(locale);
  const imperial = isImperial(unitSystem);
  const system = imperial ? 'imperial' : 'metric';
  const code = CURRENCIES.includes(/** @type {any} */ (currency)) ? /** @type {'EUR'|'USD'|'GBP'} */ (currency) : DEFAULT_CURRENCY;
  const dateTag = dateTagFor(lang, browserLanguage);
  const key = `${lang}|${system}|${code}|${dateTag}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const tag = LOCALE_TAGS[lang];
  const number = (value, digitsOrOptions) => formatNumber(tag, value, toOptions(digitsOrOptions));
  const unit = (kind) => UNIT_SYMBOLS[kind]?.[system] ?? '';

  /**
   * A metric value of `kind` in this system's unit, rounded, with its unit.
   * @param {string} kind
   * @param {unknown} value
   * @param {QuantityOptions} [options]
   */
  const quantity = (kind, value, options = {}) => {
    const shown = toUnitSystem(kind, finite(value), system);
    const digits = options.digits ?? defaultDigits(kind, imperial, shown);
    const text = formatNumber(tag, shown, { digits, minDigits: options.minDigits, signed: options.signed });
    return options.unit === false ? text : `${text} ${unit(kind)}`;
  };

  /** @type {Formatters} */
  const formatters = {
    locale: lang,
    unitSystem: system,
    currencyCode: code,
    tag,
    dateTag,
    number,
    integer: (value, { signed = false } = {}) => formatNumber(tag, value, { digits: 0, signed }),
    mass: (kg, options) => quantity('mass', kg, options),
    height: (cm, options = {}) => {
      if (!imperial || options.inches || options.unit === false) return quantity('height', cm, options);
      const { ft, in: inches } = cmToFtIn(finite(cm));
      const sign = finite(cm) < 0 && ft + inches > 0 ? MINUS : '';
      return `${sign}${formatNumber(tag, ft)} ft ${formatNumber(tag, inches)} in`;
    },
    temp: (celsius, options) => quantity('temp', celsius, options),
    speed: (kmh, options) => quantity('speed', kmh, options),
    pace: (minPerKm, options = {}) => {
      const { min, sec } = splitMinutes(toUnitSystem('pace', finite(minPerKm), system));
      const text = `${formatNumber(tag, min)}:${String(sec).padStart(2, '0')}`;
      return options.unit === false ? text : `${text} ${unit('pace')}`;
    },
    volume: (ml, options) => quantity('volume', ml, options),
    volumeL: (litres, options) => quantity('volumeL', litres, options),
    percent: (value, options = {}) => {
      const text = formatNumber(tag, value, { digits: 1, ...options });
      return lang === 'de' ? `${text}${NBSP}%` : `${text}%`;
    },
    currency: (amount, { digits = 2, currency: other } = {}) => {
      const currencyCode = CURRENCIES.includes(/** @type {any} */ (other)) ? other : code;
      const d = clampDigits(digits, 2);
      const rounded = roundTo(finite(amount), d);
      const text = numberFormat(tag, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(Math.abs(rounded));
      return rounded < 0 ? `${MINUS}${text}` : text;
    },
    date: (value, options = { dateStyle: 'medium' }) => {
      const date = toDate(value);
      return date ? new Intl.DateTimeFormat(dateTag, options).format(date) : '';
    },
    ratio: (ratio) => {
      const text = typeof ratio === 'string' ? ratio : formatRatio(ratio);
      return text
        .split(':')
        .map((part) => (/^\d+(\.\d+)?$/.test(part) ? formatNumber(tag, Number(part), { digits: 2 }) : part))
        .join(':');
    },
    duration: (minutes) => {
      const total = Math.max(0, Math.round(finite(minutes)));
      const hours = Math.floor(total / 60);
      const rest = total % 60;
      if (hours === 0) return `${formatNumber(tag, rest)} min`;
      return rest === 0 ? `${formatNumber(tag, hours)} h` : `${formatNumber(tag, hours)} h ${rest} min`;
    },
    unit,
    toDisplay: (kind, metricValue, { digits } = {}) => {
      if (!imperial) return digits === undefined ? finite(metricValue) : roundTo(metricValue, digits);
      return roundTo(toUnitSystem(kind, metricValue, system), digits ?? INPUT_DIGITS[kind] ?? 1);
    },
    fromDisplay: (kind, shownValue) => fromUnitSystem(kind, shownValue, system),
    inputValue: (value, digits = 3) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '';
      const d = clampDigits(digits, 3);
      const rounded = roundTo(value, d);
      const text = numberFormat(tag, { useGrouping: false, maximumFractionDigits: d }).format(Math.abs(rounded));
      return rounded < 0 ? `-${text}` : text;
    },
    parseNumber: (text) => parseLocaleNumber(text, lang),
  };
  Object.freeze(formatters);
  cache.set(key, formatters);
  return formatters;
}
