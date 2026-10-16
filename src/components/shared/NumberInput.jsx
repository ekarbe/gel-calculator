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

import { useState } from "react";

/**
 * Parses the text of a number field; an empty field is NaN (not 0).
 * @param {string} text
 * @returns {number}
 */
const parseNumber = (text) => (String(text).trim() === "" ? NaN : Number(text));

/**
 * A number input that keeps the text the user types while the field is
 * focused, so clamping never fights the keyboard (typing "154" lb passes
 * through 1 and 15, which are below the mass limit).
 *
 * - Typing: a value that parses and lies within [`min`, `max`] is committed
 *   at once, so the plan updates live.
 * - Clearing the field commits `emptyValue` when one is given (e.g. 0 for a
 *   percentage); otherwise nothing is committed.
 * - Leaving the field commits any finite value as typed (the inputs are
 *   clamped by `normalizeInputs`) and shows the stored value again.
 * - `blankZero` shows a stored 0 as an empty field (use with a placeholder).
 *
 * Other props (`aria-describedby`, `placeholder`, …) go to the `<input>`.
 *
 * @param {{ id: string, value: number, onCommit: (value: number) => void, min?: number, max?: number,
 *   step?: number|string, emptyValue?: number, blankZero?: boolean, className?: string }
 *   & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'value'|'onChange'|'onBlur'|'min'|'max'|'step'>} props
 */
export default function NumberInput({
  id,
  value,
  onCommit,
  min,
  max,
  step = "any",
  emptyValue,
  blankZero = false,
  className = "",
  ...rest
}) {
  const [draft, setDraft] = useState(/** @type {string|null} */ (null));
  const inRange = (n) => Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max);
  const shown = blankZero && value === 0 ? "" : String(value);

  return (
    <input
      inputMode="decimal"
      {...rest}
      id={id}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft ?? shown}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (text.trim() === "") {
          if (emptyValue !== undefined) onCommit(emptyValue);
          return;
        }
        const n = parseNumber(text);
        if (inRange(n)) onCommit(n);
      }}
      onBlur={() => {
        if (draft === null) return;
        const n = parseNumber(draft);
        if (Number.isFinite(n)) onCommit(n);
        setDraft(null);
      }}
      className={className}
    />
  );
}
