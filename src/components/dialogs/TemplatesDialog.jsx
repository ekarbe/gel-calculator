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
import { BadgeCheck, CircleAlert, Info } from "lucide-react";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import Dialog from "../ui/Dialog";
import Disclosure from "../ui/Disclosure";
import Icon from "../ui/Icon";
import { cx, toneClasses } from "../ui/cx";
import { TEMPLATES } from "../../constants/templates";
import { templateToInputs } from "../../domain/plan";
import { hasMessage } from "../../i18n";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi, TEMPLATE_MODAL } from "../../state/UiProvider";
import { formatMonth } from "./dialogText";
import { pluralOf } from "../../i18n/plural";
import { sourceName } from "../recipe/recipeText";

/** @typedef {import('../../constants/templates').ProductTemplate} ProductTemplate */
/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */

/**
 * The catalog key of a piece of template prose (`ui-dialogs.templates.data.<id>.<field>`).
 * @param {ProductTemplate} template
 * @param {string} field  `description`, `otherIngredients`, `notes` or `source.<index>`.
 * @returns {string}
 */
export const templateTextKey = (template, field) => `ui-dialogs.templates.data.${template.id}.${field}`;

/**
 * A piece of template prose in the UI language: its catalog text, else (a
 * template added without catalog keys) the English text of the constants.
 * @param {TranslateFn} t
 * @param {ProductTemplate} template
 * @param {string} field
 * @param {string} fallback
 * @returns {string}
 */
export function templateText(t, template, field, fallback) {
  const key = templateTextKey(template, field);
  return hasMessage(key) ? t(key) : fallback;
}

/**
 * Names of the calculator's carb sources a template maps to, glucose list
 * first, in the UI language (the source names, as everywhere in the
 * recipe). Unknown ids are skipped.
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {ProductTemplate} template
 * @returns {string[]}
 */
const carbSourceLabels = (t, template) =>
  [...template.glucoseSources, ...template.fructoseSources].map((s) => sourceName(t, s.id)).filter(Boolean);

/**
 * One per-gel value: caption over the number, with the substance colour as
 * an edge mark (`<dt>`/`<dd>`). The tiles flow and wrap as wholes (a long
 * caption such as German "Kohlenhydrate" moves its tile to the next row
 * instead of spilling into its neighbour); a caption wider than the whole
 * row breaks.
 * @param {{ term: string, tone: string, children: import('react').ReactNode }} props
 */
function PerGel({ term, tone, children }) {
  return (
    <div className={cx("min-w-0 flex-auto rounded-control border-l-4 bg-surface-2 py-1.5 pl-2 pr-1", toneClasses(tone).border)}>
      <dt className="caption break-words text-ink-2">{term}</dt>
      <dd className="font-display text-title font-bold text-ink">{children}</dd>
    </div>
  );
}

/**
 * One template: name, ratio, brand disclaimer, verification status, per-gel
 * nutrition, carb sources, other ingredients, label notes, source links,
 * the gel rate it gives at the current carb target, and the button that
 * applies it.
 *
 * @param {{ template: ProductTemplate, gPerHour: number, onApply: (template: ProductTemplate) => void }} props
 */
function TemplateCard({ template, gPerHour, onApply }) {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const gelsPerHour = templateToInputs(template, { gPerHour }).format.gelsPerHour;
  const carbSources = carbSourceLabels(t, template);
  const hasOtherIngredients = Boolean(template.otherIngredients) && template.otherIngredients !== "None";

  return (
    <li className="min-w-0">
      <article
        aria-labelledby={headingId}
        data-template-id={template.id}
        className="flex h-full flex-col gap-3 rounded-panel border border-line bg-surface p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 id={headingId} className="display-title min-w-0 text-ink">
            {template.name}
          </h3>
          <Chip data-testid="template-ratio" className="shrink-0">
            {t("ui-dialogs.templates.ratio", { ratio: template.ratio })}
          </Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-sm text-ink-2">{t("ui-dialogs.templates.inspired", { brand: template.brand })}</p>
          {template.verified ? (
            <Chip tone="ok" icon={BadgeCheck} data-testid="template-verified">
              {t("ui-dialogs.templates.verified")}
            </Chip>
          ) : (
            <Chip tone="warn" icon={CircleAlert} data-testid="template-verified">
              {t("ui-dialogs.templates.notVerified")}
            </Chip>
          )}
        </div>
        {template.verified ? null : (
          <p data-testid="template-estimates" className="-mt-1 text-body-sm text-ink-2">
            {t("ui-dialogs.templates.estimates")}
          </p>
        )}
        <p className="text-body-sm text-ink">{templateText(t, template, "description", template.description)}</p>

        <div>
          <p className="caption mb-1 text-ink-2">{t("ui-dialogs.templates.perGel")}</p>
          <dl data-testid="template-per-gel" className="flex flex-wrap gap-2">
            <PerGel term={t("ui-dialogs.templates.carbs")} tone="glucose">
              {t("ui-recipe.amount.g", { value: f.number(template.carbsPerGelG, 1) })}
            </PerGel>
            <PerGel term={t("ui-dialogs.templates.sodium")} tone="sodium">
              {t("ui-recipe.amount.mg", { value: f.number(template.sodiumPerGelMg) })}
            </PerGel>
            <PerGel term={t("ui-dialogs.templates.caffeine")} tone="caffeine">
              {t("ui-recipe.amount.mg", { value: f.number(template.caffeinePerGelMg) })}
            </PerGel>
          </dl>
        </div>

        <div className="space-y-2 text-body-sm text-ink-2">
          <p data-testid="template-carb-sources">
            <span className="font-semibold text-ink">{t("ui-dialogs.templates.carbSources")}:</span>{" "}
            {carbSources.join(", ") || t("ui-dialogs.templates.none")}
          </p>
          {hasOtherIngredients ? (
            <p data-testid="template-other-ingredients">
              <span className="font-semibold text-ink">{t("ui-dialogs.templates.otherIngredients")}:</span>{" "}
              {templateText(t, template, "otherIngredients", template.otherIngredients)}
            </p>
          ) : null}
          {template.notes ? (
            <Disclosure summary={t("ui-dialogs.templates.notes")} icon={Info} buttonClassName="text-body-sm text-ink-2 hover:text-ink">
              <p className="mt-1 rounded-control border border-line bg-surface-2 p-3 text-body-sm text-ink-2">
                {templateText(t, template, "notes", template.notes)}
              </p>
            </Disclosure>
          ) : null}
          <div>
            <p className="font-semibold text-ink">{t("ui-dialogs.templates.sources")}</p>
            <ul role="list" aria-label={t("ui-dialogs.templates.sources")} className="mt-1">
              {template.sources.map((source, index) => (
                <li key={source.url} className="flex flex-wrap items-baseline gap-x-1">
                  {/* The link itself is the 24 px (44 px on touch) target, not only its line of text. */}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="template-source"
                    className="group inline-flex min-h-6 items-center font-medium text-ink pointer-coarse:min-h-11"
                  >
                    {/* One inline run inside the flex box, so the space before the hidden text stays in the name. */}
                    <span className="underline decoration-1 underline-offset-2 group-hover:decoration-2">
                      {templateText(t, template, `source.${index}`, source.label)}{" "}
                      <span className="sr-only">{t("ui-common.opensInNewTab")}</span>
                    </span>
                  </a>
                  <span className="text-muted">{t("ui-dialogs.templates.checked", { date: formatMonth(f, source.checked) })}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p data-testid="template-rate" className="text-body-sm text-ink-2">
            {t(`ui-dialogs.templates.rate.${pluralOf(gelsPerHour)}`, {
              gPerHour: f.number(gPerHour, 1),
              count: f.number(gelsPerHour, 1),
            })}
          </p>
          <Button aria-label={t("ui-dialogs.templates.useNamed", { name: template.name })} onClick={() => onApply(template)}>
            {t("ui-dialogs.templates.use")}
          </Button>
        </div>
      </article>
    </li>
  );
}

/**
 * The template list, rendered only while the dialog is open.
 * @param {{ onApply: (template: ProductTemplate) => void }} props
 */
function TemplateList({ onApply }) {
  const t = useT();
  const plan = usePlan();
  return (
    <ul role="list" aria-label={t("ui-dialogs.templates.list")} className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {TEMPLATES.map((template) => (
        <TemplateCard key={template.id} template={template} gPerHour={plan.carbs.gPerHour} onApply={onApply} />
      ))}
    </ul>
  );
}

/**
 * The gel templates (`src/constants/templates.js`) on the `Dialog`
 * primitive: one card per commercial gel with its ratio, the brand ("inspired
 * by, not affiliated"), whether the label values are verified (badge with
 * icon and text), the per-gel carbs, sodium and caffeine, the carb sources,
 * other ingredients, label notes (a disclosure), the sources with the month
 * they were checked, and the gel rate it gives at the plan's carb target.
 *
 * Open with `useUi().openModal(TEMPLATE_MODAL)` (the My recipes dialog has
 * a button for it). "Use template" passes
 * `templateToInputs(template, { gPerHour: plan.carbs.gPerHour })` to
 * `usePlanInputs().apply`: it loads the template's ratio, carb sources and
 * sodium salt and sets gels per hour so the carb target stays the same. The
 * sodium target is left alone. Then the dialog closes and a toast confirms
 * it. Escape, the close button and a click on the backdrop close it without
 * changes. The template prose comes from the `ui-dialogs.templates.data.*`
 * catalog keys, so it can be translated.
 */
export default function TemplatesDialog() {
  const t = useT();
  const { isModalOpen, closeModal, showToast } = useUi();
  const { apply } = usePlanInputs();
  const plan = usePlan();

  const applyTemplate = (template) => {
    apply(templateToInputs(template, { gPerHour: plan.carbs.gPerHour }));
    closeModal();
    showToast(t("ui-dialogs.templates.applied", { name: template.name }), { tone: "ok" });
  };

  return (
    <Dialog
      open={isModalOpen(TEMPLATE_MODAL)}
      onClose={closeModal}
      title={t("ui-dialogs.templates.title")}
      description={t("ui-dialogs.templates.description")}
      size="lg"
      bodyClassName="bg-surface-2"
      data-testid="templates-dialog"
    >
      <TemplateList onApply={applyTemplate} />
    </Dialog>
  );
}
