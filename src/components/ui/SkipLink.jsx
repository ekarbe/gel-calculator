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

import { cx } from './cx';
import { useT } from '../../i18n/useT';

/**
 * "Skip to main content": the first focusable element of the page, hidden
 * until it gets keyboard focus. Activating it moves focus to the element
 * with id `targetId` (made focusable with `tabindex="-1"` when it is not)
 * without changing the address (a `?s=` link stays as it is).
 *
 * @param {{ targetId?: string, children?: import('react').ReactNode, className?: string }} props
 *   `targetId` defaults to `'main'`; `children` replaces the default text.
 */
export default function SkipLink({ targetId = 'main', children, className }) {
  const t = useT();
  return (
    <a
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        event.preventDefault();
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus();
        target.scrollIntoView?.({ block: 'start' });
      }}
      className={cx(
        'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(1rem+env(safe-area-inset-top))] focus:z-[100]',
        'focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-control focus:bg-accent focus:px-4',
        'focus:font-semibold focus:text-accent-ink focus:shadow-dialog',
        className,
      )}
    >
      {children ?? t('ui-common.skipToContent')}
    </a>
  );
}
