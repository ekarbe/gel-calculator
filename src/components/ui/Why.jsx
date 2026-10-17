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
import { CircleHelp } from 'lucide-react';
import Disclosure, { DisclosureButton } from './Disclosure';
import { useT } from '../../i18n/useT';
import { citationLabel, citationUrl } from '../../domain/evidence';
import { cx } from './cx';

/** @typedef {{ key: string, params?: Record<string, unknown> }} Message */
/** @typedef {{ summary: Message, details?: Message[], citations: string[] }} Explanation */

/*  Colours: links, the "Why?" button and the info level are neutral (ink with
    an underline, ink-2), never a substance colour: blue means glucose. Ink and
    ink-2 pass AA on every surface and soft tint (scripts/check-contrast.mjs). */

/** The "Why?" button's look. */
const WHY_BUTTON_CLASSES = 'text-body-sm text-ink-2 hover:text-ink';

/** The explanation panel's look. */
const WHY_PANEL_CLASSES = 'space-y-2 rounded-control border border-line bg-surface-2 p-3 text-body-sm text-ink-2';

/**
 * List of citation links: label from `citationLabel`, link from
 * `citationUrl` (opens in a new tab, which a hidden note tells screen-reader
 * users). Ids without a link are plain text; duplicates are dropped. The
 * list is named "Sources". Renders nothing for no ids. Links are underlined
 * ink (no colour-only meaning) and at least 24 px tall, 44 px on touch
 * screens (they are list items, not links inside a sentence).
 *
 * @param {{ ids?: string[], className?: string }} props
 */
export function CitationLinks({ ids, className }) {
  const t = useT();
  const unique = [...new Set(Array.isArray(ids) ? ids : [])];
  if (unique.length === 0) return null;
  return (
    <ul role="list" aria-label={t('ui-common.sources')} className={cx('flex flex-wrap gap-x-3', className)}>
      {unique.map((id) => {
        const url = citationUrl(id);
        const label = citationLabel(id);
        return (
          <li key={id} className="flex min-h-6 items-center pointer-coarse:min-h-11">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-6 items-center font-medium text-ink underline decoration-1 underline-offset-2 hover:decoration-2 pointer-coarse:min-h-11"
              >
                <span>
                  {label}
                  <span className="sr-only"> {t('ui-common.opensInNewTab')}</span>
                </span>
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
 * What a "Why?" panel shows: the summary, any details and the citation
 * links, in the UI language and units.
 * @param {{ why: Explanation }} props
 */
function WhyContent({ why }) {
  const t = useT();
  const details = Array.isArray(why.details) ? why.details : [];
  return (
    <>
      <p className="text-ink">{t(why.summary)}</p>
      {details.map((detail, index) => (
        <p key={`${detail?.key}-${index}`}>{t(detail)}</p>
      ))}
      <CitationLinks ids={why.citations} />
    </>
  );
}

/**
 * True when `why` is an explanation a "Why?" can show.
 * @param {unknown} why
 * @returns {why is Explanation}
 */
export function hasWhy(why) {
  return Boolean(why && typeof why === 'object' && /** @type {any} */ (why).summary);
}

/**
 * A "Why?" split in two for a title row: `button` (the toggle, for the row)
 * and `panel` (the explanation, full width under the row). `Field` and
 * `PanelHeader` use it for their `why` prop; a feature puts `why` there
 * rather than a `Why` in a row slot. Both are `null` without an explanation.
 *
 * @param {Explanation|null|undefined} why
 * @param {{ label?: import('react').ReactNode, id?: string, panelClassName?: string, compact?: boolean }} [options]
 *   `label` replaces the button text (default "Why?"); `id` is the panel's id (default generated);
 *   `compact` draws the button one caption line tall (a KPI tile's caption row), same target size.
 * @returns {{ button: import('react').ReactNode, panel: import('react').ReactNode }}
 */
export function useWhyParts(why, { label, id, panelClassName, compact = false } = {}) {
  const t = useT();
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  if (!hasWhy(why)) return { button: null, panel: null };
  const panelId = id ?? `why-${generatedId.replace(/:/g, '')}`;
  return {
    button: (
      <DisclosureButton
        open={open}
        onToggle={() => setOpen((value) => !value)}
        controls={panelId}
        id={`${panelId}-button`}
        icon={CircleHelp}
        compact={compact}
        className={compact ? 'text-caption text-ink-2 hover:text-ink' : WHY_BUTTON_CLASSES}
      >
        {label ?? t('ui-common.why')}
      </DisclosureButton>
    ),
    panel: (
      <div id={panelId} hidden={!open} className={cx(WHY_PANEL_CLASSES, panelClassName)}>
        <WhyContent why={why} />
      </div>
    ),
  };
}

/**
 * "Why?": a disclosure that shows the explanation behind a recommendation
 * (the summary, any details and links to the cited studies), in the UI
 * language and units. Renders nothing without an explanation.
 *
 * Place it where it has the full width of its container (a KPI tile, a
 * panel body, a warning). In a label row or a panel title row use the `why`
 * prop of `Field`/`NumberField`/`Select`/`PanelHeader` instead: an open
 * `Why` in a row slot would widen the row to its longest line.
 *
 * @param {{ why?: Explanation|null, label?: import('react').ReactNode, defaultOpen?: boolean,
 *   open?: boolean, onOpenChange?: (open: boolean) => void, id?: string, className?: string }} props
 *   `label` replaces the button text (default "Why?").
 */
export default function Why({ why, label, defaultOpen = false, open, onOpenChange, id, className }) {
  const t = useT();
  if (!hasWhy(why)) return null;
  return (
    <Disclosure
      summary={label ?? t('ui-common.why')}
      icon={CircleHelp}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      id={id}
      className={className}
      buttonClassName={WHY_BUTTON_CLASSES}
      panelClassName={cx('mt-2', WHY_PANEL_CLASSES)}
    >
      <WhyContent why={why} />
    </Disclosure>
  );
}
