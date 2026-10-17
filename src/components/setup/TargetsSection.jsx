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
import { Target } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import TargetsFields, { useTargetsSummary } from "./TargetsFields";
import { useT } from "../../i18n/useT";

export {
  TargetsCarbs,
  TargetsRatio,
  TargetsSodium,
  TargetsFluid,
  TargetsExtras,
  TARGETS_EXTRA_IONS,
  useTargetsSummary,
} from "./TargetsFields";
export { default as TargetsFields } from "./TargetsFields";

/**
 * The Targets setup section: what the plan aims for per hour. Carbohydrates
 * (Auto/Adjust, evidence range, duration band, the gut-trained opt-in, the
 * mouth rinse option), the glucose:fructose ratio (Auto/Adjust, allowed
 * range), sodium, fluid (with the projected scale change) and the optional
 * ions under "Advanced". Each block has its "Why?" and its warnings. Every
 * number comes from the plan; fluid follows the unit system of the UI prefs.
 *
 * A collapsible panel (open by default, a named region "Targets"): the
 * title is a disclosure button, and while closed the header shows a
 * one-line summary ("Carbs 75 g/h · 1:0.5 · Sodium 300 mg/h · Fluid
 * 100 ml/h"). The blocks stay mounted while closed. The blocks are exported
 * (`./TargetsFields.jsx`) for the guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 *
 * @param {{ headingLevel?: number, collapsible?: boolean, defaultExpanded?: boolean, className?: string }} props
 *   `headingLevel` is the section title's level (default 2; the blocks are one below);
 *   `collapsible` (default true) makes the title a disclosure button; `defaultExpanded` (default true).
 */
export default function TargetsSection({ headingLevel = 2, collapsible = true, defaultExpanded = true, className }) {
  const t = useT();
  const summary = useTargetsSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const open = !collapsible || expanded;
  const level = Math.min(6, Math.max(2, Math.round(headingLevel) || 2));
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-targets" className={className}>
      <PanelHeader
        id={titleId}
        level={level}
        title={t("ui-setup-targets.targets.title")}
        icon={Target}
        expanded={collapsible ? expanded : undefined}
        onToggle={collapsible ? () => setExpanded((value) => !value) : undefined}
        controls={collapsible ? bodyId : undefined}
        description={open ? undefined : <span data-testid="targets-summary">{summary}</span>}
      />
      <div id={bodyId} hidden={!open} className="mt-4">
        <TargetsFields headingLevel={level + 1} />
      </div>
    </Panel>
  );
}
