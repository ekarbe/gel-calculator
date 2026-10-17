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

import { forwardRef, useId, useState } from "react";
import { CircleCheck, Droplets, Hexagon, Info, OctagonAlert, TriangleAlert, Zap } from "lucide-react";
import Chip from "../ui/Chip";
import Icon from "../ui/Icon";
import WarningList from "../ui/WarningList";
import { cx, toneClasses } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import BoardAnnouncer from "../board/BoardAnnouncer";
import { countText } from "../../i18n/plural";
import { warningsSummary } from "../board/boardText";

/**
 * The viewports on which the dock is not sticky (short ones: a landscape
 * phone, or 400 % zoom at 320 × 256 CSS px), so it never covers the
 * question fields (WCAG 1.4.10, 2.4.11); it then sits after the screen. The
 * same query is in the dock's class list (`[@media(max-height:32rem)]:static`;
 * a test keeps the two in step) and in the flow, which reserves no scroll
 * padding for a dock that does not stick.
 */
export const DOCK_STATIC_QUERY = "(max-height: 32rem)";

/** Tone and icon of the warnings chip by the worst level: an icon shape per level, never colour alone. */
const WARNING_LOOKS = Object.freeze({
  danger: { tone: "danger", icon: OctagonAlert },
  warning: { tone: "warn", icon: TriangleAlert },
  info: { tone: "neutral", icon: Info },
});

/**
 * One live number of the dock: the substance colour as an edge mark (as on
 * the board's tiles), the caption with its icon, the value and its unit.
 * The visible caption is a short one (`short`: "KH" for "Kohlenhydrate"),
 * so it fits a third of a 320 px phone on one line in every language
 * instead of breaking inside a word (uppercase German nouns are not
 * hyphenated); the full name (`label`) is the caption for screen readers.
 * The caption icon is dropped while the dock is narrower than 26 rem (the
 * edge mark keeps the colour).
 * @param {{ tone: string, icon: import('react').ComponentType<any>, label: string, short: string, value: string,
 *   unit: string, testId: string }} props
 */
function DockStat({ tone, icon, label, short, value, unit, testId }) {
  const look = toneClasses(tone);
  return (
    <div className={cx("min-w-0 border-l-2 pl-2", look.border)} data-testid={testId}>
      <dt className={cx("caption flex min-w-0 items-start gap-1", look.text)}>
        <Icon icon={icon} size={12} className="mt-0.5 @max-[26rem]:hidden" />
        <span aria-hidden="true" className="min-w-0 whitespace-nowrap" data-testid={`${testId}-caption`}>
          {short}
        </span>
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="flex flex-wrap items-baseline gap-x-1">
        <span className="font-display text-title font-bold text-ink" data-testid={`${testId}-value`}>
          {value}
        </span>
        <span className="text-caption font-semibold text-ink-2">{unit}</span>
      </dd>
    </div>
  );
}

/**
 * The text of the warnings chip: the count alone while the dock is narrower
 * than 26 rem (decorative; the icon gives the level), else the full text,
 * which stays the chip's name for screen readers at every width.
 * @param {{ compact: string, full: string }} props
 */
function ChipText({ compact, full }) {
  return (
    <>
      <span aria-hidden="true" className="@[26rem]:hidden" data-testid="guided-dock-warnings-compact">
        {compact}
      </span>
      <span className="sr-only @[26rem]:not-sr-only" data-testid="guided-dock-warnings-full">
        {full}
      </span>
    </>
  );
}

/**
 * The dock of the guided flow, pinned to the bottom of the screen while
 * the flow scrolls (sticky, safe-area aware; on short viewports,
 * {@link DOCK_STATIC_QUERY}, it is not sticky and sits after the screen):
 * on the question screens (`stats`) the live carbs, sodium and fluid per
 * hour of the plan and the warnings count, then the step navigation
 * (`children`: Back and Next, and any note for them).
 *
 * - The numbers come from the plan (the same values as the board's tiles)
 *   in the UI language and unit system (fluid in ml/h or fl oz/h). They are
 *   a named region ("Your plan so far") holding a description list; they
 *   are not a live region (each keystroke would be read).
 * - The warnings chip, when the plan has warnings, is a disclosure button
 *   for the list of every plan warning (danger first), shown in the dock
 *   and scrolling on its own when long (a focusable group named by the
 *   chip, so the keyboard can scroll it). Without warnings it is a static
 *   "No warnings" chip, and the list closes. While the dock is narrower
 *   than 26 rem (phones) the chip shows its icon and the count only, so the
 *   three numbers keep the row; its name is the full text ("3 warnings").
 * - Changes of the warnings count are announced politely (the board's
 *   announcer); the last screen has the board, which announces them itself.
 *
 * The ref goes to the dock's root (the flow measures it to keep focused
 * fields clear of it). `offsetClassName` is where it sticks (default
 * `bottom-0`; a shell with a fixed bar under it lifts it, e.g. `bottom-16`).
 *
 * @type {import('react').ForwardRefExoticComponent<{ stats?: boolean, offsetClassName?: string,
 *   className?: string, children?: import('react').ReactNode } & import('react').RefAttributes<HTMLDivElement>>}
 */
const GuidedDock = forwardRef(function GuidedDock({ stats = true, offsetClassName = "bottom-0", className, children }, ref) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const uid = useId().replace(/:/g, "");
  const chipId = `guided-dock-${uid}-warnings-button`;
  const panelId = `guided-dock-${uid}-warnings`;
  const [warningsOpen, setWarningsOpen] = useState(false);
  const { count, worst } = warningsSummary(plan.warnings);
  const look = worst ? WARNING_LOOKS[worst] : null;
  // The list closes when the last warning goes, and stays closed when warnings come back.
  if (count === 0 && warningsOpen) setWarningsOpen(false);
  const open = warningsOpen && count > 0;

  return (
    <div
      ref={ref}
      data-testid="guided-dock"
      className={cx(
        "sticky z-30 -mx-4 border-t border-line bg-surface px-4 pb-safe md:mx-0 md:rounded-t-panel md:border-x md:px-5",
        offsetClassName,
        // Not sticky on short viewports (DOCK_STATIC_QUERY): after the offset, so it wins.
        "[@media(max-height:32rem)]:static",
        className,
      )}
    >
      <div className="space-y-2 py-2">
        {stats ? (
          <section aria-label={t("ui-guided.dock.label")} data-testid="guided-dock-stats" className="num @container space-y-2">
            <div className="flex items-start gap-2">
              <dl className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                <DockStat
                  tone="glucose"
                  icon={Zap}
                  label={t("ui-guided.dock.carbs")}
                  short={t("ui-guided.dock.carbs.short")}
                  value={f.number(plan.carbs.gPerHour)}
                  unit={t("ui-guided.dock.gPerHour")}
                  testId="guided-dock-carbs"
                />
                <DockStat
                  tone="sodium"
                  icon={Hexagon}
                  label={t("ui-guided.dock.sodium")}
                  short={t("ui-guided.dock.sodium.short")}
                  value={f.number(plan.sodium.mgPerHour)}
                  unit={t("ui-guided.dock.mgPerHour")}
                  testId="guided-dock-sodium"
                />
                <DockStat
                  tone="fluid"
                  icon={Droplets}
                  label={t("ui-guided.dock.fluid")}
                  short={t("ui-guided.dock.fluid.short")}
                  value={f.volume(plan.fluid.mlPerHour, { unit: false })}
                  unit={t("ui-guided.dock.perHour", { unit: f.unit("volume") })}
                  testId="guided-dock-fluid"
                />
              </dl>
              <div className="shrink-0 self-center">
                {look ? (
                  <Chip
                    id={chipId}
                    tone={look.tone}
                    icon={look.icon}
                    onClick={() => setWarningsOpen((value) => !value)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    data-testid="guided-dock-warnings"
                    data-level={worst}
                  >
                    <ChipText compact={f.integer(count)} full={countText(t, f, "ui-guided.dock.warnings", count)} />
                  </Chip>
                ) : (
                  <Chip tone="ok" icon={CircleCheck} data-testid="guided-dock-warnings" data-level="none">
                    <ChipText compact={f.integer(0)} full={t("ui-common.noWarnings")} />
                  </Chip>
                )}
              </div>
            </div>
            <div
              id={panelId}
              hidden={!open}
              role="group"
              aria-labelledby={look ? chipId : undefined}
              tabIndex={open ? 0 : -1}
              data-testid="guided-dock-warnings-panel"
              className="max-h-[40dvh] overflow-y-auto rounded-control"
            >
              {open ? <WarningList warnings={plan.warnings} compact /> : null}
            </div>
            <BoardAnnouncer />
          </section>
        ) : null}
        {children}
      </div>
    </div>
  );
});

export default GuidedDock;
