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

import { forwardRef } from 'react';
import Icon from './Icon';
import { cx } from './cx';

/** Look per variant. Only `primary` uses the accent (the one primary action per view). */
const VARIANTS = Object.freeze({
  // The transparent border shows as an outline in forced colours (Windows high contrast), where the fill is gone.
  primary: 'bg-accent text-accent-ink font-semibold border border-transparent hover:brightness-95 active:brightness-90',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-danger border border-danger hover:bg-danger-soft',
});

/** Height and padding per size; `md` and `lg` are at least 44 px (touch targets). */
const SIZES = Object.freeze({
  sm: 'min-h-9 pointer-coarse:min-h-11 px-3 text-body-sm gap-1.5',
  md: 'min-h-11 px-4 text-body gap-2',
  // One font size per size (two text-* classes would fight; the CSS order decides, not this list).
  lg: 'min-h-12 px-5 gap-2 uppercase tracking-wide font-display text-title',
});

/** Square sizes for icon-only buttons. */
const ICON_SIZES = Object.freeze({
  sm: 'size-9 pointer-coarse:size-11',
  md: 'size-11',
  lg: 'size-12',
});

/**
 * A button in the design system's look. Always `type="button"` unless
 * `type` is given. `icon` adds a decorative lucide icon before the text;
 * `iconOnly` hides the text visually but keeps it as the accessible name
 * (so an icon button always has a name). Other props (`onClick`,
 * `aria-*`, `disabled`, `data-testid`, …) go to the `<button>`; the ref too.
 *
 * @type {import('react').ForwardRefExoticComponent<{
 *   variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg',
 *   icon?: import('react').ComponentType<any>, iconOnly?: boolean, fullWidth?: boolean,
 *   className?: string, children?: import('react').ReactNode
 * } & import('react').ButtonHTMLAttributes<HTMLButtonElement> & import('react').RefAttributes<HTMLButtonElement>>}
 */
const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly = false, fullWidth = false, className, children, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'sm' ? 16 : 20;
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded-control transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant] ?? VARIANTS.secondary,
        iconOnly ? ICON_SIZES[size] ?? ICON_SIZES.md : SIZES[size] ?? SIZES.md,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon ? <Icon icon={icon} size={iconSize} /> : null}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
});

export default Button;
