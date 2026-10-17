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
import { FlaskConical } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import SaltsFields, { SaltsModeField, useSaltsSummary } from "./SaltsFields";
import { useT } from "../../i18n/useT";

export {
  SaltsModeField,
  SaltsSodiumSaltField,
  SaltsAutoList,
  SaltsManualList,
  SaltsComparison,
  useSaltsSummary,
  saltName,
  saltContents,
} from "./SaltsFields";
export { default as SaltsFields } from "./SaltsFields";
export { default as SaltsCustom, CUSTOM_SALT_FIELDS } from "./SaltsCustom";

/**
 * The Salts setup section: the salts that deliver the sodium (and the
 * optional potassium, magnesium and calcium) targets.
 *
 * - Auto/Manual in the title row ({@link SaltsModeField}). Auto: the sodium
 *   salt (table salt, sodium citrate or a 50:50 mix) and the amounts the
 *   plan computes (`plan.salts.items`). Manual starts from those amounts:
 *   a list of salts with whole-activity amounts in g, and salts typed in
 *   from a label (% of the mass per element).
 * - Delivered vs target per ion (`plan.salts.comparison`) and the salt
 *   warnings (`plan.salts.warnings`).
 *
 * The sodium target itself is part of the Targets section. A collapsible
 * panel (open by default, a named region "Salts"): while closed the header
 * shows a one-line summary. The field groups are exported for the guided
 * flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 */
export default function SaltsSection() {
  const t = useT();
  const summary = useSaltsSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-salts">
      <PanelHeader
        id={titleId}
        title={t("ui-setup-recipe.salts.title")}
        icon={FlaskConical}
        iconClassName="text-sodium"
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        controls={bodyId}
        description={expanded ? undefined : summary}
        actions={<SaltsModeField />}
      />
      <div id={bodyId} hidden={!expanded} className="mt-4">
        <SaltsFields />
      </div>
    </Panel>
  );
}
