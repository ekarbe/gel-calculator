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
 * `useT()`: the translate function for the UI language and unit system the
 * user chose (`src/state/UiProvider.jsx` prefs). Outside a `UiProvider` it
 * is English with metric units, like the module-level `t`.
 */

import { usePrefs } from "../state/UiProvider";
import { createT } from "./index";

/**
 * The translate function for the current prefs: `t(messageOrKey, params)`
 * (see `createT` in `./index.js` for placeholders and fallback). It is
 * cached per locale, unit system and currency, so it is stable between
 * renders until a pref changes (safe in effect and memo dependencies).
 * `t.locale`, `t.unitSystem` and `t.currency` tell which ones it uses.
 *
 * @returns {import('./index').TranslateFn}
 */
export function useT() {
  const { locale, unitSystem, currency } = usePrefs();
  return createT(locale, { unitSystem, currency });
}

export default useT;
