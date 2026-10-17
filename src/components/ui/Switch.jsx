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

import { useId } from 'react';
import { cx } from './cx';
import { useT } from '../../i18n/useT';

/**
 * An on/off switch: a `<button role="switch" aria-checked>` whose content is
 * the visible label, so the whole row (at least 44 px tall) is the target
 * and the label is its accessible name. Space and Enter toggle it (native
 * button). The state shows as the knob position and, with `showState`, as
 * "On"/"Off" text too, never by colour alone. `description` is linked with
 * `aria-describedby`. Other props (`data-testid`) go to the button.
 *
 * @param {{ label: import('react').ReactNode, checked: boolean, onChange: (checked: boolean) => void,
 *   description?: import('react').ReactNode, showState?: boolean, disabled?: boolean, id?: string,
 *   className?: string } & Record<string, unknown>} props
 */
export default function Switch({ label, checked, onChange, description, showState = false, disabled = false, id, className, ...rest }) {
  const t = useT();
  const descriptionId = useId();
  const on = checked === true;
  return (
    <div className={cx('min-w-0', className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={on}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control text-left text-body text-ink disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      >
        <span className="min-w-0">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {showState ? (
            <span aria-hidden="true" className="caption text-ink-2">
              {on ? t('ui-common.on') : t('ui-common.off')}
            </span>
          ) : null}
          {/* Forced colours (Windows high contrast) drop the fills, which leaves an empty pill either way:
              system colours keep the knob visible and the "on" track filled. */}
          <span
            aria-hidden="true"
            data-testid="switch-track"
            className={cx(
              'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-150',
              'forced-colors:forced-color-adjust-none',
              on
                ? 'border-ink bg-ink forced-colors:border-[color:Highlight] forced-colors:bg-[color:Highlight]'
                : 'border-line-strong bg-surface-2 forced-colors:border-[color:CanvasText] forced-colors:bg-[color:Canvas]',
            )}
          >
            <span
              data-testid="switch-knob"
              className={cx(
                'inline-block size-4 rounded-full transition-transform duration-150',
                on
                  ? 'translate-x-[22px] bg-surface forced-colors:bg-[color:HighlightText]'
                  : 'translate-x-[3px] bg-ink-2 forced-colors:bg-[color:CanvasText]',
              )}
            />
          </span>
        </span>
      </button>
      {description ? (
        <p id={descriptionId} className="mt-0.5 text-body-sm text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}
