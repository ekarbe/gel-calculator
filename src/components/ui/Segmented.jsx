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

import { useMemo, useRef } from 'react';
import Icon from './Icon';
import { cx } from './cx';
import { useT } from '../../i18n/useT';

/**
 * @template {string|number} T
 * @typedef {{ value: T, label: import('react').ReactNode, icon?: import('react').ComponentType<any>,
 *   disabled?: boolean, ariaLabel?: string }} SegmentedOption
 */

/**
 * The Auto/Adjust options every recommendation offers (`'auto'` and
 * `'manual'`), labelled in the UI language.
 * @returns {Array<SegmentedOption<'auto'|'manual'>>}
 */
export function useAutoAdjustOptions() {
  const t = useT();
  return useMemo(
    () => [
      { value: 'auto', label: t('ui-common.auto') },
      { value: 'manual', label: t('ui-common.adjust') },
    ],
    [t],
  );
}

/** Option height per size; `md` is a 44 px touch target, `sm` grows to 44 px on touch screens. */
const SIZES = Object.freeze({
  sm: 'min-h-8 pointer-coarse:min-h-11 px-2.5 text-body-sm',
  md: 'min-h-11 px-3 text-body-sm',
});

/**
 * A segmented control: pick one of a few options. A WAI-ARIA radio group:
 * `role="radiogroup"` named by `label` (or `labelledBy`), options with
 * `role="radio"` and `aria-checked`, one tab stop (roving tabindex on the
 * checked option), Arrow keys move and select (wrapping, skipping disabled
 * options), Home/End jump to the first/last, Space or a click selects.
 * The checked option also differs by its border and weight, not colour only.
 *
 * @template {string|number} T
 * @param {{ label?: string, labelledBy?: string, value: T, onChange: (value: T) => void,
 *   options: ReadonlyArray<SegmentedOption<T>>, size?: 'sm'|'md', fullWidth?: boolean,
 *   disabled?: boolean, id?: string, className?: string } & Record<string, unknown>} props
 *   Other props (`data-testid`, `aria-describedby`) go to the group.
 */
export default function Segmented({
  label,
  labelledBy,
  value,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  disabled = false,
  id,
  className,
  ...rest
}) {
  const refs = useRef(/** @type {Array<HTMLButtonElement|null>} */ ([]));
  const list = Array.isArray(options) ? options : [];
  const enabled = (index) => !disabled && !list[index]?.disabled;
  const checkedIndex = list.findIndex((option) => option.value === value);
  const firstEnabled = list.findIndex((_, index) => enabled(index));
  const tabIndexOwner = checkedIndex !== -1 && enabled(checkedIndex) ? checkedIndex : firstEnabled;

  /** Selects and focuses the next enabled option from `from` in `direction` (wrapping). */
  const move = (from, direction) => {
    for (let step = 1; step <= list.length; step += 1) {
      const index = (((from + direction * step) % list.length) + list.length) % list.length;
      if (enabled(index)) {
        refs.current[index]?.focus();
        if (list[index].value !== value) onChange(list[index].value);
        return;
      }
    }
  };

  const onKeyDown = (event, index) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(-1, 1);
        break;
      case 'End':
        event.preventDefault();
        move(list.length, -1);
        break;
      default:
    }
  };

  return (
    <div
      role="radiogroup"
      id={id}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={cx(
        'inline-flex max-w-full gap-0.5 rounded-control border border-line bg-surface-2 p-0.5',
        fullWidth && 'flex w-full',
        className,
      )}
      {...rest}
    >
      {list.map((option, index) => {
        const checked = index === checkedIndex;
        return (
          <button
            key={String(option.value)}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            disabled={!enabled(index)}
            tabIndex={index === tabIndexOwner ? 0 : -1}
            onClick={() => {
              if (!checked) onChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 rounded-[6px] border transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-50',
              SIZES[size] ?? SIZES.md,
              fullWidth && 'flex-1',
              // Forced colours: the checked option takes the system highlight, the others lose their
              // border, so the choice never shows by font weight alone.
              'forced-colors:forced-color-adjust-none',
              checked
                ? 'border-line-strong bg-surface font-semibold text-ink forced-colors:border-[color:Highlight] forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]'
                : 'border-transparent font-medium text-ink-2 hover:text-ink forced-colors:border-[color:Canvas] forced-colors:bg-[color:Canvas] forced-colors:text-[color:ButtonText]',
            )}
          >
            {option.icon ? <Icon icon={option.icon} size={16} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
