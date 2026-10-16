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

import { useEffect, useId, useRef } from "react";
import { BookTemplate, X, Info, BadgeCheck, CircleAlert } from "lucide-react";
import { TEMPLATES } from "../../constants/templates";
import { sourceDataByIdMap } from "../../constants/constants";
import { templateToInputs } from "../../domain/plan";
import { fmt } from "../shared/format";
import { formatRatio } from "../../domain/carbs";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, TEMPLATE_MODAL } from "../../state/UiProvider";

/** @typedef {import('../../constants/templates').ProductTemplate} ProductTemplate */

/**
 * Labels of the calculator's carb sources a template maps to, glucose list
 * first. Unknown ids are skipped.
 * @param {ProductTemplate} template
 * @returns {string[]}
 */
const carbSourceLabels = (template) =>
  [...template.glucoseSources, ...template.fructoseSources]
    .map((s) => sourceDataByIdMap.get(s.id)?.label)
    .filter(Boolean);

/**
 * One template: name, brand disclaimer, verification status, per-gel
 * nutrition, ratio, ingredients, label notes, source links, the gel rate it
 * gives at the current carb target, and the button that applies it.
 *
 * @param {{ template: ProductTemplate, gPerHour: number, onApply: (template: ProductTemplate) => void }} props
 */
function TemplateCard({ template, gPerHour, onApply }) {
  const headingId = useId();
  const gelsPerHour = templateToInputs(template, { gPerHour }).format.gelsPerHour;
  const carbSources = carbSourceLabels(template);
  const hasOtherIngredients = Boolean(template.otherIngredients) && template.otherIngredients !== "None";

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className="bg-card border border-card-border p-5 rounded-xl text-left hover:border-apple-blue hover:shadow-md transition-all flex flex-col group h-full"
      >
        <div className="flex justify-between items-start mb-1">
          <h4 id={headingId} className="font-bold text-text-primary group-hover:text-apple-blue transition-colors">
            {template.name}
          </h4>
          <span className="text-xs font-medium text-apple-blue bg-apple-blue/10 px-2 py-1 rounded-full whitespace-nowrap ml-2">
            Ratio {formatRatio(template.ratio)}
          </span>
        </div>
        <p className="text-xs text-text-secondary mb-2">Inspired by {template.brand}; not affiliated</p>
        <div className="mb-3">
          {template.verified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-apple-green-ink bg-apple-green/10 px-2 py-0.5 rounded-full">
              <BadgeCheck size={12} aria-hidden="true" /> Label verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-apple-amber-ink bg-apple-amber/10 px-2 py-0.5 rounded-full">
              <CircleAlert size={12} aria-hidden="true" /> Label not verified. Some values are estimates.
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary mb-4">{template.description}</p>

        <p className="text-xs font-semibold text-text-secondary mb-1">Per gel</p>
        <dl className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-card-border/30 rounded-lg p-2">
            <dt className="text-[11px] text-text-secondary">Carbs</dt>
            <dd className="text-sm font-bold text-text-primary">{fmt(template.carbsPerGelG, 1)} g</dd>
          </div>
          <div className="bg-card-border/30 rounded-lg p-2">
            <dt className="text-[11px] text-text-secondary">Sodium</dt>
            <dd className="text-sm font-bold text-text-primary">{fmt(template.sodiumPerGelMg)} mg</dd>
          </div>
          <div className="bg-card-border/30 rounded-lg p-2">
            <dt className="text-[11px] text-text-secondary">Caffeine</dt>
            <dd className="text-sm font-bold text-text-primary">{fmt(template.caffeinePerGelMg)} mg</dd>
          </div>
        </dl>

        <div className="text-xs text-text-secondary space-y-2 mt-auto">
          <p>
            <strong>Carb sources:</strong> {carbSources.join(", ") || "None"}
          </p>
          {hasOtherIngredients && (
            <p>
              <strong>Other ingredients:</strong> {template.otherIngredients}
            </p>
          )}
          {template.notes && (
            <details>
              <summary className="cursor-pointer font-medium text-apple-blue">Label notes</summary>
              <div className="mt-2 p-3 bg-card-border/30 rounded-lg flex gap-2 items-start border border-card-border">
                <Info size={14} aria-hidden="true" className="text-text-secondary mt-0.5 flex-shrink-0" />
                <p className="text-text-secondary text-[11px] leading-relaxed">{template.notes}</p>
              </div>
            </details>
          )}
          <div>
            <strong>Sources:</strong>
            <ul aria-label="Sources" className="mt-1 space-y-0.5">
              {template.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-apple-blue hover:underline"
                  >
                    {source.label}
                  </a>{" "}
                  <span>(checked {source.checked})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between gap-3">
          <p className="text-xs text-text-secondary">
            At {fmt(gPerHour, 1)} g/h: {fmt(gelsPerHour, 1)} {gelsPerHour === 1 ? "gel" : "gels"} per hour
          </p>
          <button
            type="button"
            onClick={() => onApply(template)}
            className="text-sm font-semibold text-white bg-apple-blue hover:bg-apple-blue/90 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Use template<span className="sr-only">: {template.name}</span>
          </button>
        </div>
      </article>
    </li>
  );
}

/**
 * Modal that lists the commercial gel templates (`src/constants/templates.js`).
 *
 * Open when `useUi().modal` is {@link TEMPLATE_MODAL}. Applying a template
 * passes `templateToInputs(template, { gPerHour: plan.carbs.gPerHour })` to
 * `usePlanInputs().apply`: it loads the template's ratio, carb sources and
 * sodium salt, and sets gels per hour so the current carb target stays the
 * same. The sodium target is left alone. Then the modal closes and a toast
 * confirms it. Escape or the close button closes the modal without changes.
 */
const TemplateModal = () => {
  const { isModalOpen, closeModal, showToast } = useUi();
  const { apply } = usePlanInputs();
  const plan = usePlan();
  const titleId = useId();
  const closeRef = useRef(/** @type {HTMLButtonElement|null} */ (null));
  const isOpen = isModalOpen(TEMPLATE_MODAL);
  const gPerHour = plan.carbs.gPerHour;

  useEffect(() => {
    if (!isOpen) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  const applyTemplate = (template) => {
    apply(templateToInputs(template, { gPerHour }));
    closeModal();
    showToast(`${template.name} template applied`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-modal border border-card-border backdrop-blur-3xl shadow-2xl rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-start gap-4 px-6 py-4 border-b border-card-border flex-shrink-0">
          <div>
            <h3 id={titleId} className="font-bold text-lg text-text-primary flex items-center gap-2">
              <BookTemplate size={20} aria-hidden="true" className="text-apple-blue" /> Pre-Mix Templates
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              A template copies a commercial gel&apos;s sugar ratio, carb sources and sodium salt. Your carb and sodium
              targets stay the same.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="p-2 text-text-secondary bg-card-border/30 rounded-full hover:bg-card-border/50 transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ul aria-label="Templates" className="p-6 bg-card-border/30 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map((template) => (
            <TemplateCard key={template.id} template={template} gPerHour={gPerHour} onApply={applyTemplate} />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default TemplateModal;
