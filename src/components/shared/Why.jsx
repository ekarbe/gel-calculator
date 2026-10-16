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

import { useId, useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import { t } from "../../i18n";
import { citationLabel, citationUrl } from "../../domain/evidence";

/** @typedef {{ key: string, params?: Record<string, string|number> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */

/**
 * List of citation links: label from `citationLabel`, link from `citationUrl`
 * (opens in a new tab). Ids without a link are shown as plain text.
 *
 * @param {{ ids?: string[], className?: string }} props
 */
export function CitationLinks({ ids, className = "" }) {
  const unique = [...new Set(Array.isArray(ids) ? ids : [])];
  if (unique.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`} aria-label="Sources">
      {unique.map((id) => {
        const url = citationUrl(id);
        const label = citationLabel(id);
        return (
          <li key={id}>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-apple-blue hover:underline"
              >
                {label}
              </a>
            ) : (
              <span>{label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A small "Why?" button that shows or hides the explanation behind a
 * recommendation: the summary, any details, and links to the cited studies.
 * Renders nothing without an explanation.
 *
 * @param {{ why?: Explanation|null, label?: string, className?: string, defaultOpen?: boolean }} props
 *   `label` replaces the button text (default "Why?"); `defaultOpen` starts expanded.
 */
export default function Why({ why, label = "Why?", className = "", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  if (!why || !why.summary) return null;
  const details = Array.isArray(why.details) ? why.details : [];

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-apple-blue hover:bg-apple-blue/10 transition-colors"
      >
        <CircleHelp size={14} aria-hidden="true" />
        {label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="mt-2 space-y-2 rounded-xl border border-card-border bg-card-border/30 p-3 text-xs leading-relaxed text-text-secondary"
      >
        <p className="text-text-primary">{t(why.summary)}</p>
        {details.map((detail, index) => (
          <p key={`${detail?.key}-${index}`}>{t(detail)}</p>
        ))}
        <CitationLinks ids={why.citations} />
      </div>
    </div>
  );
}
