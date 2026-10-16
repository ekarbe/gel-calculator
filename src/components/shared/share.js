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
 * Share links and the clipboard, used by the share modal and the saved
 * recipes. Browser only: call these from event handlers, not while rendering.
 */

import { encodeShareState } from "../../state/shareCodec";

/**
 * The current page URL with `inputs` in the `s` parameter (share link v4).
 * @param {unknown} inputs
 * @returns {string}
 */
export function shareUrl(inputs) {
  const url = new URL(window.location.href);
  url.searchParams.set("s", encodeShareState(inputs));
  return url.toString();
}

/**
 * Copies text to the clipboard. Uses the Clipboard API when the browser has
 * it, otherwise a hidden textarea with `execCommand('copy')`.
 * @param {string} text
 * @returns {Promise<boolean>} Whether the text was copied.
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or not focused: try the fallback below.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-999999px";
  document.body.append(area);
  area.select();
  try {
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
