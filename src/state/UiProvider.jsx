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

/** How long a toast stays visible by default, in ms. */
export const TOAST_DURATION_MS = 3000;

/** Display units for body mass. */
export const MASS_UNITS = Object.freeze(["kg", "lb"]);

/** Display units for temperature. */
export const TEMP_UNITS = Object.freeze(["C", "F"]);

/** Modal names for `openModal` / `isModalOpen`. Openers and modals both use these. */
export const MIXING_MODAL = "mixing";
export const TEMPLATE_MODAL = "templates";
export const SHARE_MODAL = "share";

/**
 * UI state that is not part of the plan inputs (and is not shared in links).
 *
 * @typedef {Object} UiApi
 * @property {string|null} modal  Name of the open modal ({@link MIXING_MODAL}, {@link TEMPLATE_MODAL},
 *   {@link SHARE_MODAL}) or `null`.
 * @property {(name: string) => void} openModal  Opens a modal; opening the share modal also resets
 *   `shareView` to `'menu'`.
 * @property {() => void} closeModal
 * @property {(name: string) => boolean} isModalOpen
 * @property {string} shareView  Current view inside the share modal (`'menu'` or `'image'`).
 * @property {(view: string) => void} setShareView
 * @property {string} toastMessage  Text of the visible toast; `''` when hidden.
 * @property {(message: string, durationMs?: number) => void} showToast  Shows a toast that hides itself after `durationMs`.
 * @property {() => void} hideToast
 * @property {import('react').RefObject<HTMLElement|null>} recipeRef  Attach to the recipe card (the PDF export captures it).
 * @property {'kg'|'lb'} massUnit
 * @property {(unit: 'kg'|'lb') => void} setMassUnit  Other values are ignored.
 * @property {'C'|'F'} tempUnit
 * @property {(unit: 'C'|'F') => void} setTempUnit  Other values are ignored.
 */

/** UI state: modals, share view, toast, recipe ref and display units. */
export const UiContext = createContext(/** @type {UiApi|null} */ (null));

/**
 * Holds UI state that the plan does not need: which modal is open, the share
 * modal's view, the toast (with its timer), a ref to the recipe card, and the
 * display units for mass and temperature. Unit conversion happens in the UI;
 * the plan inputs always use kg and °C.
 *
 * @param {{ children?: import('react').ReactNode }} props
 */
export function UiProvider({ children }) {
  const [modal, setModal] = useState(/** @type {string|null} */ (null));
  const [shareView, setShareView] = useState("menu");
  const [toastMessage, setToastMessage] = useState("");
  const [massUnit, setMassUnitState] = useState(/** @type {'kg'|'lb'} */ ("kg"));
  const [tempUnit, setTempUnitState] = useState(/** @type {'C'|'F'} */ ("C"));
  const recipeRef = useRef(/** @type {HTMLElement|null} */ (null));
  const toastTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined));

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const openModal = useCallback((name) => {
    if (typeof name !== "string" || name === "") return;
    if (name === SHARE_MODAL) setShareView("menu");
    setModal(name);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const isModalOpen = useCallback((name) => modal === name, [modal]);

  const hideToast = useCallback(() => {
    clearTimeout(toastTimerRef.current);
    setToastMessage("");
  }, []);
  const showToast = useCallback((message, durationMs = TOAST_DURATION_MS) => {
    clearTimeout(toastTimerRef.current);
    setToastMessage(String(message ?? ""));
    toastTimerRef.current = setTimeout(() => setToastMessage(""), durationMs);
  }, []);

  const setMassUnit = useCallback((unit) => {
    if (MASS_UNITS.includes(unit)) setMassUnitState(unit);
  }, []);
  const setTempUnit = useCallback((unit) => {
    if (TEMP_UNITS.includes(unit)) setTempUnitState(unit);
  }, []);

  const value = useMemo(
    () => ({
      modal,
      openModal,
      closeModal,
      isModalOpen,
      shareView,
      setShareView,
      toastMessage,
      showToast,
      hideToast,
      recipeRef,
      massUnit,
      setMassUnit,
      tempUnit,
      setTempUnit,
    }),
    [modal, openModal, closeModal, isModalOpen, shareView, toastMessage, showToast, hideToast, massUnit, setMassUnit, tempUnit, setTempUnit],
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
