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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PlanInputsContext } from "./PlanProvider";
import {
  BOARD_TABS,
  DEFAULT_PREFS,
  GUIDED_STEP_COUNT,
  PREF_VALUES,
  loadPrefs,
  normalizePrefs,
  prefsForLanguage,
  savePrefs,
} from "./prefs";

export { BOARD_TABS, GUIDED_STEP_COUNT, MODES, PREFS_KEY, DEFAULT_PREFS } from "./prefs";

/** How long a toast stays visible by default, in ms. */
export const TOAST_DURATION_MS = 3000;

/**
 * Toast tones (the `Toast` icon and colour): `ok` for a confirmation
 * ("Link copied"), `warn` and `danger` for a problem, `neutral` (the
 * default) for plain information.
 */
export const TOAST_TONES = Object.freeze(["neutral", "ok", "warn", "danger"]);

/** Modal names for `openModal` / `isModalOpen`. Openers and modals both use these. */
export const MIXING_MODAL = "mixing";
export const TEMPLATE_MODAL = "templates";
export const SHARE_MODAL = "share";
export const RECIPES_MODAL = "recipes";
export const SETTINGS_MODAL = "settings";

/**
 * UI state that is not part of the plan inputs (and is not shared in links).
 *
 * @typedef {Object} UiApi
 * @property {string|null} modal  Name of the open modal ({@link MIXING_MODAL}, {@link TEMPLATE_MODAL},
 *   {@link SHARE_MODAL}, {@link RECIPES_MODAL}, {@link SETTINGS_MODAL}) or `null`.
 * @property {(name: string) => void} openModal  Opens a modal; opening the share modal also resets
 *   `shareView` to `'menu'`.
 * @property {() => void} closeModal
 * @property {(name: string) => boolean} isModalOpen
 * @property {string} shareView  Current view inside the share modal (`'menu'` or `'image'`).
 * @property {(view: string) => void} setShareView
 * @property {string} toastMessage  Text of the visible toast; `''` when hidden.
 * @property {'neutral'|'ok'|'warn'|'danger'} toastTone  Tone of the visible toast (see {@link TOAST_TONES}).
 * @property {(message: string, options?: number | { tone?: 'neutral'|'ok'|'warn'|'danger', durationMs?: number }) => void} showToast
 *   Shows a toast that hides itself after `durationMs` (default {@link TOAST_DURATION_MS}). The
 *   tone (default `'neutral'`; unknown tones too) picks the icon: pass `'ok'` for a confirmation
 *   and `'warn'`/`'danger'` for a failure, so the icon never contradicts the text. A number as the
 *   second argument is the duration (the Phase 2 form).
 * @property {() => void} hideToast
 * @property {'en'|'de'} locale  UI language (persisted).
 * @property {(locale: 'en'|'de') => void} setLocale  Other values are ignored.
 * @property {'metric'|'imperial'} unitSystem  Display units (persisted). The inputs stay metric.
 * @property {(system: 'metric'|'imperial') => void} setUnitSystem  Other values are ignored.
 * @property {'EUR'|'USD'|'GBP'} currency  Currency of the cost estimate (persisted).
 * @property {(currency: 'EUR'|'USD'|'GBP') => void} setCurrency  Other values are ignored.
 * @property {'guided'|'expert'} mode  Guided flow or expert layout (persisted).
 * @property {(mode: 'guided'|'expert') => void} setMode  Other values are ignored.
 * @property {number} guidedStep  Current guided step, 0–3 (not persisted).
 * @property {(step: number | ((current: number) => number)) => void} setGuidedStep
 *   Rounded and clamped to 0–3; non-finite values are ignored.
 * @property {'board'|'setup'|'schedule'} boardTab  Phone tab of the expert layout (not persisted).
 * @property {(tab: 'board'|'setup'|'schedule') => void} setBoardTab  Other values are ignored.
 * @property {import('./prefs').Prefs} prefs  `{ locale, unitSystem, currency, mode }` as one object.
 * @property {boolean} prefsReady  False until the stored prefs (or the browser defaults) are applied
 *   after mount; until then the prefs are {@link DEFAULT_PREFS}. A shell can wait for it before
 *   choosing between the guided and the expert layout.
 * @property {string} browserLanguage  `navigator.language`, read with the prefs (`''` before): it only
 *   decides how dates read (an en-GB visitor gets day-first dates; see `dateTagFor`).
 */

/** UI state: modals, share view, toast, prefs and layout state. */
export const UiContext = createContext(/** @type {UiApi|null} */ (null));

/**
 * The browser language, or `''` outside a browser.
 * @returns {string}
 */
function browserLanguage() {
  try {
    return typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "";
  } catch {
    return "";
  }
}

/**
 * Holds UI state that the plan does not need: which modal is open, the share
 * modal's view, the toast (with its timer), the UI prefs (language, unit
 * system, currency, mode) and the layout state (guided step, phone tab).
 *
 * **Prefs.** The first render uses {@link DEFAULT_PREFS} (the page is a
 * static export, so storage and `navigator` can only be read after
 * hydration). After mount, once the surrounding `PlanProvider` (if any) has
 * restored its inputs, the prefs are resolved once and `prefsReady` turns
 * true:
 * - stored prefs (`gel-calculator:prefs`) win field by field; missing fields
 *   come from the browser language (`prefsForLanguage(navigator.language)`);
 * - the mode is the stored mode; without stored prefs (a first visit) it is
 *   `'guided'` when the plan restored nothing (`restoredFrom === null`: no
 *   share link, no autosave) and `'expert'` otherwise. Outside a
 *   `PlanProvider` nothing was restored, so a first visit is guided.
 * From then on `{ locale, unitSystem, currency, mode }` are saved on every
 * change (and once when resolved, so the next visit is not a first visit).
 * A pref set before the resolution is kept.
 *
 * Unit conversion happens in the UI; the plan inputs always use kg, cm, °C,
 * km/h and ml.
 *
 * @param {{ children?: import('react').ReactNode }} props
 */
export function UiProvider({ children }) {
  const [modal, setModal] = useState(/** @type {string|null} */ (null));
  const [shareView, setShareView] = useState("menu");
  const [toast, setToast] = useState(/** @type {{ message: string, tone: string }} */ ({ message: "", tone: "neutral" }));
  const [prefs, setPrefs] = useState(/** @type {import('./prefs').Prefs} */ (DEFAULT_PREFS));
  const [prefsReady, setPrefsReady] = useState(false);
  const [browserTag, setBrowserTag] = useState("");
  const [guidedStep, setGuidedStepState] = useState(0);
  const [boardTab, setBoardTabState] = useState(/** @type {'board'|'setup'|'schedule'} */ ("board"));
  const toastTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));
  // Prefs set before they were resolved; the resolution keeps them.
  const earlyPrefs = useRef(/** @type {Partial<import('./prefs').Prefs>} */ ({}));
  const readyRef = useRef(false);

  const planInputs = useContext(PlanInputsContext);
  const planRestored = planInputs ? planInputs.restored : true;
  const restoredFrom = planInputs ? planInputs.restoredFrom ?? null : null;

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if (readyRef.current || !planRestored) return;
    readyRef.current = true;
    const stored = loadPrefs();
    const language = browserLanguage();
    setBrowserTag(language);
    const defaults = {
      ...prefsForLanguage(language),
      mode: stored || restoredFrom ? "expert" : "guided",
    };
    setPrefs(normalizePrefs({ ...stored, ...earlyPrefs.current }, defaults));
    setPrefsReady(true);
  }, [planRestored, restoredFrom]);

  useEffect(() => {
    if (prefsReady) savePrefs(prefs);
  }, [prefsReady, prefs]);

  /** Sets one pref field to an allowed value; other values are ignored. */
  const setPref = useCallback((field, value) => {
    if (!Object.hasOwn(PREF_VALUES, field) || !PREF_VALUES[field].includes(value)) return;
    if (!readyRef.current) earlyPrefs.current = { ...earlyPrefs.current, [field]: value };
    setPrefs((current) => (current[field] === value ? current : { ...current, [field]: value }));
  }, []);
  const setLocale = useCallback((value) => setPref("locale", value), [setPref]);
  const setUnitSystem = useCallback((value) => setPref("unitSystem", value), [setPref]);
  const setCurrency = useCallback((value) => setPref("currency", value), [setPref]);
  const setMode = useCallback((value) => setPref("mode", value), [setPref]);

  const setGuidedStep = useCallback((step) => {
    setGuidedStepState((current) => {
      const next = typeof step === "function" ? step(current) : step;
      if (typeof next !== "number" || !Number.isFinite(next)) return current;
      return Math.min(GUIDED_STEP_COUNT - 1, Math.max(0, Math.round(next)));
    });
  }, []);
  const setBoardTab = useCallback((tab) => {
    if (BOARD_TABS.includes(tab)) setBoardTabState(tab);
  }, []);

  const openModal = useCallback((name) => {
    if (typeof name !== "string" || name === "") return;
    if (name === SHARE_MODAL) setShareView("menu");
    setModal(name);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const isModalOpen = useCallback((name) => modal === name, [modal]);

  const hideToast = useCallback(() => {
    clearTimeout(toastTimerRef.current);
    setToast((current) => (current.message === "" ? current : { ...current, message: "" }));
  }, []);
  const showToast = useCallback((message, options) => {
    const { tone, durationMs } = typeof options === "number" ? { durationMs: options } : options ?? {};
    const duration = typeof durationMs === "number" && Number.isFinite(durationMs) ? durationMs : TOAST_DURATION_MS;
    clearTimeout(toastTimerRef.current);
    setToast({ message: String(message ?? ""), tone: TOAST_TONES.includes(tone) ? tone : "neutral" });
    toastTimerRef.current = setTimeout(() => setToast((current) => ({ ...current, message: "" })), duration);
  }, []);

  const value = useMemo(
    () => ({
      modal,
      openModal,
      closeModal,
      isModalOpen,
      shareView,
      setShareView,
      toastMessage: toast.message,
      toastTone: toast.tone,
      showToast,
      hideToast,
      prefs,
      prefsReady,
      browserLanguage: browserTag,
      locale: prefs.locale,
      setLocale,
      unitSystem: prefs.unitSystem,
      setUnitSystem,
      currency: prefs.currency,
      setCurrency,
      mode: prefs.mode,
      setMode,
      guidedStep,
      setGuidedStep,
      boardTab,
      setBoardTab,
    }),
    [
      modal,
      openModal,
      closeModal,
      isModalOpen,
      shareView,
      toast,
      showToast,
      hideToast,
      prefs,
      prefsReady,
      browserTag,
      setLocale,
      setUnitSystem,
      setCurrency,
      setMode,
      guidedStep,
      setGuidedStep,
      boardTab,
      setBoardTab,
    ],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

/**
 * UI state and actions. Throws when used outside {@link UiProvider}.
 * @returns {UiApi}
 */
export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside <UiProvider>");
  return value;
}

/**
 * The UI prefs `{ locale, unitSystem, currency, mode }`. Unlike {@link useUi}
 * it works outside a `UiProvider` too (then {@link DEFAULT_PREFS}: English,
 * metric, EUR), so primitives and their tests can translate and format
 * without the provider.
 * @returns {import('./prefs').Prefs}
 */
export function usePrefs() {
  const value = useContext(UiContext);
  return value ? value.prefs : DEFAULT_PREFS;
}

/**
 * The browser language read with the prefs (`''` before they resolve and
 * outside a `UiProvider`), for date formatting only (`useFormat`).
 * @returns {string}
 */
export function useBrowserLanguage() {
  const value = useContext(UiContext);
  return value ? value.browserLanguage : "";
}
