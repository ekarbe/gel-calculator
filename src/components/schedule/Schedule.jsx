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

import { useId, useMemo, useState } from "react";
import { CupSoda, List, ListOrdered, Table2 } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import Segmented from "../ui/Segmented";
import Icon from "../ui/Icon";
import FluidAdvice from "./FluidAdvice";
import { ScheduleList, ScheduleTable } from "./ScheduleViews";
import { bottleNote, scheduleRows } from "./scheduleText";
import { usePlan } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";

/**
 * The full race-day schedule: every event of `plan.schedule` (bicarbonate,
 * pre-race caffeine, the start, each gel with its fluid and caffeine, drink
 * sips, hydration, the finish) as a list or a table, then the fluid advice.
 * A named region (the panel heading "Schedule"); the list and the table
 * carry the same name.
 *
 * - Times are "T−1h 30m" / "T+20m" in the data face, with the same time in
 *   words for screen readers. Titles and texts are the domain messages in
 *   the UI language and units (`schedule.*`).
 * - List ↔ table: a radio group in the panel header (default list; not
 *   remembered).
 * - When drink sips carry the fluid (a drink plan, or gels without fluid),
 *   a note above the events names the bottles they come from.
 * - The fluid advice ({@link FluidAdvice}) follows; it is hidden when no
 *   fluid is planned.
 *
 * Must be rendered inside `PlanProvider`; works with or without `UiProvider`
 * (English and metric without it).
 */
export default function Schedule() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const titleId = useId();
  const [view, setView] = useState(/** @type {'list'|'table'} */ ("list"));
  const rows = useMemo(() => scheduleRows(t, f, plan.schedule), [t, f, plan.schedule]);
  const note = bottleNote(t, f, plan);
  const title = t("ui-schedule.title");

  let events;
  if (rows.length === 0) events = <p className="text-body-sm text-muted">{t("ui-schedule.empty")}</p>;
  else if (view === "table") events = <ScheduleTable rows={rows} caption={title} />;
  else events = <ScheduleList rows={rows} labelledBy={titleId} />;

  return (
    <Panel aria-labelledby={titleId} data-testid="schedule" className="space-y-4">
      <PanelHeader
        id={titleId}
        title={title}
        icon={ListOrdered}
        description={t("ui-schedule.description")}
        actions={
          <Segmented
            size="sm"
            label={t("ui-schedule.view.label")}
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: t("ui-schedule.view.list"), icon: List },
              { value: "table", label: t("ui-schedule.view.table"), icon: Table2 },
            ]}
          />
        }
      />
      {note ? (
        <p data-testid="bottle-note" className="flex items-start gap-2 rounded-control bg-fluid-soft p-3 text-body-sm text-ink">
          <Icon icon={CupSoda} size={16} className="mt-0.5 text-fluid" />
          <span>{note}</span>
        </p>
      ) : null}
      {events}
      <FluidAdvice className="border-t border-line pt-4" />
    </Panel>
  );
}
