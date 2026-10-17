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

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Field from './Field';
import Icon from './Icon';
import { cx } from './cx';
import { useT } from '../../i18n/useT';
import { useFormat } from '../../i18n/format';
import { roundTo, roundToStep } from '../../domain/units';

/** @param {number} x @returns {number} */
const identity = (x) => x;

/**
 * A number field: label, a text input with − and + steppers, a unit
 * suffix, hint and error (through {@link Field}).
 *
 * Values: `value` is the stored value (the plan's metric unit); `toInput`
 * converts it to the number shown and `fromInput` converts a typed number
 * back (default: none). For imperial use the formatters:
 * `toInput={(kg) => f.toDisplay('mass', kg)}`, `fromInput={(lb) => f.fromDisplay('mass', lb)}`
 * with `f = useFormat()`. `min`, `max` and `step` are in the **shown** unit
 * (convert limits with `f.toDisplay`).
 *
 * Typing (ported from the Phase 2 `NumberInput`): the typed text stays as
 * typed while the field has focus, so clamping never fights the keyboard.
 * Text is read in the UI locale ("1,5" and "1.5"; see `parseLocaleNumber`).
 * A number within [min, max] is committed at once (`onChange(fromInput(n))`),
 * so the plan updates live. Clearing the field commits `emptyValue` when
 * one is given. Leaving the field commits a finite number clamped to
 * [min, max] and shows the stored value again, formatted with up to
 * `digits` decimals.
 *
 * Keyboard (WAI-ARIA spin button): the input has `role="spinbutton"` with
 * `aria-valuenow/min/max` and an `aria-valuetext` that includes the unit.
 * ArrowUp/ArrowDown step by `step` (×10 with Shift), PageUp/PageDown by
 * 10 × `step`, snapped to the step grid and clamped. The − and + buttons do
 * the same for pointer users; they are named "Decrease/Increase <label>"
 * and left out of the tab order (the arrow keys cover them), so the field is
 * one tab stop.
 *
 * Phone keyboards: the decimal keypad (`inputMode="decimal"`), or the full
 * keyboard when `min` is below 0, because the iOS decimal keypad has no
 * minus key (a temperature below 0 °C or 0 °F could only be reached with
 * the − button otherwise). The value is set in the body face with tabular
 * figures, as inputs are (the data face is for tables and times).
 *
 * Other props (`data-testid`, `placeholder`, `autoComplete`, `inputMode`, …)
 * go to the `<input>`.
 *
 * @param {{ label: import('react').ReactNode, labelText?: string, value: number,
 *   onChange: (value: number) => void, min?: number, max?: number, step?: number,
 *   unit?: string, hint?: import('react').ReactNode, error?: import('react').ReactNode, id?: string,
 *   toInput?: (stored: number) => number, fromInput?: (shown: number) => number, digits?: number,
 *   emptyValue?: number, blankZero?: boolean, steppers?: boolean, disabled?: boolean,
 *   labelHidden?: boolean, labelAside?: import('react').ReactNode,
 *   why?: import('./Why').Explanation|null, whyLabel?: import('react').ReactNode, className?: string,
 *   inputClassName?: string } & Record<string, unknown>} props
 *   `labelText` names the steppers when `label` is not a plain string; `digits` (default 2) is the
 *   most decimals shown; `blankZero` shows a stored 0 as an empty field (use with a placeholder);
 *   `steppers` (default true) shows the − and + buttons; `why`, `whyLabel` and `labelAside` as in
 *   {@link Field} (a "Why?" goes in `why`, not in `labelAside`).
 */
export default function NumberField({
  label,
  labelText,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
  error,
  id,
  toInput = identity,
  fromInput = identity,
  digits = 2,
  emptyValue,
  blankZero = false,
  steppers = true,
  disabled = false,
  labelHidden,
  labelAside,
  why,
  whyLabel,
  className,
  inputClassName,
  ...rest
}) {
  const t = useT();
  const f = useFormat();
  const [draft, setDraft] = useState(/** @type {string|null} */ (null));
  const name = labelText ?? (typeof label === 'string' ? label : '');

  const shown = typeof value === 'number' && Number.isFinite(value) ? roundTo(toInput(value), digits) : NaN;
  const shownText = blankZero && shown === 0 ? '' : f.inputValue(shown, digits);
  const hasMin = typeof min === 'number' && Number.isFinite(min);
  const hasMax = typeof max === 'number' && Number.isFinite(max);
  const inRange = (n) => Number.isFinite(n) && (!hasMin || n >= min) && (!hasMax || n <= max);
  const clamp = (n) => Math.min(hasMax ? max : Infinity, Math.max(hasMin ? min : -Infinity, n));
  const stepSize = typeof step === 'number' && step > 0 ? step : 1;

  /** Commits a shown-unit number (already clamped). */
  const commit = (n) => onChange(fromInput(n));

  /** Steps from the current (typed or stored) number. */
  const stepBy = (multiple) => {
    const typed = draft === null ? NaN : f.parseNumber(draft);
    const base = Number.isFinite(typed) ? typed : Number.isFinite(shown) ? shown : hasMin ? min : 0;
    const next = clamp(roundToStep(base + multiple * stepSize, stepSize));
    setDraft(null);
    commit(next);
  };

  const onKeyDown = (event) => {
    const keys = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (!Object.hasOwn(keys, event.key) || disabled) return;
    event.preventDefault();
    const factor = event.shiftKey && Math.abs(keys[event.key]) === 1 ? 10 : 1;
    stepBy(keys[event.key] * factor);
  };

  const valueText = shownText === '' ? undefined : unit ? `${shownText} ${unit}` : shownText;
  const atMin = hasMin && Number.isFinite(shown) && shown <= min;
  const atMax = hasMax && Number.isFinite(shown) && shown >= max;
  const stepperClasses =
    'inline-flex size-11 shrink-0 items-center justify-center text-ink-2 hover:bg-surface hover:text-ink ' +
    'disabled:cursor-not-allowed disabled:opacity-40';

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
        <div
          className={cx(
            'flex min-h-11 items-stretch overflow-hidden rounded-control border bg-surface-2',
            'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus',
            // One border colour (two would fight; the CSS order decides).
            error ? 'border-danger' : 'border-line-strong',
            disabled && 'opacity-50',
          )}
        >
          {steppers ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('ui-common.decrease', { label: name })}
              aria-controls={controlProps.id}
              disabled={disabled || atMin}
              onClick={() => stepBy(-1)}
              className={cx(stepperClasses, 'border-r border-line')}
            >
              <Icon icon={Minus} size={18} />
            </button>
          ) : null}
          <input
            type="text"
            inputMode={hasMin && min < 0 ? 'text' : 'decimal'}
            role="spinbutton"
            autoComplete="off"
            {...rest}
            {...controlProps}
            disabled={disabled}
            aria-valuenow={Number.isFinite(shown) ? shown : undefined}
            aria-valuemin={hasMin ? min : undefined}
            aria-valuemax={hasMax ? max : undefined}
            aria-valuetext={valueText}
            value={draft ?? shownText}
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              if (text.trim() === '') {
                if (emptyValue !== undefined) onChange(emptyValue);
                return;
              }
              const n = f.parseNumber(text);
              if (inRange(n)) commit(n);
            }}
            onBlur={() => {
              if (draft === null) return;
              const n = f.parseNumber(draft);
              if (Number.isFinite(n)) commit(clamp(n));
              setDraft(null);
            }}
            onKeyDown={onKeyDown}
            className={cx(
              'min-w-0 flex-1 bg-transparent px-3 text-right font-sans num text-body text-ink focus-visible:outline-none',
              'disabled:cursor-not-allowed',
              inputClassName,
            )}
          />
          {unit ? (
            <span aria-hidden="true" className="flex items-center pr-3 text-body-sm text-muted">
              {unit}
            </span>
          ) : null}
          {steppers ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('ui-common.increase', { label: name })}
              aria-controls={controlProps.id}
              disabled={disabled || atMax}
              onClick={() => stepBy(1)}
              className={cx(stepperClasses, 'border-l border-line')}
            >
              <Icon icon={Plus} size={18} />
            </button>
          ) : null}
        </div>
      )}
    </Field>
  );
}
