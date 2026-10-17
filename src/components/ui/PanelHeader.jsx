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
import Icon from './Icon';
import { useWhyParts } from './Why';
import { cx } from './cx';

/**
 * The title row of a panel: a heading in the display face (uppercase,
 * condensed), an optional icon, an actions slot for small controls (an
 * Auto/Adjust `Segmented`, a button) and an optional description under
 * the row, full width.
 *
 * The title and the actions share one row while they fit; otherwise the
 * actions wrap under the title (a long German title, a wide button, text
 * spacing at 320 px), so neither is squeezed into a narrow column and the
 * row never overflows its panel. The description never shares the row.
 *
 * `why` (an explanation from the plan) adds a "Why?" button after the
 * actions and its panel, full width, under the title row. Use it rather
 * than a `Why` in `actions`: an open explanation there would widen the
 * header and squeeze the title.
 *
 * Collapsible: pass `expanded` (boolean) and `onToggle`; the title then
 * becomes a button inside the heading with `aria-expanded` and
 * `aria-controls={controls}` (the id of the panel body, which the caller
 * hides when collapsed): the WAI-ARIA disclosure/accordion header pattern.
 * Its chevron sits right after the title on every panel, with or without
 * actions.
 *
 * @param {{ title: import('react').ReactNode, id?: string, level?: 2|3|4|5|6,
 *   icon?: import('react').ComponentType<any>, iconClassName?: string,
 *   description?: import('react').ReactNode, actions?: import('react').ReactNode,
 *   why?: import('./Why').Explanation|null, whyLabel?: import('react').ReactNode,
 *   expanded?: boolean, onToggle?: () => void, controls?: string, className?: string }} props
 *   `id` goes to the heading (use it as the panel's `aria-labelledby`); `level` is the heading level
 *   (default 2); `iconClassName` colours the icon (a tone text class such as `text-glucose`);
 *   `whyLabel` replaces the "Why?" button text.
 */
export default function PanelHeader({
  title,
  id,
  level = 2,
  icon,
  iconClassName = 'text-ink-2',
  description,
  actions,
  why,
  whyLabel,
  expanded,
  onToggle,
  controls,
  className,
}) {
  const Heading = `h${Math.min(6, Math.max(2, Math.round(level) || 2))}`;
  const collapsible = typeof expanded === 'boolean';
  const whyParts = useWhyParts(why, { label: whyLabel, panelClassName: 'mt-2' });
  const label = (
    <>
      {icon ? <Icon icon={icon} size={20} className={iconClassName} /> : null}
      <span className="min-w-0">{title}</span>
    </>
  );
  // One wrapper whether or not a description or a "Why?" panel shows, so a collapsible title keeps its
  // button (and the keyboard focus on it) when the collapsed summary appears.
  const row = (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <Heading id={id} className="display-title min-w-0 max-w-full text-ink">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={controls}
            onClick={onToggle}
            className="-mx-1 flex min-h-11 items-center gap-2 rounded-control px-1 text-left uppercase"
          >
            {label}
            <Icon
              icon={ChevronDown}
              size={20}
              className={cx('shrink-0 text-muted transition-transform duration-150', expanded && 'rotate-180')}
            />
          </button>
        ) : (
          <span className="flex min-h-8 items-center gap-2">{label}</span>
        )}
      </Heading>
      {actions || whyParts.button ? (
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {actions}
          {whyParts.button}
        </div>
      ) : null}
    </div>
  );
  return (
    <div className={className}>
      {row}
      {description ? <p className="mt-0.5 text-body-sm text-ink-2">{description}</p> : null}
      {whyParts.panel}
    </div>
  );
}
