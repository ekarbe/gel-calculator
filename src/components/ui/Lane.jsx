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


import { cx, toneClasses } from './cx';

/**
 * One line of a recipe lane: a colour dot, the label, the amount and, when
 * `share` is given, a horizontal bar whose length is that share (an
 * ingredient's part of its section's carbs). Without `share` it is a plain
 * row with its colour dot (salts, water, caffeine: no fake bars). The bar
 * and dot are decorative; `shareLabel` gives screen readers the share in
 * words. Renders a `<div>`; use `as="li"` inside a list.
 *
 * @param {{ label: import('react').ReactNode, amount?: import('react').ReactNode, share?: number|null,
 *   tone?: string, detail?: import('react').ReactNode, shareLabel?: string, as?: import('react').ElementType,
 *   amountProps?: import('react').HTMLAttributes<HTMLElement> & Record<string, unknown>,
 *   className?: string } & import('react').HTMLAttributes<HTMLElement>} props
 *   `share` is 0–1 (clamped; non-finite → no bar); `detail` is a second, smaller line (e.g. "105 g
 *   glucose · 53 g fructose"); `amountProps` go to the amount element (e.g. a `data-testid`).
 */
export default function Lane({
  label,
  amount,
  share,
  tone = 'neutral',
  detail,
  shareLabel,
  as: Component = 'div',
  amountProps,
  className,
  ...rest
}) {
  const look = toneClasses(tone);
  const hasBar = typeof share === 'number' && Number.isFinite(share);
  const pct = hasBar ? Math.min(100, Math.max(0, share * 100)) : 0;
  return (
    <Component className={cx('min-w-0 py-1.5', className)} {...rest}>
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true" className={cx('size-2.5 shrink-0 translate-y-[-1px] rounded-full', look.fill)} />
        <span className="min-w-0 flex-1 text-body-sm text-ink">{label}</span>
        {amount !== undefined && amount !== null ? (
          <span className="shrink-0 font-mono text-body-sm font-medium text-ink" {...amountProps}>
            {amount}
          </span>
        ) : null}
      </div>
      {detail ? <p className="ml-[1.125rem] text-caption text-muted">{detail}</p> : null}
      {hasBar ? (
        <div aria-hidden="true" className="ml-[1.125rem] mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={cx('h-full rounded-full', look.fill)} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {hasBar && shareLabel ? <span className="sr-only">{shareLabel}</span> : null}
    </Component>
  );
}
