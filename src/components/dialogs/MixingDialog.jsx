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
import { Droplets, Info } from "lucide-react";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Icon from "../ui/Icon";
import Lane from "../ui/Lane";
import Stat from "../ui/Stat";
import WarningList from "../ui/WarningList";
import { CitationLinks } from "../ui/Why";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, MIXING_MODAL } from "../../state/UiProvider";
import { sectionTitle, servingsText } from "./dialogText";
import { fluidInstruction } from "./fluidInstruction";
import { mixingSteps, recipeWarnings } from "../recipe/recipeText";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../recipe/recipeText').MixStep} MixStep */

/**
 * One numbered step: a heading with its number (a badge, and "Step N:" for
 * screen readers), the instruction, the recipe lines it lists (as lanes in
 * the substance colours) and, for the caffeine step, the "tablets, never
 * powder" danger.
 * @param {{ number: number, step: MixStep, plan: Plan }} props
 */
function Step({ number, step, plan }) {
  const t = useT();
  const noPowder =
    step.key === "caffeine" ? plan.caffeine.warnings.filter((warning) => warning.id === "caffeine.noPowder") : [];
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 font-display text-title font-bold text-ink"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pt-1">
        <h4 className="text-body font-semibold text-ink">
          <span className="sr-only">{t("ui-dialogs.mixing.step", { number })} </span>
          {step.title}
        </h4>
        <p className="text-body-sm text-ink-2">{step.text}</p>
        {step.lines.length > 0 ? (
          <ul role="list" aria-label={step.listLabel ?? step.title} className="divide-y divide-line rounded-control border border-line bg-surface-2 px-3">
            {step.lines.map((line) => (
              <Lane
                key={line.key}
                as="li"
                label={<span data-testid="line-name">{line.name}</span>}
                amount={line.amount}
                amountProps={{ "data-testid": "line-amount" }}
                tone={line.tone}
                data-tone={line.tone}
              />
            ))}
          </ul>
        ) : null}
        <WarningList warnings={noPowder} compact />
      </div>
    </li>
  );
}

/**
 * The steps of one recipe section under its heading and servings, then its
 * warnings.
 * @param {{ section: RecipeSection, steps: MixStep[], bottleMl: number, plan: Plan }} props
 */
function MixBlock({ section, steps, bottleMl, plan }) {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const title = sectionTitle(t, section);
  return (
    <section aria-labelledby={headingId} data-testid={`mix-section-${section.kind}`} className="space-y-3">
      <div className="border-b border-line pb-1">
        <h3 id={headingId} className="display-title text-ink">
          {title}
        </h3>
        <p data-testid="mix-servings" className="caption text-ink-2">
          {servingsText(t, f, section, bottleMl)}
        </p>
      </div>
      {steps.length > 0 ? (
        <ol role="list" aria-label={t("ui-dialogs.mixing.steps", { title })} className="space-y-4">
          {steps.map((step, index) => (
            <Step key={step.key} number={index + 1} step={step} plan={plan} />
          ))}
        </ol>
      ) : null}
      <WarningList warnings={section.warnings} showCitations={false} compact />
    </section>
  );
}

/**
 * The dialog's content, rendered only while it is open.
 */
function MixingContent() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const { inputs } = usePlanInputs();
  const bottleMl = inputs.format.bottleMl;
  const carbTarget = plan.carbs.totalG;
  const delivered = plan.carbs.deliveredG;
  const carbShort = carbTarget > 0 && Math.round(delivered) < Math.round(carbTarget);
  const duringId = useId();
  const rinse = plan.carbs.mouthRinseHowTo;
  const warnings = recipeWarnings(plan).filter((warning) => warning.id !== "caffeine.noPowder");
  const blocks = plan.recipe.sections
    .map((section) => ({ section, steps: mixingSteps(t, f, section, bottleMl) }))
    .filter(({ section, steps }) => steps.length > 0 || section.warnings.length > 0);
  let sub = null;
  if (carbShort) sub = t("ui-dialogs.mixing.ofTarget", { target: f.number(carbTarget) });
  else if (!(carbTarget > 0)) sub = t("ui-dialogs.mixing.noCarbs");

  return (
    // Focusable: the steps are static text in the dialog's scrolling body, so without a tab stop in it a
    // keyboard could not scroll to them in browsers that do not focus scroll areas (axe scrollable-region-focusable).
    <div
      role="group"
      aria-label={t("ui-dialogs.mixing.content")}
      tabIndex={0}
      data-testid="mixing-content"
      className="space-y-6 rounded-control"
    >
      <div className="space-y-3">
        <Stat
          tone="glucose"
          label={t("ui-dialogs.mixing.totalCarbs")}
          value={f.number(delivered)}
          unit={t("ui-dialogs.unit.g")}
          sub={sub}
          valueProps={{ "data-testid": "mix-total-carbs" }}
        />
        <WarningList warnings={warnings} showCitations={false} compact />
      </div>

      {rinse ? (
        <div data-testid="mouth-rinse-note" className="flex items-start gap-2 rounded-control border border-line bg-surface-2 p-3 text-body-sm">
          <Icon icon={Info} size={18} className="mt-0.5 text-ink-2" />
          <div className="min-w-0 space-y-1">
            <p className="text-ink">
              <span className="font-semibold">{t("ui-dialogs.mixing.rinse")}</span> {t(rinse.summary)}
            </p>
            <CitationLinks ids={rinse.citations} className="text-caption" />
          </div>
        </div>
      ) : null}

      {blocks.length === 0 ? <p className="text-body-sm text-ink-2">{t("ui-dialogs.nothingToMix")}</p> : null}

      {blocks.map(({ section, steps }) => (
        <MixBlock key={section.kind} section={section} steps={steps} bottleMl={bottleMl} plan={plan} />
      ))}

      <section aria-labelledby={duringId} className="space-y-2">
        <h3 id={duringId} className="display-title flex items-center gap-2 border-b border-line pb-1 text-ink">
          <Icon icon={Droplets} size={20} className="text-fluid" />
          {t("ui-dialogs.mixing.during.title")}
        </h3>
        <p data-testid="mix-during" className="text-body-sm text-ink-2">
          {fluidInstruction(t, plan)}
        </p>
      </section>
    </div>
  );
}

/**
 * Mixing steps for the current recipe, one block of steps per recipe
 * section (`plan.recipe.sections`), on the `Dialog` primitive:
 *
 * - Gels: weigh the whole batch, dissolve the powders in the warm added
 *   water (`section.water`), divide into N flasks of about X ml, then add
 *   any caffeine tablets to their gels (crushed, never pure powder).
 * - Drink: per bottle add the powders, fill to the mark, shake. Without
 *   bottles (no fluid) the section's warning says why. A gel or both plan
 *   without gels mixes everything into the drink (`plan.format.type`).
 *
 * Each block ends with the section's warnings. The summary tile shows the
 * carbs the recipe delivers (and the target when it falls short) with the
 * recipe warnings; a mouth rinse note (`plan.carbs.mouthRinseHowTo`) appears
 * for 45–75 min events, and the last part gives the fluid from the plan and
 * the schedule. Steps and lines follow the UI language and unit system. The
 * content is one focusable group, so the keyboard can scroll the steps.
 *
 * Open with `useUi().openModal(MIXING_MODAL)`; Escape, the close button, a
 * click on the backdrop and "Got it" close it, and focus returns to the
 * opener.
 */
export default function MixingDialog() {
  const t = useT();
  const { isModalOpen, closeModal } = useUi();
  return (
    <Dialog
      open={isModalOpen(MIXING_MODAL)}
      onClose={closeModal}
      title={t("ui-dialogs.mixing.title")}
      size="md"
      data-testid="mixing-dialog"
      footer={
        <Button variant="primary" fullWidth onClick={closeModal}>
          {t("ui-dialogs.mixing.done")}
        </Button>
      }
    >
      <MixingContent />
    </Dialog>
  );
}
