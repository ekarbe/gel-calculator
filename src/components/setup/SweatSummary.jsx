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

import Why from "../ui/Why";
import { useT } from "../../i18n/useT";
import { usePlan } from "../../state/PlanProvider";
import { rateForText, sodiumMgPerL } from "./SweatHelpers";

/**
 * The sweat numbers the plan uses: the sweat rate with its likely range
 * (± the source's uncertainty, never below 0), where it comes from (the
 * source actually used: a test that cannot be used falls back to the
 * estimate), the sweat sodium, and the "Why?" behind the rate with its
 * sources. `data-source` is the source used. Exported for the guided flow.
 */
export default function SweatSummary() {
  const t = useT();
  const { sweat } = usePlan();
  const lo = Math.max(0, sweat.rateLph - sweat.uncertaintyLph);
  const hi = sweat.rateLph + sweat.uncertaintyLph;
  return (
    <div
      role="group"
      aria-label={t("ui-setup-sweat.summary.label")}
      data-testid="sweat-summary"
      data-source={sweat.source}
      className="rounded-control border border-line bg-surface-2 p-3"
    >
      <dl className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <dt className="caption text-muted">{t("ui-setup-sweat.summary.rate")}</dt>
          <dd>
            <span data-testid="sweat-rate-used" className="block font-display text-section font-bold text-ink">
              {t("ui-setup-sweat.summary.rateValue", { rateLph: rateForText(sweat.rateLph) })}
            </span>
            <span data-testid="sweat-rate-range" className="block text-body-sm text-ink-2">
              {t("ui-setup-sweat.summary.range", { lo: rateForText(lo), hi: rateForText(hi) })}
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="caption text-muted">{t("ui-setup-sweat.summary.sodium")}</dt>
          <dd data-testid="sweat-sodium" className="font-display text-section font-bold text-ink">
            {t("ui-setup-sweat.summary.sodiumValue", { mgPerL: sodiumMgPerL(sweat.sodiumMmolL) })}
          </dd>
        </div>
      </dl>
      <p data-testid="sweat-summary-source" className="mt-2 text-body-sm text-ink-2">
        {t(`ui-setup-sweat.summary.source.${sweat.source}`)}
      </p>
      <Why why={sweat.why} className="mt-1" />
    </div>
  );
}
