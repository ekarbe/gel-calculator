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
import { Flag } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import EventFields, { useEventSummary } from "./EventFields";
import { useT } from "../../i18n/useT";

export {
  EventSportField,
  EventDurationField,
  EventIntensityField,
  EventSpeedField,
  EventPowerField,
  EventMetsField,
  EventEffortFields,
  EventSettingField,
  useEventSummary,
} from "./EventFields";
export { default as EventFields } from "./EventFields";

/**
 * The Event setup section: sport, duration (hours and minutes), intensity,
 * what drives the effort (speed with the running pace, cycling power with
 * the estimate used when it is 0, or METs for other sports) and the
 * setting. These feed the carbohydrate target and the heat-balance sweat
 * estimate. Quantities follow the unit system of the UI prefs (speed in
 * km/h or mph, pace in min/km or min/mi); the plan stores metric.
 *
 * A collapsible panel (open by default, a named region "Event"): the title
 * is a disclosure button, and while closed the header shows a one-line
 * summary ("3 h · Cycling · Moderate"). The fields stay mounted while
 * closed. The field groups are exported (`./EventFields.jsx`) for the
 * guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 */
export default function EventSection() {
  const t = useT();
  const summary = useEventSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-event">
      <PanelHeader
        id={titleId}
        title={t("ui-setup-event.event.title")}
        icon={Flag}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        controls={bodyId}
        description={expanded ? undefined : summary}
      />
      <div id={bodyId} hidden={!expanded} className="mt-4">
        <EventFields />
      </div>
    </Panel>
  );
}
