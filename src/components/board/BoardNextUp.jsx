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

import { useId, useMemo } from "react";
import { Clock, ListOrdered } from "lucide-react";
import Button from "../ui/Button";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import ScheduleEventIcon from "../schedule/ScheduleEventIcon";
import { ScheduleTime } from "../schedule/ScheduleViews";
import { scheduleRows } from "../schedule/scheduleText";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { countText } from "../../i18n/plural";

/** How many schedule events "Next up" shows. */
export const NEXT_UP_COUNT = 4;

/**
 * "Next up": the first schedule events (`plan.schedule`, at most
 * {@link NEXT_UP_COUNT}) as a compact list: the time from the start, the
 * event's badge, its title and what to do. Rows, times (short on screen, in
 * words for screen readers) and badges are the full schedule's own
 * (`scheduleRows`, `ScheduleTime`, `ScheduleEventIcon`), so an event reads
 * and looks the same in both places. Then how many more the full schedule
 * lists, and a "Full schedule" button when there is somewhere to go
 * (`onShowSchedule`).
 *
 * @param {{ headingLevel?: number, onShowSchedule?: (() => void)|null }} props
 */
export default function BoardNextUp({ headingLevel = 3, onShowSchedule = null }) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const headingId = useId();
  const rows = useMemo(() => scheduleRows(t, f, plan.schedule), [t, f, plan.schedule]);
  const shown = rows.slice(0, NEXT_UP_COUNT);
  const more = Math.max(0, rows.length - shown.length);

  return (
    <Panel aria-labelledby={headingId} data-testid="board-next-up">
      <PanelHeader
        id={headingId}
        level={headingLevel}
        title={t("ui-board.next.title")}
        icon={Clock}
        actions={
          onShowSchedule ? (
            <Button
              variant="ghost"
              size="sm"
              icon={ListOrdered}
              data-testid="board-full-schedule"
              onClick={onShowSchedule}
            >
              {t("ui-board.next.full")}
            </Button>
          ) : null
        }
      />
      {shown.length > 0 ? (
        <ol role="list" aria-labelledby={headingId} className="mt-2 divide-y divide-line">
          {shown.map((row) => (
            <li key={row.key} data-type={row.type} className="flex items-start gap-3 py-2">
              <span data-testid="next-time" className="w-[4.5rem] shrink-0 pt-0.5">
                <ScheduleTime row={row} className="text-body-sm font-medium text-ink" />
              </span>
              <ScheduleEventIcon type={row.type} size="sm" />
              <div className="min-w-0">
                <p data-testid="next-title" className="text-body-sm font-semibold text-ink">
                  {row.title}
                </p>
                <p data-testid="next-text" className="text-body-sm text-ink-2">
                  {row.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-body-sm text-ink-2">{t("ui-board.next.empty")}</p>
      )}
      {more > 0 ? (
        <p data-testid="next-more" className="mt-1 text-body-sm text-muted">
          {countText(t, f, "ui-board.next.more", more)}
        </p>
      ) : null}
    </Panel>
  );
}
