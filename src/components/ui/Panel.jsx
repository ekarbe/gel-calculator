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


import { cx } from './cx';

/**
 * A flat panel: surface background, 1 px hairline, 10 px radius, 16 px
 * padding on phones and 20 px from 1024 px. No shadow, no blur, no hover
 * lift. Renders a `<section>` by default; give it `aria-labelledby` (the id
 * of its `PanelHeader` title) so it is a named region, or pass `as="div"`.
 * Other props go to the element.
 *
 * @param {{ as?: import('react').ElementType, padded?: boolean, inset?: boolean, className?: string,
 *   children?: import('react').ReactNode } & import('react').HTMLAttributes<HTMLElement>} props
 *   `padded` (default true) adds the panel padding; `inset` uses the inset surface (`surface-2`)
 *   for a panel inside a panel.
 */
export default function Panel({ as: Component = 'section', padded = true, inset = false, className, children, ...rest }) {
  return (
    <Component
      className={cx(
        'rounded-panel border border-line text-ink',
        inset ? 'bg-surface-2' : 'bg-surface',
        padded && 'p-4 lg:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
