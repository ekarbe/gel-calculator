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

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import Icon from "../ui/Icon";
import WarningList from "../ui/WarningList";
import { cx } from "../ui/cx";
import { roundTo } from "../../domain/units";

/*  Presentational parts shared by the Targets and the Caffeine & bicarbonate
    field groups (`TargetsFields.jsx`, `SupplementsFields.jsx`): a named
    block with its heading and its warnings, the value a target uses, a facts
    list and a note. They hold no state and read no plan. */

/**
 * The most decimals a Targets or Supplements number field shows, and the
 * precision it commits at ({@link roundField}), so the field, its
 * `aria-valuetext` and the plan always hold the same number.
 */
export const FIELD_DIGITS = 2;

/**
 * A typed field value at the precision the field shows ({@link FIELD_DIGITS}).
 * @param {number} value
 * @returns {number}
 */
export const roundField = (value) => roundTo(value, FIELD_DIGITS);

/**
 * A heading level clamped to 2–6 (`fallback` when it is not a number).
 * @param {unknown} level
 * @param {number} [fallback=3]
 * @returns {number}
 */
export function clampHeadingLevel(level, fallback = 3) {
  const n = typeof level === "number" && Number.isFinite(level) ? Math.round(level) : fallback;
  return Math.min(6, Math.max(2, n));
}

/**
 * The warnings of a block, under its content. Not a live region: a value
 * typed digit by digit ("1", "15", "150", "1500") would have each
 * intermediate warning and its sources read out. The board's announcer
 * (`BoardAnnouncer`, mounted with the expert layout and speaking while the
 * board is hidden) says once, after the plan settles, how many warnings and
 * dangers there are; the list is here to read. Empty, it takes no space.
 *
 * @param {{ warnings?: import('../ui/WarningList').Warning[]|null, className?: string }} props
 */
export function TargetsWarnings({ warnings, className }) {
  return (
    <div data-testid="block-warnings" className={cx("not-empty:mt-3", className)}>
      <WarningList warnings={warnings} />
    </div>
  );
}

/**
 * One block of a setup section (a target or a supplement): a group named by
 * its heading (the display title face, uppercase, with a decorative icon in
 * the substance colour), an optional badge after the heading (outside it, so
 * the group's name stays the title), small controls on the right (the
 * Auto/Adjust choice; the row wraps on narrow screens), the content under it
 * and, when `warnings` is given, the block's warnings
 * ({@link TargetsWarnings}; the board announces their count). Other props (`data-testid`) go to the group.
 *
 * Collapsible: pass `expanded` (boolean) and `onToggle`; the title then
 * becomes a button inside the heading with `aria-expanded` and
 * `aria-controls` (the WAI-ARIA disclosure/accordion header pattern, as in
 * `PanelHeader`), and the content is hidden (but stays mounted) while closed.
 *
 * @param {{ title: import('react').ReactNode, icon?: import('react').ComponentType<any>, iconClassName?: string,
 *   headingLevel?: number, badge?: import('react').ReactNode, actions?: import('react').ReactNode,
 *   warnings?: import('../ui/WarningList').Warning[]|null, expanded?: boolean, onToggle?: () => void,
 *   className?: string, children?: import('react').ReactNode } & Record<string, unknown>} props
 *   `headingLevel` defaults to 3 (the blocks sit under a section's h2).
 */
export function TargetsBlock({
  title,
  icon,
  iconClassName = "text-ink-2",
  headingLevel = 3,
  badge,
  actions,
  warnings,
  expanded,
  onToggle,
  className,
  children,
  ...rest
}) {
  const headingId = useId();
  const contentId = useId();
  const Heading = `h${clampHeadingLevel(headingLevel)}`;
  const collapsible = typeof expanded === "boolean";
  const label = (
    <>
      {icon ? <Icon icon={icon} size={20} className={iconClassName} /> : null}
      <span className="min-w-0">{title}</span>
    </>
  );
  return (
    <div role="group" aria-labelledby={headingId} className={cx("min-w-0", className)} {...rest}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Heading id={headingId} className="display-title min-w-0 text-ink">
            {collapsible ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={onToggle}
                className="-mx-1 flex min-h-11 items-center gap-2 rounded-control px-1 text-left uppercase"
              >
                {label}
                <Icon
                  icon={ChevronDown}
                  size={20}
                  className={cx("text-muted transition-transform duration-150", expanded && "rotate-180")}
                />
              </button>
            ) : (
              <span className="flex min-h-8 items-center gap-2">{label}</span>
            )}
          </Heading>
          {badge}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div
        id={collapsible ? contentId : undefined}
        hidden={collapsible ? !expanded : undefined}
        className="mt-3 space-y-3"
      >
        {children}
      </div>
      {warnings !== undefined ? <TargetsWarnings warnings={warnings} /> : null}
    </div>
  );
}

/**
 * The value a target uses, large (display face, tabular figures) with a
 * small caption above it and the unit after it.
 *
 * @param {{ label: import('react').ReactNode, value: import('react').ReactNode, unit?: import('react').ReactNode,
 *   testId?: string, className?: string }} props
 */
export function TargetsValue({ label, value, unit, testId, className }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="caption text-ink-2">{label}</p>
      <p data-testid={testId} className="font-display text-section font-bold text-ink">
        {value}
        {unit ? (
          <>
            {" "}
            <span className="text-body-sm font-semibold text-ink-2">{unit}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * A facts list (`<dl>`) in two columns; put {@link TargetsFact} items in it.
 * @param {{ className?: string, children?: import('react').ReactNode }} props
 */
export function TargetsFacts({ className, children }) {
  return <dl className={cx("grid grid-cols-2 gap-x-4 gap-y-3", className)}>{children}</dl>;
}

/**
 * One term/value pair of a facts list (`<dt>` caption, `<dd>` value in the
 * data face).
 * @param {{ term: import('react').ReactNode, children: import('react').ReactNode, testId?: string, className?: string }} props
 */
export function TargetsFact({ term, children, testId, className }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="caption text-muted">{term}</dt>
      <dd data-testid={testId} className="num text-body-sm font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

/**
 * A short note in an inset box (drink to thirst, mouth rinse), with an
 * optional decorative icon and title. Other props (`data-testid`) go to the box.
 *
 * @param {{ icon?: import('react').ComponentType<any>, title?: import('react').ReactNode,
 *   className?: string, children?: import('react').ReactNode } & Record<string, unknown>} props
 */
export function TargetsNote({ icon, title, className, children, ...rest }) {
  return (
    <div className={cx("flex items-start gap-2 rounded-control border border-line bg-surface-2 p-3 text-body-sm text-ink", className)} {...rest}>
      {icon ? <Icon icon={icon} size={16} className="mt-0.5 text-ink-2" /> : null}
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * The visible label of a group of controls that is not a single input (a
 * segmented choice), styled like a `Field` label.
 * @param {{ id: string, children: import('react').ReactNode }} props
 */
export function TargetsGroupLabel({ id, children }) {
  return (
    <p id={id} className="caption mb-1 text-ink-2">
      {children}
    </p>
  );
}
