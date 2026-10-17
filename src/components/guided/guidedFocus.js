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
 * Focus and scroll helpers of the guided flow: keyboard focus never drops
 * to the page when the focused control goes away, and a new screen starts
 * at its top, below the sticky header.
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * Space kept between the sticky header and the top of the flow, in px, on
 * top of the page's own scroll padding (`globals.css`: the header's height
 * and 0.5 rem), so the flow starts 16 px below the header.
 */
export const SCROLL_GAP_PX = 8;

/**
 * Focuses the checked option of a radio group (a `Segmented`) by the
 * group's id, after the next render. For a button that goes away when it is
 * pressed and whose choice the group then shows ("Use the estimate
 * instead", "Let the plan choose the salts"). Falls back to the group's
 * first radio.
 * @returns {(groupId: string) => void}  Call it in the handler, before the state change.
 */
export function useFocusRadioAfterRender() {
  const pending = useRef(/** @type {string|null} */ (null));
  useEffect(() => {
    const groupId = pending.current;
    if (groupId === null) return;
    pending.current = null;
    const group = document.getElementById(groupId);
    const radio = group?.querySelector('[role="radio"][aria-checked="true"]') ?? group?.querySelector('[role="radio"]');
    if (radio instanceof HTMLElement) radio.focus();
  });
  return useCallback((groupId) => {
    pending.current = groupId;
  }, []);
}

/**
 * Scrolls an element to the top of the screen, below the sticky header (the
 * page's scroll padding keeps it clear, `usePinnedHeight`), without
 * animation. Does nothing without `scrollIntoView` (jsdom) or without the
 * element.
 * @param {Element|null|undefined} element
 */
export function scrollToTop(element) {
  if (!(element instanceof HTMLElement) || typeof element.scrollIntoView !== 'function') return;
  const previous = element.style.scrollMarginTop;
  element.style.scrollMarginTop = `${SCROLL_GAP_PX}px`;
  element.scrollIntoView({ block: 'start' });
  element.style.scrollMarginTop = previous;
}

/**
 * Moves the focus into an open form (an unsaved draft the user is asked to
 * finish): its heading when the form made it focusable (`tabindex="-1"`),
 * else its first enabled field; or, when the form sits in a closed
 * disclosure inside `root` (an element with `hidden` and an id, such as a
 * collapsed setup panel's body), the button that opens it
 * (`aria-controls`). A guided screen's own slot (`data-guided-slot`) is not
 * a disclosure: the flow shows it before calling this.
 * @param {HTMLFormElement} form
 * @param {HTMLElement|null} root
 */
export function focusIntoForm(form, root) {
  const closed = form.parentElement?.closest('[hidden]');
  if (closed instanceof HTMLElement && closed.id && root?.contains(closed) && !closed.hasAttribute('data-guided-slot')) {
    const opener = [...root.querySelectorAll('[aria-controls]')].find((el) => el.getAttribute('aria-controls') === closed.id);
    if (opener instanceof HTMLElement) {
      opener.focus();
      return;
    }
  }
  // A form heading made focusable (tabindex -1) comes first: a date field would open the iOS date picker at once.
  const field =
    form.querySelector(':is(h2, h3, h4, h5, h6)[tabindex="-1"]') ??
    form.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
  if (field instanceof HTMLElement) field.focus();
}
