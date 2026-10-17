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
import { amountsCaption, printMixingSteps, sectionFacts, sectionTitle, servingsText } from "./printText";
import { itemAmount, itemLabel } from "../recipe/recipeText";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */

/** Header cell of a printed table. */
export const PRINT_TH = "caption py-1 pr-3 text-left align-bottom last:pr-0";

/**
 * A heading for one block of the printout, in the display face with a
 * hairline under it. It never ends a page on its own (`break-after: avoid`):
 * the block's first lines always follow it.
 * @param {{ id: string, children: import('react').ReactNode }} props
 */
export function BlockHeading({ id, children }) {
  return (
    <h2 id={id} className="display-title mb-2 mt-6 border-b border-line-strong pb-1 text-ink break-after-avoid">
      {children}
    </h2>
  );
}

/**
 * One recipe section as printed (a named region): its servings in the
 * heading ("Gel batch: 9 gels"), the ingredient table (the whole amount, and
 * per gel or bottle when there are servings), the gel consistency or the
 * drink strength, the per-serving facts and the osmolality.
 * @param {{ section: RecipeSection, plan: Plan }} props
 */
export function SectionTable({ section, plan }) {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const hasServings = section.servings > 0;
  const title = sectionTitle(t, section);
  const facts = sectionFacts(t, f, plan, section);

  return (
    <section aria-labelledby={headingId} data-kind={section.kind} className="mb-4 break-inside-avoid">
      <h3 id={headingId} className="mb-1 font-semibold text-ink">
        {t("ui-print.section.heading", { title, servings: servingsText(t, f, section, plan.inputs.format.bottleMl) })}
      </h3>
      {section.items.length > 0 ? (
        <table className="w-full border-collapse">
          <caption className="sr-only">{t("ui-print.section.caption", { title })}</caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className={PRINT_TH}>
                {t("ui-print.table.ingredient")}
              </th>
              <th scope="col" className={`${PRINT_TH} text-right`}>
                {amountsCaption(t, section)}
              </th>
              {hasServings ? (
                <th scope="col" className={`${PRINT_TH} text-right`}>
                  {t(section.servingLabelKey)}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item) => (
              <tr key={item.key} data-kind={item.kind} className="border-b border-line break-inside-avoid">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {itemLabel(t, item)}
                </th>
                <td className="whitespace-nowrap py-1 pr-3 text-right font-mono last:pr-0">{itemAmount(t, f, item, "total")}</td>
                {hasServings ? (
                  <td className="whitespace-nowrap py-1 text-right font-mono">{itemAmount(t, f, item, "perServing")}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{t("ui-print.section.empty")}</p>
      )}
      {facts.length > 0 ? (
        <ul className="mt-1 text-ink-2">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * The mixing steps of one recipe section (the same steps as the mixing
 * dialog) as a numbered list: each step's title and text, then the recipe
 * lines it lists. A section without steps (a drink without fluid) prints
 * its warnings, which say why there is nothing to mix.
 * @param {{ section: RecipeSection, bottleMl: number, showTitle: boolean }} props
 */
export function MixingBlock({ section, bottleMl, showTitle }) {
  const t = useT();
  const f = useFormat();
  const title = sectionTitle(t, section);
  const steps = printMixingSteps(t, f, section, bottleMl);
  return (
    <div data-kind={section.kind} className="mb-3">
      {showTitle ? <h3 className="mb-1 font-semibold text-ink">{title}</h3> : null}
      {steps.length > 0 ? (
        <ol aria-label={t("ui-print.mix.steps", { title })} className="list-decimal space-y-1 pl-5">
          {steps.map((step) => (
            <li key={step.key} className="break-inside-avoid">
              <span className="font-semibold">{step.title}.</span> {step.text}
              {step.lines.length > 0 ? (
                <ul aria-label={step.listLabel ?? step.title} className="list-disc pl-5">
                  {step.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {section.warnings.length > 0
            ? section.warnings.map((warning) => t(warning.message)).join(" ")
            : t("ui-print.mix.nothing")}
        </p>
      )}
    </div>
  );
}
