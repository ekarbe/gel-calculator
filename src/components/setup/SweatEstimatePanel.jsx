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

import { Gauge } from "lucide-react";
import Disclosure from "../ui/Disclosure";
import { useT } from "../../i18n/useT";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { roundTo } from "../../domain/units";
import { currentConditions, describeConditions, rateForText } from "./SweatHelpers";

/**
 * One term/value pair of a facts list (`<dt>`/`<dd>`).
 * @param {{ term: import('react').ReactNode, children: import('react').ReactNode, testId?: string }} props
 */
export function SweatFact({ term, children, testId }) {
  return (
    <div className="min-w-0">
      <dt className="caption text-muted">{term}</dt>
      <dd data-testid={testId} className="num text-body-sm font-medium text-ink">
        {children}
      </dd>
    </div>
  );
}

/**
 * The estimate tab: the heat-balance estimate for the event with its
 * uncertainty, what drives it (heat production, energy use, the heat sweat
 * must remove), the event conditions it uses (with the cycling power the
 * model derived from the speed, and heat acclimatisation), a note when the
 * estimate hit the model's ceiling, and the heat balance details (air speed,
 * skin temperature, dry, breathing and solar heat flows; the dry flow is
 * named a gain, with its size, when the air is hotter than the skin) behind
 * a disclosure. Every number is from `plan.sweat.estimate`, in the UI language
 * and units. Exported for the guided flow.
 */
export default function SweatEstimatePanel() {
  const t = useT();
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const estimate = plan.sweat.estimate;
  const derivedPowerW = estimate.powerFromSpeed ? estimate.powerW : undefined;
  const watts = (w) => t("ui-setup-sweat.estimate.watts", { watts: roundTo(w, 0) });
  const conditions = describeConditions(t, currentConditions(inputs), derivedPowerW);
  // Negative when the air is hotter than the skin: then the body gains that heat (shown as a positive gain).
  const dryHeatW = roundTo(estimate.dryHeatLossW, 0);

  return (
    <div data-testid="sweat-estimate-panel" className="space-y-3">
      <div>
        <p className="caption text-ink-2">{t("ui-setup-sweat.estimate.label")}</p>
        <p data-testid="sweat-estimate" className="font-display text-section font-bold text-ink">
          {t("ui-setup-sweat.estimate.value", {
            rateLph: rateForText(estimate.rateLph),
            uncertaintyLph: roundTo(estimate.uncertaintyLph, 1),
          })}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
        <SweatFact term={t("ui-setup-sweat.estimate.heatProduction")} testId="sweat-estimate-heat">
          {watts(estimate.heatProductionW)}
        </SweatFact>
        <SweatFact term={t("ui-setup-sweat.estimate.energyUse")} testId="sweat-estimate-energy">
          {t("ui-setup-sweat.estimate.kcalPerHour", { kcal: roundTo(estimate.energyKcalPerHour, 0) })}
        </SweatFact>
        <SweatFact term={t("ui-setup-sweat.estimate.heatToLose")} testId="sweat-estimate-ereq">
          {watts(Math.max(0, estimate.ereqW))}
        </SweatFact>
      </dl>
      <p className="text-body-sm text-ink-2" data-testid="sweat-estimate-conditions">
        {t(inputs.athlete.acclimatised ? "ui-setup-sweat.estimate.usesAcclimatised" : "ui-setup-sweat.estimate.uses", {
          conditions,
        })}{" "}
        {t("ui-setup-sweat.estimate.changeHint")}
      </p>
      {estimate.capped ? (
        <p className="text-body-sm text-ink" data-testid="sweat-estimate-capped">
          {t("ui-setup-sweat.estimate.capped", { maxLph: rateForText(estimate.maxRateLph) })}
        </p>
      ) : null}
      <Disclosure
        summary={t("ui-setup-sweat.estimate.details")}
        icon={Gauge}
        buttonClassName="text-body-sm text-ink-2 hover:text-ink"
        panelClassName="mt-2 rounded-control border border-line bg-surface-2 p-3"
      >
        <dl className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
          <SweatFact term={t("ui-setup-sweat.estimate.airSpeed")} testId="sweat-estimate-air">
            {t("ui-setup-sweat.estimate.airSpeedValue", { speed: roundTo(estimate.airSpeedMs * 3.6, 1) })}
          </SweatFact>
          <SweatFact term={t("ui-setup-sweat.estimate.skinTemp")}>
            {t("ui-setup-sweat.estimate.skinTempValue", { tempC: roundTo(estimate.skinTempC, 1) })}
          </SweatFact>
          <SweatFact
            term={t(dryHeatW < 0 ? "ui-setup-sweat.estimate.dryHeatGain" : "ui-setup-sweat.estimate.dryHeatLoss")}
            testId="sweat-estimate-dry"
          >
            {watts(Math.abs(dryHeatW))}
          </SweatFact>
          <SweatFact term={t("ui-setup-sweat.estimate.breathing")}>{watts(estimate.respiratoryHeatLossW)}</SweatFact>
          <SweatFact term={t("ui-setup-sweat.estimate.sun")}>{watts(estimate.solarGainW)}</SweatFact>
        </dl>
      </Disclosure>
    </div>
  );
}
