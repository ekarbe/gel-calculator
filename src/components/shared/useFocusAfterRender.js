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

import { useCallback, useEffect, useRef } from "react";

/**
 * Moves focus to an element by id after the next render. Handlers call the
 * returned function before they change state; once the change is on screen
 * (the element may only exist after that render) the first of the given ids
 * whose element exists and is not disabled gets the focus. So a form that
 * closes, or a row that goes away, never drops keyboard focus to the page.
 * @returns {(...ids: string[]) => void}
 */
export default function useFocusAfterRender() {
  const pending = useRef(/** @type {string[]|null} */ (null));
  useEffect(() => {
    const targets = pending.current;
    if (targets === null) return;
    pending.current = null;
    for (const id of targets) {
      const element = document.getElementById(id);
      if (element && !element.disabled) {
        element.focus();
        return;
      }
    }
  });
  return useCallback((...ids) => {
    pending.current = ids;
  }, []);
}
