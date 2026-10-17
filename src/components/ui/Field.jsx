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

import { Children, cloneElement, isValidElement, useId } from 'react';
import { CircleAlert } from 'lucide-react';
import Icon from './Icon';
import { useWhyParts } from './Why';
import { cx } from './cx';
import { useT } from '../../i18n/useT';

/**
 * The props a `Field` passes to its control.
 * @typedef {{ id: string, 'aria-describedby'?: string, 'aria-invalid'?: true }} FieldControlProps
 */

/**
 * A form field: a visible label, the control, an optional hint and an
 * optional error, wired together: the label's `for` is the control's id,
 * and the hint and error are the control's `aria-describedby`; an error
 * also sets `aria-invalid` and shows an icon and an "Error:" prefix for
 * screen readers (never colour alone).
 *
 * The control is either a render function `(controlProps) => <input …/>` or
 * a single element, which gets `id`, `aria-describedby` and `aria-invalid`
 * merged in (its own `aria-describedby` ids are kept, first).
 *
 * `why` (an explanation from the plan) adds a "Why?" button at the right of
 * the label row and its panel, full width, under the row. Use it rather
 * than a `Why` in `labelAside`: that slot keeps its content at its natural
 * width, so an open explanation there would widen the field past the screen.
 *
 * @param {{ label: import('react').ReactNode, hint?: import('react').ReactNode, error?: import('react').ReactNode,
 *   id?: string, labelHidden?: boolean, labelAside?: import('react').ReactNode,
 *   why?: import('./Why').Explanation|null, whyLabel?: import('react').ReactNode, className?: string,
 *   children: import('react').ReactElement | ((props: FieldControlProps) => import('react').ReactNode) }} props
 *   `id` is the control's id (default generated); `labelHidden` keeps the label for screen readers
 *   only (for a field whose purpose is visible otherwise, e.g. a table cell); `labelAside` renders
 *   at the right of the label row and is for small controls that keep one line (a unit switch, a
 *   chip); `whyLabel` replaces the "Why?" button text.
 */
export default function Field({ label, hint, error, id, labelHidden = false, labelAside, why, whyLabel, className, children }) {
  const t = useT();
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId.replace(/:/g, '')}`;
  const whyParts = useWhyParts(why, { label: whyLabel, id: `${controlId}-why`, panelClassName: 'mb-2' });
  const aside = labelAside || whyParts.button;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  /** @type {FieldControlProps} */
  const controlProps = { id: controlId, 'aria-describedby': describedBy };
  if (error) controlProps['aria-invalid'] = true;

  let control;
  if (typeof children === 'function') {
    control = children(controlProps);
  } else {
    const child = Children.only(children);
    if (isValidElement(child)) {
      const own = /** @type {any} */ (child.props)['aria-describedby'];
      control = cloneElement(/** @type {import('react').ReactElement<any>} */ (child), {
        ...controlProps,
        'aria-describedby': [own, describedBy].filter(Boolean).join(' ') || undefined,
      });
    } else {
      control = child;
    }
  }

  return (
    <div className={cx('min-w-0', className)}>
      <div className={cx('mb-1 flex items-end justify-between gap-2', labelHidden && !aside && 'sr-only')}>
        <label htmlFor={controlId} className={cx('caption text-ink-2', labelHidden && 'sr-only')}>
          {label}
        </label>
        {aside ? (
          <div className="flex shrink-0 items-center gap-2">
            {labelAside}
            {whyParts.button}
          </div>
        ) : null}
      </div>
      {whyParts.panel}
      {control}
      {hint ? (
        <p id={hintId} className="mt-1 text-body-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 flex items-start gap-1.5 text-body-sm text-danger">
          <Icon icon={CircleAlert} size={16} className="mt-0.5" />
          <span>
            <span className="sr-only">{t('ui-common.error')}:</span> {error}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Classes of a text-like control (input, select) inside a `Field`. */
export const CONTROL_CLASSES =
  'block w-full min-h-11 rounded-control border border-line-strong bg-surface-2 px-3 text-body text-ink ' +
  'placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';
