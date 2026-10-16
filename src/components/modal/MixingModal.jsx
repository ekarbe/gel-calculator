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
import { mixingSteps } from "../shared/mixing";
import { SECTION_TITLES, recipeWarnings, servingsText } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, MIXING_MODAL } from "../../state/UiProvider";
import { t } from "../../i18n";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../shared/mixing').MixStep} MixStep */

/**
 * One numbered step of the instructions: its text, the recipe lines it
 * lists, and for the caffeine step the "tablets, never powder" warning.
 * @param {{ number: number, step: MixStep, plan: Plan }} props
 */
function Step({ number, step, plan }) {
  const noPowder =
    step.key === "caffeine" ? plan.caffeine.warnings.filter((warning) => warning.id === "caffeine.noPowder") : [];
  return (
    <li>
      <h5 className="font-bold text-text-primary mb-2">
        {number}. {step.title}
      </h5>
      <div className="space-y-2">
        <p className="text-text-secondary">{step.text}</p>
        {step.lines.length > 0 && (
          <ul aria-label={step.listLabel ?? step.title} className="list-disc pl-5 space-y-1 text-text-secondary font-medium">
            {step.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <Warnings warnings={noPowder} />
      </div>
    </li>
  );
}

/**
 * What to drink during the activity, from the plan: the hourly fluid target
 * and the fluid the schedule lists with the first gel or the first drink sip
 * (`plan.schedule`), so the steps never disagree with the timeline.
 *
 * @param {Plan} plan
 * @returns {string}
 */
export function fluidInstruction(plan) {
  const mlPerHour = plan.fluid.mlPerHour;
  const hasGels = plan.gels.count > 0;
  const fromBottles = plan.format.type !== "gel" && plan.concentration.drink?.bottles > 0;
  const source = fromBottles ? " from your bottles" : "";
  const firstGelFluid = plan.schedule.find(
    (event) => (event.type === "start" || event.type === "fuel") && event.fluidMl > 0,
  )?.fluidMl;
  const firstSip = plan.schedule.find((event) => event.type === "drink" && event.fluidMl > 0)?.fluidMl;
  const thirst = plan.fluid.recommended.drinkToThirst ? " Drinking to thirst also works for this event." : "";
  if (!(mlPerHour > 0)) {
    return hasGels
      ? "Take each gel at the time the schedule lists. This plan has no fluid target."
      : "This plan has no fluid target.";
  }
  if (firstGelFluid) {
    return `Drink about ${fmt(mlPerHour)} ml/h${source}: about ${fmt(firstGelFluid)} ml with each gel. The schedule lists the amount for every gel.${thirst}`;
  }
  if (firstSip) {
    return `Drink about ${fmt(mlPerHour)} ml/h${source}: about ${fmt(firstSip)} ml every 20 min. The schedule lists every sip.${thirst}`;
  }
  return `Drink about ${fmt(mlPerHour)} ml/h${source}.${hasGels ? " Take each gel at the time the schedule lists." : ""}${thirst}`;
}

/**
 * Mixing instructions for the current recipe, one block of steps per recipe
 * section (`plan.recipe.sections`), from the shared step builder
 * (`mixingSteps` in `src/components/shared/mixing.js`, also used by the
 * print view):
 *
 * - Gels: weigh the whole batch, dissolve the powders in the warm added water
 *   (`section.water`), divide into N flasks of about X ml, then add any
 *   caffeine tablets to their gels (crushed, never pure powder).
 * - Drink: per bottle add the powders, fill to the mark, shake. Without
 *   bottles (no fluid) the section's warning says why. A gel or both plan
 *   without gels mixes everything into the drink (`plan.format.type`).
 *
 * Each block ends with the section's warnings. The summary shows the carbs
 * the recipe delivers and the recipe warnings ({@link recipeWarnings}); a
 * mouth rinse note (`plan.carbs.mouthRinseHowTo`) appears for 45–75 min
 * events, and the last step gives the fluid from the plan and the schedule.
 * Open with `useUi().openModal(MIXING_MODAL)`; Escape, the close button and
 * "Got It" close it.
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

  const bottleMl = inputs.format.bottleMl;
  const carbTarget = plan.carbs.totalG;
  const delivered = plan.carbs.deliveredG;
  const carbShort = carbTarget > 0 && Math.round(delivered) < Math.round(carbTarget);
  const rinse = plan.carbs.mouthRinseHowTo;
  const warnings = recipeWarnings(plan).filter((warning) => warning.id !== "caffeine.noPowder");
  const blocks = plan.recipe.sections
    .map((section) => ({ section, steps: mixingSteps(section, bottleMl) }))
    .filter(({ section, steps }) => steps.length > 0 || section.warnings.length > 0);

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
              <div data-testid="mix-total-carbs" className="font-semibold text-text-primary">
                Total Carbs: <span className="font-bold text-apple-blue">{fmt(delivered)} g</span>
                {carbShort && <span className="font-normal text-text-secondary"> of {fmt(carbTarget)} g target</span>}
              </div>
              {carbTarget <= 0 && (
                <p className="text-text-secondary">This plan has no carbs, so there are no gels to make.</p>
              )}
              <Warnings warnings={warnings} showCitations={false} className="pt-2" />
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

            {blocks.length === 0 && <p className="text-text-secondary">Nothing to mix for this plan.</p>}

            {blocks.map(({ section, steps }) => (
              <MixBlock key={section.kind} section={section} steps={steps} bottleMl={bottleMl} plan={plan} />
            ))}

            <div>
              <h4 className="text-base font-bold text-text-primary mb-2">During the Activity</h4>
              <p data-testid="mix-during" className="text-text-secondary">
                {fluidInstruction(plan)}
              </p>
            </div>
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

/**
 * The steps of one recipe section under its heading, then its warnings.
 * @param {{ section: RecipeSection, steps: MixStep[], bottleMl: number, plan: Plan }} props
 */
function MixBlock({ section, steps, bottleMl, plan }) {
  const headingId = useId();
  const title = SECTION_TITLES[section.kind] ?? section.kind;
  return (
    <section aria-labelledby={headingId} data-testid={`mix-section-${section.kind}`} className="space-y-4">
      <h4 id={headingId} className="text-base font-bold text-text-primary border-b border-card-border pb-1">
        {title} <span className="text-xs font-semibold text-text-secondary">· {servingsText(section, bottleMl)}</span>
      </h4>
      {steps.length > 0 && (
        <ol className="space-y-5">
          {steps.map((step, index) => (
            <Step key={step.key} number={index + 1} step={step} plan={plan} />
          ))}
        </ol>
      )}
      <Warnings warnings={section.warnings} showCitations={false} />
    </section>
  );
}
