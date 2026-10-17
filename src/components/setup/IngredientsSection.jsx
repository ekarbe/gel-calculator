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
import { Wheat } from "lucide-react";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import IngredientsFields, { useIngredientsSummary } from "./IngredientsFields";
import { useT } from "../../i18n/useT";

export {
  IngredientsList,
  IngredientsAdd,
  useIngredientsSummary,
  ingredientName,
} from "./IngredientsFields";
export { default as IngredientsFields } from "./IngredientsFields";
export { default as IngredientsRatioReach, IngredientsRatioBar } from "./IngredientsRatioReach";
export { default as IngredientsCustom, IngredientsCustomForm } from "./IngredientsCustom";

/**
 * The Ingredients setup section: what the carbs are made from.
 *
 * - The ratio reach bar: the glucose:fructose ratios the listed ingredients
 *   can make (`plan.carbs.ingredients.feasibleRange`), with the allowed
 *   range (Auto ratio only), the target and the recipe's ratio, a note when
 *   Auto ratio uses another ratio in the allowed range, and the solver's
 *   warnings (`carbs.ratioNotReachable`, `carbs.noIngredients`).
 * - One list (`inputs.carbs.ingredients`) with a preference weight per
 *   ingredient (number field and slider, 0–100) and what the recipe uses of
 *   it; the add menu (powders, syrups, your ingredients).
 * - The user's own ingredients (`inputs.carbs.custom`), typed in from a
 *   label, with a form to add, edit or delete them.
 *
 * The glucose:fructose ratio itself (Auto/Adjust) is part of the Targets
 * section. A collapsible panel (open by default, a named region
 * "Ingredients"): while closed the header shows a one-line summary. The
 * field groups are exported for the guided flow.
 *
 * Must be rendered inside `PlanProvider` (and `UiProvider` for the prefs;
 * without it English and metric).
 */
export default function IngredientsSection() {
  const t = useT();
  const summary = useIngredientsSummary();
  const titleId = useId();
  const bodyId = useId();
  const [expanded, setExpanded] = useState(true);
  return (
    <Panel aria-labelledby={titleId} data-testid="setup-ingredients">
      <PanelHeader
        id={titleId}
        title={t("ui-setup-recipe.ingredients.title")}
        icon={Wheat}
        iconClassName="text-glucose"
        expanded={expanded}
        onToggle={() => setExpanded((open) => !open)}
        controls={bodyId}
        description={expanded ? undefined : summary}
      />
      <div id={bodyId} hidden={!expanded} className="mt-4">
        <IngredientsFields />
      </div>
    </Panel>
  );
}
