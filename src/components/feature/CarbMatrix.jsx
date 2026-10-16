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

import { FlaskConical, Scale, Minus, Plus, Trash2 } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import Why from "../shared/Why";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import Segmented, { AUTO_ADJUST_OPTIONS } from "../shared/Segmented";
import { fmt, formatRatio, shareToRatio } from "../shared/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { glucoseSourceOptions, fructoseSourceOptions, sourceDataByIdMap } from "../../constants/constants";

/** @typedef {{ id: number, percentage: number }} SourceShare */
/** @typedef {'glucose'|'fructose'} Pathway */

/** Step of the ratio sliders and +/- buttons, in parts. */
const RATIO_STEP = 0.05;
/** Upper end of the ratio sliders. Larger parts (from a share link) stretch the slider. */
const RATIO_SLIDER_MAX = 2;

/** Id of the plan warning raised when the sources cannot deliver the ratio. */
const INFEASIBLE_WARNING_ID = "plan.carbSourcesInfeasible";

/** Per-pathway text, input key, source options and colour classes. */
const PATHWAYS = {
  glucose: {
    title: "Glucose Sources",
    noun: "glucose source",
    inputKey: "glucoseSources",
    options: glucoseSourceOptions,
    dot: "bg-apple-blue",
    text: "text-apple-blue",
    rowBorder: "border-apple-blue/30",
    stepper: "hover:border-apple-blue hover:text-apple-blue",
    slider: "bg-apple-blue/20 accent-apple-blue",
  },
  fructose: {
    title: "Fructose Sources",
    noun: "fructose source",
    inputKey: "fructoseSources",
    options: fructoseSourceOptions,
    dot: "bg-apple-purple",
    text: "text-apple-purple",
    rowBorder: "border-apple-purple/30",
    stepper: "hover:border-apple-purple hover:text-apple-purple",
    slider: "bg-apple-purple/20 accent-apple-purple",
  },
};

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * Fructose share as a whole percentage, e.g. "33%".
 * @param {number} share
 * @returns {string}
 */
const formatShare = (share) => `${fmt(share * 100, 0)}%`;

/**
 * Sum of the percentages in a source list, rounded to 2 decimals so typed
 * decimals (33.3 + 66.7) compare cleanly with 100.
 * @param {SourceShare[]} sources
 * @returns {number}
 */
const totalPercentage = (sources) =>
  round2(sources.reduce((sum, s) => sum + (Number.isFinite(s.percentage) ? s.percentage : 0), 0));

/**
 * Slider with -/+ buttons for one part of the manual ratio. The buttons move
 * in 0.05 steps between 0 and 2; a larger value from a share link widens the
 * slider so it is never misrepresented, and can be stepped down.
 *
 * @param {{ id: string, label: string, value: number, pathway: Pathway,
 *   onChange: (value: number | ((current: number) => number)) => void }} props
 */
function RatioPartControl({ id, label, value, pathway, onChange }) {
  const { stepper, slider } = PATHWAYS[pathway];
  const lower = label.toLowerCase();
  const buttonClass = `w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm text-text-secondary ${stepper} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-card-border disabled:hover:text-text-secondary`;

  return (
    <div>
      <div className="flex justify-between text-xs text-text-secondary mb-2">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <output htmlFor={id} className="font-bold text-text-primary">
          {value.toFixed(2)}
        </output>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${lower}`}
          disabled={value <= 0}
          onClick={() => onChange((p) => Math.max(0, round2(p - RATIO_STEP)))}
          className={buttonClass}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="range"
          min="0"
          max={Math.max(RATIO_SLIDER_MAX, value)}
          step={RATIO_STEP}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${slider}`}
        />
        <button
          type="button"
          aria-label={`Increase ${lower}`}
          disabled={value >= RATIO_SLIDER_MAX}
          onClick={() => onChange((p) => Math.min(RATIO_SLIDER_MAX, round2(p + RATIO_STEP)))}
          className={buttonClass}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Tooltip text for one source: carbs per gram and the glucose/fructose split.
 * @param {{ carbsPerGram?: number, glucoseContent?: number, fructoseContent?: number }|undefined} data
 */
function SourceDetails({ data }) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="font-semibold">{(data?.carbsPerGram ?? 1).toFixed(2)}g Carbs / 1g</span>
      <span className="text-xs text-text-secondary">
        Glucose: {((data?.glucoseContent ?? 0) * 100).toFixed(0)}% | Fructose:{" "}
        {((data?.fructoseContent ?? 0) * 100).toFixed(0)}%
      </span>
    </div>
  );
}

/**
 * Allocation badge: how much of 100% the list's percentages use.
 * @param {{ total: number }} props
 */
function AllocationBadge({ total }) {
  const tone =
    total > 100
      ? "text-apple-red bg-apple-red/10 border-apple-red/30"
      : total === 100
        ? "text-apple-green-ink bg-apple-green/10 border-apple-green/30"
        : "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30";
  const text =
    total > 100
      ? `Over by ${fmt(total - 100, 2)}%`
      : total === 100
        ? "100% Allocated"
        : `${fmt(100 - total, 2)}% Remaining`;
  return <span className={`text-xs font-semibold px-2 py-1 rounded-md border transition-colors ${tone}`}>{text}</span>;
}

/**
 * Editable list of carb sources for one pathway, bound to
 * `inputs.carbs.glucoseSources` or `inputs.carbs.fructoseSources`. Rows are
 * addressed by index; each picks a source by id and gives it a percentage.
 * An option already used in another row of the list is disabled. "Add" adds
 * the first unused option at 0%.
 *
 * @param {{ pathway: Pathway, sources: SourceShare[],
 *   set: (path: string, value: unknown) => void }} props
 */
function SourceList({ pathway, sources, set }) {
  const { title, noun, inputKey, options, dot, text, rowBorder } = PATHWAYS[pathway];
  const listPath = `carbs.${inputKey}`;
  const headingId = `carb-sources-${pathway}-heading`;
  const total = totalPercentage(sources);
  const over = total > 100;
  const usedIds = new Set(sources.map((s) => s.id));
  const canAdd = options.some((option) => !usedIds.has(option.id));

  const addSource = () =>
    set(listPath, (list) => {
      const used = new Set(list.map((s) => s.id));
      const next = options.find((option) => !used.has(option.id));
      return next ? [...list, { id: next.id, percentage: 0 }] : list;
    });
  const removeSource = (index) => set(listPath, (list) => list.filter((_, i) => i !== index));

  return (
    <section aria-labelledby={headingId} className="p-5 rounded-xl border border-card-border bg-card-border/30">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 id={headingId} className="font-semibold text-text-primary flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dot}`} aria-hidden="true"></span>
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <AllocationBadge total={total} />
          <button
            type="button"
            aria-label={`Add ${noun}`}
            onClick={addSource}
            disabled={!canAdd}
            className={`text-xs ${text} font-medium flex items-center gap-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline`}
          >
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        </div>
      </div>
      {sources.length === 0 && <p className="text-sm text-text-secondary">No {noun}s yet.</p>}
      <div className="space-y-3">
        {sources.map((source, index) => {
          const data = sourceDataByIdMap.get(source.id);
          const label = data?.label ?? `Source ${source.id}`;
          const selectId = `carb-source-${pathway}-${index}`;
          const percentId = `${selectId}-percentage`;
          return (
            // Rows are positions in the input list (paths use the index), so the index is the key.
            <div
              key={index}
              className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border rounded-xl bg-card shadow-sm transition-colors ${over ? "border-apple-red/40" : rowBorder}`}
            >
              <label htmlFor={selectId} className="sr-only">
                {`${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${index + 1}`}
              </label>
              <select
                id={selectId}
                value={String(source.id)}
                onChange={(e) => set(`${listPath}.${index}.id`, Number(e.target.value))}
                className="flex-1 min-w-[120px] bg-card-border/30 border border-card-border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 outline-none"
              >
                {options.map((option) => (
                  <option
                    key={option.id}
                    value={String(option.id)}
                    disabled={sources.some((s, i) => s.id === option.id && i !== index)}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <TooltipInfo content={<SourceDetails data={data} />} />
              <div
                className={`flex items-center gap-1 text-sm bg-card-border/30 px-3 py-2 rounded-lg border ml-1 transition-colors ${over ? "border-apple-red/40" : "border-card-border"}`}
              >
                <label htmlFor={percentId} className="sr-only">
                  {`${label} share (%)`}
                </label>
                <NumberInput
                  id={percentId}
                  value={source.percentage}
                  min={INPUT_LIMITS.sourcePercentage[0]}
                  max={INPUT_LIMITS.sourcePercentage[1]}
                  emptyValue={0}
                  blankZero
                  placeholder="0"
                  onCommit={(value) => set(`${listPath}.${index}.percentage`, value)}
                  className={`w-12 bg-transparent outline-none font-semibold text-right transition-colors ${over ? "text-apple-red" : "text-text-primary"}`}
                />
                <span aria-hidden="true" className={over ? "text-apple-red" : "text-text-secondary"}>
                  %
                </span>
              </div>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => removeSource(index)}
                className="text-text-secondary hover:text-apple-red p-2"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Carbohydrate matrix: the glucose:fructose ratio and the sources that
 * deliver it.
 *
 * - Ratio, Auto: the recommended ratio for the current carb target, its
 *   allowed range and the "Why?" explanation (`plan.carbs.ratio.recommended`).
 * - Ratio, Adjust: glucose and fructose part sliders bound to
 *   `inputs.carbs.manualRatio`, with the `checkRatio` warnings. Switching to
 *   Adjust starts from the ratio in use, so nothing jumps.
 * - Sources: the glucose and fructose source lists (by id, with percentages),
 *   an allocation badge each, and the plan warning when the sources cannot
 *   deliver the ratio (`plan.carbs.sources.canAchieveRatio`).
 *
 * Reads the plan from `usePlan()` and edits the inputs through
 * `usePlanInputs()`. Domain messages render through `t()` (via `Why` and
 * `Warnings`).
 */
const CarbMatrix = () => {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();

  const ratio = plan.carbs.ratio;
  const recommended = ratio.recommended;
  const isManual = ratio.mode === "manual";
  const setRatioMode = (mode) => {
    if (mode === ratio.mode) return;
    // Adjust starts from the ratio in use, so switching never jumps the value.
    if (mode === "manual") apply({ carbs: { ratioMode: "manual", manualRatio: { ...ratio.value } } });
    else set("carbs.ratioMode", "auto");
  };

  // The ratio warnings (Adjust only) and, when the sources cannot deliver the
  // ratio, the plan's infeasibility warning. A 0:0 ratio has no infeasibility
  // warning because checkRatio already reports it.
  const infeasibleWarnings = plan.carbs.sources.canAchieveRatio
    ? []
    : plan.carbs.warnings.filter((w) => w.id === INFEASIBLE_WARNING_ID);

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
          <FlaskConical size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Carbohydrate Matrix</h2>
          <p className="text-sm text-text-secondary">
            Optimize your glucose to fructose ratio for maximum absorption.
          </p>
        </div>
      </div>

      <section
        aria-labelledby="carb-ratio-heading"
        className="bg-card-border/30 rounded-xl p-5 border border-card-border mb-8"
      >
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-apple-blue" aria-hidden="true" />
            <h3 id="carb-ratio-heading" className="font-semibold text-text-primary">
              Pathway Ratio
            </h3>
          </div>
          <Segmented label="Ratio mode" value={ratio.mode} onChange={setRatioMode} options={AUTO_ADJUST_OPTIONS} />
        </div>

        <div className="bg-apple-blue/10 p-4 rounded-xl border border-apple-blue/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                {isManual ? "Your ratio" : "Recommended ratio"}
              </p>
              <p className="text-3xl font-bold text-apple-blue" data-testid="carb-ratio-value">
                {formatRatio(ratio.value)}
              </p>
              <p className="text-xs text-text-secondary">
                Glucose : fructose at your {fmt(plan.carbs.gPerHour, 1)} g/h target
              </p>
            </div>
            <dl className="text-sm space-y-1">
              {isManual && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Recommended</dt>
                  <dd className="font-semibold text-text-primary">{formatRatio(recommended.ratio)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Allowed range</dt>
                <dd className="font-semibold text-text-primary">
                  {shareToRatio(recommended.minShare)}–{shareToRatio(recommended.maxShare)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Fructose share</dt>
                <dd className="font-semibold text-text-primary">
                  {formatShare(ratio.share)}{" "}
                  <span className="font-normal text-text-secondary">
                    (allowed {fmt(recommended.minShare * 100, 0)}–{fmt(recommended.maxShare * 100, 0)}%)
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <Why why={recommended.why} />
        </div>

        {isManual && (
          <div className="space-y-6 mt-6">
            <RatioPartControl
              id="carb-ratio-glucose"
              label="Glucose parts"
              pathway="glucose"
              value={inputs.carbs.manualRatio.glucose}
              onChange={(value) => set("carbs.manualRatio.glucose", value)}
            />
            <RatioPartControl
              id="carb-ratio-fructose"
              label="Fructose parts"
              pathway="fructose"
              value={inputs.carbs.manualRatio.fructose}
              onChange={(value) => set("carbs.manualRatio.fructose", value)}
            />
          </div>
        )}

        <Warnings warnings={[...ratio.warnings, ...infeasibleWarnings]} className="mt-6" />
      </section>

      <div className="space-y-6">
        <SourceList pathway="glucose" sources={inputs.carbs.glucoseSources} set={set} />
        <SourceList pathway="fructose" sources={inputs.carbs.fructoseSources} set={set} />
      </div>
    </Card>
  );
};

export default CarbMatrix;
