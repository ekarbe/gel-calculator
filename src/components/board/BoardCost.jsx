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

import Chip from "../ui/Chip";
import Panel from "../ui/Panel";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { estimateCost } from "../../domain/cost";

/**
 * The rough cost of the plan's carbs in the chosen currency, mixed at home
 * and the saving against commercial gels (`estimateCost`), marked
 * approximate. After Next up and the warnings: a side note, never ahead of
 * what race morning needs.
 */
export default function BoardCost() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const cost = estimateCost(plan.carbs.totalG, f.currencyCode);
  return (
    <Panel as="div" data-testid="board-cost" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 lg:py-3">
      <p className="flex items-center gap-2">
        <span className="caption text-ink-2">{t("ui-board.cost.title")}</span>
        <Chip>{t("ui-common.approximate")}</Chip>
      </p>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-ink-2">{t("ui-board.cost.diy")}</dt>
          <dd data-testid="cost-diy" className="num font-medium text-ink">
            {f.currency(cost.diy)}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-ink-2">{t("ui-board.cost.savings")}</dt>
          <dd data-testid="cost-savings" className="num font-medium text-ink">
            {t("ui-board.cost.savingsValue", { amount: cost.savings })}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}
