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

import { TriangleAlert } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import WarningList from "../ui/WarningList";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";

/**
 * The warnings panel of the race board: every plan warning
 * (`plan.warnings`: sweat, carbs, ratio, sodium, salts, fluid, body mass,
 * format, gel and drink, caffeine, bicarbonate), danger first, each with
 * its level icon, the level for screen readers, the text in the UI language
 * and units and its sources. Collapsible (the title is the toggle); the
 * board's warnings chip opens it.
 *
 * @param {{ open: boolean, onOpenChange: (open: boolean) => void, headingId: string, bodyId: string,
 *   headingLevel?: number }} props
 *   `headingId` / `bodyId` are set by the board so its chip can open the panel and move the focus here.
 */
export default function BoardWarnings({ open, onOpenChange, headingId, bodyId, headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const count = plan.warnings.length;

  return (
    <Panel aria-labelledby={headingId} data-testid="board-warnings">
      <PanelHeader
        id={headingId}
        level={headingLevel}
        title={t("ui-board.warnings.titleCount", { count: f.number(count) })}
        icon={TriangleAlert}
        expanded={open}
        onToggle={() => onOpenChange(!open)}
        controls={bodyId}
      />
      <div id={bodyId} hidden={!open} className="mt-3">
        <WarningList warnings={plan.warnings} emptyText={t("ui-board.warnings.empty")} />
      </div>
    </Panel>
  );
}
