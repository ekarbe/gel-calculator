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
import { ListRestart, ChevronRight, Download } from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import { fmt } from "../shared/format";
import { carbRecipeWarnings, recipeItemDotClass, recipeItemLabel } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, MIXING_MODAL } from "../../state/UiProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { formatAmount } from "../../domain/recipe";

/** The two recipe views (`inputs.format.view`). */
const VIEWS = [
  { value: "total", label: "Total Batch" },
  { value: "perGel", label: "Per Gel" },
];

/**
 * A money amount with two decimals (rough estimate; currency is Phase 3).
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

/**
 * Tooltip text for a carb line: the carbs it delivers, split by pathway.
 * @param {{ detail: { carbsG: number, glucoseG: number, fructoseG: number } }} props
 */
function CarbDetail({ detail }) {
  return (
    <div className="flex flex-col gap-1 text-left min-w-max">
      <span className="font-semibold">{formatAmount(detail.carbsG, "g")} total carbs</span>
      <span className="text-xs text-text-secondary">
        Glucose: {formatAmount(detail.glucoseG, "g")} | Fructose: {formatAmount(detail.fructoseG, "g")}
      </span>
    </div>
  );
}

/**
 * Saves the recipe card as an A4 PDF. The two libraries are loaded on demand
 * because they are the largest part of the bundle.
 * @param {HTMLElement|null} node
 */
async function downloadPdf(node) {
  if (!node) return;
  try {
    const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
    const isDark = document.documentElement.classList.contains("dark");
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
    });
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    // Keep the aspect ratio of the card.
    const rect = node.getBoundingClientRect();
    const pdfHeight = rect.width > 0 ? (rect.height * pdfWidth) / rect.width : pdfWidth;
    pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("Fueling-Recipe.pdf");
  } catch (error) {
    console.error("Failed to generate PDF", error);
  }
}

/**
 * The recipe card: what to weigh out, for the whole batch or for one gel.
 *
 * Every line comes from `buildRecipeItems` (`plan.recipe.items`, built with
 * the view in `inputs.format.view` and the gel count in `plan.gels.count`):
 * carb sources, salts and caffeine tablets added to specific gels. The view
 * toggle and the gels-per-hour input edit `inputs.format`. The cost is the
 * plan's rough estimate (`plan.cost`). The card is the target of
 * `useUi().recipeRef`, which the PDF export captures.
 *
 * Warnings: why the recipe has no carbs (the sources cannot make the ratio,
 * or the ratio is 0:0), and the "tablets, never powder" danger when the
 * recipe lists caffeine tablets. A plan with no carbs has no gels, and the
 * card says so.
 */
export default function FinalRecipe() {
  const plan = usePlan();
  const { inputs, set } = usePlanInputs();
  const { recipeRef, openModal } = useUi();
  const baseId = useId();
  const gelsInputId = `${baseId}-gels-per-hour`;
  const gelsHelpId = `${baseId}-gels-help`;
  const headingId = `${baseId}-heading`;

  const view = inputs.format.view;
  const gelsPerHour = inputs.format.gelsPerHour;
  const gelCount = plan.gels.count;
  const items = plan.recipe.items;
  const hasCaffeineItems = items.some((item) => item.kind === "caffeine");
  const recipeWarnings = [
    ...carbRecipeWarnings(plan),
    ...(hasCaffeineItems ? plan.caffeine.warnings.filter((warning) => warning.id === "caffeine.noPowder") : []),
  ];
  const noCarbs = plan.carbs.totalG <= 0;

  let description;
  if (view === "total") {
    description = `Total batch for a ${plan.durationH.toFixed(1)} hour activity.`;
  } else if (gelCount > 0) {
    description = `Amounts to mix for one single gel flask (${fmt(gelsPerHour, 2)} gels/hr).`;
  } else {
    description = "No gels are planned, so these are the amounts for the whole activity.";
  }

  let gelsHelp;
  if (gelCount > 0) gelsHelp = `${fmt(gelCount)} ${gelCount === 1 ? "gel" : "gels"} in total`;
  else if (noCarbs) gelsHelp = "No gels needed: this plan has no carbs";
  else gelsHelp = "No gels planned";

  return (
    <div ref={recipeRef} className="sticky top-24">
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
              {VIEWS.map((option) => {
                const active = view === option.value;
                return (
                  <button
                    key={option.value}
                    id={`${baseId}-view-${option.value}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => set("format.view", option.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${active ? "bg-apple-blue text-white shadow-sm" : "text-text-secondary"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6 p-4 bg-apple-blue/10 rounded-xl border border-apple-blue/30 flex items-center justify-between gap-4">
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
              value={gelsPerHour}
              min={INPUT_LIMITS.gelsPerHour[0]}
              max={INPUT_LIMITS.gelsPerHour[1]}
              step={0.5}
              aria-describedby={gelsHelpId}
              onCommit={(n) => set("format.gelsPerHour", n)}
              className="w-20 px-3 py-1.5 text-sm font-bold text-text-primary text-right bg-card border border-card-border rounded-lg outline-none focus:ring-2 focus:ring-apple-blue"
            />
          </div>

          <p className="text-sm text-text-secondary mb-6 bg-card-border/30 p-3 rounded-xl border border-card-border">
            {description}
          </p>

          {items.length > 0 ? (
            <ul aria-label="Ingredients" className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.key}
                  className="flex justify-between items-center gap-3 py-2 border-b border-card-border border-dashed"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${recipeItemDotClass(item)}`} />
                    <div className="flex items-center min-w-0">
                      <span className="font-medium text-text-primary">{recipeItemLabel(item)}</span>
                      {item.kind === "carb" && item.detail && <TooltipInfo content={<CarbDetail detail={item.detail} />} />}
                    </div>
                  </div>
                  <span className="font-bold text-text-primary whitespace-nowrap">{item.display}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">Nothing to mix for this plan.</p>
          )}

          <Warnings warnings={recipeWarnings} className="mt-6" />
        </section>

        <div className="px-6 py-4 bg-card-border/10 border-t border-card-border flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-text-primary">Est. Cost (DIY)</h4>
            <p className="text-xs text-text-secondary">{money(plan.cost.diy)}</p>
          </div>
          <div className="text-right">
            <h4 className="text-sm font-bold text-apple-green">You Save</h4>
            <p className="text-xs font-semibold text-apple-green/80">{money(plan.cost.savings)} vs Commercial</p>
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
            id={`${baseId}-save-pdf`}
            type="button"
            onClick={() => downloadPdf(recipeRef.current)}
            className="w-full bg-card hover:bg-card-border/50 text-text-primary font-semibold py-3 px-7 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 border border-card-border"
          >
            <Download size={18} aria-hidden="true" />
            Save as PDF
          </button>
        </div>
      </Card>
    </div>
  );
}
