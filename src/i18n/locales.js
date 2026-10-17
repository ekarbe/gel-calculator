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
 * The languages the UI speaks. Pure constants and helpers, shared by the
 * message catalogs (`./index.js`), the formatters (`./formatters.js`) and
 * the UI preferences (`src/state/prefs.js`).
 */

/** UI languages. English is the source language and the fallback. */
export const LOCALES = Object.freeze(['en', 'de']);

/** The language used when none (or an unknown one) is chosen. */
export const DEFAULT_LOCALE = 'en';

/**
 * BCP 47 tag used for `Intl` number and date formatting per locale. English
 * uses US conventions ("1,234.5"); German uses "1.234,5".
 * @type {Readonly<Record<'en'|'de', string>>}
 */
export const LOCALE_TAGS = Object.freeze({ en: 'en-US', de: 'de-DE' });

/**
 * The BCP 47 tag dates are written with for a UI language: the browser's
 * own tag when it is a region of that language that `Intl` knows (an en-GB
 * visitor reads "17 October 2026" and "17 Oct 2026, 07:20", an en-US one
 * "October 17, 2026" and "Oct 17, 2026, 7:20 AM"), else the language's tag
 * in {@link LOCALE_TAGS}. Numbers always use {@link LOCALE_TAGS}, so the
 * decimal separator never depends on the browser.
 * @param {unknown} locale  A UI language (`'en'`, `'de'`).
 * @param {unknown} browserLanguage  `navigator.language`, e.g. `'en-GB'`.
 * @returns {string}
 */
export function dateTagFor(locale, browserLanguage) {
  const lang = resolveLocale(locale);
  const fallback = LOCALE_TAGS[lang];
  if (typeof browserLanguage !== 'string') return fallback;
  const raw = browserLanguage.trim().replace(/_/g, '-');
  // Only a region of the UI language: German text never gets US dates, nor English text German ones.
  if (!new RegExp(`^${lang}-[a-z0-9]`, 'i').test(raw)) return fallback;
  try {
    const [supported] = Intl.DateTimeFormat.supportedLocalesOf(raw);
    return supported && supported.toLowerCase().startsWith(`${lang}-`) ? supported : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A supported locale: the value itself when it is one, else
 * {@link DEFAULT_LOCALE}.
 * @param {unknown} value
 * @returns {'en'|'de'}
 */
export function resolveLocale(value) {
  return typeof value === 'string' && LOCALES.includes(value) ? /** @type {'en'|'de'} */ (value) : DEFAULT_LOCALE;
}
