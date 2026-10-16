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
import { Settings, Scale, Droplets } from "lucide-react";
import Card from "../shared/Card";
import Why from "../shared/Why";
import BodyMassLevel from "../shared/BodyMassLevel";
import { aboutKcal, fmt, formatRange } from "../shared/format";
import { bodyMassText } from "../shared/bodyMass";
import { deliveredShare } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi } from "../../state/UiProvider";
import { formatRatio } from "../../domain/carbs";

/** @typedef {{ summary: { key: string }, details?: { key: string }[], citations: string[] }} Explanation */
/** @typedef {import('../../domain/plan').Plan} Plan */

/** Text for an `auto` / `manual` input mode. */
const MODE_LABELS = { auto: "Auto", manual: "Adjusted" };

/** Name of each sweat source (`plan.sweat.source`). */
const SWEAT_SOURCE_LABELS = Object.freeze({
  test: "Sweat test",
  estimate: "Heat-balance estimate",
  preset: "Self-assessed preset",
});

/**
 * How the sweat rate was found: the source's name, plus a note when a sweat
 * test was chosen but the estimate is used, or when the test is scaled to
 * the event conditions.
 * @param {Plan} plan
 * @param {string} requested  `inputs.sweat.source`.
 * @returns {string}
 */
function sweatSourceText(plan, requested) {
  const { source, calibration } = plan.sweat;
  const name = SWEAT_SOURCE_LABELS[source] ?? source;
  if (requested === "test" && source !== "test") return `${name} (no usable sweat test)`;
  if (source === "test" && calibration?.applied) return `${name}, scaled to this event`;
  return name;
}

/**
 * A ring that shows how far `progress` (a share, 0–1) goes toward a real
 * target. Without a target (`progress === null`) only the track is drawn.
 * Shares above 1 draw a full ring; the text says by how much it is over.
 *
 * @param {{ label: string, value: string, unit: string, progress: number|null, color: string,
 *   target: string, note?: string|null, extra?: string|null, mode?: string|null, range?: string|null,
 *   why?: Explanation|null, testId: string }} props
 *   `extra` is one more line of context under the note.
 */
function Ring({
  label,
  value,
  unit,
  progress,
  color,
  target,
  note = null,
  extra = null,
  mode = null,
  range = null,
  why = null,
  testId,
}) {
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
        {extra && <div className="text-[10px] text-text-secondary mt-0.5">{extra}</div>}
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
 * Sweat rate and body-mass projection: the rate with its uncertainty and
 * source (`plan.sweat`), and the projected change over the event
 * (`plan.hydration`): what the scale shows afterwards, the water lost or
 * gained and its level.
 * @param {{ plan: Plan }} props
 */
function SweatAndBodyMass({ plan }) {
  const headingId = useId();
  const { inputs } = usePlanInputs();
  const { massUnit } = useUi();
  const { sweat, hydration } = plan;
  const bodyMass = bodyMassText(hydration, massUnit);

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="bg-card-border/20 rounded-2xl p-4 border border-card-border/50 mb-4 space-y-3"
    >
      <span id={headingId} className="flex items-center gap-2 text-sm font-bold text-text-secondary">
        <Droplets size={16} aria-hidden="true" className="text-sky-500" /> Sweat and Body Mass
      </span>
      <dl className="space-y-2 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Sweat rate</dt>
          <dd data-testid="summary-sweat-rate" className="font-bold text-text-primary text-right">
            {fmt(sweat.rateLph, 2)} ± {fmt(sweat.uncertaintyLph, 2)} L/h
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">Source</dt>
          <dd data-testid="summary-sweat-source" className="font-semibold text-text-primary text-right">
            {sweatSourceText(plan, inputs.sweat.source)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">On the scale after the event</dt>
          <dd data-testid="summary-body-mass" className="font-bold text-text-primary text-right">
            {bodyMass.scale}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-secondary">{bodyMass.waterTerm}</dt>
          <dd data-testid="summary-body-water" className="font-semibold text-text-primary text-right">
            {bodyMass.water}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-text-secondary">
          <Scale size={14} aria-hidden="true" /> Projected body-mass change
        </span>
        <BodyMassLevel level={bodyMass.level} testId="summary-body-mass-level" />
      </div>
      <Why why={sweat.why} label="Why this sweat rate?" />
    </div>
  );
}

/**
 * Activity summary: four rings that each compare something with a real
 * target, the sweat rate and body-mass projection, and the carb ratio bar.
 *
 * - Carbs: grams the recipe delivers (`plan.carbs.deliveredG`) vs the
 *   whole-activity carb target. The ring turns orange (and says how much is
 *   missing) when the recipe delivers less, e.g. without a carb ingredient.
 * - Sodium: mg the salts deliver vs the sodium target (`plan.salts.comparison`).
 *   A manual target below the evidence range says so instead of "On target".
 * - Fluid: the effective intake in ml/h vs the plan's recommendation.
 * - Energy: kcal from the carbs the recipe delivers (`plan.energy.deliveredKcal`)
 *   vs the planned kcal, and the energy the event burns
 *   (`plan.energy.expenditureKcal`, from the heat-balance estimate).
 * - Sweat and body mass: the sweat rate ± its uncertainty and its source
 *   (`plan.sweat`), and the projected scale change and water loss or gain
 *   with its level (`plan.hydration`). Mass in the display unit.
 * - Ratio bar: the glucose:fructose ratio the recipe delivers (glucose blue,
 *   fructose purple; the text names both), the g/h on each pathway, the
 *   target when the recipe cannot reach it, the recommendation, range and
 *   explanation.
 *
 * Every number comes from the plan; the card only formats it.
 */
export default function BalanceAnalysis() {
  const plan = usePlan();
  const ratioLabelId = useId();

  // Carbs: what the recipe actually contains.
  const carbTarget = plan.carbs.totalG;
  const carbDelivered = plan.carbs.deliveredG;
  const carbShort = carbTarget > 0 && Math.round(carbDelivered) < Math.round(carbTarget);
  const gPerHourText = `${fmt(plan.carbs.gPerHour)} g/h`;

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
  const kcalBurned = plan.energy.expenditureKcal;

  // Ratio bar: the share the recipe delivers.
  const ratio = plan.carbs.ratio;
  const share = deliveredShare(plan);
  const fructoseShare = share ?? 0;
  const glucoseShare = share === null ? 0 : 1 - share;
  const deliveredText = share === null ? "0:0" : formatRatio({ glucose: glucoseShare, fructose: fructoseShare });
  const targetText = formatRatio(ratio.value);
  const recommendedRatio = ratio.recommended;
  const shareText = (s) => formatRatio({ glucose: 1 - s, fructose: s });

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
          note={carbShort ? `${fmt(carbTarget - carbDelivered)} g short · ${gPerHourText}` : gPerHourText}
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
          extra={kcalBurned > 0 ? `You burn about ${aboutKcal(kcalBurned)} kcal` : null}
        />
      </div>

      <SweatAndBodyMass plan={plan} />

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
            {deliveredText}
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
        {share !== null && deliveredText !== targetText && (
          <p data-testid="ratio-target" className="mt-2 text-xs font-semibold text-text-primary">
            Target {targetText}: the recipe delivers {deliveredText}.
          </p>
        )}
        <p className="mt-2 text-xs text-text-secondary">
          {MODE_LABELS[ratio.mode]} · recommended {formatRatio(recommendedRatio.ratio)} · range{" "}
          {shareText(recommendedRatio.minShare)}–{shareText(recommendedRatio.maxShare)}
        </p>
        <Why why={recommendedRatio.why} className="mt-1" />
      </div>
    </Card>
  );
}
