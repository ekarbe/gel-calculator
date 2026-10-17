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


/**
 * Wrapper for lucide icons. Decorative by default (`aria-hidden`, not
 * focusable): the text next to it carries the meaning. With `label` the
 * icon is announced as an image with that name instead.
 *
 * @param {{ icon: import('react').ComponentType<any>, size?: number, strokeWidth?: number,
 *   label?: string, className?: string }} props
 *   `icon` is a lucide-react component (`import { Clock } from 'lucide-react'`); `size` in px
 *   (default 16); `label` makes the icon meaningful (`role="img"` with that name).
 */
export default function Icon({ icon: IconComponent, size = 16, strokeWidth = 2, label, className }) {
  if (!IconComponent) return null;
  const a11y = label
    ? { role: 'img', 'aria-label': label, 'aria-hidden': undefined }
    : { 'aria-hidden': true };
  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      focusable="false"
      className={['shrink-0', className].filter(Boolean).join(' ')}
      {...a11y}
    />
  );
}
