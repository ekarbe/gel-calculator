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

import { Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import Icon from './Icon';
import { CitationLinks } from './Why';
import { cx } from './cx';
import { useT } from '../../i18n/useT';

/** @typedef {{ key: string, params?: Record<string, unknown> }} Message */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * Look of each level: its own icon shape, a tinted box and the level
 * written out for screen readers, so the meaning never depends on colour.
 */
const LEVELS = Object.freeze({
  danger: { icon: OctagonAlert, box: 'border-danger bg-danger-soft', iconClass: 'text-danger', labelKey: 'ui-common.level.danger' },
  warning: { icon: TriangleAlert, box: 'border-warn bg-warn-soft', iconClass: 'text-warn', labelKey: 'ui-common.level.warning' },
  // Neutral, not a substance colour (blue means glucose).
  info: { icon: Info, box: 'border-line bg-surface-2', iconClass: 'text-ink-2', labelKey: 'ui-common.level.info' },
});

/** Sort order: danger first, then warning, then info. */
const ORDER = Object.freeze({ danger: 0, warning: 1, info: 2 });

/**
 * The level of a warning; unknown levels count as info.
 * @param {unknown} level
 * @returns {'danger'|'warning'|'info'}
 */
const levelOf = (level) => (typeof level === 'string' && Object.hasOwn(LEVELS, level) ? /** @type {any} */ (level) : 'info');

/**
 * A list of plan warnings (`{ id, level, message, citations }`): one item
 * per warning with its level icon, the level for screen readers ("Danger:",
 * "Warning:", "Note:"), the message in the UI language and units, and the
 * citation links. `role="list"` keeps list semantics where list styles are
 * removed. Danger comes first, then warning, then info (stable within a
 * level; `sort={false}` keeps the given order). Renders nothing for an
 * empty list unless `emptyText` is given. Each item has `data-level`.
 *
 * @param {{ warnings?: Warning[]|null, label?: string, showCitations?: boolean, sort?: boolean,
 *   emptyText?: import('react').ReactNode, compact?: boolean, id?: string, className?: string }} props
 *   `label` names the list (default "Warnings"); `compact` uses smaller boxes.
 */
export default function WarningList({ warnings, label, showCitations = true, sort = true, emptyText, compact = false, id, className }) {
  const t = useT();
  const list = (Array.isArray(warnings) ? warnings : []).filter((w) => w && typeof w === 'object');
  const ordered = sort
    ? list.map((w, index) => ({ w, index })).sort((a, b) => ORDER[levelOf(a.w.level)] - ORDER[levelOf(b.w.level)] || a.index - b.index).map(({ w }) => w)
    : list;

  if (ordered.length === 0) {
    return emptyText ? <p id={id} className={cx('text-body-sm text-muted', className)}>{emptyText}</p> : null;
  }

  return (
    <ul role="list" id={id} aria-label={label ?? t('ui-common.warnings')} className={cx('space-y-2', className)}>
      {ordered.map((warning, index) => {
        const level = levelOf(warning.level);
        const look = LEVELS[level];
        return (
          <li
            key={warning.id ?? index}
            data-level={level}
            className={cx('flex items-start gap-2 rounded-control border text-ink', compact ? 'p-2 text-body-sm' : 'p-3 text-body-sm', look.box)}
          >
            <Icon icon={look.icon} size={18} className={cx('mt-0.5', look.iconClass)} />
            <div className="min-w-0 space-y-1">
              <p>
                <span className="sr-only">{t(look.labelKey)}:</span> {t(warning.message)}
              </p>
              {showCitations ? <CitationLinks ids={warning.citations} className="text-caption" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
