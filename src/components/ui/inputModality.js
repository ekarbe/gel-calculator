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
 * How the person last used the page (pointer or keyboard), and the control
 * they last activated. Two iOS Safari behaviours need it:
 *
 * - A focus moved by script after a tap (a dialog's close button, a guided
 *   step's heading) matches `:focus-visible` in WebKit, so the 2 px ring
 *   showed on every dialog opened by a tap. Chromium draws no ring there.
 *   The root element carries `data-input="pointer"` after a pointer press and
 *   `data-input="keyboard"` after a key press; globals.css hides the ring in
 *   pointer mode, except on text fields. A key press brings the rings back.
 * - A tapped button does not take the focus in Safari, so a dialog opened by
 *   a tap saw `<body>` as the focused element and could not give the focus
 *   back on close (VoiceOver users lost their place). `lastActivatedControl()`
 *   names the control the last click activated, for a short while after it.
 *
 * The listeners are installed once, when this module is first imported in a
 * browser (capture phase, so they run before React's handlers).
 */

/** How long after its click a control still counts as the one that opened something, ms. */
export const ACTIVATION_WINDOW_MS = 1000;

/** The focusable control a click landed in. */
const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

/** Keys that only modify another key: pressing them alone does not mean keyboard use. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);

/** @type {'pointer'|'keyboard'|null} */
let mode = null;
/** @type {Element|null} */
let lastControl = null;
let lastControlAt = -Infinity;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** @param {'pointer'|'keyboard'} next */
function setMode(next) {
  if (mode === next) return;
  mode = next;
  document.documentElement.dataset.input = next;
}

/**
 * Installs the listeners (once; a no-op outside a browser).
 * @returns {boolean} whether they are installed
 */
export function installInputModality() {
  if (typeof document === 'undefined') return false;
  const root = /** @type {any} */ (document);
  if (root.__gelInputModality) return true;
  root.__gelInputModality = true;
  document.addEventListener('pointerdown', () => setMode('pointer'), true);
  document.addEventListener(
    'keydown',
    (event) => {
      if (!MODIFIER_KEYS.has(event.key)) setMode('keyboard');
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(CONTROL_SELECTOR) : null;
      if (!target) return;
      lastControl = target;
      lastControlAt = now();
    },
    true,
  );
  return true;
}

/** The last input: 'pointer', 'keyboard', or null before the first one. */
export const inputMode = () => mode;

/**
 * The control the last click activated, when that click was at most
 * {@link ACTIVATION_WINDOW_MS} ago and the control is still in the page; else null.
 * @returns {HTMLElement|null}
 */
export function lastActivatedControl() {
  if (!(lastControl instanceof HTMLElement) || !lastControl.isConnected) return null;
  return now() - lastControlAt <= ACTIVATION_WINDOW_MS ? lastControl : null;
}

installInputModality();
