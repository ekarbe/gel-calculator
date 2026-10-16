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

import { useId } from "react";
import { Settings } from "lucide-react";
import Card from "../shared/Card";
import Why from "../shared/Why";
import { fmt, formatRange, formatRatio, shareToRatio } from "../shared/format";
import { usePlan } from "../../state/PlanProvider";

/** @typedef {{ summary: { key: string }, details?: { key: string }[], citations: string[] }} Explanation */

/** Text for an `auto` / `manual` input mode. */
const MODE_LABELS = { auto: "Auto", manual: "Adjusted" };

/**
 * A ring that shows how far `progress` (a share, 0–1) goes toward a real
 * target. Without a target (`progress === null`) only the track is drawn.
 * Shares above 1 draw a full ring; the text says by how much it is over.
 *
 * @param {{ label: string, value: string, unit: string, progress: number|null, color: string,
 *   target: string, note?: string|null, mode?: string|null, range?: string|null, why?: Explanation|null,
 *   testId: string }} props
 */
function Ring({ label, value, unit, progress, color, target, note = null, mode = null, range = null, why = null, testId }) {
  const labelId = useId();
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const hasProgress = typeof progress === "number" && Number.isFinite(progress);
  const drawn = hasProgress ? Math.min(1, Math.max(0, progress)) : 0;
  const percent = hasProgress ? Math.round(progress * 100) : null;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      data-testid={testId}
      data-progress={percent ?? "none"}
      className="flex flex-col items-center"
    >
      <div className="relative w-24 h-24 mb-3">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-card-border/50"
          />
          {hasProgress && drawn > 0 && (
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - drawn)}
              strokeLinecap="round"
              className={`${color} transition-all duration-1000 ease-out`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-text-primary">{value}</span>
          <span className="text-[10px] font-bold text-text-secondary -mt-1">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <div id={labelId} className="text-xs font-bold text-text-primary uppercase tracking-wider">
          {label}
        </div>
        <div className="text-[10px] text-text-secondary mt-0.5">
          {target}
          {percent !== null && <span className="sr-only"> ({percent}%)</span>}
        </div>
        {note && <div className="text-[10px] font-semibold text-text-secondary mt-0.5">{note}</div>}
        {(mode || range) && (
          <div className="text-[10px] text-text-secondary mt-0.5">
            {[mode, range && `range ${range}`].filter(Boolean).join(" · ")}
          </div>
        )}
        <Why why={why} className="mt-1" />
      </div>
    </div>
  );
}

/**
 * Activity summary: four rings that each compare something with a real
 * target, and the carb ratio bar.
 *
 * - Carbs: grams the recipe delivers (`plan.carbs.deliveredG`) vs the
 *   whole-activity carb target. The ring turns orange when the sources cannot
 *   make the ratio (`plan.carbs.sources.canAchieveRatio`), the same rule the
 *   recipe and source warnings use.
 * - Sodium: mg the salts deliver vs the sodium target (`plan.salts.comparison`).
 *   A manual target below the evidence range says so instead of "On target".
 * - Fluid: the effective intake in ml/h vs the plan's recommendation.
 * - Energy: kcal from the carbs the recipe delivers (`plan.energy.deliveredKcal`)
 *   vs the planned kcal.
 * - Ratio bar: the effective glucose:fructose ratio (glucose blue, fructose
 *   purple), the g/h on each pathway, its recommendation, range and explanation.
 *
 * Every number comes from the plan; the card only formats it.
 */
export default function BalanceAnalysis() {
  const plan = usePlan();
  const ratioLabelId = useId();

  // Carbs: what the recipe actually contains. An infeasible mix has no items.
  const carbTarget = plan.carbs.totalG;
  const carbDelivered = plan.carbs.deliveredG;
  const carbShort = carbTarget > 0 && !plan.carbs.sources.canAchieveRatio;

  // Sodium: delivered vs target from the salts comparison.
  const sodiumRow = plan.salts.comparison.Sodium ?? {
    target: plan.sodium.totalMg,
    delivered: plan.salts.delivered.Sodium ?? 0,
    diff: (plan.salts.delivered.Sodium ?? 0) - plan.sodium.totalMg,
    status: "met",
  };
  const sodiumBelowRange = plan.sodium.warnings.some((warning) => warning.id === "plan.sodiumBelowRange");
  let sodiumNote = null;
  if (sodiumRow.target > 0) {
    if (sodiumRow.status === "short") sodiumNote = `${fmt(-sodiumRow.diff)} mg short`;
    else if (sodiumRow.status === "over") sodiumNote = `${fmt(sodiumRow.diff)} mg over`;
    else sodiumNote = sodiumBelowRange ? "Below the evidence range" : "On target";
  }

  // Fluid: effective ml/h vs the recommended ml/h.
  const fluidPlan = plan.fluid.recommended.mlPerHour;

  // Energy: kcal from the carbs in the recipe vs the planned kcal.
  const kcalPlanned = plan.energy.kcal;
  const kcalDelivered = plan.energy.deliveredKcal;

  // Ratio bar
  const ratio = plan.carbs.ratio;
  const parts = ratio.value.glucose + ratio.value.fructose;
  const fructoseShare = parts > 0 ? ratio.share : 0;
  const glucoseShare = parts > 0 ? 1 - ratio.share : 0;
  const recommendedRatio = ratio.recommended;

  return (
    <Card className="h-full">
      <div className="flex items-center gap-2 mb-8">
        <Settings size={18} className="text-apple-blue" aria-hidden="true" />
        <h3 className="font-bold text-lg">Activity Summary</h3>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 mb-8">
        <Ring
          testId="ring-carbs"
          label="Total Carbs"
          value={fmt(carbDelivered)}
          unit="grams"
          progress={carbTarget > 0 ? carbDelivered / carbTarget : null}
          color={carbShort ? "text-orange-400" : "text-apple-blue"}
          target={carbTarget > 0 ? `of ${fmt(carbTarget)} g target` : "No carb target"}
          note={`${fmt(plan.carbs.gPerHour)} g/h`}
          mode={MODE_LABELS[plan.carbs.mode]}
          range={formatRange(plan.carbs.recommended.range, "g/h")}
          why={plan.carbs.recommended.why}
        />
        <Ring
          testId="ring-sodium"
          label="Sodium"
          value={fmt(sodiumRow.delivered)}
          unit="mg"
          progress={sodiumRow.target > 0 ? sodiumRow.delivered / sodiumRow.target : null}
          color={sodiumRow.status === "met" && !sodiumBelowRange ? "text-apple-teal" : "text-orange-400"}
          target={sodiumRow.target > 0 ? `of ${fmt(sodiumRow.target)} mg target` : "No sodium target"}
          note={sodiumNote}
          mode={MODE_LABELS[plan.sodium.mode]}
          range={formatRange(plan.sodium.recommended.range, "mg/h")}
          why={plan.sodium.recommended.why}
        />
        <Ring
          testId="ring-fluid"
          label="Fluid"
          value={fmt(plan.fluid.mlPerHour)}
          unit="ml/h"
          progress={fluidPlan > 0 ? plan.fluid.mlPerHour / fluidPlan : null}
          color="text-sky-500"
          target={fluidPlan > 0 ? `of ${fmt(fluidPlan)} ml/h planned` : "No fluid plan"}
          note={`${fmt(plan.fluid.totalMl)} ml in total`}
          mode={MODE_LABELS[plan.fluid.mode]}
          range={formatRange(plan.fluid.recommended.range, "ml/h")}
          why={plan.fluid.recommended.why}
        />
        <Ring
          testId="ring-energy"
          label="Total Energy"
          value={fmt(kcalDelivered)}
          unit="kcal"
          progress={kcalPlanned > 0 ? kcalDelivered / kcalPlanned : null}
          color={carbShort ? "text-orange-400" : "text-apple-amber"}
          target={kcalPlanned > 0 ? `of ${fmt(kcalPlanned)} kcal planned` : "No energy target"}
          note="From carbohydrates"
        />
      </div>

      <div
        role="group"
        aria-labelledby={ratioLabelId}
        className="bg-card-border/20 rounded-2xl p-4 border border-card-border/50"
      >
        <div className="flex justify-between items-center mb-3">
          <span id={ratioLabelId} className="text-sm font-bold text-text-secondary">
            Carb Ratio
          </span>
          <span data-testid="ratio-value" className="text-sm font-black text-text-primary">
            {formatRatio(ratio.value)}
          </span>
        </div>
        <div
          role="img"
          aria-label={`Glucose ${fmt(glucoseShare * 100)}%, fructose ${fmt(fructoseShare * 100)}%`}
          className="w-full h-3 bg-card-border/50 rounded-full flex overflow-hidden shadow-inner mb-2"
        >
          <div data-testid="ratio-glucose" className="h-full bg-apple-blue" style={{ width: `${glucoseShare * 100}%` }} />
          <div data-testid="ratio-fructose" className="h-full bg-apple-purple" style={{ width: `${fructoseShare * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs font-semibold text-text-secondary">
          <span>Glucose: {fmt(ratio.glucoseGPerHour)} g/h</span>
          <span>Fructose: {fmt(ratio.fructoseGPerHour)} g/h</span>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          {MODE_LABELS[ratio.mode]} · recommended {formatRatio(recommendedRatio.ratio)} · range{" "}
          {shareToRatio(recommendedRatio.minShare)}–{shareToRatio(recommendedRatio.maxShare)}
        </p>
        <Why why={recommendedRatio.why} className="mt-1" />
      </div>
    </Card>
  );
}
