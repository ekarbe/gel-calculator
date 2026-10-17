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
import { Coffee } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import SupplementsFields, { useSupplementsSummary } from "./SupplementsFields";
import { useT } from "../../i18n/useT";

export { SupplementsCaffeine, SupplementsBicarb, useSupplementsSummary } from "./SupplementsFields";
export { default as SupplementsFields } from "./SupplementsFields";

/**
 * The Caffeine & bicarbonate setup section, both optional and off by
 * default. Caffeine: the dose in mg/kg, tablets added to the gels with
 * their size, the planned doses and the total. Sodium bicarbonate: shown
 * for events up to 90 min (or when on), behind "Show sodium bicarbonate"
 * otherwise; the dose in g/kg, the dose in g, its sodium and when to take
 * it. Each has its "Why?" and its warnings; every amount and time comes
 * from the plan.
 *
 * A collapsible panel (open by default, a named region "Caffeine &
 * bicarbonate"): the title is a disclosure button, and while closed the
 * header shows a one-line summary ("Caffeine 210 mg · Bicarbonate off").
 * The blocks stay mounted while closed. The blocks are exported
 * (`./SupplementsFields.jsx`) for the guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 *
 * @param {{ headingLevel?: number, collapsible?: boolean, defaultExpanded?: boolean, className?: string }} props
 *   `headingLevel` is the section title's level (default 2; the blocks are one below);
 *   `collapsible` (default true) makes the title a disclosure button; `defaultExpanded` (default true).
 */
export default function SupplementsSection({ headingLevel = 2, collapsible = true, defaultExpanded = true, className }) {
  const t = useT();
  const summary = useSupplementsSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const open = !collapsible || expanded;
  const level = Math.min(6, Math.max(2, Math.round(headingLevel) || 2));
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-supplements" className={className}>
      <PanelHeader
        id={titleId}
        level={level}
        title={t("ui-setup-targets.supplements.title")}
        icon={Coffee}
        iconClassName="text-caffeine"
        expanded={collapsible ? expanded : undefined}
        onToggle={collapsible ? () => setExpanded((value) => !value) : undefined}
        controls={collapsible ? bodyId : undefined}
        description={open ? undefined : <span data-testid="supplements-summary">{summary}</span>}
      />
      <div id={bodyId} hidden={!open} className="mt-4">
        <SupplementsFields headingLevel={level + 1} />
      </div>
    </Panel>
  );
}
