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

import { useState } from "react";
import { Gem, GlassWater, Info, Scale, SlidersHorizontal, Zap } from "lucide-react";
import Chip from "../ui/Chip";
import NumberField from "../ui/NumberField";
import Segmented, { useAutoAdjustOptions } from "../ui/Segmented";
import Switch from "../ui/Switch";
import Why, { CitationLinks } from "../ui/Why";
import { cx } from "../ui/cx";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { INPUT_LIMITS } from "../../domain/plan";
import { HIGH_CARB_MIN_DURATION_MIN } from "../../domain/carbs";
import { roundTo } from "../../domain/units";
import { SweatProjectionLevel } from "./SweatProjection";
import {
  FIELD_DIGITS,
  TargetsBlock,
  TargetsFact,
  TargetsFacts,
  TargetsNote,
  TargetsValue,
  roundField,
} from "./TargetsParts";

/*  The Targets field groups: the carbohydrate target, the glucose:fructose
    ratio, sodium, fluid and the optional ions ("Advanced"). Each reads the
    plan and writes the plan inputs itself, so the Targets section and the
    guided flow use the same components. Every number comes from the plan
    (`usePlan()`); the groups only format it. Auto uses the recommendation;
    switching to Adjust starts from the value the plan uses now, so nothing
    jumps. Fluid follows the unit system of the UI prefs (ml or fl oz); the
    plan stores ml. Nutrients stay in g and mg. The Adjust fields show up to
    two decimals and commit at that precision (`roundField`), so a field shows
    the number the plan uses. */

/**
 * Carb warnings about the chosen ingredients, not the target. The
 * ingredient list and the recipe show them where they can be fixed, so the
 * carbohydrate block leaves them out.
 */
const SOURCE_WARNING_IDS = new Set(["carbs.ratioNotReachable", "carbs.noIngredients"]);

/**
 * The optional ions under "Advanced": the input key and the plan key.
 * @type {ReadonlyArray<{ key: 'potassium'|'magnesium'|'calcium', ion: 'Potassium'|'Magnesium'|'Calcium' }>}
 */
export const TARGETS_EXTRA_IONS = Object.freeze([
  Object.freeze({ key: "potassium", ion: "Potassium" }),
  Object.freeze({ key: "magnesium", ion: "Magnesium" }),
  Object.freeze({ key: "calcium", ion: "Calcium" }),
]);

/**
 * A fructose share (fructose ÷ all carbs) as a ratio for `{x:ratio}`:
 * `1/3` → 1:0.5, `0.5` → 1:1.
 * @param {number} share
 * @returns {{ glucose: number, fructose: number }}
 */
const shareRatio = (share) => ({ glucose: 1 - share, fructose: share });

/**
 * A share (0–1) as a whole percent number; non-finite counts as 0.
 * @param {number} share
 * @returns {number}
 */
const wholePercent = (share) => (Number.isFinite(share) ? Math.round(share * 100) : 0);

/**
 * The Auto/Adjust choice of a block, small, in the block's title row.
 * @param {{ label: string, value: 'auto'|'manual', onChange: (mode: 'auto'|'manual') => void, testId?: string }} props
 */
function TargetsModeSwitch({ label, value, onChange, testId }) {
  const options = useAutoAdjustOptions();
  return <Segmented size="sm" label={label} value={value} onChange={onChange} options={options} data-testid={testId} />;
}

/**
 * The carbohydrate target: Auto (the recommendation for the duration and
 * intensity) or Adjust (your own g/h), the recommended value, the evidence
 * range and the duration band with its "Why?", the gut-trained opt-in (over
 * 150 min, and kept while it is on so a shorter event can turn it off; once
 * pressed it stays until the duration changes, so turning it off on a short
 * event does not remove the focused switch), the mouth rinse protocol in the
 * 45–75 min band, and the target's warnings (not the ingredient warnings: the
 * ingredient list shows those).
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function TargetsCarbs({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { carbs } = plan;
  const recommended = carbs.recommended;
  const manual = carbs.mode === "manual";
  const [lo, hi] = recommended.range;
  const [minG, maxG] = INPUT_LIMITS.manualGPerHour;
  const unit = t("ui-setup-targets.unit.gPerHour");
  const durationMin = inputs.event.durationMin;
  // The duration at which the gut-trained switch was last pressed: it stays
  // rendered for that duration, so the switch never unmounts under focus.
  const [highCarbKeptAt, setHighCarbKeptAt] = useState(/** @type {number|null} */ (null));
  const showHighCarb =
    durationMin > HIGH_CARB_MIN_DURATION_MIN || inputs.event.highCarb || highCarbKeptAt === durationMin;
  const warnings = carbs.warnings.filter((warning) => !SOURCE_WARNING_IDS.has(warning.id));

  const setMode = (mode) => {
    if (mode === carbs.mode) return;
    if (mode === "manual") apply({ carbs: { mode: "manual", manualGPerHour: carbs.gPerHour } });
    else set("carbs.mode", "auto");
  };

  return (
    <TargetsBlock
      title={t("ui-setup-targets.carbs.title")}
      icon={Zap}
      iconClassName="text-glucose"
      headingLevel={headingLevel}
      actions={<TargetsModeSwitch label={t("ui-setup-targets.carbs.mode")} value={carbs.mode} onChange={setMode} />}
      warnings={warnings}
      data-testid="targets-carbs"
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        {manual ? (
          <NumberField
            label={t("ui-setup-targets.carbs.target")}
            value={inputs.carbs.manualGPerHour}
            onChange={(value) => set("carbs.manualGPerHour", roundField(value))}
            min={minG}
            max={maxG}
            step={5}
            digits={FIELD_DIGITS}
            unit={unit}
            className="w-full max-w-60"
          />
        ) : (
          <TargetsValue
            label={t("ui-setup-targets.carbs.target")}
            value={f.number(carbs.gPerHour, 1)}
            unit={unit}
            testId="carbs-target"
          />
        )}
        <p className="text-body-sm text-ink-2" data-testid="carbs-total">
          {t("ui-setup-targets.carbs.total", { g: Math.round(carbs.totalG) })}
        </p>
      </div>
      <TargetsFacts>
        <TargetsFact term={t("ui-setup-targets.carbs.recommended")} testId="carbs-recommended">
          {t("ui-setup-targets.carbs.perHour", { g: recommended.gPerHour })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.carbs.range")} testId="carbs-range">
          {lo === 0 && hi === 0
            ? t("ui-setup-targets.carbs.perHour", { g: 0 })
            : t("ui-setup-targets.carbs.rangeValue", { lo, hi })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.carbs.band")} className="col-span-2">
          <Chip tone="glucose" className="mt-0.5 font-sans" data-testid="carbs-band">
            {t(`ui-setup-targets.carbs.band.${recommended.band}`)}
          </Chip>
        </TargetsFact>
      </TargetsFacts>
      <Why why={recommended.why} />
      {showHighCarb ? (
        <div className="rounded-control border border-line px-3 py-2">
          <Switch
            label={t("ui-setup-targets.carbs.highCarb.label")}
            description={t("ui-setup-targets.carbs.highCarb.hint")}
            checked={inputs.event.highCarb}
            onChange={(checked) => {
              setHighCarbKeptAt(durationMin);
              set("event.highCarb", checked);
            }}
          />
        </div>
      ) : null}
      {carbs.mouthRinseHowTo ? (
        <TargetsNote icon={Info} title={t("ui-setup-targets.carbs.mouthRinse.title")} data-testid="mouth-rinse-note">
          <p>{t(carbs.mouthRinseHowTo.summary)}</p>
          <CitationLinks ids={carbs.mouthRinseHowTo.citations} className="text-caption" />
        </TargetsNote>
      ) : null}
    </TargetsBlock>
  );
}

/**
 * The glucose:fructose ratio: Auto (the recommended ratio for the carb
 * target, with the range the solver may use) or Adjust (glucose and
 * fructose parts, starting from the ratio in use), shown normalised to
 * glucose 1 ("1:0.89"), the allowed range, the fructose share with its
 * "Why?", and the ratio warnings (`checkRatio`; a 0:0 ratio is a danger).
 * The ratios the ingredients can reach are in the Ingredients section.
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function TargetsRatio({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const ratio = plan.carbs.ratio;
  const recommended = ratio.recommended;
  const manual = ratio.mode === "manual";
  const hasRatio = ratio.value.glucose + ratio.value.fructose > 0;
  const share = Number.isFinite(ratio.share) ? Math.min(1, Math.max(0, ratio.share)) : 0;
  const [minPart, maxPart] = INPUT_LIMITS.ratioPart;

  const setMode = (mode) => {
    if (mode === ratio.mode) return;
    if (mode === "manual") apply({ carbs: { ratioMode: "manual", manualRatio: { ...ratio.value } } });
    else set("carbs.ratioMode", "auto");
  };

  // Each part field says which side of the ratio it is (its own hint, linked
  // with aria-describedby), with the example 1:0.5 in locale numbers.
  const example = { glucose: 1, fructose: 0.5 };
  const partField = (pathway) => (
    <NumberField
      label={t(`ui-setup-targets.ratio.${pathway}Parts`)}
      value={inputs.carbs.manualRatio[pathway]}
      onChange={(value) => set(`carbs.manualRatio.${pathway}`, roundField(value))}
      min={minPart}
      max={maxPart}
      step={0.05}
      digits={FIELD_DIGITS}
      hint={t(`ui-setup-targets.ratio.${pathway}Hint`, { parts: example[pathway], ratio: example })}
    />
  );

  return (
    <TargetsBlock
      title={t("ui-setup-targets.ratio.title")}
      icon={Scale}
      iconClassName="text-fructose"
      headingLevel={headingLevel}
      actions={<TargetsModeSwitch label={t("ui-setup-targets.ratio.mode")} value={ratio.mode} onChange={setMode} />}
      warnings={ratio.warnings}
      data-testid="targets-ratio"
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <TargetsValue
          label={t(manual ? "ui-setup-targets.ratio.yourLabel" : "ui-setup-targets.ratio.recommendedLabel")}
          value={f.ratio(ratio.value)}
          testId="carb-ratio-value"
        />
        <p className="text-body-sm text-ink-2">
          {t("ui-setup-targets.ratio.at", { g: roundTo(plan.carbs.gPerHour, 1) })}
        </p>
      </div>
      {hasRatio ? (
        // The split of the target between the two pathways; the facts below say it in words.
        <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2" data-testid="ratio-split">
          <div className="h-full rounded-full bg-glucose" style={{ width: `${(1 - share) * 100}%` }} />
          <div className="h-full rounded-full bg-fructose" style={{ width: `${share * 100}%` }} />
        </div>
      ) : null}
      <TargetsFacts>
        {manual ? (
          <TargetsFact term={t("ui-setup-targets.ratio.recommended")} testId="ratio-recommended">
            {f.ratio(recommended.ratio)}
          </TargetsFact>
        ) : null}
        <TargetsFact term={t("ui-setup-targets.ratio.allowed")} testId="ratio-allowed">
          {t("ui-setup-targets.ratio.allowedValue", {
            lo: shareRatio(recommended.minShare),
            hi: shareRatio(recommended.maxShare),
          })}
        </TargetsFact>
        {/* Full width, and the allowed range never breaks inside, so "44–50%" reads as one value on phones. */}
        <TargetsFact term={t("ui-setup-targets.ratio.share")} testId="ratio-share" className="col-span-2">
          {t("ui-setup-targets.ratio.shareValue", { pct: wholePercent(ratio.share) })}{" "}
          <span className="whitespace-nowrap">
            {t("ui-setup-targets.ratio.shareAllowed", {
              lo: wholePercent(recommended.minShare),
              hi: wholePercent(recommended.maxShare),
            })}
          </span>
        </TargetsFact>
      </TargetsFacts>
      {manual ? (
        <div className="@container">
          <div className="grid grid-cols-1 gap-3 @min-[20rem]:grid-cols-2">
            {partField("glucose")}
            {partField("fructose")}
          </div>
        </div>
      ) : null}
      <Why why={recommended.why} />
    </TargetsBlock>
  );
}

/**
 * The sodium target: Auto (half of the estimated sweat loss, kept in the
 * evidence range for the duration) or Adjust (your own mg/h), "Optional"
 * for events under 2 h, the recommended value, the range and the sweat
 * loss with its "Why?", and the sodium warnings (high intakes, a
 * concentration above 1,725 mg per litre of planned fluid).
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function TargetsSodium({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { sodium } = plan;
  const recommended = sodium.recommended;
  const manual = inputs.sodium.mode === "manual";
  const [lo, hi] = recommended.range;
  const [minMg, maxMg] = INPUT_LIMITS.manualMgPerHour;
  const unit = t("ui-setup-targets.unit.mgPerHour");

  const setMode = (mode) => {
    if (mode === "manual" && inputs.sodium.mode !== "manual") {
      apply({ sodium: { mode: "manual", manualMgPerHour: sodium.mgPerHour } });
    } else {
      set("sodium.mode", mode);
    }
  };

  return (
    <TargetsBlock
      title={t("ui-setup-targets.sodium.title")}
      icon={Gem}
      iconClassName="text-sodium"
      headingLevel={headingLevel}
      badge={
        recommended.optional ? (
          <Chip tone="sodium" data-testid="sodium-optional">
            {t("ui-setup-targets.sodium.optional")}
          </Chip>
        ) : null
      }
      actions={<TargetsModeSwitch label={t("ui-setup-targets.sodium.mode")} value={inputs.sodium.mode} onChange={setMode} />}
      warnings={sodium.warnings}
      data-testid="targets-sodium"
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        {manual ? (
          <NumberField
            label={t("ui-setup-targets.sodium.manual")}
            value={inputs.sodium.manualMgPerHour}
            onChange={(value) => set("sodium.manualMgPerHour", roundField(value))}
            min={minMg}
            max={maxMg}
            step={10}
            digits={FIELD_DIGITS}
            unit={unit}
            className="w-full max-w-60"
          />
        ) : (
          <TargetsValue
            label={t("ui-setup-targets.sodium.target")}
            value={f.number(sodium.mgPerHour)}
            unit={unit}
            testId="sodium-value"
          />
        )}
        <p className="text-body-sm text-ink-2" data-testid="sodium-total">
          {t("ui-setup-targets.sodium.total", { mg: Math.round(sodium.totalMg) })}
        </p>
      </div>
      <TargetsFacts>
        <TargetsFact term={t("ui-setup-targets.sodium.recommended")} testId="sodium-recommended">
          {t("ui-setup-targets.sodium.perHour", { mg: recommended.mgPerHour })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.sodium.range")} testId="sodium-range">
          {t("ui-setup-targets.sodium.rangeValue", { lo, hi })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.sodium.loss")} testId="sodium-loss" className="col-span-2">
          {t("ui-setup-targets.sodium.lossValue", { mg: Math.round(recommended.estimatedLossMgPerHour) })}
        </TargetsFact>
      </TargetsFacts>
      <Why why={recommended.why} />
    </TargetsBlock>
  );
}

/**
 * The fluid target: Auto (about 80 % of the sweat loss, at most 800 ml/h)
 * or Adjust (your own amount per hour), in ml or US fl oz per the UI
 * prefs; the recommended value, the guideline range and the sweat loss with
 * its "Why?", the drink-to-thirst note for short or cool events, the
 * projected scale change with its level, and the fluid and body-mass
 * warnings. Over-drinking gives two dangers that say the same thing; the
 * block shows the fluid one, which names the rates.
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function TargetsFluid({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { fluid, hydration, sweat } = plan;
  const recommended = fluid.recommended;
  const manual = inputs.fluid.mode === "manual";
  const imperial = f.unitSystem === "imperial";
  const [minMl, maxMl] = INPUT_LIMITS.manualMlPerHour;
  const unit = t("ui-setup-targets.unit.perHour", { unit: f.unit("volume") });

  const fluidWarningIds = new Set(fluid.warnings.map((warning) => warning.id));
  const warnings = [
    ...fluid.warnings,
    ...hydration.warnings.filter(
      (warning) => !(warning.id === "fluid.projectedGain" && fluidWarningIds.has("fluid.aboveSweat")),
    ),
  ];

  const setMode = (mode) => {
    if (mode === "manual" && inputs.fluid.mode !== "manual") {
      apply({ fluid: { mode: "manual", manualMlPerHour: fluid.mlPerHour } });
    } else {
      set("fluid.mode", mode);
    }
  };

  return (
    <TargetsBlock
      title={t("ui-setup-targets.fluid.title")}
      icon={GlassWater}
      iconClassName="text-fluid"
      headingLevel={headingLevel}
      actions={<TargetsModeSwitch label={t("ui-setup-targets.fluid.mode")} value={inputs.fluid.mode} onChange={setMode} />}
      warnings={warnings}
      data-testid="targets-fluid"
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        {manual ? (
          <NumberField
            label={t("ui-setup-targets.fluid.manual")}
            value={inputs.fluid.manualMlPerHour}
            onChange={(value) => set("fluid.manualMlPerHour", value)}
            toInput={(ml) => f.toDisplay("volume", ml)}
            fromInput={(shown) => f.fromDisplay("volume", shown)}
            min={f.toDisplay("volume", minMl)}
            max={f.toDisplay("volume", maxMl)}
            step={imperial ? 1 : 50}
            // Metric shows the stored ml (the plan keeps 0.01 ml); imperial shows the converted fl oz.
            digits={imperial ? 1 : FIELD_DIGITS}
            unit={unit}
            className="w-full max-w-60"
          />
        ) : (
          <TargetsValue
            label={t("ui-setup-targets.fluid.target")}
            value={f.volume(fluid.mlPerHour, { unit: false })}
            unit={unit}
            testId="fluid-value"
          />
        )}
        <p className="text-body-sm text-ink-2" data-testid="fluid-total">
          {/* The exact total in whole ml, as the board and the print view convert it (not 0.01 L first). */}
          {t("ui-setup-targets.fluid.total", { ml: Math.round(fluid.totalMl) })}
        </p>
      </div>
      <TargetsFacts>
        <TargetsFact term={t("ui-setup-targets.fluid.recommended")} testId="fluid-recommended">
          {t("ui-setup-targets.fluid.perHour", { ml: recommended.mlPerHour })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.fluid.range")} testId="fluid-range">
          {t("ui-setup-targets.fluid.rangeValue", { lo: recommended.range[0], hi: recommended.range[1] })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.fluid.sweat")} testId="fluid-sweat">
          {t("ui-setup-targets.fluid.sweatValue", { ml: Math.round(sweat.rateLph * 1000) })}
        </TargetsFact>
        <TargetsFact term={t("ui-setup-targets.fluid.bodyMass")}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span data-testid="fluid-body-mass">{f.mass(hydration.scaleChangeKg, { signed: true })}</span>
            <SweatProjectionLevel level={hydration.level} testId="fluid-body-mass-level" />
          </span>
        </TargetsFact>
      </TargetsFacts>
      {recommended.drinkToThirst ? (
        <TargetsNote icon={Info} data-testid="drink-to-thirst">
          <p>{t("ui-setup-targets.fluid.thirst")}</p>
        </TargetsNote>
      ) : null}
      <Why why={recommended.why} />
    </TargetsBlock>
  );
}

/**
 * "Advanced: potassium, magnesium, calcium": a collapsible block (its
 * heading is the disclosure button, styled like the other block headings)
 * with a switch per ion and the amount per hour each one adds (half of a
 * typical sweat loss), and the "Why?" that says they are optional. It opens
 * whenever an ion turns on, also after the first render (a share link is
 * restored after mount), and never closes by itself, so turning the last ion
 * off keeps the switch in view.
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function TargetsExtras({ headingLevel = 3, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const anyOn = TARGETS_EXTRA_IONS.some(({ key }) => inputs.extras[key]);
  const [open, setOpen] = useState(anyOn);
  const [wasOn, setWasOn] = useState(anyOn);
  if (anyOn !== wasOn) {
    setWasOn(anyOn);
    if (anyOn) setOpen(true);
  }

  return (
    <TargetsBlock
      title={t("ui-setup-targets.extras.title")}
      icon={SlidersHorizontal}
      headingLevel={headingLevel}
      expanded={open}
      onToggle={() => setOpen((value) => !value)}
      data-testid="targets-extras"
      className={className}
    >
      <div className="space-y-1">
        {TARGETS_EXTRA_IONS.map(({ key, ion }) => {
          const enabled = inputs.extras[key] === true;
          return (
            <Switch
              key={key}
              label={t(`ui-setup-targets.extras.${key}`)}
              checked={enabled}
              onChange={(checked) => set(`extras.${key}`, checked)}
              description={
                <span data-testid={`extra-${key}`} className="font-mono">
                  {enabled
                    ? t("ui-setup-targets.extras.perHour", { mg: plan.extras[ion].mgPerHour })
                    : t("ui-common.off")}
                </span>
              }
            />
          );
        })}
      </div>
      <Why why={plan.extras.why} />
    </TargetsBlock>
  );
}

/**
 * The one-line summary of the targets: "Carbs 75 g/h · 1:0.5 · Sodium
 * 300 mg/h · Fluid 100 ml/h", in the UI language and units.
 * @returns {string}
 */
export function useTargetsSummary() {
  const t = useT();
  const plan = usePlan();
  return t("ui-setup-targets.targets.summary", {
    g: roundTo(plan.carbs.gPerHour, 1),
    ratio: plan.carbs.ratio.value,
    mg: Math.round(plan.sodium.mgPerHour),
    ml: Math.round(plan.fluid.mlPerHour),
  });
}

/**
 * Every Targets block in order: carbohydrates, ratio, sodium, fluid,
 * advanced ions, with hairlines between them.
 * @param {{ headingLevel?: number, className?: string }} props  `headingLevel` of the blocks (default 3).
 */
export default function TargetsFields({ headingLevel = 3, className }) {
  return (
    <div className={cx("min-w-0 space-y-5 [&>*+*]:border-t [&>*+*]:border-line [&>*+*]:pt-5", className)}>
      <TargetsCarbs headingLevel={headingLevel} />
      <TargetsRatio headingLevel={headingLevel} />
      <TargetsSodium headingLevel={headingLevel} />
      <TargetsFluid headingLevel={headingLevel} />
      <TargetsExtras headingLevel={headingLevel} />
    </div>
  );
}
