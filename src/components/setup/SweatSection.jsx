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
import { Droplets, Scale, SlidersHorizontal, Thermometer } from "lucide-react";
import Chip from "../ui/Chip";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import Tabs from "../ui/Tabs";
import WarningList from "../ui/WarningList";
import { useT } from "../../i18n/useT";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import SweatTestPanel from "./SweatTestPanel";
import SweatEstimatePanel from "./SweatEstimatePanel";
import SweatProjection from "./SweatProjection";
import SweatSummary from "./SweatSummary";
import { SweatPresetField, SweatSaltinessField } from "./SweatFields";
import { SWEAT_SOURCES, rateForText } from "./SweatHelpers";

/** Tab icon per sweat source. */
const SOURCE_ICONS = Object.freeze({ test: Scale, estimate: Thermometer, preset: SlidersHorizontal });

/**
 * The sweat source tabs (Test / Estimate / Presets) with the selected
 * source's panel: picking a tab sets `sweat.source` (the selected tab is the
 * source the plan asks for; ArrowLeft/ArrowRight, Home and End move and
 * select, WAI-ARIA tabs). Exported for the guided flow.
 * @param {{ id?: string, headingLevel?: number }} props
 *   `id` prefixes the tab, panel and field ids (default generated); `headingLevel` is the level of
 *   headings inside the panels (default 3).
 */
export function SweatSourceTabs({ id, headingLevel = 3 }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const generatedId = useId();
  const base = id ?? `sweat-source-${generatedId.replace(/:/g, "")}`;
  const items = SWEAT_SOURCES.map((source) => ({
    value: source,
    label: t(`ui-setup-sweat.source.${source}`),
    icon: SOURCE_ICONS[source],
  }));
  return (
    <Tabs
      id={base}
      label={t("ui-setup-sweat.source.label")}
      items={items}
      value={inputs.sweat.source}
      onChange={(source) => set("sweat.source", source)}
      fullWidth
      panelClassName="pt-4"
    >
      {(source) => {
        if (source === "test") return <SweatTestPanel idPrefix={`${base}-test`} headingLevel={headingLevel} />;
        if (source === "estimate") return <SweatEstimatePanel />;
        return <SweatPresetField id={`${base}-rate`} />;
      }}
    </Tabs>
  );
}

/**
 * The Sweat setup section: where the sweat rate comes from (a sweat test,
 * the heat-balance estimate or a self-assessed preset; see
 * {@link SweatSourceTabs}), the sweat saltiness every source uses, the
 * sweat warnings, the numbers the plan uses with their "Why?", and the
 * projected body-mass change. A collapsible panel (open by default); the
 * title row shows the sweat rate in use, also while collapsed.
 *
 * Reads the plan from `usePlan()` and edits the inputs through
 * `usePlanInputs()`; text and units follow the UI prefs (`useT`,
 * `useFormat`). The parts are separate exports for the guided flow:
 * `SweatSourceTabs`, `SweatTestPanel`, `SweatTestForm`, `SweatEstimatePanel`,
 * `SweatPresetField`, `SweatSaltinessField`, `SweatSummary`, `SweatProjection`.
 *
 * @param {{ headingLevel?: number, collapsible?: boolean, defaultExpanded?: boolean, className?: string }} props
 *   `headingLevel` is the section title's level (default 2; inner headings are one below);
 *   `collapsible` (default true) makes the title a disclosure button; `defaultExpanded` (default true).
 */
export default function SweatSection({ headingLevel = 2, collapsible = true, defaultExpanded = true, className }) {
  const t = useT();
  const { sweat } = usePlan();
  const uid = useId().replace(/:/g, "");
  const titleId = `sweat-${uid}-title`;
  const bodyId = `sweat-${uid}-body`;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const open = !collapsible || expanded;
  const level = Math.min(6, Math.max(2, Math.round(headingLevel) || 2));

  return (
    <Panel aria-labelledby={titleId} data-testid="sweat-section" className={className}>
      <PanelHeader
        id={titleId}
        level={level}
        title={t("ui-setup-sweat.title")}
        icon={Droplets}
        iconClassName="text-fluid"
        description={t("ui-setup-sweat.description")}
        actions={
          <Chip tone="fluid" data-testid="sweat-header-rate">
            {t("ui-setup-sweat.headerRate", { rateLph: rateForText(sweat.rateLph) })}
          </Chip>
        }
        expanded={collapsible ? expanded : undefined}
        onToggle={collapsible ? () => setExpanded((value) => !value) : undefined}
        controls={collapsible ? bodyId : undefined}
      />
      <div id={bodyId} hidden={!open} className="@container mt-4 space-y-5">
        <SweatSourceTabs id={`sweat-${uid}-source`} headingLevel={level + 1} />
        <SweatSaltinessField id={`sweat-${uid}-saltiness`} />
        <WarningList warnings={sweat.warnings} />
        <SweatSummary />
        <SweatProjection headingLevel={level + 1} />
      </div>
    </Panel>
  );
}
