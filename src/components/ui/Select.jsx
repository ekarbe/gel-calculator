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

import { ChevronDown } from 'lucide-react';
import Field, { CONTROL_CLASSES } from './Field';
import Icon from './Icon';
import { cx } from './cx';

/**
 * @typedef {{ value: string|number, label: string, disabled?: boolean }} SelectOption
 * @typedef {{ label: string, options: SelectOption[] }} SelectGroup
 */

/**
 * A native `<select>` in a {@link Field} (label, hint, error), so keyboard
 * use, type-ahead and the phone pickers come from the browser. Options keep
 * their value type: `onChange` gets the option's own `value` (a number
 * stays a number). Groups (`{ label, options }`) become `<optgroup>`s. Other
 * props (`data-testid`, `required`) go to the `<select>`.
 *
 * @param {{ label: import('react').ReactNode, value: string|number, onChange: (value: any) => void,
 *   options: Array<SelectOption|SelectGroup>, hint?: import('react').ReactNode, error?: import('react').ReactNode,
 *   id?: string, disabled?: boolean, labelHidden?: boolean, labelAside?: import('react').ReactNode,
 *   why?: import('./Why').Explanation|null, whyLabel?: import('react').ReactNode,
 *   placeholder?: string, className?: string } & Record<string, unknown>} props
 *   `placeholder` adds a first, disabled option shown while `value` matches no option; `why`,
 *   `whyLabel` and `labelAside` as in {@link Field}.
 */
export default function Select({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  id,
  disabled = false,
  labelHidden,
  labelAside,
  why,
  whyLabel,
  placeholder,
  className,
  ...rest
}) {
  const list = Array.isArray(options) ? options : [];
  const flat = list.flatMap((entry) => (Array.isArray(entry?.options) ? entry.options : [entry]));
  const selected = flat.find((option) => option.value === value);
  const renderOption = (option) => (
    <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>
      {option.label}
    </option>
  );

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      id={id}
      labelHidden={labelHidden}
      labelAside={labelAside}
      why={why}
      whyLabel={whyLabel}
      className={className}
    >
      {(controlProps) => (
        <div className="relative">
          <select
            {...rest}
            {...controlProps}
            disabled={disabled}
            value={selected ? String(selected.value) : ''}
            onChange={(event) => {
              const option = flat.find((o) => String(o.value) === event.target.value);
              if (option) onChange(option.value);
            }}
            className={cx(CONTROL_CLASSES, 'appearance-none pr-10')}
          >
            {placeholder !== undefined || !selected ? (
              <option value="" disabled>
                {placeholder ?? ''}
              </option>
            ) : null}
            {list.map((entry) =>
              Array.isArray(entry?.options) ? (
                <optgroup key={`group-${entry.label}`} label={entry.label}>
                  {entry.options.map(renderOption)}
                </optgroup>
              ) : (
                renderOption(entry)
              ),
            )}
          </select>
          <Icon
            icon={ChevronDown}
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
          />
        </div>
      )}
    </Field>
  );
}
