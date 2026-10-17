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

import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import Toast from './Toast';
import { cx } from './cx';
import { useT } from '../../i18n/useT';
import { UiContext } from '../../state/UiProvider';

/** Width per size. */
const SIZES = Object.freeze({ sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' });

/**
 * A modal dialog on the native `<dialog>` element (`showModal()`: the page
 * behind is inert, focus stays inside, the browser draws the backdrop in the
 * `--scrim` colour of globals.css).
 *
 * Controlled: `open` shows it, `onClose` asks the owner to set `open` to
 * false. Escape (the native `cancel` event), the close button and a click on
 * the backdrop call `onClose`; the dialog itself closes only when `open`
 * turns false, so the owner's state and the dialog never disagree. An inline
 * editor inside can keep Escape for itself with `event.preventDefault()` on
 * its keydown.
 *
 * Content: renders only while open, and mounts right after `showModal()`
 * (before the browser paints), so React's `autoFocus` works inside.
 *
 * Focus: on open, `initialFocus` (a ref); else the element React focused
 * for `autoFocus`; else the first element with `data-autofocus` (or an
 * `autofocus` attribute); else the close button. On close (or unmount while
 * open), focus returns to `returnFocus` (a ref) or to the element that had
 * focus when the dialog opened, when it is still in the page. The page does
 * not scroll behind an open dialog.
 *
 * Toast: inside a `UiProvider` the dialog renders its own toast region (the
 * `toastMessage` of `useUi()`), because the page's toast is inert and
 * covered while a modal dialog is open. `showToast` from inside a dialog
 * is therefore seen and announced.
 *
 * Labelling: `title` is the dialog's heading (`<h2>`, `aria-labelledby`);
 * `description` is a paragraph under it (`aria-describedby`). Other props
 * (`data-testid`) go to the `<dialog>`.
 *
 * @param {{ open: boolean, onClose: () => void, title: import('react').ReactNode,
 *   description?: import('react').ReactNode, children?: import('react').ReactNode,
 *   footer?: import('react').ReactNode, size?: 'sm'|'md'|'lg',
 *   initialFocus?: import('react').RefObject<HTMLElement|null>,
 *   returnFocus?: import('react').RefObject<HTMLElement|null>,
 *   closeLabel?: string, className?: string, bodyClassName?: string } & Record<string, unknown>} props
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
  returnFocus,
  closeLabel,
  className,
  bodyClassName,
  ...rest
}) {
  const t = useT();
  const ui = useContext(UiContext);
  const dialogRef = useRef(/** @type {HTMLDialogElement|null} */ (null));
  const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const pointerDownOnBackdrop = useRef(false);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const returnFocusRef = useRef(returnFocus);
  // True once showModal() ran for the current opening: the content mounts then.
  const [shown, setShown] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
    returnFocusRef.current = returnFocus;
  });

  // Opens the native dialog before the browser paints. The content mounts in
  // the next (synchronous) render, inside the open dialog, so an autoFocus
  // in it can take focus.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return undefined;
    const opener = document.activeElement;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    // The content mounts only now (see above).
    setShown(true);

    const latestReturnFocus = returnFocusRef;
    return () => {
      setShown(false);
      html.style.overflow = previousOverflow;
      // Closing because the owner asked (or unmounted): its close event must not call onClose again.
      openRef.current = false;
      if (dialog.open) dialog.close();
      // The return target is read at close time (it may have been rendered after opening).
      const back = latestReturnFocus.current?.current ?? opener;
      if (back && back.isConnected && typeof back.focus === 'function') back.focus();
    };
  }, [open]);

  // Initial focus, once the content is in the open dialog.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!shown || !dialog) return;
    const active = document.activeElement;
    const autoFocused = active instanceof HTMLElement && active !== dialog && dialog.contains(active) ? active : null;
    const target =
      initialFocus?.current ??
      autoFocused ??
      dialog.querySelector('[data-autofocus], [autofocus]') ??
      closeRef.current;
    if (target && target !== document.activeElement && typeof target.focus === 'function') target.focus();
    // Focus targets are read when the dialog opens; changing them while open has no effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape: let the owner close it (the effect then calls close()).
        event.preventDefault();
        onCloseRef.current?.();
      }}
      onClose={() => {
        // Closed by the browser itself (e.g. a second Escape): tell the owner.
        if (openRef.current) onCloseRef.current?.();
      }}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pointerDownOnBackdrop.current) onCloseRef.current?.();
        pointerDownOnBackdrop.current = false;
      }}
      className={cx(
        'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-panel border border-line bg-surface p-0 text-ink shadow-dialog',
        'open:flex open:flex-col open:animate-rise-in',
        SIZES[size] ?? SIZES.md,
        className,
      )}
      {...rest}
    >
      {open && shown ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line py-2 pl-4 pr-2 lg:pl-5">
            <h2 id={titleId} className="display-section min-w-0 py-2 text-ink">
              {title}
            </h2>
            <Button ref={closeRef} variant="ghost" iconOnly icon={X} onClick={() => onCloseRef.current?.()}>
              {closeLabel ?? t('ui-common.close')}
            </Button>
          </div>
          {/* flex-auto (basis: its content), not flex-1 (basis 0%): a percentage
              inside the fit-content modal depends on the dialog's own height, and
              iOS Safari resolved it to 0, so the body collapsed to its padding on
              iPhones. Too tall for the screen, it shrinks (min-h-0) and scrolls. */}
          <div data-dialog-body="" className={cx('min-h-0 flex-auto overflow-y-auto px-4 py-4 lg:px-5', bodyClassName)}>
            {description ? (
              <p id={descriptionId} className="mb-3 text-body-sm text-ink-2">
                {description}
              </p>
            ) : null}
            {children}
          </div>
          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 lg:px-5">{footer}</div>
          ) : null}
          {ui ? <Toast layer="dialog" message={ui.toastMessage} tone={ui.toastTone} /> : null}
        </>
      ) : null}
    </dialog>
  );
}
