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

import { useId, useRef } from 'react';
import Icon from './Icon';
import { cx } from './cx';

/**
 * @template {string|number} T
 * @typedef {{ value: T, label: import('react').ReactNode, icon?: import('react').ComponentType<any>,
 *   disabled?: boolean }} TabItem
 */

/**
 * Tabs (WAI-ARIA tabs pattern): a `tablist` named by `label`, one `tab` per
 * item with `aria-selected` and `aria-controls`, and one `tabpanel` (the
 * selected tab's content, labelled by its tab, focusable). One tab stop:
 * the selected tab (roving tabindex). ArrowLeft/ArrowRight move between tabs
 * (wrapping, skipping disabled ones), Home/End jump to the first/last. With
 * `activation="automatic"` (default) moving also selects; with `"manual"`
 * Enter or Space selects the focused tab.
 *
 * The panel shows `children` (a node, or a function of the selected value);
 * the owner renders the content for `value`.
 *
 * @template {string|number} T
 * @param {{ label?: string, labelledBy?: string, items: ReadonlyArray<TabItem<T>>, value: T,
 *   onChange: (value: T) => void, activation?: 'automatic'|'manual', fullWidth?: boolean,
 *   children?: import('react').ReactNode | ((value: T) => import('react').ReactNode),
 *   id?: string, className?: string, tablistClassName?: string, panelClassName?: string }} props
 *   `id` prefixes the tab and panel ids (`${id}-tab-${index}`, `${id}-panel`).
 */
export default function Tabs({
  label,
  labelledBy,
  items,
  value,
  onChange,
  activation = 'automatic',
  fullWidth = false,
  children,
  id,
  className,
  tablistClassName,
  panelClassName,
}) {
  const generatedId = useId();
  const base = id ?? `tabs-${generatedId.replace(/:/g, '')}`;
  const refs = useRef(/** @type {Array<HTMLButtonElement|null>} */ ([]));
  const list = Array.isArray(items) ? items : [];
  const selectedIndex = list.findIndex((item) => item.value === value);
  const firstEnabled = list.findIndex((item) => !item.disabled);
  const tabStop = selectedIndex !== -1 && !list[selectedIndex].disabled ? selectedIndex : firstEnabled;

  const focusTab = (from, direction) => {
    for (let step = 1; step <= list.length; step += 1) {
      const index = (((from + direction * step) % list.length) + list.length) % list.length;
      if (!list[index].disabled) {
        refs.current[index]?.focus();
        if (activation === 'automatic' && list[index].value !== value) onChange(list[index].value);
        return;
      }
    }
  };

  const onKeyDown = (event, index) => {
    const moves = { ArrowRight: [index, 1], ArrowLeft: [index, -1], Home: [-1, 1], End: [list.length, -1] };
    if (!Object.hasOwn(moves, event.key)) return;
    event.preventDefault();
    focusTab(...moves[event.key]);
  };

  const panelId = `${base}-panel`;
  const selectedTabId = selectedIndex === -1 ? undefined : `${base}-tab-${selectedIndex}`;
  return (
    <div className={className}>
      {/* The hairline is on this wrapper. The tablist scrolls sideways when the tabs do not fit, and
          a scroll container clips what is drawn outside its padding box: its 4 px padding (pulled
          back with negative margins, so the tabs stay where they were) holds the focus ring
          (2 px, offset 2). The extra 1 px at the bottom lets the selected tab's line cover the hairline. */}
      <div className="border-b border-line">
        <div
          role="tablist"
          aria-label={labelledBy ? undefined : label}
          aria-labelledby={labelledBy}
          className={cx('-mx-1 -mt-1 mb-[-5px] flex gap-1 overflow-x-auto p-1', tablistClassName)}
        >
          {list.map((item, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={String(item.value)}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${index}`}
                aria-selected={selected}
                aria-controls={selected ? panelId : undefined}
                tabIndex={index === tabStop ? 0 : -1}
                disabled={item.disabled}
                onClick={() => {
                  if (!selected) onChange(item.value);
                }}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cx(
                  'inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-body-sm transition-colors duration-150',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  fullWidth && 'flex-1',
                  // Forced colours: the selected tab keeps a highlight bar, the others none (not weight alone).
                  'forced-colors:forced-color-adjust-none forced-colors:bg-[color:Canvas]',
                  selected
                    ? 'border-ink font-semibold text-ink forced-colors:border-[color:Highlight] forced-colors:text-[color:CanvasText]'
                    : 'border-transparent font-medium text-ink-2 hover:text-ink forced-colors:border-[color:Canvas] forced-colors:text-[color:ButtonText]',
                )}
              >
                {item.icon ? <Icon icon={item.icon} size={16} /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {selectedTabId ? (
        <div role="tabpanel" id={panelId} aria-labelledby={selectedTabId} tabIndex={0} className={cx('pt-3', panelClassName)}>
          {typeof children === 'function' ? children(value) : children}
        </div>
      ) : null}
    </div>
  );
}
