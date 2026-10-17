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
import { CircleCheck, Droplets, FlaskConical, Printer, Share2, TriangleAlert } from "lucide-react";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import Lane from "../ui/Lane";
import { cx } from "../ui/cx";
import Panel from "../ui/Panel";
import PanelHeader from "../ui/PanelHeader";
import Segmented from "../ui/Segmented";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { MIXING_MODAL, SHARE_MODAL, useUi } from "../../state/UiProvider";
import { INPUT_OPTIONS } from "../../domain/plan";
import { roundTo } from "../../domain/units";
import { amountsCaption, sectionTitle, servingsText } from "./boardText";
import { formatAmount, itemLabel, itemTone, osmolalityText } from "../recipe/recipeText";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../domain/recipe').RecipeSection} RecipeSection */
/** @typedef {import('../../domain/recipe').RecipeItem} RecipeItem */
/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */

/**
 * Chip look of each tonicity band (icon and text, never colour alone):
 * hypo- and isotonic drinks are fine; a hypertonic drink is a caution. A gel
 * is always hypertonic and is taken with water, so its chip is neutral.
 */
const TONICITY_LOOKS = Object.freeze({
  hypotonic: { tone: "ok", icon: CircleCheck },
  isotonic: { tone: "ok", icon: CircleCheck },
  hypertonic: { tone: "warn", icon: TriangleAlert },
});

/** Chip look of a gel's (hypertonic) osmolality. */
const GEL_TONICITY_LOOK = Object.freeze({ tone: "neutral", icon: Droplets });

/**
 * One fact of a section's per-serving list (`<dt>` term, `<dd>` value).
 * @param {{ term: string, children: import('react').ReactNode }} props
 */
function Fact({ term, children }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <dt className="text-body-sm text-ink-2">{term}</dt>
      <dd className="num text-right text-body-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * What one serving holds: per gel the mass, volume, carbs and strength (%
 * w/w); per bottle the fill, the carbs (% w/v) and the sodium (mg/L).
 * Nothing for a section without servings.
 * @param {{ section: RecipeSection, plan: Plan }} props
 */
function ServingFacts({ section, plan }) {
  const t = useT();
  const f = useFormat();
  if (!(section.servings > 0)) return null;
  const ps = /** @type {any} */ (section.perServing);
  const label = t("ui-board.facts.label", { serving: t(section.servingLabelKey) });
  const listClass = "grid grid-cols-1 gap-x-4 gap-y-1 @md:grid-cols-2";
  if (section.kind === "gel") {
    const carbPct = plan.concentration.gel?.carbPct;
    return (
      <dl aria-label={label} data-testid="serving-facts" className={listClass}>
        <Fact term={t("ui-board.facts.gelMass")}>{formatAmount(t, f, ps.massG, "g")}</Fact>
        <Fact term={t("ui-board.facts.gelVolume")}>
          {t("ui-board.facts.about", { value: formatAmount(t, f, ps.volumeMl, "ml") })}
        </Fact>
        <Fact term={t("ui-board.facts.carbsPerGel")}>{formatAmount(t, f, ps.carbsG, "g")}</Fact>
        {typeof carbPct === "number" && Number.isFinite(carbPct) ? (
          <Fact term={t("ui-board.facts.carbPct")}>{t("ui-board.facts.carbPctValue", { pct: Math.round(carbPct) })}</Fact>
        ) : null}
      </dl>
    );
  }
  return (
    <dl aria-label={label} data-testid="serving-facts" className={listClass}>
      <Fact term={t("ui-board.facts.fill")}>{formatAmount(t, f, ps.volumeMl, "ml")}</Fact>
      <Fact term={t("ui-board.facts.carbsPerBottle")}>
        {t("ui-board.facts.carbsPerBottleValue", { amount: formatAmount(t, f, ps.carbsG, "g"), pct: roundTo(ps.carbPctWv ?? 0, 1) })}
      </Fact>
      <Fact term={t("ui-board.facts.sodiumPerBottle")}>
        {t("ui-board.facts.sodiumPerBottleValue", {
          amount: formatAmount(t, f, ps.sodiumMg, "mg"),
          mgPerL: f.number(ps.sodiumMgPerL ?? 0),
        })}
      </Fact>
    </dl>
  );
}

/**
 * The osmolality of a section ("≈ 4,300 mOsm/kg, likely higher") with a
 * tonicity chip that names the band (icon and text, not colour alone).
 * Nothing when the section has no osmolality.
 * @param {{ section: RecipeSection }} props
 */
function Osmolality({ section }) {
  const t = useT();
  const f = useFormat();
  const shown = osmolalityText(t, f, section.osmolality, section.kind);
  if (!shown) return null;
  const look =
    section.kind === "gel" && shown.tonicity === "hypertonic"
      ? GEL_TONICITY_LOOK
      : TONICITY_LOOKS[shown.tonicity] ?? TONICITY_LOOKS.hypertonic;
  return (
    <div data-testid="osmolality" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
      <span className="text-ink-2">{t("ui-board.osmo.label")}</span>
      <span className="num font-medium text-ink">{shown.text}</span>
      <Chip tone={look.tone} icon={look.icon} data-testid="tonicity-chip" data-tonicity={shown.tonicity}>
        {t(`concentration.tonicity.${shown.tonicity}`)}
      </Chip>
    </div>
  );
}

/**
 * One recipe line as a lane: colour dot, label and amount in the chosen
 * view. A carb ingredient also gets its carbs by pathway (a second line)
 * and a bar whose length is its share of the section's carbs; salts, water
 * and caffeine are plain rows with their colour dot.
 * @param {{ item: RecipeItem, view: 'total'|'perServing', sectionCarbsG: number }} props
 */
function RecipeLane({ item, view, sectionCarbsG }) {
  const t = useT();
  const f = useFormat();
  const perServing = view === "perServing";
  const amount = formatAmount(t, f, perServing ? item.perServing : item.amount, item.unit);
  let detail = null;
  let share = null;
  let shareLabel;
  if (item.kind === "carb" && item.detail && "carbsG" in item.detail) {
    const d = perServing ? item.detail.perServing : item.detail;
    detail = t("ui-board.lane.carbDetail", {
      carbs: formatAmount(t, f, d.carbsG, "g"),
      glucose: formatAmount(t, f, d.glucoseG, "g"),
      fructose: formatAmount(t, f, d.fructoseG, "g"),
    });
    share = sectionCarbsG > 0 ? item.detail.carbsG / sectionCarbsG : null;
    shareLabel = share === null ? undefined : t("ui-board.lane.share", { pct: Math.round(share * 100) });
  }
  return (
    <Lane
      as="li"
      data-kind={item.kind}
      data-tone={itemTone(item)}
      tone={itemTone(item)}
      label={<span data-testid="item-label">{itemLabel(t, item)}</span>}
      amount={amount}
      amountProps={{ "data-testid": "item-amount" }}
      detail={detail ? <span data-testid="item-detail">{detail}</span> : null}
      share={share}
      shareLabel={shareLabel}
    />
  );
}

/**
 * One recipe section's lanes (the gel batch or the drink): the heading with
 * the count ("Gels ×9", "Bottles ×4"), what the bottles hold and the caption
 * of the view ("Whole batch", "Per gel") in the same row, then one lane per
 * line. Flat on the recipe panel (no panel in a panel: the lane bars keep
 * their `surface-2` track, and the lanes start one row higher on a phone),
 * with a hairline between two sections; a group named by its heading (not
 * a landmark: the board has enough of those). Its per-serving facts and
 * osmolality follow the recipe actions ({@link SectionFacts}).
 * @param {{ section: RecipeSection, view: 'total'|'perServing', bottleMl: number, headingLevel: number }} props
 */
function RecipeSectionBlock({ section, view, bottleMl, headingLevel }) {
  const t = useT();
  const f = useFormat();
  const headingId = useId();
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 4))}`;
  const servings = servingsText(t, f, section, bottleMl);
  const sectionCarbsG = section.items
    .filter((item) => item.kind === "carb")
    .reduce((total, item) => total + (/** @type {any} */ (item.detail)?.carbsG ?? 0), 0);

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid={`recipe-section-${section.kind}`}
      className="@container min-w-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <Heading id={headingId} className="display-title text-ink">
          {sectionTitle(t, f, section)}
        </Heading>
        {servings ? (
          <span data-testid="section-servings" className="text-body-sm text-ink-2">
            {servings}
          </span>
        ) : null}
        {section.items.length > 0 ? (
          <span data-testid="amounts-caption" className="caption ml-auto text-muted">
            {amountsCaption(t, section, view)}
          </span>
        ) : null}
      </div>
      {section.items.length > 0 ? (
        <ul role="list" aria-label={t("ui-board.lanes.label")} className="mt-1 divide-y divide-line">
          {section.items.map((item) => (
            <RecipeLane key={item.key} item={item} view={view} sectionCarbsG={sectionCarbsG} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-body-sm text-ink-2">{t("ui-board.section.empty")}</p>
      )}
    </div>
  );
}

/**
 * Whether a section has per-serving facts or an osmolality to show.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {RecipeSection} section
 * @returns {boolean}
 */
const hasFacts = (t, f, section) => section.servings > 0 || osmolalityText(t, f, section.osmolality, section.kind) !== null;

/**
 * What one serving of a section holds and its osmolality with the tonicity
 * chip, after the recipe actions (the lanes and START MIXING come first on
 * a phone): a group named by the serving ("Per gel facts"), under a caption
 * with the section's name when the plan has two sections. Only for a
 * section that has either ({@link hasFacts}).
 * @param {{ section: RecipeSection, plan: Plan, showTitle: boolean }} props
 */
function SectionFacts({ section, plan, showTitle }) {
  const t = useT();
  const f = useFormat();
  return (
    <div data-testid={`recipe-facts-${section.kind}`} className="@container min-w-0">
      {showTitle ? <p className="caption mb-1 text-muted">{sectionTitle(t, f, section)}</p> : null}
      <ServingFacts section={section} plan={plan} />
      <Osmolality section={section} />
    </div>
  );
}

/**
 * The recipe panel of the race board: what to weigh out and mix.
 *
 * - Total ↔ Per serving (`inputs.format.view`); each section's caption
 *   says what its amounts are for ("Whole batch", "Per gel", …).
 * - One block of lanes per section of `plan.recipe.sections` (gel batch,
 *   drink): carbs, salts, the water to add and caffeine tablets. A carb
 *   lane's bar is that ingredient's share of the section's carbs.
 * - START MIXING (the one accent button) opens the mixing steps; Print
 *   opens the browser's print dialog (the print view is a separate
 *   component); Share opens the share dialog. Right after the lanes, so
 *   on a phone the lanes and START MIXING are in the first screen.
 * - Then what one serving holds and the osmolality of each section, with
 *   its tonicity chip.
 *
 * Section and plan warnings are in the board's warnings panel, the cost
 * estimate after Next up (`BoardCost`).
 *
 * @param {{ headingLevel?: number }} props  Level of the panel heading (default 3; sections one below).
 */
export default function BoardRecipe({ headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const { inputs, set } = usePlanInputs();
  const { openModal } = useUi();
  const headingId = useId();
  const view = inputs.format.view === "perServing" ? "perServing" : "total";
  const sections = plan.recipe.sections;
  const hasItems = sections.some((section) => section.items.length > 0);
  const two = sections.length > 1;
  const factSections = sections.filter((section) => hasFacts(t, f, section));

  return (
    <Panel aria-labelledby={headingId} data-testid="board-recipe" className="@container min-w-0">
      <PanelHeader
        id={headingId}
        level={headingLevel}
        title={t("ui-board.recipe.title")}
        icon={FlaskConical}
        actions={
          <Segmented
            size="sm"
            label={t("ui-board.recipe.view")}
            value={view}
            onChange={(next) => set("format.view", next)}
            options={INPUT_OPTIONS.view.map((value) => ({ value, label: t(`ui-board.recipe.view.${value}`) }))}
          />
        }
      />
      {hasItems ? (
        <div
          className={cx(
            "mt-2 grid gap-3",
            // Two sections side by side when there is room, else one under the other with a hairline.
            two && "@3xl:grid-cols-2 @3xl:gap-x-5 @max-3xl:[&>*+*]:border-t @max-3xl:[&>*+*]:border-line @max-3xl:[&>*+*]:pt-3",
          )}
        >
          {sections.map((section) => (
            <RecipeSectionBlock
              key={section.kind}
              section={section}
              view={view}
              bottleMl={inputs.format.bottleMl}
              headingLevel={headingLevel + 1}
            />
          ))}
        </div>
      ) : (
        <p data-testid="recipe-empty" className="mt-3 text-body-sm text-ink-2">
          {t("ui-board.recipe.empty")}
        </p>
      )}

      <div role="group" aria-label={t("ui-board.actions.label")} className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="col-span-2"
          aria-haspopup="dialog"
          data-testid="board-start-mixing"
          onClick={() => openModal(MIXING_MODAL)}
        >
          {t("ui-board.actions.mix")}
        </Button>
        <Button icon={Printer} fullWidth data-testid="board-print" onClick={() => window.print()}>
          {t("ui-board.actions.print")}
        </Button>
        <Button icon={Share2} fullWidth aria-haspopup="dialog" data-testid="board-share" onClick={() => openModal(SHARE_MODAL)}>
          {t("ui-board.actions.share")}
        </Button>
      </div>

      {factSections.length > 0 ? (
        <div className={cx("mt-4 grid gap-3 border-t border-line pt-3", factSections.length > 1 && "@3xl:grid-cols-2 @3xl:gap-x-5")}>
          {factSections.map((section) => (
            <SectionFacts key={section.kind} section={section} plan={plan} showTitle={two} />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
