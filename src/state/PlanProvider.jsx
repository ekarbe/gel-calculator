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

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { DEFAULT_INPUTS, normalizeInputs, computePlan } from "../domain/plan";
import { isPlainObject, mergeDeep } from "../domain/objects";
import { decodeShareState } from "./shareCodec";
import { loadAutosave, saveAutosave } from "./storage";

/** @typedef {import('../domain/plan').PlanInputs} PlanInputs */
/** @typedef {import('../domain/plan').Plan} Plan */
/** @typedef {string | Array<string|number>} InputPath  `'carbs.manualRatio.fructose'` or `['carbs', 'manualRatio', 'fructose']`. */

/**
 * @typedef {Object} PlanInputsApi
 * @property {PlanInputs} inputs  Current normalized inputs.
 * @property {(path: InputPath, value: unknown | ((current: unknown) => unknown)) => void} set
 *   Sets one field. A function value is called with the current value at `path` (an updater).
 * @property {(partial: unknown) => void} apply  Deep-merges a partial into the current inputs.
 * @property {(inputs: unknown) => void} replace  Replaces all inputs (merged onto the defaults).
 * @property {() => void} reset  Restores the defaults.
 * @property {(inputs: unknown) => void} loadInputs  Replaces all inputs with a loaded plan (a saved
 *   recipe) and removes a `?s=` link from the address bar, so a reload shows the loaded plan (from the
 *   autosave) instead of the link.
 * @property {boolean} shareLinkFailed  True when the page was opened with a `?s=` share link that could
 *   not be read (damaged, or from an older version), so the autosave or the defaults are shown instead.
 * @property {boolean} restored  True once the mount restore (link, else autosave) has run. Autosave
 *   only starts after it.
 */

/** Autosave waits this long after the last change, in ms. */
export const AUTOSAVE_DELAY_MS = 400;

/** Current inputs and the actions that change them. */
export const PlanInputsContext = createContext(/** @type {PlanInputsApi|null} */ (null));

/** The plan computed from the current inputs. */
export const PlanContext = createContext(/** @type {Plan|null} */ (null));

/**
 * Splits a path into its keys. Strings use dots; numeric segments index arrays.
 * @param {InputPath} path
 * @returns {string[]}
 */
function toKeys(path) {
  if (Array.isArray(path)) return path.map(String);
  return typeof path === "string" && path !== "" ? path.split(".") : [];
}

/**
 * Reads the value at `keys`, or `undefined`.
 * @param {unknown} obj
 * @param {string[]} keys
 * @returns {unknown}
 */
function getIn(obj, keys) {
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Returns a copy of `obj` with `value` at `keys`, copying every object or
 * array on the way. Missing containers are created as objects.
 * @param {unknown} obj
 * @param {string[]} keys
 * @param {unknown} value
 * @returns {unknown}
 */
function setIn(obj, keys, value) {
  if (keys.length === 0) return value;
  const [key, ...rest] = keys;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[Number(key)] = setIn(obj[Number(key)], rest, value);
    return copy;
  }
  const base = isPlainObject(obj) ? obj : {};
  return { ...base, [key]: setIn(base[key], rest, value) };
}

/**
 * Keeps the current state object when the new inputs are equal, so a no-op
 * action does not recompute the plan or re-render consumers.
 * @param {PlanInputs} state
 * @param {PlanInputs} next
 * @returns {PlanInputs}
 */
function keepIfEqual(state, next) {
  return JSON.stringify(state) === JSON.stringify(next) ? state : next;
}

/**
 * Reducer over the inputs. Every action passes its result through
 * `normalizeInputs`.
 *
 * Actions: `{ type: 'set', path, value }`, `{ type: 'apply', partial }`,
 * `{ type: 'replace', inputs }`, `{ type: 'reset' }`. Unknown actions return
 * the state unchanged.
 *
 * @param {PlanInputs} state
 * @param {{ type: string, path?: InputPath, value?: unknown, partial?: unknown, inputs?: unknown }} action
 * @returns {PlanInputs}
 */
export function planInputsReducer(state, action) {
  switch (action?.type) {
    case "set": {
      const keys = toKeys(action.path);
      if (keys.length === 0) return state;
      const value = typeof action.value === "function" ? action.value(getIn(state, keys)) : action.value;
      return keepIfEqual(state, normalizeInputs(setIn(state, keys, value)));
    }
    case "apply":
      return keepIfEqual(state, normalizeInputs(mergeDeep(state, action.partial)));
    case "replace":
      return keepIfEqual(state, normalizeInputs(action.inputs));
    case "reset":
      return keepIfEqual(state, normalizeInputs(DEFAULT_INPUTS));
    default:
      return state;
  }
}

/**
 * Removes the `s` parameter from the address bar (keeping the rest of the URL
 * and the history entry), so reloading does not try the same bad link again.
 */
function dropShareParam() {
  const url = new URL(window.location.href);
  url.searchParams.delete("s");
  window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Holds the calculator inputs and the plan computed from them, and keeps an
 * autosave of the inputs in localStorage (`src/state/storage.js`).
 *
 * On mount (the page is a static export, so the URL and storage can only be
 * read after hydration) it restores the inputs once, in this order:
 * 1. a `?s=` share link. An unreadable link (damaged, or from an unknown
 *    version) logs a console warning, is removed from the address bar and
 *    sets `shareLinkFailed`, so the app can tell the visitor the shared plan
 *    was not loaded; the autosave is used instead.
 * 2. else the autosave, when there is one (`loadAutosave`).
 *
 * Autosave: after that restore has run, every change to the inputs is saved
 * (`saveAutosave`) {@link AUTOSAVE_DELAY_MS} ms after the last change. The
 * restored inputs themselves are not written back, and nothing is saved
 * before the restore, so the defaults never overwrite a stored plan. A
 * pending save is written at once when the page is hidden (`pagehide`), and
 * dropped when the provider unmounts.
 *
 * @param {{ children?: import('react').ReactNode, initialInputs?: unknown, persist?: boolean }} props
 *   `initialInputs` (normalized) replaces the defaults as the starting state; when it is given the
 *   autosave is not restored (a `?s=` link still is). `persist` (default true) turns the autosave
 *   off entirely when false (no restore, no saving).
 */
export function PlanProvider({ children, initialInputs, persist = true }) {
  const [inputs, dispatch] = useReducer(planInputsReducer, initialInputs, normalizeInputs);
  // One-way flags. (Reducers, because their dispatch is the stable way to
  // record an external event from an effect.)
  const [shareLinkFailed, markShareLinkFailed] = useReducer(() => true, false);
  const [restored, markRestored] = useReducer(() => true, false);
  // Read once, by the mount restore.
  const restoreAutosave = useRef(persist && initialInputs === undefined);
  // The inputs the restore produced: already stored, so not saved again.
  const baseline = useRef(/** @type {PlanInputs|null} */ (null));
  // Inputs waiting for the debounce timer, flushed on pagehide.
  const pending = useRef(/** @type {PlanInputs|null} */ (null));

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("s");
    let next = null;
    if (encoded) {
      next = decodeShareState(encoded);
      if (!next) {
        console.warn("Ignoring unreadable share link");
        dropShareParam();
        markShareLinkFailed();
      }
    }
    if (!next && restoreAutosave.current) next = loadAutosave();
    if (next) dispatch({ type: "replace", inputs: next });
    markRestored();
  }, []);

  useEffect(() => {
    if (!restored || !persist) return undefined;
    if (baseline.current === null) {
      baseline.current = inputs;
      return undefined;
    }
    if (inputs === baseline.current) return undefined;
    pending.current = inputs;
    const timer = setTimeout(() => {
      pending.current = null;
      saveAutosave(inputs);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [inputs, restored, persist]);

  useEffect(() => {
    if (!persist) return undefined;
    const flush = () => {
      if (pending.current === null) return;
      saveAutosave(pending.current);
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persist]);

  const set = useCallback((path, value) => dispatch({ type: "set", path, value }), []);
  const apply = useCallback((partial) => dispatch({ type: "apply", partial }), []);
  const replace = useCallback((next) => dispatch({ type: "replace", inputs: next }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);
  const loadInputs = useCallback((next) => {
    if (new URLSearchParams(window.location.search).has("s")) dropShareParam();
    dispatch({ type: "replace", inputs: next });
  }, []);

  const inputsApi = useMemo(
    () => ({ inputs, set, apply, replace, reset, loadInputs, shareLinkFailed, restored }),
    [inputs, set, apply, replace, reset, loadInputs, shareLinkFailed, restored],
  );
  const plan = useMemo(() => computePlan(inputs), [inputs]);

  return (
    <PlanInputsContext.Provider value={inputsApi}>
      <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>
    </PlanInputsContext.Provider>
  );
}

/**
 * The current inputs and the actions that change them.
 * Throws when used outside {@link PlanProvider}.
 * @returns {PlanInputsApi}
 */
export function usePlanInputs() {
  const value = useContext(PlanInputsContext);
  if (!value) throw new Error("usePlanInputs must be used inside <PlanProvider>");
  return value;
}

/**
 * The plan computed from the current inputs (`computePlan`).
 * Throws when used outside {@link PlanProvider}.
 * @returns {Plan}
 */
export function usePlan() {
  const value = useContext(PlanContext);
  if (!value) throw new Error("usePlan must be used inside <PlanProvider>");
  return value;
}
