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

import { useEffect, useId } from "react";
import { FlaskConical, Info, X } from "lucide-react";
import Warnings from "../shared/Warnings";
import { CitationLinks } from "../shared/Why";
import { fmt } from "../shared/format";
import { carbRecipeWarnings, recipeItemLabel } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, MIXING_MODAL } from "../../state/UiProvider";
import { t } from "../../i18n";

/**
 * One numbered step of the instructions.
 * @param {{ number: number, title: string, children: import('react').ReactNode }} props
 */
function Step({ number, title, children }) {
  return (
    <li>
      <h4 className="font-bold text-text-primary mb-2">
        {number}. {title}
      </h4>
      {children}
    </li>
  );
}

/**
 * What to drink during the activity, from the plan: the hourly fluid target
 * and the fluid the schedule lists with the first gel (`plan.schedule`), so
 * the steps never disagree with the timeline.
 *
 * @param {import('../../domain/plan').Plan} plan
 * @returns {string}
 */
function fluidInstruction(plan) {
  const mlPerHour = plan.fluid.mlPerHour;
  const hasGels = plan.gels.count > 0;
  const firstGelFluid = plan.schedule.find(
    (event) => (event.type === "start" || event.type === "fuel") && event.fluidMl > 0,
  )?.fluidMl;
  const thirst = plan.fluid.recommended.drinkToThirst ? " Drinking to thirst also works for this event." : "";
  if (!(mlPerHour > 0)) {
    return hasGels
      ? "Take each gel at the time the schedule lists. This plan has no fluid target."
      : "This plan has no fluid target.";
  }
  if (firstGelFluid) {
    return `Drink about ${fmt(mlPerHour)} ml/h: about ${fmt(firstGelFluid)} ml with each gel. The schedule lists the amount for every gel.${thirst}`;
  }
  return `Drink about ${fmt(mlPerHour)} ml/h.${hasGels ? " Take each gel at the time the schedule lists." : ""}${thirst}`;
}

/**
 * Mixing instructions for the current recipe.
 *
 * Ingredients come from the same recipe items as the recipe card
 * (`plan.recipe.items`, in the view the card shows). With gels the steps make
 * a gel base; without gels (no carbs, or 0 gels per hour) the ingredients go
 * into the drink. Caffeine tablets get their own step (crush, dissolve, never
 * pure powder). The carb total is what the recipe delivers, with the plan's
 * warning when the sources cannot make the ratio. A mouth rinse note
 * (`plan.carbs.mouthRinseHowTo`) appears for 45–75 min events, and the last
 * step gives the fluid from the plan and the schedule. Open with
 * `useUi().openModal(MIXING_MODAL)`; Escape, the close button and "Got It"
 * close it.
 */
export default function MixingModal() {
  const plan = usePlan();
  const { inputs } = usePlanInputs();
  const { isModalOpen, closeModal } = useUi();
  const isOpen = isModalOpen(MIXING_MODAL);
  const baseId = useId();
  const titleId = `${baseId}-title`;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  const view = inputs.format.view;
  const gelCount = plan.gels.count;
  const hasGels = gelCount > 0;
  const items = plan.recipe.items;
  const ingredients = items.filter((item) => item.kind !== "caffeine");
  const caffeineItems = items.filter((item) => item.kind === "caffeine");
  const caffeineWarnings = plan.caffeine.warnings.filter((warning) => warning.id === "caffeine.noPowder");
  const carbWarnings = carbRecipeWarnings(plan);
  const carbTarget = plan.carbs.totalG;
  const carbShort = carbTarget > 0 && !plan.carbs.sources.canAchieveRatio;
  const rinse = plan.carbs.mouthRinseHowTo;

  let amountsFor;
  if (hasGels && view === "perGel") amountsFor = `Amounts for one gel (${fmt(gelCount)} gels in total).`;
  else if (hasGels) amountsFor = `Amounts for the whole batch (${fmt(gelCount)} ${gelCount === 1 ? "gel" : "gels"}).`;
  else if (carbTarget <= 0) amountsFor = "This plan has no carbs, so there are no gels. Amounts are for the whole activity.";
  else amountsFor = "No gels are planned, so the amounts are for the whole activity.";

  /** @type {Array<{ title: string, body: import('react').ReactNode }|false>} */
  const steps = [
    {
      title: "Gather Ingredients",
      body:
        ingredients.length > 0 ? (
          <ul aria-label="Ingredients" className="list-disc pl-5 space-y-1 text-text-secondary font-medium">
            {ingredients.map((item) => (
              <li key={item.key}>
                {item.display} {recipeItemLabel(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-secondary">Nothing to mix for this plan.</p>
        ),
    },
    hasGels && {
      title: "Initial Mixing (Gel Base)",
      body: <p className="text-text-secondary">Add warm water to powders. Shake until smooth gel-like paste forms.</p>,
    },
    hasGels && {
      title: "Final Consistency",
      body: (
        <p className="text-text-secondary">
          Add cold water gradually while shaking until desired consistency is reached.
        </p>
      ),
    },
    !hasGels &&
      ingredients.length > 0 && {
        title: "Mix Into Your Drink",
        body: (
          <p className="text-text-secondary">
            Dissolve the ingredients in the fluid you drink during the activity
            {plan.fluid.totalMl > 0 ? ` (about ${fmt(plan.fluid.totalMl)} ml in total)` : ""}. Shake until nothing is
            left at the bottom.
          </p>
        ),
      },
    caffeineItems.length > 0 && {
      title: "Add Caffeine Tablets",
      body: (
        <div className="space-y-3">
          <p className="text-text-secondary">
            {view === "total" && hasGels ? `Split the batch into ${fmt(gelCount)} equal gels. ` : ""}
            Crush each tablet into a fine powder and stir it into the gel listed below until it dissolves. Mark these
            gels so you take them at the right time.
          </p>
          <ul aria-label="Caffeine tablets" className="list-disc pl-5 space-y-1 text-text-secondary font-medium">
            {caffeineItems.map((item) => (
              <li key={item.key}>
                {recipeItemLabel(item)} ({item.display})
              </li>
            ))}
          </ul>
          <Warnings warnings={caffeineWarnings} />
        </div>
      ),
    },
    {
      title: "During the Activity",
      body: <p className="text-text-secondary">{fluidInstruction(plan)}</p>,
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 transition-all">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-modal w-full sm:max-w-xl sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-card-border backdrop-blur-3xl"
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-card-border bg-card-border/30">
          <h3 id={titleId} className="font-bold text-lg text-text-primary flex items-center gap-2">
            <FlaskConical size={20} className="text-apple-blue" aria-hidden="true" /> DIY Mix Instructions
          </h3>
          <button
            id={`${baseId}-close`}
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="p-2 text-text-secondary hover:text-text-primary bg-card rounded-full border border-card-border"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="text-sm text-text-primary leading-relaxed space-y-6">
            <div className="bg-card-border/30 p-4 rounded-xl border border-card-border space-y-1">
              <div className="font-semibold text-text-primary">
                Total Carbs: <span className="font-bold text-apple-blue">{fmt(plan.carbs.deliveredG)} g</span>
                {carbShort && <span className="font-normal text-text-secondary"> of {fmt(carbTarget)} g target</span>}
              </div>
              <p className="text-text-secondary">{amountsFor}</p>
              <Warnings warnings={carbWarnings} showCitations={false} className="pt-2" />
            </div>

            {rinse && (
              <div
                data-testid="mouth-rinse-note"
                className="flex items-start gap-2 rounded-xl border border-apple-blue/30 bg-apple-blue/10 p-3"
              >
                <Info size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-apple-blue" />
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold">Mouth rinse option.</span> {t(rinse.summary)}
                  </p>
                  <CitationLinks ids={rinse.citations} className="text-xs" />
                </div>
              </div>
            )}

            <ol className="space-y-6">
              {steps.filter(Boolean).map((step, index) => (
                <Step key={step.title} number={index + 1} title={step.title}>
                  {step.body}
                </Step>
              ))}
            </ol>
          </div>
        </div>
        <div className="p-4 border-t border-card-border bg-card">
          <button
            id={`${baseId}-done`}
            type="button"
            onClick={closeModal}
            className="w-full bg-apple-blue text-white font-semibold py-3 rounded-full hover:bg-apple-blue/90 transition-colors shadow-sm"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
