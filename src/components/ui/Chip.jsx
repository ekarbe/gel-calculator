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

import Icon from './Icon';
import { cx, toneClasses } from './cx';

/**
 * A small label chip: tinted background (the tone's soft tint), text in the
 * tone colour, 8 px radius, optional decorative icon. Static (`<span>`) by
 * default; with `onClick` it is a `<button>`, and with `pressed` a toggle
 * button (`aria-pressed`), for example in a pick-from grid. Status chips
 * should carry an icon and text, never colour alone. Other props (`aria-*`,
 * `data-testid`, `title`) go to the element.
 *
 * Every chip has the same visual height (28 px), so a static chip and a
 * button chip line up in one row. A button chip's target is larger than
 * what it draws: an invisible hit area of at least 36 × 36 px, 44 × 44 px
 * on touch screens, centred on it.
 *
 * The text wraps inside the chip when it is longer than the room it has, so
 * it is never cut off (a status such as "Bis 2 % Verlust" must stay
 * readable at 320 px). `truncate` cuts it with an ellipsis instead; use it
 * only for text that is repeated in full elsewhere (the full text then goes
 * in `title`).
 *
 * @param {{ tone?: string, icon?: import('react').ComponentType<any>, onClick?: (event: any) => void,
 *   pressed?: boolean, disabled?: boolean, truncate?: boolean, className?: string,
 *   children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLElement>} props
 *   `tone`: neutral (default), accent, glucose, fructose, sodium, fluid, caffeine, ok, warn, danger.
 */
export default function Chip({ tone = 'neutral', icon, onClick, pressed, disabled, truncate = false, className, children, ...rest }) {
  const look = toneClasses(tone);
  const interactive = typeof onClick === 'function' || typeof pressed === 'boolean';
  const classes = cx(
    'inline-flex h-fit min-h-7 max-w-full items-center gap-1.5 rounded-control px-2.5 py-0.5 text-body-sm font-medium',
    look.soft,
    look.text,
    interactive && 'relative border transition-colors duration-150',
    // The hit area: a transparent pseudo-element, centred, at least 36 px (44 px on touch) each way.
    interactive &&
      "before:absolute before:left-1/2 before:top-1/2 before:size-full before:min-h-9 before:min-w-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] pointer-coarse:before:min-h-11 pointer-coarse:before:min-w-11",
    // One border colour at a time (two would fight; the CSS order decides). Pressed: border plus
    // ring, a 2 px outline that does not rely on colour.
    interactive && (pressed === true ? 'border-current ring-1 ring-current' : 'border-transparent hover:border-current'),
    interactive && 'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  );
  const content = (
    <>
      {icon ? <Icon icon={icon} size={14} /> : null}
      <span className={cx('min-w-0', truncate ? 'truncate' : 'break-words')}>{children}</span>
    </>
  );
  if (!interactive) {
    return (
      <span className={classes} {...rest}>
        {content}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} disabled={disabled} className={classes} {...rest}>
      {content}
    </button>
  );
}
