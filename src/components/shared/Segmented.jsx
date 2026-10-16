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

/** The Auto/Adjust choice every recommendation offers. */
export const AUTO_ADJUST_OPTIONS = Object.freeze([
  Object.freeze({ value: "auto", label: "Auto" }),
  Object.freeze({ value: "manual", label: "Adjust" }),
]);

/** Container and button classes per size. */
const SIZES = {
  sm: {
    group: "flex bg-card-border/50 rounded-lg p-0.5",
    button: "px-2 py-0.5 text-xs rounded-md",
    active: "bg-card text-text-primary shadow-sm font-bold",
    idle: "text-text-secondary hover:text-text-primary",
  },
  lg: {
    group: "flex p-1 bg-card-border/50 rounded-xl",
    button: "flex-1 py-2 text-sm rounded-lg",
    active: "font-semibold bg-card text-text-primary shadow-sm border border-card-border/60",
    idle: "font-medium text-text-secondary hover:text-text-primary",
  },
};

/**
 * A segmented control: two or more buttons that pick one value. The group is
 * labelled with `label`; the active button has `aria-pressed="true"`.
 *
 * `size="sm"` is the small pill used next to section headings (Auto/Adjust,
 * units); `size="lg"` fills the row (the sweat source picker).
 *
 * @template {string} T
 * @param {{ label: string, value: T, onChange: (value: T) => void,
 *   options: ReadonlyArray<{ value: T, label: string }>, size?: 'sm'|'lg', className?: string }} props
 */
export default function Segmented({ label, value, onChange, options, size = "sm", className = "" }) {
  const look = SIZES[size] ?? SIZES.sm;
  return (
    <div role="group" aria-label={label} className={`${look.group} ${className}`.trim()}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`${look.button} transition-colors ${active ? look.active : look.idle}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
