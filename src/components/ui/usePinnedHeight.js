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

import { useEffect } from 'react';

/** CSS custom property (on `<html>`) with the height of the sticky header, in px. */
export const HEADER_HEIGHT_VAR = '--pinned-top';

/** CSS custom property (on `<html>`) with the height of the bar pinned to the bottom (tab bar or dock), in px. */
export const BOTTOM_HEIGHT_VAR = '--pinned-bottom';

/**
 * Keeps a CSS custom property on `<html>` at the height of an element that
 * is pinned to an edge of the screen (sticky or fixed), and at `0px` while
 * it is not pinned (hidden, or static on a short viewport). `globals.css`
 * turns the two properties ({@link HEADER_HEIGHT_VAR},
 * {@link BOTTOM_HEIGHT_VAR}) into `scroll-padding-top` / `-bottom` of the
 * page, so a control that gets the keyboard focus, a skip-link target or a
 * scrolled-to section is never left under the sticky header or the fixed
 * tab bar (WCAG 2.4.11). Follows the element's size (a header that wraps to
 * two rows at 320 px) and the viewport (media queries). Removes the
 * property on unmount.
 *
 * @param {import('react').RefObject<HTMLElement|null>} ref
 * @param {string} name  The custom property, e.g. {@link HEADER_HEIGHT_VAR}.
 */
export function usePinnedHeight(ref, name) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    const update = () => {
      const { position } = window.getComputedStyle(element);
      const pinned = (position === 'sticky' || position === 'fixed') && element.getClientRects().length > 0;
      root.style.setProperty(name, pinned ? `${Math.ceil(element.getBoundingClientRect().height)}px` : '0px');
    };
    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}
