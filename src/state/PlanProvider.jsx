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

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { DEFAULT_INPUTS, normalizeInputs, computePlan } from "../domain/plan";
import { isPlainObject } from "../domain/objects";
import { decodeShareState } from "./shareCodec";

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
 * @property {boolean} shareLinkFailed  True when the page was opened with a `?s=` share link that could
 *   not be read (damaged, or from an older version), so the defaults are shown instead.
 */

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
 * Deep-merges `partial` into `base`: plain objects merge key by key, anything
 * else (arrays included) replaces. A `partial` that is not a plain object
 * leaves `base` unchanged.
 * @param {unknown} base
 * @param {unknown} partial
 * @returns {unknown}
 */
function mergeDeep(base, partial) {
  if (!isPlainObject(partial)) return base;
  const out = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(partial)) {
    if (key === "__proto__") continue; // an own "__proto__" key (from JSON) must not set the prototype
    out[key] =isPlainObject(value) && isPlainObject(out[key]) ? mergeDeep(out[key], value) : value;
  }
  return out;
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
 * Holds the calculator inputs and the plan computed from them.
 *
 * On mount it restores inputs from a `?s=` share link once (the page is a
 * static export, so the URL can only be read after hydration). An unreadable
 * link (damaged, or from an older version) logs a console warning, is removed
 * from the address bar, and sets `shareLinkFailed` so the app can tell the
 * visitor the shared plan was not loaded.
 *
 * @param {{ children?: import('react').ReactNode, initialInputs?: unknown }} props
 *   `initialInputs` (normalized) replaces the defaults as the starting state.
 */
export function PlanProvider({ children, initialInputs }) {
  const [inputs, dispatch] = useReducer(planInputsReducer, initialInputs, normalizeInputs);
  // A one-way flag: once a link failed it stays failed. (A reducer, because its
  // dispatch is the stable way to record an external event from the effect.)
  const [shareLinkFailed, markShareLinkFailed] = useReducer(() => true, false);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("s");
    if (!encoded) return;
    const restored = decodeShareState(encoded);
    if (restored) {
      dispatch({ type: "replace", inputs: restored });
    } else {
      console.warn("Ignoring unreadable share link");
      dropShareParam();
      markShareLinkFailed();
    }
  }, []);

  const set = useCallback((path, value) => dispatch({ type: "set", path, value }), []);
  const apply = useCallback((partial) => dispatch({ type: "apply", partial }), []);
  const replace = useCallback((next) => dispatch({ type: "replace", inputs: next }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  const inputsApi = useMemo(
    () => ({ inputs, set, apply, replace, reset, shareLinkFailed }),
    [inputs, set, apply, replace, reset, shareLinkFailed],
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
