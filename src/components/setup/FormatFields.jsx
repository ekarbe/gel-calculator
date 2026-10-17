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

import { useId, useState } from "react";
import NumberField from "../ui/NumberField";
import Segmented from "../ui/Segmented";
import Select from "../ui/Select";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { GEL_CONSISTENCY_PCT } from "../../domain/concentration";
import { roundTo } from "../../domain/units";
import { countText } from "../../i18n/plural";

/*  The Format field groups: gel, drink or both; gels per hour and the gel
    consistency for gels; the bottle size for a drink; the drink's share of
    the carbs for both. Every control edits `inputs.format` itself, so the
    Format section and the guided flow use the same parts. Bottle sizes
    follow the unit system (ml or US fl oz); the plan stores ml. */

/** Bottle sizes offered as presets, ml. Any other size is "Custom". */
export const BOTTLE_PRESETS_ML = Object.freeze([500, 750, 950]);

const [GELS_MIN, GELS_MAX] = INPUT_LIMITS.gelsPerHour;
const [BOTTLE_MIN, BOTTLE_MAX] = INPUT_LIMITS.bottleMl;
const [SHARE_MIN, SHARE_MAX] = INPUT_LIMITS.drinkCarbSharePct;

/**
 * The option text of a gel consistency ("Standard 60%").
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {string} key
 * @returns {string}
 */
export function consistencyLabel(t, key) {
  return t("ui-setup-recipe.format.consistency.option", {
    name: t(`concentration.consistency.${key}`),
    pct: GEL_CONSISTENCY_PCT[key],
  });
}

/**
 * A segmented choice with a visible caption that names it.
 * @param {{ label: string, className?: string, children: (labelId: string) => import('react').ReactNode }} props
 */
function Labelled({ label, className, children }) {
  const labelId = useId();
  return (
    <div className={cx("min-w-0", className)}>
      <p id={labelId} className="caption mb-1 text-ink-2">
        {label}
      </p>
      {children(labelId)}
    </div>
  );
}

/**
 * Gel, drink or both (`format.type`).
 * @param {{ className?: string }} props
 */
export function FormatTypeField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  return (
    <Segmented
      label={t("ui-setup-recipe.format.type.label")}
      value={inputs.format.type}
      onChange={(type) => set("format.type", type)}
      options={INPUT_OPTIONS.formatType.map((type) => ({ value: type, label: t(`ui-setup-recipe.format.type.${type}`) }))}
      fullWidth
      className={className}
      data-testid="format-type"
    />
  );
}

/**
 * Gels per hour (`format.gelsPerHour`, 0–12 in steps of 0.5), with what
 * that gives as its hint: the gel count, or why there are no gels (the plan
 * then puts what they would hold into the drink).
 * @param {{ id?: string, className?: string }} props
 */
export function FormatGelsPerHourField({ id, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const format = inputs.format;
  const count = plan.gels.count;
  let hint;
  if (count > 0) hint = countText(t, f, "ui-setup-recipe.format.gels.total", count);
  else if (plan.carbs.totalG <= 0) hint = t("ui-setup-recipe.format.gels.noCarbs");
  else if (plan.carbs.deliveredG <= 0) hint = t("ui-setup-recipe.format.gels.noIngredients");
  else if (format.type === "both" && format.drinkCarbSharePct >= SHARE_MAX) hint = t("ui-setup-recipe.format.gels.allInDrink");
  else hint = t("ui-setup-recipe.format.gels.none");
  return (
    <NumberField
      id={id}
      label={t("ui-setup-recipe.format.gels.label")}
      value={format.gelsPerHour}
      onChange={(n) => set("format.gelsPerHour", n)}
      min={GELS_MIN}
      max={GELS_MAX}
      step={0.5}
      hint={hint}
      className={className}
    />
  );
}

/**
 * The gel consistency preset (`format.gelConsistency`), each with its
 * carbohydrate % of the gel mass, and the note for the isotonic-style one.
 * @param {{ id?: string, className?: string }} props
 */
export function FormatConsistencyField({ id, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const consistency = inputs.format.gelConsistency;
  return (
    <div className={cx("min-w-0 space-y-1", className)}>
      <Select
        id={id}
        label={t("ui-setup-recipe.format.consistency.label")}
        hint={t("ui-setup-recipe.format.consistency.hint")}
        value={consistency}
        onChange={(key) => set("format.gelConsistency", key)}
        options={INPUT_OPTIONS.gelConsistency.map((key) => ({ value: key, label: consistencyLabel(t, key) }))}
      />
      {consistency === "isotonic" ? (
        <p data-testid="isotonic-note" className="text-body-sm text-ink-2">
          {t("concentration.consistency.isotonicNote")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The bottle size (`format.bottleMl`): presets of 500, 750 and 950 ml, or a
 * custom size (250–1500 ml) in a number field. Sizes show in ml or fl oz;
 * a typed size is stored in whole ml. A size from the inputs that is not a
 * preset shows as "Custom".
 * @param {{ id?: string, className?: string }} props
 */
export function FormatBottleField({ id, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const [customChosen, setCustomChosen] = useState(false);
  const generatedId = useId();
  const inputId = id ?? `bottle-ml-${generatedId.replace(/:/g, "")}`;
  const bottleMl = inputs.format.bottleMl;
  const custom = customChosen || !BOTTLE_PRESETS_ML.includes(bottleMl);
  return (
    <div className={cx("min-w-0 space-y-3", className)}>
      <Labelled label={t("ui-setup-recipe.format.bottle.label")}>
        {(labelId) => (
          <Segmented
            labelledBy={labelId}
            size="sm"
            fullWidth
            value={custom ? "custom" : bottleMl}
            onChange={(value) => {
              if (value === "custom") {
                setCustomChosen(true);
                return;
              }
              setCustomChosen(false);
              set("format.bottleMl", value);
            }}
            options={[
              // One decimal in fl oz, as the custom field shows it (750 ml is 25.4 fl oz). On a narrow
              // screen the label wraps between the number and the unit ("25.4" / "fl oz").
              ...BOTTLE_PRESETS_ML.map((ml) => ({
                value: ml,
                // One element: the option is a flex row, so loose parts would not wrap.
                label: (
                  <span>
                    {f.volume(ml, { digits: 1, unit: false })} <span className="whitespace-nowrap">{f.unit("volume")}</span>
                  </span>
                ),
              })),
              { value: "custom", label: t("ui-setup-recipe.format.bottle.custom") },
            ]}
            data-testid="bottle-size"
          />
        )}
      </Labelled>
      {custom ? (
        <NumberField
          id={inputId}
          label={t("ui-setup-recipe.format.bottle.customLabel")}
          hint={t("ui-setup-recipe.format.bottle.customHint", {
            min: f.volume(BOTTLE_MIN, { digits: 1, unit: false }),
            max: f.volume(BOTTLE_MAX, { digits: 1 }),
          })}
          value={bottleMl}
          onChange={(ml) => set("format.bottleMl", ml)}
          toInput={(ml) => f.toDisplay("volume", ml)}
          fromInput={(shown) => Math.round(f.fromDisplay("volume", shown))}
          min={f.toDisplay("volume", BOTTLE_MIN)}
          max={f.toDisplay("volume", BOTTLE_MAX)}
          step={f.unitSystem === "imperial" ? 1 : 50}
          digits={1}
          unit={f.unit("volume")}
          className="max-w-56"
        />
      ) : null}
    </div>
  );
}

/**
 * For both: the drink's share of the carbs (`format.drinkCarbSharePct`,
 * 0–100 % in steps of 5) as a number field and a slider. The rest goes into
 * gels; the drink holds all the salts.
 * @param {{ id?: string, className?: string }} props
 */
export function FormatDrinkShareField({ id, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const generatedId = useId();
  const inputId = id ?? `drink-share-${generatedId.replace(/:/g, "")}`;
  const share = inputs.format.drinkCarbSharePct;
  const commit = (n) => set("format.drinkCarbSharePct", n);
  return (
    <div className={cx("min-w-0 space-y-1", className)}>
      <NumberField
        id={inputId}
        label={t("ui-setup-recipe.format.share.label")}
        hint={t("ui-setup-recipe.format.share.hint")}
        value={share}
        onChange={commit}
        min={SHARE_MIN}
        max={SHARE_MAX}
        step={5}
        unit={t("ui-setup-recipe.unit.percent")}
        className="max-w-xs"
      />
      <input
        id={`${inputId}-slider`}
        type="range"
        min={SHARE_MIN}
        max={SHARE_MAX}
        step={5}
        value={share}
        aria-label={t("ui-setup-recipe.format.share.slider")}
        aria-valuetext={t("ui-setup-recipe.format.share.sliderValue", { pct: roundTo(share, 1) })}
        onChange={(event) => commit(Number(event.target.value))}
        className="block h-11 w-full cursor-pointer accent-ink"
      />
    </div>
  );
}

/**
 * The one-line summary of the format for a collapsed section ("Gel · 3 per
 * hour · Standard 60%", "Drink · 750 ml bottles", "Both · 50% of the carbs
 * in the drink"). The bottle size reads as the bottle presets and the
 * custom field write it (one decimal in fl oz: "Drink · 25.4 fl oz bottles").
 * @returns {string}
 */
export function useFormatSummary() {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const format = inputs.format;
  if (format.type === "drink") {
    return t("ui-setup-recipe.format.summary.drink", { bottle: f.volume(format.bottleMl, { digits: 1 }) });
  }
  if (format.type === "both") return t("ui-setup-recipe.format.summary.both", { share: format.drinkCarbSharePct });
  return t("ui-setup-recipe.format.summary.gel", {
    gels: roundTo(format.gelsPerHour, 2),
    consistency: consistencyLabel(t, format.gelConsistency),
  });
}

/**
 * Every Format field group for the chosen format: the format; gels per
 * hour and the consistency for gels (and both); the bottle size for a
 * drink (and both); the drink's share of the carbs for both.
 * @param {{ idPrefix?: string }} props
 */
export default function FormatFields({ idPrefix }) {
  const { inputs } = usePlanInputs();
  const generatedId = useId();
  const prefix = idPrefix ?? `format-${generatedId.replace(/:/g, "")}`;
  const type = inputs.format.type;
  const hasGel = type !== "drink";
  const hasDrink = type !== "gel";
  return (
    <div className="space-y-5" data-testid="format-controls">
      <FormatTypeField />
      {hasGel ? (
        <div className="space-y-4">
          <FormatGelsPerHourField id={`${prefix}-gels`} className="max-w-56" />
          <FormatConsistencyField id={`${prefix}-consistency`} />
        </div>
      ) : null}
      {hasDrink ? <FormatBottleField id={`${prefix}-bottle`} /> : null}
      {type === "both" ? <FormatDrinkShareField id={`${prefix}-share`} /> : null}
    </div>
  );
}
