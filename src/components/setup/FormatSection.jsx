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
import { Package } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import FormatFields, { useFormatSummary } from "./FormatFields";
import { useT } from "../../i18n/useT";

export {
  FormatTypeField,
  FormatGelsPerHourField,
  FormatConsistencyField,
  FormatBottleField,
  FormatDrinkShareField,
  useFormatSummary,
  consistencyLabel,
  BOTTLE_PRESETS_ML,
} from "./FormatFields";
export { default as FormatFields } from "./FormatFields";

/**
 * The Format setup section: how the recipe is packed (`inputs.format`).
 * Gel, drink or both; for gels the gels per hour (with the gel count, or
 * why there are none) and the consistency preset with its carbohydrate %;
 * for a drink the bottle size (500/750/950 ml or custom, in ml or fl oz);
 * for both the drink's share of the carbs. The recipe itself (Total/Per
 * serving, the lanes) is on the race board.
 *
 * A collapsible panel (open by default, a named region "Format"): while
 * closed the header shows a one-line summary. The field groups are
 * exported for the guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 */
export default function FormatSection() {
  const t = useT();
  const summary = useFormatSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-format">
      <PanelHeader
        id={titleId}
        title={t("ui-setup-recipe.format.title")}
        icon={Package}
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        controls={bodyId}
        description={expanded ? undefined : summary}
      />
      <div id={bodyId} hidden={!expanded} className="mt-4">
        <FormatFields />
      </div>
    </Panel>
  );
}
