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

import { useEffect, useState } from 'react';
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import Icon from './Icon';
import { cx, toneClasses } from './cx';

/** Icon per tone; the text says the rest. */
const ICONS = Object.freeze({ neutral: Info, ok: CircleCheck, warn: TriangleAlert, danger: OctagonAlert });

/**
 * A toast: a short message near the bottom of the screen, above the phone
 * tab bar. The live region (`role="status"`, `aria-live="polite"`,
 * `aria-atomic`) is always in the page, so screen readers announce each new
 * message without interrupting. The tone picks the icon (`ok` a check,
 * `warn` a triangle, `danger` an octagon, `neutral` an info sign); the text
 * says the rest. An empty message shows nothing. Fades in over 200 ms (no
 * motion when the user prefers reduced motion).
 *
 * Where it goes: one `Toast` in the app shell with `toastMessage` and
 * `toastTone` of `useUi()` (the provider hides it after its timer), and one
 * inside every open `Dialog` (the `Dialog` renders it). A modal dialog makes
 * the rest of the page inert and covers it, so a page toast could be neither
 * seen nor announced while a dialog is open: the page toast (`layer="page"`)
 * hides itself while a modal dialog is open, and the dialog's own toast
 * (`layer="dialog"`) shows the message in the top layer instead.
 *
 * A new message reaches the page one effect later than the prop, after the
 * effects of the same update have run, so a toast shown while a dialog
 * closes is written when the page is no longer inert and is announced.
 *
 * @param {{ message?: string, tone?: 'neutral'|'ok'|'warn'|'danger', layer?: 'page'|'dialog', className?: string }} props
 *   `className` positions the region (default: bottom centre, above the tab bar; 24 px from the
 *   bottom from 1024 px).
 */
export default function Toast({ message = '', tone = 'neutral', layer = 'page', className }) {
  // The first render shows the message at once (a dialog opening over a
  // visible toast shows it without announcing it again); later changes
  // land after this update's effects (see above).
  const [shown, setShown] = useState({ message, tone });
  useEffect(() => {
    // Mirrors the props one effect later on purpose (see the component comment).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown((current) => (current.message === message && current.tone === tone ? current : { message, tone }));
  }, [message, tone]);

  const look = toneClasses(shown.tone);
  const icon = ICONS[shown.tone] ?? ICONS.neutral;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-toast-layer={layer}
      className={cx(
        'pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6',
        // Under an open modal dialog the page toast is inert and covered; the dialog shows its own.
        layer === 'page' && '[body:has(dialog:modal)_&]:hidden',
        className,
      )}
    >
      {shown.message ? (
        <div className="pointer-events-auto flex max-w-[min(100%,32rem)] animate-rise-in items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3 text-body-sm font-medium text-ink shadow-dialog">
          <Icon icon={icon} size={18} className={look.text} />
          <span>{shown.message}</span>
        </div>
      ) : null}
    </div>
  );
}
