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
import { ListRestart, ChevronRight, Printer, Droplets } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import { fmt } from "../shared/format";
import {
  SECTION_TITLES,
  amountsCaption,
  countText,
  itemAmount,
  osmolalityDisplay,
  recipeItemLabel,
  recipeWarnings,
  servingsText,
} from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, MIXING_MODAL } from "../../state/UiProvider";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { formatAmount } from "../../domain/recipe";
import { GEL_CONSISTENCY_PCT } from "../../domain/concentration";
import { t } from "../../i18n";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/plan').PlanInputs} PlanInputs */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {import('../../domain/recipe').Osmolality} Osmolality */

/** Recipe formats (`inputs.format.type`), in `INPUT_OPTIONS.formatType` order. */
const FORMAT_LABELS = Object.freeze({ gel: "Gel", drink: "Drink", both: "Both" });

/** Recipe views (`inputs.format.view`). */
const VIEW_LABELS = Object.freeze({ total: "Total", perServing: "Per serving" });

/** Bottle sizes offered as buttons, ml. Any other size is "Custom". */
const BOTTLE_PRESETS_ML = Object.freeze([500, 750, 950]);

/** Dot color of a recipe line, by item kind. The label and amount carry the meaning. */
const DOT_CLASSES = Object.freeze({
  carb: "bg-apple-blue",
  salt: "bg-apple-teal",
  water: "bg-sky-400",
  caffeine: "bg-apple-amber",
});

/** Look of each tonicity band. The chip always shows the band's name. */
const TONICITY_CHIPS = Object.freeze({
  hypotonic: "text-apple-green-ink bg-apple-green/10 border-apple-green/30",
  isotonic: "text-apple-green-ink bg-apple-green/10 border-apple-green/30",
  hypertonic: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30",
});

/** Layout of a section's per-serving facts. */
const FACTS_CLASS = "mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs";

/**
 * Button classes of a choice in a choice group. Choices that are not picked
 * use the primary text color at 75 %: about 6.6:1 on the blue-tinted format
 * panel in light mode and 8.3:1 in dark mode (the secondary gray was 3:1).
 * @param {boolean} active
 * @returns {string}
 */
const choiceClass = (active) =>
  `px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${active ? "bg-apple-blue text-white shadow-sm" : "text-text-primary/75 hover:text-text-primary"}`;

/**
 * A money amount with two decimals (rough estimate; currency is Phase 3).
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

/**
 * Tonicity chip: the band's name (from the concentration catalog) with an
 * icon, so the meaning never depends on color.
 * @param {{ tonicity: string }} props
 */
function TonicityChip({ tonicity }) {
  const look = TONICITY_CHIPS[tonicity] ?? TONICITY_CHIPS.hypertonic;
  return (
    <span
      data-testid="tonicity-chip"
      data-tonicity={tonicity}
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${look}`}
    >
      <Droplets size={12} aria-hidden="true" />
      {t(`concentration.tonicity.${tonicity}`)}
    </span>
  );
}

/**
 * Tooltip text for a carb line: the carbs it delivers, split by pathway.
 * @param {{ detail: { carbsG: number, glucoseG: number, fructoseG: number } }} props
 */
function CarbDetail({ detail }) {
  return (
    <div className="flex flex-col gap-1 text-left min-w-max">
      <span className="font-semibold">{formatAmount(detail.carbsG, "g")} carbs</span>
      <span className="text-xs">
        Glucose: {formatAmount(detail.glucoseG, "g")} | Fructose: {formatAmount(detail.fructoseG, "g")}
      </span>
    </div>
  );
}

/**
 * One fact in a section's per-serving list.
 * @param {{ term: string, children: import('react').ReactNode }} props
 */
function Fact({ term, children }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-text-secondary">{term}</dt>
      <dd className="font-semibold text-text-primary text-right">{children}</dd>
    </div>
  );
}

/**
 * What one serving holds: per gel the mass, volume, carbs and strength; per
 * bottle the fill, carbs (% w/v) and sodium (mg/L). Nothing for a section
 * without servings.
 * @param {{ section: RecipeSection, plan: Plan }} props
 */
function ServingFacts({ section, plan }) {
  if (section.servings <= 0) return null;
  const ps = section.perServing;
  if (section.kind === "gel") {
    const carbPct = plan.concentration.gel?.carbPct;
    return (
      <dl aria-label={`${t(section.servingLabelKey)} facts`} className={FACTS_CLASS}>
        <Fact term="Gel mass">{formatAmount(ps.massG, "g")}</Fact>
        <Fact term="Gel volume">≈ {formatAmount(ps.volumeMl, "ml")}</Fact>
        <Fact term="Carbs per gel">{formatAmount(ps.carbsG, "g")}</Fact>
        {Number.isFinite(carbPct) && <Fact term="Carbohydrate">{fmt(carbPct, 0)}% w/w</Fact>}
      </dl>
    );
  }
  return (
    <dl aria-label={`${t(section.servingLabelKey)} facts`} className={FACTS_CLASS}>
      <Fact term="Fill each bottle to">{formatAmount(ps.volumeMl, "ml")}</Fact>
      <Fact term="Carbs per bottle">
        {formatAmount(ps.carbsG, "g")} ({fmt(ps.carbPctWv, 1)}% w/v)
      </Fact>
      <Fact term="Sodium per bottle">
        {formatAmount(ps.sodiumMg, "mg")} ({fmt(ps.sodiumMgPerL)} mg/L)
      </Fact>
    </dl>
  );
}

/**
 * Osmolality line: "≈ 4,300 mOsm/kg" with the tonicity chip. Nothing when
 * the section has no osmolality.
 * @param {{ section: RecipeSection, className?: string }} props
 */
function OsmolalityLine({ section, className = "" }) {
  const shown = osmolalityDisplay(section.osmolality, section.kind);
  if (!shown) return null;
  return (
    <div data-testid="osmolality" className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="text-text-secondary">Osmolality</span>
      <span className="font-semibold text-text-primary">
        {shown.text}
        {shown.likelyHigher && <span className="font-normal text-text-secondary">, likely higher</span>}
      </span>
      <TonicityChip tonicity={shown.tonicity} />
    </div>
  );
}

/**
 * One recipe section (gel batch or drink): its lines in the chosen view, the
 * per-serving facts, the osmolality and the section's warnings.
 * @param {{ section: RecipeSection, view: 'total'|'perServing', plan: Plan, bottleMl: number }} props
 */
function RecipeSectionCard({ section, view, plan, bottleMl }) {
  const headingId = useId();
  const title = SECTION_TITLES[section.kind] ?? section.kind;
  const items = section.items;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`recipe-section-${section.kind}`}
      className="rounded-2xl border border-card-border bg-card-border/10 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h4 id={headingId} className="text-base font-bold text-text-primary">
          {title}
        </h4>
        <span data-testid="section-servings" className="text-xs font-semibold text-text-secondary">
          {servingsText(section, bottleMl)}
        </span>
      </div>
      {items.length > 0 ? (
        <>
          <p data-testid="amounts-caption" className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
            {amountsCaption(section, view)}
          </p>
          <ul aria-label="Ingredients" className="space-y-1">
            {items.map((item) => (
              <li
                key={item.key}
                data-kind={item.kind}
                className="flex justify-between items-center gap-3 py-2 border-b border-card-border border-dashed"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_CLASSES[item.kind] ?? "bg-text-secondary"}`} />
                  <div className="flex items-center min-w-0">
                    <span data-testid="item-label" className="font-medium text-text-primary">
                      {recipeItemLabel(item)}
                    </span>
                    {item.kind === "carb" && item.detail && (
                      <TooltipInfo
                        content={<CarbDetail detail={view === "perServing" ? item.detail.perServing : item.detail} />}
                      />
                    )}
                  </div>
                </div>
                <span data-testid="item-amount" className="font-bold text-text-primary whitespace-nowrap">
                  {itemAmount(item, view)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-text-secondary">Nothing goes into this part.</p>
      )}
      {items.length > 0 && <ServingFacts section={section} plan={plan} />}
      <OsmolalityLine section={section} className="mt-3" />
      <Warnings warnings={section.warnings} className="mt-3" />
    </section>
  );
}

/**
 * A labelled row of choice buttons; each button has its own id.
 * @param {{ idPrefix: string, label: string, value: string|number, onChange: (value: any) => void,
 *   options: ReadonlyArray<{ value: string|number, label: import('react').ReactNode }> }} props
 */
function ChoiceGroup({ idPrefix, label, value, onChange, options }) {
  const labelId = `${idPrefix}-label`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span id={labelId} className="text-sm font-semibold text-apple-blue">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1 bg-card-border/50 p-1 rounded-lg">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              id={`${idPrefix}-${option.value}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={choiceClass(active)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Format controls: Gel / Drink / Both; gels per hour and gel consistency for
 * gels; bottle size for drinks; the drink's share of the carbs for both.
 * Every control edits `inputs.format`.
 * @param {{ baseId: string, plan: Plan }} props
 */
function FormatControls({ baseId, plan }) {
  const { inputs, set } = usePlanInputs();
  const [customBottle, setCustomBottle] = useState(false);
  const format = inputs.format;
  const hasGel = format.type !== "drink";
  const hasDrink = format.type !== "gel";
  const gelsInputId = `${baseId}-gels-per-hour`;
  const gelsHelpId = `${baseId}-gels-help`;
  const bottleInputId = `${baseId}-bottle-ml`;
  const shareInputId = `${baseId}-drink-share`;
  const shareHelpId = `${baseId}-drink-share-help`;
  const isCustomBottle = customBottle || !BOTTLE_PRESETS_ML.includes(format.bottleMl);
  const gelCount = plan.gels.count;
  const [bottleMin, bottleMax] = INPUT_LIMITS.bottleMl;
  const [shareMin, shareMax] = INPUT_LIMITS.drinkCarbSharePct;

  // Without gels the plan puts what they would hold into the drink (plan.format.type 'drink').
  let gelsHelp;
  if (gelCount > 0) gelsHelp = `${countText(gelCount, "gel", "gels")} in total`;
  else if (plan.carbs.totalG <= 0) gelsHelp = "No gels needed: this plan has no carbs";
  else if (plan.carbs.deliveredG <= 0) gelsHelp = "No gels: your ingredients give no carbs";
  else if (format.type === "both" && format.drinkCarbSharePct >= shareMax) gelsHelp = "No gels: all carbs are in the drink";
  else gelsHelp = "No gels planned: the carbs go in your drink";

  const inputClass =
    "w-20 px-3 py-1.5 text-sm font-bold text-text-primary text-right bg-card border border-card-border rounded-lg outline-none focus:ring-2 focus:ring-apple-blue";

  return (
    <div data-testid="format-controls" className="mb-6 p-4 bg-apple-blue/10 rounded-xl border border-apple-blue/30 space-y-4">
      <ChoiceGroup
        idPrefix={`${baseId}-format`}
        label="Format"
        value={format.type}
        onChange={(type) => set("format.type", type)}
        options={INPUT_OPTIONS.formatType.map((type) => ({ value: type, label: FORMAT_LABELS[type] ?? type }))}
      />

      {hasGel && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor={gelsInputId} className="text-sm font-semibold text-apple-blue">
              Gels per Hour
            </label>
            <p id={gelsHelpId} className="text-xs text-text-secondary">
              {gelsHelp}
            </p>
          </div>
          <NumberInput
            id={gelsInputId}
            value={format.gelsPerHour}
            min={INPUT_LIMITS.gelsPerHour[0]}
            max={INPUT_LIMITS.gelsPerHour[1]}
            step={0.5}
            aria-describedby={gelsHelpId}
            onCommit={(n) => set("format.gelsPerHour", n)}
            className={inputClass}
          />
        </div>
      )}

      {hasGel && (
        <div className="space-y-2">
          <ChoiceGroup
            idPrefix={`${baseId}-consistency`}
            label="Gel consistency"
            value={format.gelConsistency}
            onChange={(consistency) => set("format.gelConsistency", consistency)}
            options={INPUT_OPTIONS.gelConsistency.map((key) => ({
              value: key,
              label: (
                <>
                  {t(`concentration.consistency.${key}`)}{" "}
                  <span className="font-normal">{GEL_CONSISTENCY_PCT[key]}%</span>
                </>
              ),
            }))}
          />
          <p className="text-xs text-text-secondary">
            Carbohydrate as % of the gel mass. Higher is thicker and needs more water with each gel.
          </p>
          {format.gelConsistency === "isotonic" && (
            <p data-testid="isotonic-note" className="text-xs text-text-secondary">
              {t("concentration.consistency.isotonicNote")}
            </p>
          )}
        </div>
      )}

      {hasDrink && (
        <div className="space-y-2">
          <ChoiceGroup
            idPrefix={`${baseId}-bottle`}
            label="Bottle size"
            value={isCustomBottle ? "custom" : format.bottleMl}
            onChange={(value) => {
              if (value === "custom") {
                setCustomBottle(true);
                return;
              }
              setCustomBottle(false);
              set("format.bottleMl", value);
            }}
            options={[
              ...BOTTLE_PRESETS_ML.map((ml) => ({ value: ml, label: `${ml} ml` })),
              { value: "custom", label: "Custom" },
            ]}
          />
          {isCustomBottle && (
            <div className="flex items-center justify-between gap-4">
              <label htmlFor={bottleInputId} className="text-xs font-semibold text-text-secondary">
                Custom bottle size (ml, {fmt(bottleMin)}–{fmt(bottleMax)})
              </label>
              <NumberInput
                id={bottleInputId}
                value={format.bottleMl}
                min={bottleMin}
                max={bottleMax}
                step={50}
                onCommit={(n) => set("format.bottleMl", n)}
                className={inputClass}
              />
            </div>
          )}
        </div>
      )}

      {format.type === "both" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor={shareInputId} className="text-sm font-semibold text-apple-blue">
                Carbs in the drink (%)
              </label>
              <p id={shareHelpId} className="text-xs text-text-secondary">
                The rest goes into gels. The drink holds all the salts.
              </p>
            </div>
            <NumberInput
              id={shareInputId}
              value={format.drinkCarbSharePct}
              min={shareMin}
              max={shareMax}
              step={5}
              aria-describedby={shareHelpId}
              onCommit={(n) => set("format.drinkCarbSharePct", n)}
              className={inputClass}
            />
          </div>
          <input
            id={`${shareInputId}-slider`}
            type="range"
            min={shareMin}
            max={shareMax}
            step={5}
            value={format.drinkCarbSharePct}
            aria-label="Carbs in the drink, slider"
            aria-valuetext={`${fmt(format.drinkCarbSharePct)}% in the drink`}
            onChange={(e) => set("format.drinkCarbSharePct", Number(e.target.value))}
            className="w-full accent-apple-blue"
          />
        </div>
      )}
    </div>
  );
}

/**
 * The card's one-line description of the amounts in the chosen view.
 * @param {Plan} plan
 * @param {'total'|'perServing'} view
 * @returns {string}
 */
function viewDescription(plan, view) {
  const hours = plan.durationH.toFixed(1);
  if (view === "total") return `Totals for a ${hours} hour activity.`;
  const parts = plan.recipe.sections
    .filter((s) => s.servings > 0 && s.items.length > 0)
    .map((s) => (s.kind === "gel" ? "one gel" : "one bottle"));
  if (parts.length === 0) return "No gels or bottles are planned, so these are the amounts for the whole activity.";
  return `Amounts for ${parts.join(" and ")}.`;
}

/**
 * The recipe card: what to weigh out and mix, as gels, a drink or both.
 *
 * - Format controls edit `inputs.format`: the format type, gels per hour, the
 *   gel consistency preset (its carbohydrate % shown), the bottle size
 *   (500/750/950 ml or a custom size) and, for both, the drink's share of the
 *   carbs.
 * - Sections come from `plan.recipe.sections` (one per gel batch or drink):
 *   carbs, salts, the water to add and caffeine tablets, in the view
 *   `inputs.format.view` (Total or Per serving). Each section shows what one
 *   gel or bottle holds, the osmolality (≈, with a tonicity chip) and its own
 *   warnings (`section.warnings`).
 * - Card warnings explain the carbs ({@link recipeWarnings}).
 * - The cost is the plan's rough estimate (`plan.cost`). "Print / save as
 *   PDF" opens the browser's print dialog (`window.print()`); the print view
 *   is a separate component.
 */
export default function FinalRecipe() {
  const plan = usePlan();
  const { inputs, set } = usePlanInputs();
  const { openModal } = useUi();
  const baseId = useId();
  const headingId = `${baseId}-heading`;

  const view = inputs.format.view;
  const sections = plan.recipe.sections;
  const hasItems = sections.some((section) => section.items.length > 0);
  const warnings = recipeWarnings(plan);

  return (
    <div className="sticky top-24">
      <Card className="!p-0 flex flex-col h-full">
        <section aria-labelledby={headingId} className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <ListRestart size={20} className="text-apple-blue" aria-hidden="true" />
              <h3 id={headingId} className="text-lg font-bold text-text-primary">
                Final Recipe
              </h3>
            </div>
            <div role="group" aria-label="Recipe view" className="flex bg-card-border/50 p-1 rounded-lg">
              {INPUT_OPTIONS.view.map((value) => (
                <button
                  key={value}
                  id={`${baseId}-view-${value}`}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => set("format.view", value)}
                  className={choiceClass(view === value)}
                >
                  {VIEW_LABELS[value] ?? value}
                </button>
              ))}
            </div>
          </div>

          <FormatControls baseId={baseId} plan={plan} />

          <p className="text-sm text-text-secondary mb-6 bg-card-border/30 p-3 rounded-xl border border-card-border">
            {viewDescription(plan, view)}
          </p>

          {hasItems ? (
            <div className="space-y-4">
              {sections.map((section) => (
                <RecipeSectionCard
                  key={section.kind}
                  section={section}
                  view={view}
                  plan={plan}
                  bottleMl={inputs.format.bottleMl}
                />
              ))}
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary">Nothing to mix for this plan.</p>
              {sections.map((section) => (
                <Warnings key={section.kind} warnings={section.warnings} className="mt-4" />
              ))}
            </>
          )}

          <Warnings warnings={warnings} className="mt-6" />
        </section>

        <div className="px-6 py-4 bg-card-border/10 border-t border-card-border flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Est. Cost (DIY)</h4>
            <p className="text-xs text-text-secondary">{money(plan.cost.diy)}</p>
          </div>
          <div className="text-right">
            <h4 className="text-sm font-bold text-apple-green-ink">You Save</h4>
            <p className="text-xs font-semibold text-apple-green-ink">{money(plan.cost.savings)} vs Commercial</p>
          </div>
        </div>

        <div className="p-6 bg-card-border/30 border-t border-card-border rounded-b-[2rem] flex flex-col gap-3">
          <button
            id={`${baseId}-open-mixing`}
            type="button"
            onClick={() => openModal(MIXING_MODAL)}
            className="w-full bg-apple-blue hover:bg-apple-blue/90 text-white font-semibold py-3 px-7 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 group"
          >
            View Mixing Instructions{" "}
            <ChevronRight size={18} aria-hidden="true" className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            id={`${baseId}-print`}
            type="button"
            onClick={() => window.print()}
            className="w-full bg-card hover:bg-card-border/50 text-text-primary font-semibold py-3 px-7 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 border border-card-border"
          >
            <Printer size={18} aria-hidden="true" />
            Print / save as PDF
          </button>
        </div>
      </Card>
    </div>
  );
}
