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
import WarningList from "../ui/WarningList";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { formatRatio } from "../../domain/carbs";
import { roundTo } from "../../domain/units";
import { shareRatio } from "./IngredientsHelpers";

/** @param {number} x @returns {number} */
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * Legend symbols. Each mark on the bar has its own shape (band, dashed
 * outline, line, ring), so the bar never relies on colour alone; the legend
 * text states every value.
 */
const LEGEND_SYMBOLS = {
  reachable: <span className="inline-block h-2.5 w-5 rounded-full bg-line-strong" />,
  allowed: <span className="inline-block h-3 w-5 rounded-full border-2 border-dashed border-ink-2" />,
  target: <span className="inline-block h-3.5 w-0.5 bg-ink" />,
  recipe: <span className="inline-block size-3 rounded-full border-2 border-ink bg-surface" />,
};

/**
 * The fructose shares the ingredients can make, drawn on a bar from 1:0
 * (glucose only, glucose colour) through 1:1 to 0:1 (fructose only,
 * fructose colour): the reachable range as a band, the allowed range (Auto
 * ratio only) as a dashed outline, the target as a line and the recipe's
 * ratio as a ring. The bar is decorative; the legend under it (a
 * description list) states every value as text, with the locale's decimals.
 *
 * @param {{ feasible: [number, number]|null, allowed: [number, number]|null, target: number|null,
 *   targetText: string, recipe: number|null }} props
 *   Shares are fructose ÷ all carbs (0–1). `allowed` null hides the allowed band; `target` null
 *   (a 0:0 ratio) hides the target line; `recipe` null (no carbs in the recipe) hides the ring.
 *   `targetText` is the target ratio as the domain writes it ("1:0.5", "0:0").
 */
export function IngredientsRatioBar({ feasible, allowed, target, targetText, recipe }) {
  const t = useT();
  const f = useFormat();
  const captionId = useId();
  const at = (share) => `${clamp01(share) * 100}%`;
  // A range shows at least 8 px wide, so a single reachable ratio stays visible.
  const span = ([lo, hi]) => ({
    left: `calc(${at(lo)} - 4px)`,
    width: `calc(${(clamp01(hi) - clamp01(lo)) * 100}% + 8px)`,
  });
  const range = ([lo, hi]) =>
    shareRatio(lo) === shareRatio(hi)
      ? t("ui-setup-recipe.reach.only", { ratio: shareRatio(lo) })
      : t("ui-setup-recipe.reach.range", { lo: shareRatio(lo), hi: shareRatio(hi) });
  const legend = [
    { key: "reachable", term: t("ui-setup-recipe.reach.reachable"), value: feasible ? range(feasible) : t("ui-setup-recipe.reach.none") },
    allowed && {
      key: "allowed",
      term: t("ui-setup-recipe.reach.allowed"),
      value: t("ui-setup-recipe.reach.range", { lo: shareRatio(allowed[0]), hi: shareRatio(allowed[1]) }),
    },
    { key: "target", term: t("ui-setup-recipe.reach.target"), value: f.ratio(targetText) },
    {
      key: "recipe",
      term: t("ui-setup-recipe.reach.recipe"),
      value: recipe === null ? t("ui-setup-recipe.reach.noCarbs") : f.ratio(shareRatio(recipe)),
    },
  ].filter(Boolean);

  return (
    <figure aria-labelledby={captionId} className="m-0 space-y-2" data-testid="ratio-reach">
      <figcaption id={captionId} className="caption text-ink-2">
        {t("ui-setup-recipe.reach.title")}
      </figcaption>
      <div aria-hidden="true" className="pb-1 pt-3">
        {/* The scale: glucose only at the left, fructose only at the right. */}
        <div className="relative h-3 rounded-full border border-line bg-linear-to-r from-glucose-soft to-fructose-soft">
          {/* Positions sit 6 px inside the track ends, so markers at 1:0 and 0:1 stay on it. */}
          <div className="absolute inset-x-1.5 inset-y-0">
            {allowed ? (
              <div
                data-testid="ratio-range-allowed"
                className="absolute -inset-y-1.5 rounded-full border-2 border-dashed border-ink-2"
                style={span(allowed)}
              />
            ) : null}
            {feasible ? (
              <div
                data-testid="ratio-range-reachable"
                className="absolute inset-y-0.5 rounded-full bg-line-strong"
                style={span(feasible)}
              />
            ) : null}
            {target !== null ? (
              <div
                data-testid="ratio-range-target"
                className="absolute -bottom-2 -top-2 w-0.5 -translate-x-1/2 bg-ink"
                style={{ left: at(target) }}
              />
            ) : null}
            {recipe !== null ? (
              <div
                data-testid="ratio-range-recipe"
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
                style={{ left: at(recipe) }}
              />
            ) : null}
          </div>
        </div>
        <div className="relative mt-2 h-4 font-mono text-caption text-muted">
          <span className="absolute left-0 text-glucose">{f.ratio("1:0")}</span>
          <span className="absolute left-1/2 -translate-x-1/2">{f.ratio("1:1")}</span>
          <span className="absolute right-0 text-fructose">{f.ratio("0:1")}</span>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-body-sm @sm:grid-cols-2">
        {legend.map(({ key, term, value }) => (
          <div key={key} className="flex items-center justify-between gap-3" data-legend={key}>
            <dt className="flex items-center gap-2 text-ink-2">
              <span aria-hidden="true" className="inline-flex w-5 justify-center">
                {LEGEND_SYMBOLS[key]}
              </span>
              {term}
            </dt>
            <dd className="num font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/**
 * The ratio reach of the current plan: the bar of ratios the ingredients
 * can make ({@link IngredientsRatioBar}, from `plan.carbs.ingredients` and
 * `plan.carbs.ratio`), a note when Auto ratio uses another ratio inside the
 * allowed range without a warning (e.g. glucose-only powders at 55 g/h),
 * and the solver's warnings (`carbs.ratioNotReachable`,
 * `carbs.noIngredients`). Exported for the guided flow.
 *
 * @param {{ className?: string }} props
 */
export default function IngredientsRatioReach({ className }) {
  const t = useT();
  const plan = usePlan();
  const ratio = plan.carbs.ratio;
  const isManual = ratio.mode === "manual";
  const hasRatio = ratio.value.glucose + ratio.value.fructose > 0;
  const solution = plan.carbs.ingredients;
  const recipeShare = solution.items.length > 0 ? solution.achievedShare : null;
  const targetText = formatRatio(ratio.value);
  const substituted =
    !isManual &&
    recipeShare !== null &&
    solution.adjusted &&
    solution.warnings.length === 0 &&
    shareRatio(recipeShare) !== targetText;

  return (
    <div className={cx("@container space-y-3", className)}>
      <IngredientsRatioBar
        feasible={solution.feasibleRange}
        allowed={isManual ? null : ratio.allowedShare}
        target={hasRatio ? ratio.share : null}
        targetText={targetText}
        recipe={recipeShare}
      />
      {substituted ? (
        <p className="text-body-sm text-ink-2" data-testid="ratio-substituted">
          {t("ui-setup-recipe.reach.substituted", {
            target: targetText,
            recipe: shareRatio(recipeShare),
            gPerHour: roundTo(plan.carbs.gPerHour, 1),
          })}
        </p>
      ) : null}
      <WarningList warnings={solution.warnings} />
    </div>
  );
}
