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

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Icon from './Icon';
import { cx } from './cx';

/**
 * The toggle button of a disclosure, on its own: `aria-expanded`,
 * `aria-controls`, an optional icon and a chevron that turns when open.
 * `Disclosure` uses it; use it directly only when the button and the content
 * cannot sit together (`Field` and `PanelHeader` put a "Why?" button in
 * their title row and its panel under the row).
 *
 * `compact` draws it one text line tall (for a caption row, such as a KPI
 * tile's), with the same target as the full one: an invisible hit area of
 * at least 36 px, 44 px on touch screens. In a size container narrower than
 * 12 rem it shows its icon only (the text stays its accessible name).
 *
 * @param {{ open: boolean, onToggle: () => void, controls: string, id?: string,
 *   icon?: import('react').ComponentType<any>, compact?: boolean, className?: string,
 *   children?: import('react').ReactNode }} props
 *   `className` replaces the text colour and size (default `text-ink`).
 */
export function DisclosureButton({ open, onToggle, controls, id, icon, compact = false, className, children }) {
  const iconSize = compact ? 14 : 16;
  return (
    <button
      type="button"
      id={id}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cx(
        'inline-flex items-center rounded-control text-left font-medium',
        compact
          ? "relative h-5 gap-1 before:absolute before:left-1/2 before:top-1/2 before:h-9 before:w-full before:min-w-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] pointer-coarse:before:h-11 pointer-coarse:before:min-w-11"
          : 'min-h-9 gap-1.5 pointer-coarse:min-h-11',
        // The default colour only when the caller sets none (two text colours would fight).
        className || 'text-ink',
      )}
    >
      {icon ? <Icon icon={icon} size={iconSize} /> : null}
      {/* Compact in a narrow container (a phone's KPI tile): the icon only; the text stays the name. */}
      <span className={cx('min-w-0', compact && '@max-[12rem]:sr-only')}>{children}</span>
      <Icon
        icon={ChevronDown}
        size={iconSize}
        className={cx('transition-transform duration-150', compact && '@max-[12rem]:hidden', open && 'rotate-180')}
      />
    </button>
  );
}

/**
 * A disclosure: a button that shows or hides the content after it
 * (WAI-ARIA disclosure pattern: `aria-expanded`, `aria-controls`). The
 * content stays in the DOM while hidden (`hidden`), so `aria-controls`
 * always points at it. Replaces hover tooltips: everything a tooltip used to
 * say is one tap or Enter/Space away.
 *
 * Uncontrolled with `defaultOpen`, or controlled with `open` and
 * `onOpenChange`. `headingLevel` wraps the button in a heading (an
 * accordion-style section). `region` makes the content a named region
 * landmark (labelled by the button); leave it off for small disclosures so
 * the landmark list stays short.
 *
 * Layout: the content renders under the button, as wide as the disclosure.
 * Do not put a disclosure in a row that keeps its items at their natural
 * width (a `shrink-0` slot): opened, the content would make the row as wide
 * as its longest line. `Field` and `PanelHeader` take a `why` prop for this.
 *
 * @param {{ summary: import('react').ReactNode, children?: import('react').ReactNode,
 *   open?: boolean, defaultOpen?: boolean, onOpenChange?: (open: boolean) => void,
 *   icon?: import('react').ComponentType<any>, headingLevel?: 2|3|4|5|6, region?: boolean,
 *   id?: string, className?: string, buttonClassName?: string, panelClassName?: string }} props
 *   `id` is the content's id (default generated); the button's id is `${id}-button`;
 *   `buttonClassName` replaces the button's text colour and size (default `text-ink`).
 */
export default function Disclosure({
  summary,
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  icon,
  headingLevel,
  region = false,
  id,
  className,
  buttonClassName,
  panelClassName,
}) {
  const generatedId = useId();
  const panelId = id ?? `disclosure-${generatedId.replace(/:/g, '')}`;
  const buttonId = `${panelId}-button`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = typeof controlledOpen === 'boolean';
  const open = controlled ? controlledOpen : uncontrolledOpen;

  const toggle = () => {
    const next = !open;
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const button = (
    <DisclosureButton open={open} onToggle={toggle} controls={panelId} id={buttonId} icon={icon} className={buttonClassName}>
      {summary}
    </DisclosureButton>
  );
  const Heading = headingLevel ? `h${Math.min(6, Math.max(2, Math.round(headingLevel)))}` : null;

  return (
    <div className={className}>
      {Heading ? <Heading className="m-0">{button}</Heading> : button}
      <div
        id={panelId}
        hidden={!open}
        role={region ? 'region' : undefined}
        aria-labelledby={region ? buttonId : undefined}
        className={panelClassName}
      >
        {children}
      </div>
    </div>
  );
}
