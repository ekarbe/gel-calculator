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
import { FlaskConical } from "lucide-react";
import Icon from "../ui/Icon";
import Lane from "../ui/Lane";
import WarningList from "../ui/WarningList";
import { cx, toneClasses } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { finite } from "../../i18n/formatters";
import { amountsCaption, sectionTitle, servingsText } from "./dialogText";
import { eventSummary } from "../board/boardText";
import { deliveredRatio, itemAmount, itemLabel, itemTone, osmolalityText, recipeWarnings } from "../recipe/recipeText";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */

/**
 * One headline number of the image: a caption over a big number, with the
 * substance colour as an edge mark (a `<dt>`/`<dd>` pair).
 * @param {{ label: string, value: string, tone: string }} props
 */
function ImageStat({ label, value, tone }) {
  return (
    <div data-tone={tone} className={cx("flex-auto border-l-4 pl-2", toneClasses(tone).border)}>
      <dt className="caption text-ink-2">{label}</dt>
      <dd className="whitespace-nowrap font-display text-title font-bold text-ink">{value}</dd>
    </div>
  );
}

/**
 * One recipe section on the image: heading and servings, the caption of the
 * view, one lane per line in the view (carbs with a bar of their share of
 * the section's carbs) and the osmolality with its tonicity band.
 * @param {{ section: RecipeSection, view: 'total'|'perServing', bottleMl: number }} props
 */
function ImageSection({ section, view, bottleMl }) {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const title = sectionTitle(t, section);
  const osmo = osmolalityText(t, f, section.osmolality, section.kind);
  const carbsG = section.items.reduce((sum, item) => (item.kind === "carb" ? sum + finite(item.detail?.carbsG) : sum), 0);
  return (
    <section aria-labelledby={headingId} data-testid={`share-section-${section.kind}`} className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
        <h3 id={headingId} className="display-title text-ink">
          {title}
        </h3>
        <span data-testid="share-servings" className="text-right text-body-sm text-ink-2">
          {servingsText(t, f, section, bottleMl)}
        </span>
      </div>
      <p data-testid="share-amounts-caption" className="caption text-muted">
        {amountsCaption(t, section, view)}
      </p>
      <ul role="list" aria-label={t("ui-dialogs.share.image.lines", { title })}>
        {section.items.map((item) => {
          const share = item.kind === "carb" && carbsG > 0 ? finite(item.detail?.carbsG) / carbsG : null;
          return (
            <Lane
              key={item.key}
              as="li"
              data-kind={item.kind}
              data-tone={itemTone(item)}
              tone={itemTone(item)}
              label={<span data-testid="line-name">{itemLabel(t, item)}</span>}
              amount={itemAmount(t, f, item, view)}
              amountProps={{ "data-testid": "line-amount" }}
              share={share}
              shareLabel={share === null ? undefined : t("ui-dialogs.share.image.share", { pct: Math.round(share * 100) })}
            />
          );
        })}
      </ul>
      {osmo ? (
        <p data-testid="share-osmolality" className="font-mono text-caption text-ink-2">
          {t("ui-dialogs.osmo.withTonicity", { value: osmo.text, tonicity: t(`concentration.tonicity.${osmo.tonicity}`) })}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The recipe image of the share dialog, as it is saved: the wordmark, the
 * event, the headline numbers (the carbs the recipe delivers, the carb
 * target per hour, the ratio the recipe delivers, sodium and fluid per hour,
 * and the caffeine when it is on), the recipe warnings, then every recipe
 * section in the board's view (Total / Per serving) and the site address.
 * Flat, in the design tokens (light or dark, as the page), with the
 * substance colours of the board on the numbers and the lanes. The card is
 * focusable (it is the only content of the dialog's scrolling body, so the
 * keyboard can scroll it). `cardRef` is the element `html-to-image` renders.
 *
 * @param {{ plan: Plan, view: 'total'|'perServing', bottleMl: number,
 *   cardRef?: import('react').Ref<HTMLDivElement> }} props
 */
export default function ShareImage({ plan, view, bottleMl, cardRef }) {
  const t = useT();
  const f = useFormat();
  const warnings = recipeWarnings(plan);
  const sections = plan.recipe.sections.filter((section) => section.items.length > 0);
  const viewCaption =
    view === "perServing"
      ? t("ui-dialogs.share.image.viewPerServing")
      : t("ui-dialogs.share.image.viewTotal", { hours: f.number(plan.durationH, 1) });

  return (
    <div className="flex justify-center">
      <div
        ref={cardRef}
        role="group"
        aria-label={t("ui-dialogs.share.image.label")}
        tabIndex={0}
        data-testid="share-image"
        className="w-full max-w-[22rem] shrink-0 overflow-hidden rounded-panel border border-line bg-surface text-ink"
      >
        <div aria-hidden="true" className="flex h-1.5">
          <span className="flex-1 bg-glucose" />
          <span className="flex-1 bg-fructose" />
          <span className="flex-1 bg-sodium" />
          <span className="flex-1 bg-fluid" />
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="display-section flex items-center gap-2 text-ink">
              <Icon icon={FlaskConical} size={24} className="text-ink-2" />
              {t("ui-dialogs.share.image.wordmark")}
            </p>
            <p data-testid="share-event" className="caption mt-1 text-ink-2">
              {eventSummary(t, f, plan.inputs.event)}
            </p>
          </div>

          {/* The stats flow and wrap as wholes, so a long number never overflows a narrow card. Each
              substance keeps its colour, as on the board; the ratio is not an amount, so it is neutral. */}
          <dl data-testid="share-stats" className="flex flex-wrap gap-x-3 gap-y-2 border-b border-line pb-3">
            <ImageStat
              tone="glucose"
              label={t("ui-dialogs.share.image.totalCarbs")}
              value={t("ui-recipe.amount.g", { value: f.number(plan.carbs.deliveredG) })}
            />
            <ImageStat
              tone="glucose"
              label={t("ui-dialogs.share.image.carbsPerHour")}
              value={t("ui-dialogs.share.image.gramsPerHour", { value: f.number(plan.carbs.gPerHour) })}
            />
            <ImageStat tone="neutral" label={t("ui-dialogs.share.image.ratio")} value={f.ratio(deliveredRatio(plan))} />
            <ImageStat
              tone="sodium"
              label={t("ui-dialogs.share.image.sodium")}
              value={t("ui-dialogs.share.image.mgPerHour", { value: f.number(finite(plan.sodium.mgPerHour)) })}
            />
            <ImageStat
              tone="fluid"
              label={t("ui-dialogs.share.image.fluid")}
              // Whole ml, as the board and the print view show it (a manual rate typed in fl oz keeps decimals).
              value={t("ui-dialogs.share.image.mlPerHour", { mlPerHour: Math.round(finite(plan.fluid.mlPerHour)) })}
            />
            {plan.caffeine.enabled ? (
              <ImageStat
                tone="caffeine"
                label={t("ui-dialogs.share.image.caffeine")}
                value={t("ui-recipe.amount.mg", { value: f.number(finite(plan.caffeine.totalMg)) })}
              />
            ) : null}
          </dl>

          <WarningList warnings={warnings} showCitations={false} compact />

          <p data-testid="share-view-caption" className="caption text-ink-2">
            {viewCaption}
          </p>
          <div className="space-y-4">
            {sections.map((section) => (
              <ImageSection key={section.kind} section={section} view={view} bottleMl={bottleMl} />
            ))}
            {sections.length === 0 ? <p className="text-body-sm text-ink-2">{t("ui-dialogs.nothingToMix")}</p> : null}
          </div>

          <p className="border-t border-line pt-3 text-center font-mono text-caption text-muted">
            {t("ui-dialogs.share.image.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
