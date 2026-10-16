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

import { Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { t } from "../../i18n";
import { CitationLinks } from "./Why";

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ id: string, level: 'info'|'warning'|'danger', message: Message, citations?: string[] }} Warning */

/**
 * Look of each warning level. Each level has its own icon shape and a
 * screen-reader label, so the meaning never depends on color alone.
 */
const LEVELS = {
  danger: {
    Icon: OctagonAlert,
    label: "Danger",
    box: "border-apple-red/30 bg-apple-red/10",
    icon: "text-apple-red",
  },
  warning: {
    Icon: TriangleAlert,
    label: "Warning",
    box: "border-apple-amber/30 bg-apple-amber/10",
    icon: "text-apple-amber",
  },
  info: {
    Icon: Info,
    label: "Note",
    box: "border-apple-blue/30 bg-apple-blue/10",
    icon: "text-apple-blue",
  },
};

/**
 * List of plan warnings (`{ id, level, message, citations }`), one box per
 * warning with a level icon, the message text and citation links. Unknown
 * levels are shown as info. Renders nothing for an empty list.
 *
 * @param {{ warnings?: Warning[], className?: string, showCitations?: boolean }} props
 */
export default function Warnings({ warnings, className = "", showCitations = true }) {
  const list = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
  if (list.length === 0) return null;

  return (
    <ul className={`space-y-2 ${className}`} aria-label="Warnings">
      {list.map((warning, index) => {
        const level = Object.hasOwn(LEVELS, warning.level) ? warning.level : "info";
        const { Icon, label, box, icon } = LEVELS[level];
        return (
          <li
            key={warning.id ?? index}
            data-level={level}
            className={`flex items-start gap-2 rounded-xl border p-3 text-sm text-text-primary ${box}`}
          >
            <Icon size={18} aria-hidden="true" className={`mt-0.5 flex-shrink-0 ${icon}`} />
            <div className="min-w-0 space-y-1">
              <p>
                <span className="sr-only">{label}: </span>
                {t(warning.message)}
              </p>
              {showCitations && <CitationLinks ids={warning.citations} className="text-xs" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
