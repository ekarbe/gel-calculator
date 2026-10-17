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

import { CircleCheck, Droplets, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import Chip from "../ui/Chip";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { roundTo } from "../../domain/units";
import { countText } from "../../i18n/plural";
import { eventSummary, sweatSourceKey, warningsSummary } from "./boardText";

/** Tone and icon of the warnings chip by the worst level: an icon shape per level, never colour alone. */
const WARNING_CHIP_LOOKS = Object.freeze({
  danger: { tone: "danger", icon: OctagonAlert },
  warning: { tone: "warn", icon: TriangleAlert },
  info: { tone: "neutral", icon: Info },
});

/**
 * The board's title row: the heading "Race board" as a small caption over
 * the event summary in the display face ("3:00 h · Cycling · Moderate", in
 * capitals), the sweat chip ("Sweat 0.15 L/h ±0.5") with where the rate
 * comes from as wrapping text next to it ("Estimate", "Sweat test, scaled
 * to this event": a chip truncates, and that part must never be cut off),
 * and the warnings-count chip. With warnings the count chip is a button
 * that opens the warnings panel and moves the focus there
 * (`onShowWarnings`); without any it is a static "No warnings" chip. On a
 * board narrower than 28 rem (a phone) the button shows its level icon and
 * the count only ("⚠ 2", named "2 warnings: show the list"), so the sweat
 * chip and the warnings chip keep one row in every language and unit
 * system; both chips are drawn 28 px tall (the button's touch target is
 * larger than what it draws).
 *
 * @param {{ headingLevel?: number, onShowWarnings?: () => void, warningsPanelId?: string }} props
 *   `headingLevel` of the "Race board" heading (default 2); `warningsPanelId` is the id of the
 *   warnings panel body the chip opens (its `aria-controls`).
 */
export default function BoardTitle({ headingLevel = 2, onShowWarnings, warningsPanelId }) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const { inputs } = usePlanInputs();
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 2))}`;
  const { count, worst } = warningsSummary(plan.warnings);
  const look = worst ? WARNING_CHIP_LOOKS[worst] : null;
  const countLabel = countText(t, f, "ui-board.chip.warnings", count);

  const sweatText = t("ui-board.chip.sweat", {
    rateL: roundTo(plan.sweat.rateLph, 2),
    uncertaintyL: roundTo(plan.sweat.uncertaintyLph, 2),
  });
  const sweatSource = t(sweatSourceKey(plan, inputs.sweat.source));

  return (
    <div data-testid="board-title" className="space-y-2">
      <div>
        <Heading className="caption text-muted">{t("ui-board.title")}</Heading>
        <p data-testid="board-summary" className="display-section text-ink">
          {eventSummary(t, f, plan.inputs.event)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p data-testid="board-sweat" data-source={plan.sweat.source} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Chip tone="fluid" icon={Droplets} data-testid="board-sweat-chip">
            {sweatText}
          </Chip>{" "}
          <span data-testid="board-sweat-source" className="min-w-0 text-body-sm text-ink-2">
            {sweatSource}
          </span>
        </p>
        {look ? (
          <Chip
            tone={look.tone}
            icon={look.icon}
            onClick={onShowWarnings}
            aria-controls={warningsPanelId}
            aria-label={t("ui-board.chip.warnings.show", { count: countLabel })}
            data-testid="board-warnings-chip"
            data-level={worst}
          >
            {/* Narrow boards (phones): the icon and the count, so both chips keep one row; the name says it in full. */}
            <span aria-hidden="true" className="@md:hidden" data-testid="board-warnings-chip-compact">
              {f.integer(count)}
            </span>
            <span aria-hidden="true" className="hidden @md:inline">
              {countLabel}
            </span>
          </Chip>
        ) : (
          <Chip tone="ok" icon={CircleCheck} data-testid="board-warnings-chip" data-level="none">
            {t("ui-common.noWarnings")}
          </Chip>
        )}
      </div>
    </div>
  );
}
