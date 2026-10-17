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
 * Share links, the clipboard and recipe names, for the share and My recipes
 * dialogs. Browser only: call the link and clipboard helpers from event
 * handlers or from content that renders only while a dialog is open, not
 * while the server renders the page.
 */

import { encodeShareState } from '../../state/shareCodec';
import { MAX_RECIPE_NAME_LENGTH } from '../../state/storage';

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */

/**
 * The current page URL with `inputs` in the `s` parameter (share link v4);
 * other parameters stay.
 * @param {unknown} inputs
 * @returns {string}
 */
export function shareUrl(inputs) {
  const url = new URL(window.location.href);
  url.searchParams.set('s', encodeShareState(inputs));
  return url.toString();
}

/**
 * Copies text to the clipboard. Uses the Clipboard API when the browser has
 * it, otherwise (or when it refuses) a hidden textarea with
 * `execCommand('copy')`.
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
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-999999px';
  // Inside an open modal dialog, so the selection is not in the inert page.
  const host = document.querySelector('dialog[open]') ?? document.body;
  host.append(area);
  area.select();
  try {
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Splits text into the characters a person sees (grapheme clusters where
 * `Intl.Segmenter` exists, code points otherwise), as the recipe storage
 * counts them.
 * @param {string} text
 * @returns {string[]}
 */
function splitChars(text) {
  const Segmenter = globalThis.Intl?.Segmenter;
  if (typeof Segmenter === 'function') {
    try {
      return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
    } catch {
      // Fall back to code points.
    }
  }
  return Array.from(text);
}

/**
 * The name a recipe saved or renamed with `name` gets: the name itself, or
 * the "Untitled recipe" of the UI language when it is empty after trimming.
 * The storage trims and cuts it.
 * @param {TranslateFn} t
 * @param {unknown} name
 * @returns {string}
 */
export function recipeNameOrUntitled(t, name) {
  return typeof name === 'string' && name.trim() !== '' ? name : t('ui-dialogs.recipes.untitled');
}

/**
 * The name of a copy of a recipe in the UI language ("Long ride (copy)"),
 * with the original name cut first so the whole addition fits in
 * {@link MAX_RECIPE_NAME_LENGTH} characters.
 * @param {TranslateFn} t
 * @param {string} name
 * @returns {string}
 */
export function copyName(t, name) {
  const original = splitChars(String(name ?? '').trim());
  const extra = splitChars(t('ui-dialogs.recipes.copyName', { name: '' })).length;
  const room = Math.max(1, MAX_RECIPE_NAME_LENGTH - extra);
  const cut = original.length > room ? original.slice(0, room).join('').replace(/[\s‍]+$/u, '') : original.join('');
  return t('ui-dialogs.recipes.copyName', { name: cut });
}
