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
 * Autosave and saved recipes in the browser's `localStorage`.
 *
 * Inputs are stored as share strings (`encodeShareState`), the same format as
 * a `?s=` link, so stored data is small, versioned and read back through
 * `decodeShareState`, which normalizes it (and migrates older versions the
 * codec still accepts). Nothing here depends on the shape of the inputs.
 *
 * Every storage access is wrapped in try/catch: when storage is missing
 * (server render), blocked (privacy settings), full or throws for any other
 * reason, the functions return their "nothing" value (`null`, `[]`, `false`)
 * and never throw. Stored JSON that cannot be parsed counts as empty.
 *
 * Keys:
 * - `gel-calculator:autosave`: one share string, the last inputs.
 * - `gel-calculator:recipes`: JSON array of {@link SavedRecipe}, newest first.
 */

import { decodeShareState, encodeShareState } from './shareCodec';
import { isPlainObject } from '../domain/objects';

/** @typedef {import('../domain/plan').PlanInputs} PlanInputs */

/**
 * A saved recipe as stored and listed.
 * @typedef {Object} SavedRecipe
 * @property {string} id  `'r' + Date.now().toString(36) + counter`, unique in the list.
 * @property {string} name  1–60 characters, trimmed.
 * @property {string} savedAt  ISO 8601 time of saving (or duplicating), as
 *   `Date.prototype.toISOString` writes it. Strictly later than every recipe
 *   saved before it (see {@link saveRecipe}), so newest first is also the save
 *   order.
 * @property {string} encoded  The inputs as a share string (`encodeShareState`).
 */

/**
 * The result of a call that adds a recipe: the new recipe plus the recipes
 * removed to stay within {@link MAX_RECIPES} (oldest first out; usually empty).
 * @typedef {SavedRecipe & { dropped: SavedRecipe[] }} AddedRecipe
 */

/** localStorage keys. */
export const STORAGE_KEYS = Object.freeze({
  autosave: 'gel-calculator:autosave',
  recipes: 'gel-calculator:recipes',
});

/** Most recipes kept. Adding one more drops the oldest. */
export const MAX_RECIPES = 50;

/**
 * Longest recipe name, in characters as the user sees them (grapheme clusters
 * where `Intl.Segmenter` exists, code points otherwise).
 */
export const MAX_RECIPE_NAME_LENGTH = 60;

/** Name used when a recipe is saved or renamed with an empty name. */
export const UNTITLED_RECIPE_NAME = 'Untitled recipe';

/** Added to a recipe's name by {@link duplicateRecipe} when no name is given. */
export const COPY_SUFFIX = ' (copy)';

/** Latest time a `Date` can hold (ms since 1970); `toISOString` throws beyond it. */
const MAX_DATE_MS = 8.64e15;

/** Makes ids created in the same millisecond unique. */
let idCounter = 0;

/**
 * The browser's localStorage, or `null` when it is missing or access throws
 * (some browsers throw a SecurityError from the `localStorage` getter when
 * site data is blocked).
 * @returns {Storage | null}
 */
function getStorage() {
  try {
    const storage = globalThis.localStorage;
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      return storage;
    }
  } catch {
    // Blocked storage: treated as unavailable.
  }
  return null;
}

/**
 * Reads one key.
 * @param {string} key
 * @returns {{ ok: true, value: string | null } | { ok: false }}  `ok: false` when storage is unavailable or throws.
 */
function readItem(key) {
  const storage = getStorage();
  if (!storage) return { ok: false };
  try {
    const value = storage.getItem(key);
    return { ok: true, value: typeof value === 'string' ? value : null };
  } catch {
    return { ok: false };
  }
}

/**
 * Writes one key.
 * @param {string} key
 * @param {string} value
 * @returns {boolean}  Whether the value was stored.
 */
function writeItem(key, value) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Splits text into the characters a user sees: grapheme clusters (an emoji
 * with a skin tone, a flag or a ZWJ family stays one character) where
 * `Intl.Segmenter` exists, else code points (never half of a UTF-16 pair).
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
 * Cuts text to at most `max` characters (see {@link splitChars}). A cut end
 * loses trailing white space and a dangling zero-width joiner (U+200D), which
 * the code point fallback can leave behind.
 * @param {string} text
 * @param {number} max
 * @returns {string}  `text` itself when it is short enough.
 */
function cutChars(text, max) {
  // No string has more characters than UTF-16 units.
  if (text.length <= max) return text;
  const chars = splitChars(text);
  if (chars.length <= max) return text;
  return chars
    .slice(0, max)
    .join('')
    .replace(/[\s\u200d]+$/u, '');
}

/**
 * Cleans a recipe name: trimmed and cut to {@link MAX_RECIPE_NAME_LENGTH}
 * characters without splitting a character the user sees as one. A name that
 * is empty after trimming (or cutting), or not a string, becomes
 * {@link UNTITLED_RECIPE_NAME}.
 *
 * @param {unknown} name
 * @returns {string}  1–60 characters.
 */
export function normalizeRecipeName(name) {
  if (typeof name !== 'string') return UNTITLED_RECIPE_NAME;
  const cut = cutChars(name.trim(), MAX_RECIPE_NAME_LENGTH);
  return cut === '' ? UNTITLED_RECIPE_NAME : cut;
}

/**
 * Parses the stored recipe list. Malformed JSON or a value that is not an
 * array gives `[]`. Entries without a non-empty string `id` and `encoded`
 * and a `savedAt` string that `Date.parse` reads are skipped, as are repeated
 * ids (the first valid one is kept). `savedAt` is rewritten in the
 * `toISOString` form and names are cleaned with {@link normalizeRecipeName}.
 * The list is sorted newest first; equal times keep their stored order.
 *
 * @param {string | null} text
 * @returns {SavedRecipe[]}  Newest first.
 */
function parseRecipes(text) {
  if (typeof text !== 'string') return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  /** @type {{ recipe: SavedRecipe, time: number }[]} */
  const entries = [];
  const seen = new Set();
  for (const entry of data) {
    if (!isPlainObject(entry)) continue;
    const { id, name, savedAt, encoded } = entry;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    if (typeof encoded !== 'string' || encoded === '') continue;
    const time = typeof savedAt === 'string' ? Date.parse(savedAt) : NaN;
    if (!Number.isFinite(time)) continue;
    seen.add(id);
    const recipe = { id, name: normalizeRecipeName(name), savedAt: new Date(time).toISOString(), encoded };
    entries.push({ recipe, time });
  }
  // Array.prototype.sort is stable, so equal times keep their stored order.
  return entries.sort((a, b) => b.time - a.time).map(({ recipe }) => recipe);
}

/**
 * Reads the recipe list.
 * @returns {SavedRecipe[] | null}  Newest first; `null` when storage cannot be read
 *   (so callers do not overwrite a list they could not see).
 */
function readRecipes() {
  const result = readItem(STORAGE_KEYS.recipes);
  return result.ok ? parseRecipes(result.value) : null;
}

/**
 * Stores the recipe list (only the four recipe fields of each entry).
 * @param {SavedRecipe[]} recipes
 * @returns {boolean}  Whether it was stored.
 */
function writeRecipes(recipes) {
  const plain = recipes.map(({ id, name, savedAt, encoded }) => ({ id, name, savedAt, encoded }));
  return writeItem(STORAGE_KEYS.recipes, JSON.stringify(plain));
}

/**
 * A new id that is not in `recipes`.
 * @param {number} now  `Date.now()` of the call.
 * @param {SavedRecipe[]} recipes
 * @returns {string}
 */
function newId(now, recipes) {
  const taken = new Set(recipes.map((recipe) => recipe.id));
  let id;
  do {
    id = 'r' + now.toString(36) + (idCounter++).toString(36);
  } while (taken.has(id));
  return id;
}

/**
 * Adds a recipe to the front of the list, dropping the oldest entries beyond
 * {@link MAX_RECIPES}. The new recipe is never dropped.
 *
 * Its `savedAt` is the current time, or 1 ms after the newest stored recipe
 * when the clock is not past it (a clock set back, recipes saved with a clock
 * that was ahead, or two saves in one millisecond). That keeps the list's
 * newest-first order equal to the save order, so the next save drops the
 * oldest recipe and not this one.
 *
 * @param {SavedRecipe[]} recipes  Current list, newest first.
 * @param {string} name  Already cleaned.
 * @param {string} encoded
 * @returns {AddedRecipe | null}  `null` when the list could not be stored.
 */
function addRecipe(recipes, name, encoded) {
  const now = Date.now();
  const newest = recipes.length > 0 ? Date.parse(recipes[0].savedAt) : -Infinity;
  // Capped so toISOString cannot throw; at the cap the stable sort keeps the new recipe first.
  const time = Math.min(MAX_DATE_MS, Math.max(now, newest + 1));
  /** @type {SavedRecipe} */
  const recipe = { id: newId(now, recipes), name, savedAt: new Date(time).toISOString(), encoded };
  const kept = recipes.slice(0, MAX_RECIPES - 1);
  const dropped = recipes.slice(MAX_RECIPES - 1);
  if (!writeRecipes([recipe, ...kept])) return null;
  return { ...recipe, dropped };
}

/**
 * The autosaved inputs, normalized by `decodeShareState`. Never throws.
 *
 * @returns {PlanInputs | null}  `null` when nothing is stored, the stored string
 *   cannot be decoded (damaged, or a version the codec no longer reads), or
 *   storage is unavailable.
 */
export function loadAutosave() {
  const result = readItem(STORAGE_KEYS.autosave);
  if (!result.ok || result.value === null) return null;
  try {
    return decodeShareState(result.value);
  } catch {
    return null;
  }
}

/**
 * Stores `encodeShareState(inputs)` as the autosave. Never throws.
 *
 * @param {unknown} inputs  Usually the provider's inputs; the codec normalizes them.
 * @returns {boolean}  Whether it was stored.
 */
export function saveAutosave(inputs) {
  let encoded;
  try {
    encoded = encodeShareState(inputs);
  } catch {
    return false;
  }
  return writeItem(STORAGE_KEYS.autosave, encoded);
}

/**
 * The saved recipes, newest first. Never throws.
 *
 * @returns {SavedRecipe[]}  `[]` when there are none, the stored list is
 *   malformed, or storage is unavailable.
 */
export function listRecipes() {
  return readRecipes() ?? [];
}

/**
 * Saves the inputs as a new recipe at the front of the list. When the list
 * already holds {@link MAX_RECIPES} recipes, the oldest are removed and
 * returned in `dropped`. `savedAt` is the current time, moved to 1 ms after
 * the newest stored recipe when the clock is behind it. Never throws.
 *
 * @param {unknown} name  Cleaned with {@link normalizeRecipeName}.
 * @param {unknown} inputs  Stored as `encodeShareState(inputs)`.
 * @returns {AddedRecipe | null}  The new recipe, or `null` when storage is
 *   unavailable or full (nothing changes then).
 */
export function saveRecipe(name, inputs) {
  const recipes = readRecipes();
  if (recipes === null) return null;
  let encoded;
  try {
    encoded = encodeShareState(inputs);
  } catch {
    return null;
  }
  return addRecipe(recipes, normalizeRecipeName(name), encoded);
}

/**
 * Renames a recipe. Its id, `savedAt` and inputs stay the same. Never throws.
 *
 * @param {string} id
 * @param {unknown} name  Cleaned with {@link normalizeRecipeName}.
 * @returns {SavedRecipe | null}  The renamed recipe, or `null` when the id is
 *   unknown or storage is unavailable.
 */
export function renameRecipe(id, name) {
  const recipes = readRecipes();
  if (recipes === null) return null;
  const index = recipes.findIndex((recipe) => recipe.id === id);
  if (index === -1) return null;
  const renamed = { ...recipes[index], name: normalizeRecipeName(name) };
  const next = recipes.slice();
  next[index] = renamed;
  return writeRecipes(next) ? renamed : null;
}

/**
 * Copies a recipe to the front of the list with a new id and the current
 * time (as in {@link saveRecipe}). Like {@link saveRecipe}, it may drop the
 * oldest recipes. Never throws.
 *
 * @param {string} id
 * @param {unknown} [name]  Name of the copy; defaults to the original name plus
 *   {@link COPY_SUFFIX}, with the original name cut first so the whole suffix
 *   fits in {@link MAX_RECIPE_NAME_LENGTH}. Cleaned with {@link normalizeRecipeName}.
 * @returns {AddedRecipe | null}  The copy, or `null` when the id is unknown or
 *   storage is unavailable.
 */
export function duplicateRecipe(id, name) {
  const recipes = readRecipes();
  if (recipes === null) return null;
  const original = recipes.find((recipe) => recipe.id === id);
  if (!original) return null;
  const copyName =
    name === undefined
      ? cutChars(original.name, MAX_RECIPE_NAME_LENGTH - splitChars(COPY_SUFFIX).length) + COPY_SUFFIX
      : name;
  return addRecipe(recipes, normalizeRecipeName(copyName), original.encoded);
}

/**
 * Deletes a recipe. Never throws.
 *
 * @param {string} id
 * @returns {boolean}  Whether a recipe was deleted (false when the id is
 *   unknown or storage is unavailable).
 */
export function deleteRecipe(id) {
  const recipes = readRecipes();
  if (recipes === null) return false;
  const next = recipes.filter((recipe) => recipe.id !== id);
  if (next.length === recipes.length) return false;
  return writeRecipes(next);
}

/**
 * The inputs of a saved recipe, normalized by `decodeShareState`. Never throws.
 *
 * @param {string} id
 * @returns {PlanInputs | null}  `null` when the id is unknown, its stored
 *   string cannot be decoded, or storage is unavailable.
 */
export function loadRecipe(id) {
  const recipes = readRecipes();
  if (recipes === null) return null;
  const recipe = recipes.find((entry) => entry.id === id);
  if (!recipe) return null;
  try {
    return decodeShareState(recipe.encoded);
  } catch {
    return null;
  }
}
