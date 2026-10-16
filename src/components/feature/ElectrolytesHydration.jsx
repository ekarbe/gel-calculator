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
import { ChevronDown, Droplet, Plus, Trash2 } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import Why from "../shared/Why";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import Segmented, { AUTO_ADJUST_OPTIONS } from "../shared/Segmented";
import { fmt } from "../shared/format";
import { INTENSITY_LABELS } from "../shared/labels";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi } from "../../state/UiProvider";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { SWEAT_RATE_PRESETS_LPH, SWEAT_SODIUM_PRESETS_MMOL } from "../../domain/sweat";
import { MG_PER_MMOL } from "../../domain/electrolytes";
import { formatAmount } from "../../domain/recipe";
import {
  electrolyteSourceOptions,
  sourceDataByIdMap,
  SWEAT_RATE_DESCRIPTIONS,
  SALTINESS_DESCRIPTIONS,
} from "../../constants/constants";

/** Labels for the enumerated inputs this card edits. */
const SEX_LABELS = { unspecified: "Not specified", female: "Female", male: "Male" };
const SODIUM_SALT_LABELS = { table: "Table salt", citrate: "Sodium citrate", mix: "50:50 mix" };

/** Optional ions under "Advanced": input key and plan key. */
const EXTRAS = [
  { key: "potassium", ion: "Potassium" },
  { key: "magnesium", ion: "Magnesium" },
  { key: "calcium", ion: "Calcium" },
];

const SWEAT_SOURCE_OPTIONS = [
  { value: "preset", label: "Presets" },
  { value: "estimate", label: "Estimate (interim)" },
];

/** Badge look and text for each `compareIons` status (ink colors keep the text readable in light mode). */
const STATUS_STYLES = {
  met: "text-apple-green-ink bg-apple-green/10 border-apple-green/30",
  short: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30",
  over: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30",
};

/** Salt mode choice: the salts follow the targets, or the user lists them. */
const SALT_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];

const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card focus:ring-2 focus:ring-apple-blue";
const LABEL_CLASS = "block text-sm font-medium text-text-primary mb-1.5";
const PANEL_CLASS = "bg-card-border/30 rounded-xl p-5 border border-card-border";

/**
 * °C in the display unit the user picked.
 * @param {number} tempC
 * @param {'C'|'F'} unit
 * @returns {string}
 */
function formatTemp(tempC, unit) {
  return unit === "F" ? `${fmt((tempC * 9) / 5 + 32)} °F` : `${fmt(tempC)} °C`;
}

/**
 * Text before the colon of a preset description ("Light sweating").
 * @param {string|undefined} description
 * @returns {string}
 */
const shortDescription = (description) => String(description ?? "").split(":")[0];

/**
 * One label/value pair in a recommendation's facts list.
 * @param {{ term: string, children: import('react').ReactNode }} props
 */
function Fact({ term, children }) {
  return (
    <div>
      <dt className="text-text-secondary">{term}</dt>
      <dd className="font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

/**
 * The effective value of a target in large type, with its unit.
 * @param {{ value: string, unit: string, testId: string }} props
 */
function BigValue({ value, unit, testId }) {
  return (
    <p data-testid={testId} className="text-text-primary">
      <span className="text-3xl font-bold">{value}</span>{" "}
      <span className="text-sm font-medium text-text-secondary">{unit}</span>
    </p>
  );
}

/**
 * Electrolytes and hydration card: sweat profile, sodium target (with the
 * optional potassium, magnesium and calcium targets under "Advanced"), the
 * salts that deliver them, and the fluid target.
 *
 * Reads the plan from `usePlan()` and edits the inputs through
 * `usePlanInputs()`; temperatures follow the display unit from `useUi()`.
 * Every recommendation shows its value, range, a "Why?" explanation and an
 * Auto/Adjust switch. Domain messages go through `t()` (via `Why` and
 * `Warnings`).
 */
const ElectrolytesHydration = () => {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { tempUnit } = useUi();
  const uid = useId();
  const id = (name) => `${uid}-${name}`;

  // "Advanced" opens whenever an extra turns on, also when that happens after
  // the first render (a share link is restored after mount). It never closes
  // by itself, so turning the last extra off keeps the checkbox in view.
  const anyExtraOn = EXTRAS.some(({ key }) => inputs.extras[key]);
  const [advancedOpen, setAdvancedOpen] = useState(anyExtraOn);
  const [extrasWereOn, setExtrasWereOn] = useState(anyExtraOn);
  if (anyExtraOn !== extrasWereOn) {
    setExtrasWereOn(anyExtraOn);
    if (anyExtraOn) setAdvancedOpen(true);
  }

  const { sweat, sodium, fluid, salts, extras } = plan;
  const sodiumRec = sodium.recommended;
  const fluidRec = fluid.recommended;
  const sweatSource = inputs.sweat.source;
  const sweatLo = Math.max(0, sweat.rateLph - sweat.uncertaintyLph);
  const sweatHi = sweat.rateLph + sweat.uncertaintyLph;
  const sweatSodiumMgL = sweat.sodiumMmolL * MG_PER_MMOL.Sodium;

  // Switching to Adjust starts from the value the plan uses now, so nothing jumps.
  const setSodiumMode = (mode) => {
    if (mode === "manual" && inputs.sodium.mode !== "manual") {
      apply({ sodium: { mode: "manual", manualMgPerHour: sodium.mgPerHour } });
    } else {
      set("sodium.mode", mode);
    }
  };
  const setFluidMode = (mode) => {
    if (mode === "manual" && inputs.fluid.mode !== "manual") {
      apply({ fluid: { mode: "manual", manualMlPerHour: fluid.mlPerHour } });
    } else {
      set("fluid.mode", mode);
    }
  };
  // Manual salts start from the auto amounts when there is no manual list yet.
  const setSaltMode = (mode) => {
    if (mode === "manual" && inputs.salts.mode !== "manual" && inputs.salts.manual.length === 0) {
      apply({ salts: { mode: "manual", manual: salts.items.map((s) => ({ id: s.id, amountMg: s.amountMg })) } });
    } else {
      set("salts.mode", mode);
    }
  };

  const manualSalts = inputs.salts.manual;
  const usedSaltIds = new Set(manualSalts.map((s) => s.id));
  const nextSaltId = electrolyteSourceOptions.find((o) => !usedSaltIds.has(o.id))?.id;
  const addSalt = () => {
    if (nextSaltId == null) return;
    set("salts.manual", (list) => [...(Array.isArray(list) ? list : []), { id: nextSaltId, amountMg: 0 }]);
  };
  const removeSalt = (index) =>
    set("salts.manual", (list) => (Array.isArray(list) ? list.filter((_, i) => i !== index) : []));

  const comparisonRows = Object.entries(salts.comparison);

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
          <Droplet size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Electrolytes & Hydration</h2>
          <p className="text-sm text-text-secondary">Sweat, sodium and fluid targets per hour.</p>
        </div>
      </div>

      {/* Sweat */}
      <section aria-labelledby={id("sweat-heading")} className="mb-8">
        <h3 id={id("sweat-heading")} className="font-semibold text-text-primary mb-4">
          Sweat
        </h3>
        <Segmented
          label="Sweat source"
          value={sweatSource}
          options={SWEAT_SOURCE_OPTIONS}
          onChange={(value) => set("sweat.source", value)}
          size="lg"
          className="mb-6"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
          {sweatSource === "preset" ? (
            <div>
              <label htmlFor={id("sweat-rate")} className={LABEL_CLASS}>
                Sweat Rate
              </label>
              <select
                id={id("sweat-rate")}
                value={inputs.sweat.rateIndex}
                onChange={(e) => set("sweat.rateIndex", Number(e.target.value))}
                aria-describedby={id("sweat-rate-description")}
                className={INPUT_CLASS}
              >
                {SWEAT_RATE_PRESETS_LPH.map((rate, index) => (
                  <option key={rate} value={index}>
                    {shortDescription(SWEAT_RATE_DESCRIPTIONS[index])} ({rate} L/h)
                  </option>
                ))}
              </select>
              <p id={id("sweat-rate-description")} className="mt-1.5 text-xs text-text-secondary">
                {SWEAT_RATE_DESCRIPTIONS[inputs.sweat.rateIndex]}
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor={id("sex")} className={LABEL_CLASS}>
                Sex
              </label>
              <select
                id={id("sex")}
                value={inputs.athlete.sex}
                onChange={(e) => set("athlete.sex", e.target.value)}
                className={INPUT_CLASS}
              >
                {INPUT_OPTIONS.sex.map((sex) => (
                  <option key={sex} value={sex}>
                    {SEX_LABELS[sex] ?? sex}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center mb-1.5">
              <label htmlFor={id("saltiness")} className="text-sm font-medium text-text-primary">
                Sweat Saltiness
              </label>
              <TooltipInfo content="How salty your sweat is (sodium per litre of sweat). Most athletes lose 0.5–1.5 g sodium per litre. White salt marks on dark clothing suggest saltier sweat." />
            </div>
            <select
              id={id("saltiness")}
              value={inputs.sweat.saltinessIndex}
              onChange={(e) => set("sweat.saltinessIndex", Number(e.target.value))}
              aria-describedby={id("saltiness-description")}
              className={INPUT_CLASS}
            >
              {SWEAT_SODIUM_PRESETS_MMOL.map((mmol, index) => (
                <option key={mmol} value={index}>
                  {shortDescription(SALTINESS_DESCRIPTIONS[index])} ({fmt(mmol * MG_PER_MMOL.Sodium)} mg/L)
                </option>
              ))}
            </select>
            <p id={id("saltiness-description")} className="mt-1.5 text-xs text-text-secondary">
              {SALTINESS_DESCRIPTIONS[inputs.sweat.saltinessIndex]}
            </p>
          </div>
        </div>

        {sweatSource === "estimate" && (
          <div className="mb-4 p-4 rounded-xl border border-apple-blue/30 bg-apple-blue/10 text-sm space-y-1">
            <p className="text-text-primary">
              Estimated sweat rate:{" "}
              <strong data-testid="sweat-estimate">
                {fmt(sweat.rateLph, 2)} L/h ± {fmt(sweat.uncertaintyLph, 1)} L/h
              </strong>
            </p>
            <p className="text-text-secondary">
              Uses your intensity ({INTENSITY_LABELS[inputs.event.intensity] ?? inputs.event.intensity}),
              temperature ({formatTemp(inputs.environment.tempC, tempUnit)}) and humidity (
              {fmt(inputs.environment.humidity)}%).
            </p>
            <p className="text-xs text-apple-blue">
              This is a rough interim estimate. A sweat test and a better estimate are coming.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <p data-testid="sweat-summary">
            Sweat rate used:{" "}
            <strong className="text-text-primary">{fmt(sweat.rateLph, 2)} L/h</strong> (likely{" "}
            {fmt(sweatLo, 2)}–{fmt(sweatHi, 2)} L/h). Sweat sodium:{" "}
            <strong className="text-text-primary">{fmt(sweatSodiumMgL)} mg/L</strong>.
          </p>
          <Why why={sweat.why} />
        </div>
      </section>

      {/* Sodium target */}
      <section aria-labelledby={id("sodium-heading")} className="pt-6 border-t border-card-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 id={id("sodium-heading")} className="font-semibold text-text-primary">
              Sodium target
            </h3>
            {sodiumRec.optional && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md border text-apple-blue bg-apple-blue/10 border-apple-blue/30">
                Optional
              </span>
            )}
          </div>
          <Segmented
            label="Sodium target mode"
            value={inputs.sodium.mode}
            options={AUTO_ADJUST_OPTIONS}
            onChange={setSodiumMode}
          />
        </div>

        <div className={PANEL_CLASS}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <BigValue testId="sodium-value" value={fmt(sodium.mgPerHour)} unit="mg/h" />
            <p className="text-sm text-text-secondary">{fmt(sodium.totalMg)} mg in total</p>
          </div>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <Fact term="Recommended">{fmt(sodiumRec.mgPerHour)} mg/h</Fact>
            <Fact term="Range">
              {fmt(sodiumRec.range[0])}–{fmt(sodiumRec.range[1])} mg/h
            </Fact>
            <Fact term="Estimated sweat loss">about {fmt(sodiumRec.estimatedLossMgPerHour)} mg/h</Fact>
          </dl>
          {inputs.sodium.mode === "manual" && (
            <div className="mt-4 max-w-xs">
              <label htmlFor={id("sodium-manual")} className={LABEL_CLASS}>
                Your sodium target (mg/h)
              </label>
              <NumberInput
                id={id("sodium-manual")}
                className={INPUT_CLASS}
                value={inputs.sodium.manualMgPerHour}
                onCommit={(value) => set("sodium.manualMgPerHour", value)}
                min={INPUT_LIMITS.manualMgPerHour[0]}
                max={INPUT_LIMITS.manualMgPerHour[1]}
                step={10}
              />
            </div>
          )}
          <Why why={sodiumRec.why} className="mt-3" />
        </div>
        <Warnings warnings={sodium.warnings} className="mt-4" />

        {/* Advanced: optional ions */}
        <div className="mt-6">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={id("advanced")}
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center justify-between w-full group focus:outline-none"
          >
            <span className="text-sm font-semibold text-text-primary">
              Advanced: potassium, magnesium, calcium
            </span>
            <ChevronDown
              size={20}
              aria-hidden="true"
              className={`text-text-secondary group-hover:text-text-primary transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div id={id("advanced")} hidden={!advancedOpen} className="mt-4 space-y-3">
            {EXTRAS.map(({ key, ion }) => {
              const enabled = inputs.extras[key];
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      id={id(`extra-${key}`)}
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => set(`extras.${key}`, e.target.checked)}
                      className="rounded text-apple-blue focus:ring-apple-blue"
                    />
                    <label
                      htmlFor={id(`extra-${key}`)}
                      className={`text-sm font-medium cursor-pointer ${enabled ? "text-text-primary" : "text-text-secondary"}`}
                    >
                      {ion}
                    </label>
                  </div>
                  <span
                    data-testid={`extra-${key}`}
                    className={`text-sm font-bold ${enabled ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    {enabled ? `${fmt(extras[ion].mgPerHour)} mg/h` : "Off"}
                  </span>
                </div>
              );
            })}
            <Why why={extras.why} />
          </div>
        </div>
      </section>

      {/* Salts */}
      <section aria-labelledby={id("salts-heading")} className="pt-6 border-t border-card-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id={id("salts-heading")} className="font-semibold text-text-primary">
            Salts
          </h3>
          <Segmented
            label="Salt mode"
            value={inputs.salts.mode}
            options={SALT_MODE_OPTIONS}
            onChange={setSaltMode}
          />
        </div>

        {inputs.salts.mode === "auto" ? (
          <div className="space-y-4">
            <div className="max-w-xs">
              <label htmlFor={id("sodium-salt")} className={LABEL_CLASS}>
                Sodium salt
              </label>
              <select
                id={id("sodium-salt")}
                value={inputs.salts.sodiumSalt}
                onChange={(e) => set("salts.sodiumSalt", e.target.value)}
                className={INPUT_CLASS}
              >
                {INPUT_OPTIONS.sodiumSalt.map((salt) => (
                  <option key={salt} value={salt}>
                    {SODIUM_SALT_LABELS[salt] ?? salt}
                  </option>
                ))}
              </select>
            </div>
            {salts.items.length > 0 ? (
              <ul aria-label="Salt amounts for the whole activity" className="space-y-2">
                {salts.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 p-3 border border-card-border rounded-xl bg-card shadow-sm text-sm"
                  >
                    <span className="font-medium text-text-primary">
                      {sourceDataByIdMap.get(item.id)?.label ?? `Salt ${item.id}`}
                    </span>
                    <span className="font-bold text-text-primary">{formatAmount(item.amountMg, "mg")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">No salts needed for this plan.</p>
            )}
            <p className="text-xs text-text-secondary">Amounts are for the whole activity.</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-text-secondary">Enter mg for the whole activity.</p>
              <button
                type="button"
                onClick={addSalt}
                disabled={nextSaltId == null}
                className="text-sm text-apple-blue font-medium flex items-center gap-1 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <Plus size={16} aria-hidden="true" /> Add salt
              </button>
            </div>
            {manualSalts.length === 0 && <p className="text-sm text-text-secondary">No salts added.</p>}
            <div className="space-y-4">
              {manualSalts.map((salt, index) => {
                const option = sourceDataByIdMap.get(salt.id);
                const name = option?.label ?? `Salt ${salt.id}`;
                const contents = option
                  ? `Contains ${option.components.map((c) => `${(c.ratio * 100).toFixed(1)}% ${c.name}`).join(", ")}`
                  : "";
                const selectId = id(`salt-${index}`);
                const amountId = id(`salt-${index}-amount`);
                return (
                  // Rows are positions in the list (edits and removal use the index), so the
                  // index is the key: changing a row's salt keeps the row and its focus.
                  <div
                    key={index}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border border-card-border rounded-xl bg-card shadow-sm"
                  >
                    <label htmlFor={selectId} className="sr-only">
                      Salt {index + 1}
                    </label>
                    <select
                      id={selectId}
                      value={salt.id}
                      onChange={(e) => set(["salts", "manual", index, "id"], Number(e.target.value))}
                      className="flex-1 min-w-[120px] bg-card-border/30 border border-card-border rounded-lg px-3 py-2 text-sm font-medium outline-none"
                    >
                      {electrolyteSourceOptions.map((opt) => (
                        <option
                          key={opt.id}
                          value={opt.id}
                          disabled={opt.id !== salt.id && usedSaltIds.has(opt.id)}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <TooltipInfo content={contents} />
                    <label htmlFor={amountId} className="sr-only">
                      {name} amount in mg for the whole activity
                    </label>
                    <NumberInput
                      id={amountId}
                      value={salt.amountMg}
                      onCommit={(value) => set(["salts", "manual", index, "amountMg"], value)}
                      min={INPUT_LIMITS.saltAmountMg[0]}
                      max={INPUT_LIMITS.saltAmountMg[1]}
                      step={1}
                      className="w-24 px-3 py-2 text-sm border border-card-border rounded-lg text-right font-bold bg-card text-text-primary"
                    />
                    <span className="text-sm text-text-secondary">mg total</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeSalt(index)}
                      className="text-text-secondary hover:text-apple-red p-2"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {comparisonRows.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left text-sm font-semibold text-text-primary mb-2">
                Delivered vs target (whole activity)
              </caption>
              <thead>
                <tr className="text-xs text-text-secondary">
                  <th scope="col" className="text-left font-medium py-1">
                    Ion
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Target
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Delivered
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([ion, row]) => (
                  <tr key={ion} className="border-t border-card-border">
                    <th scope="row" className="text-left font-medium text-text-primary py-2">
                      {ion}
                    </th>
                    <td className="text-right text-text-primary py-2">{fmt(row.target)} mg</td>
                    <td className="text-right text-text-primary py-2">{fmt(row.delivered)} mg</td>
                    <td className="text-right py-2 pl-2">
                      <span
                        data-status={row.status}
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLES[row.status] ?? STATUS_STYLES.short}`}
                      >
                        {row.status === "met"
                          ? "On target"
                          : `${row.status === "short" ? "Short by" : "Over by"} ${fmt(Math.abs(row.diff))} mg`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Warnings warnings={salts.warnings} className="mt-4" />
      </section>

      {/* Fluid */}
      <section aria-labelledby={id("fluid-heading")} className="pt-6 border-t border-card-border">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id={id("fluid-heading")} className="font-semibold text-text-primary">
            Fluid
          </h3>
          <Segmented
            label="Fluid target mode"
            value={inputs.fluid.mode}
            options={AUTO_ADJUST_OPTIONS}
            onChange={setFluidMode}
          />
        </div>

        <div className={PANEL_CLASS}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <BigValue testId="fluid-value" value={fmt(fluid.mlPerHour)} unit="ml/h" />
            <p className="text-sm text-text-secondary">{fmt(fluid.totalMl / 1000, 1)} L in total</p>
          </div>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <Fact term="Recommended">{fmt(fluidRec.mlPerHour)} ml/h</Fact>
            <Fact term="Guideline range">
              {fmt(fluidRec.range[0])}–{fmt(fluidRec.range[1])} ml/h
            </Fact>
            <Fact term="Sweat loss">about {fmt(sweat.rateLph * 1000)} ml/h</Fact>
          </dl>
          {fluidRec.drinkToThirst && (
            <p
              data-testid="drink-to-thirst"
              className="mt-4 p-3 rounded-xl border border-apple-blue/30 bg-apple-blue/10 text-xs text-text-primary"
            >
              Drinking to thirst works well for this event. Use this number as a rough guide.
            </p>
          )}
          {inputs.fluid.mode === "manual" && (
            <div className="mt-4 max-w-xs">
              <label htmlFor={id("fluid-manual")} className={LABEL_CLASS}>
                Your fluid target (ml/h)
              </label>
              <NumberInput
                id={id("fluid-manual")}
                className={INPUT_CLASS}
                value={inputs.fluid.manualMlPerHour}
                onCommit={(value) => set("fluid.manualMlPerHour", value)}
                min={INPUT_LIMITS.manualMlPerHour[0]}
                max={INPUT_LIMITS.manualMlPerHour[1]}
                step={50}
              />
            </div>
          )}
          <Why why={fluidRec.why} className="mt-3" />
        </div>
        <Warnings warnings={fluid.warnings} className="mt-4" />
      </section>
    </Card>
  );
};

export default ElectrolytesHydration;
