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
import Icon from './Icon';
import Why from './Why';
import { cx, toneClasses } from './cx';

/**
 * A KPI tile of the race board: a substance colour bar on the left edge, a
 * small uppercase caption, the big number (display face, tabular figures,
 * 2.25 rem on phones and 3 rem from 1024 px) with its unit, a one-line
 * sub-info and an optional "Why?" disclosure. The tile is a group named by
 * its caption, so a screen reader reads "Carbs, group, 75 g/h, …".
 * `aside` goes at the right end of the caption row (a compact "Why?"
 * button), so the tile spends no row of its own on it. The tile is a size
 * container: narrower than 12 rem (a phone's 2 × 2) the caption drops its
 * icon (the colour bar keeps the substance) and a compact "Why?" shows its
 * icon only, so caption and button keep one row in every language.
 *
 * @param {{ label: import('react').ReactNode, value: import('react').ReactNode, unit?: import('react').ReactNode,
 *   sub?: import('react').ReactNode, aside?: import('react').ReactNode, tone?: string, icon?: import('react').ComponentType<any>,
 *   why?: import('./Why').Explanation|null, whyLabel?: import('react').ReactNode,
 *   valueProps?: import('react').HTMLAttributes<HTMLElement> & Record<string, unknown>,
 *   className?: string, children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLDivElement>} props
 *   `tone`: glucose, fructose, sodium, fluid, caffeine (or any tone of `cx.js`); `valueProps` go to
 *   the value element (e.g. a `data-testid`); `children` render under the sub-info.
 */
export default function Stat({
  label,
  value,
  unit,
  sub,
  aside,
  tone = 'neutral',
  icon,
  why,
  whyLabel,
  valueProps,
  className,
  children,
  ...rest
}) {
  const labelId = useId();
  const look = toneClasses(tone);
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cx('@container relative min-w-0 overflow-hidden rounded-panel border border-line bg-surface py-2.5 pl-5 pr-3 lg:py-4', className)}
      {...rest}
    >
      <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 w-1.5', look.fill)} />
      <div className="flex min-h-5 items-center justify-between gap-2">
        <p id={labelId} className={cx('caption flex min-w-0 items-center gap-1.5', look.text)}>
          {/* A narrow tile (a phone's 2 × 2) leaves the icon out, so the caption and "Why?" share the row. */}
          {icon ? <Icon icon={icon} size={14} className="@max-[12rem]:hidden" /> : null}
          {label}
        </p>
        {aside ? <div className="flex shrink-0">{aside}</div> : null}
      </div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="kpi-value text-ink" {...valueProps}>
          {value}
        </span>
        {unit ? <span className="text-body-sm font-semibold text-ink-2">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1 text-body-sm text-ink-2">{sub}</p> : null}
      {children}
      {why ? <Why why={why} label={whyLabel} className="mt-1" /> : null}
    </div>
  );
}
