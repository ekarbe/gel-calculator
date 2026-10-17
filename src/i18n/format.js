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


"use client";

/**
 * `useFormat()`: number, quantity, currency and date formatting for the UI
 * language, unit system and currency the user chose. The pure formatter set
 * (`createFormat`) lives in `./formatters.js` and is re-exported here for
 * code outside React (the print view, the share image, tests).
 */

import { useBrowserLanguage, usePrefs } from "../state/UiProvider";
import { createFormat } from "./formatters";

export { createFormat, MINUS, UNIT_SYMBOLS, INPUT_DIGITS } from "./formatters";

/**
 * The formatter set for the current prefs:
 * `{ number, integer, mass, height, temp, speed, pace, volume, volumeL,
 * percent, currency, date, ratio, duration, unit, toDisplay, fromDisplay }`
 * plus `locale`, `unitSystem`, `currencyCode` and `tag`. Values come in the
 * plan's metric units; imperial converts them for display. Dates follow the
 * visitor's region of the language (`navigator.language`: day first for
 * en-GB). Cached per locale, unit system, currency and date region, so it is
 * stable between renders. Outside a `UiProvider`: English, metric, EUR.
 *
 * @returns {import('./formatters').Formatters}
 */
export function useFormat() {
  const { locale, unitSystem, currency } = usePrefs();
  const browserLanguage = useBrowserLanguage();
  return createFormat(locale, { unitSystem, currency, browserLanguage });
}

export default useFormat;
