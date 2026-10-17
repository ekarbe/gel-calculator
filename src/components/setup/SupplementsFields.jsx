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

import { useEffect, useId, useRef, useState } from "react";
import { Coffee, FlaskConical } from "lucide-react";
import Button from "../ui/Button";
import Lane from "../ui/Lane";
import NumberField from "../ui/NumberField";
import Segmented from "../ui/Segmented";
import Switch from "../ui/Switch";
import Why from "../ui/Why";
import { cx } from "../ui/cx";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { roundTo } from "../../domain/units";
import { elapsedText, spokenElapsedText } from "../schedule/scheduleText";
import { FIELD_DIGITS, TargetsBlock, TargetsFact, TargetsFacts, TargetsGroupLabel, roundField } from "./TargetsParts";

/*  The Caffeine & bicarbonate field groups. Each reads the plan and writes
    the plan inputs itself, so the section and the guided flow can use the
    same components. Every amount and time comes from the plan
    (`plan.caffeine`, `plan.bicarb`); the groups only format it. Times are
    written as the schedule writes them, through the same catalog keys and
    locale numbers (`elapsedText`: "T−1h 30m"); screen readers get the
    spoken form instead (`spokenElapsedText`: "1 h 30 min before the
    start"). The number fields show up to two decimals and commit at that
    precision (`roundField`), so a field shows the number the plan uses. */

/**
 * The body mass a dose hint names. In metric one decimal of kg, as the mass
 * field and the domain's own "Why?" text show it: a mass typed in lb is
 * stored as its exact conversion (160 lb = 72.5747… kg), which would
 * otherwise read "72.575 kg". In imperial the exact value, which the
 * placeholder rounds in lb ("160 lb"; rounding in kg first would give
 * "160.1 lb").
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {number} massKg
 * @returns {number}
 */
const shownMassKg = (t, massKg) => (t.unitSystem === "metric" ? roundTo(massKg, 1) : massKg);

/**
 * A time from the start: the short form on screen (hidden from screen
 * readers) and the spoken form for screen readers, as the schedule shows it.
 * @param {{ visible: string, spoken: string, className?: string }} props
 */
function SupplementsTime({ visible, spoken, className }) {
  return (
    <>
      <span aria-hidden="true" className={className}>
        {visible}
      </span>
      <span className="sr-only">{spoken}</span>
    </>
  );
}

/**
 * Caffeine: the on/off switch with its "Why?" (shown also while off), and
 * when on: the dose in mg/kg, "Add to gels as tablets" with the tablet size,
 * the planned doses (time, when, amount, tablets) with the total, and the
 * caffeine warnings (never pure caffeine powder, who should skip it, …).
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function SupplementsCaffeine({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const caffeine = plan.caffeine;
  const settings = inputs.caffeine;
  const [minMgPerKg, maxMgPerKg] = INPUT_LIMITS.caffeineMgPerKg;
  const tabletLabelId = useId();
  const tabletOptions = INPUT_OPTIONS.tabletMg.map((mg) => ({
    value: mg,
    label: t("ui-setup-targets.caffeine.tabletOption", { mg }),
  }));

  /** Where a dose is taken: before the start, with gel N, or on its own during the event. */
  const when = (dose) => {
    if (dose.kind === "pre") return t("ui-setup-targets.caffeine.when.pre");
    if (typeof dose.gelIndex === "number") return t("ui-setup-targets.caffeine.when.gel", { gel: dose.gelIndex + 1 });
    return t("ui-setup-targets.caffeine.when.intra");
  };

  return (
    <TargetsBlock
      title={t("ui-setup-targets.caffeine.title")}
      icon={Coffee}
      iconClassName="text-caffeine"
      headingLevel={headingLevel}
      warnings={caffeine.enabled ? caffeine.warnings : []}
      data-testid="supplements-caffeine"
      className={className}
    >
      <Switch
        label={t("ui-setup-targets.caffeine.include")}
        checked={settings.enabled}
        onChange={(checked) => set("caffeine.enabled", checked)}
      />
      <Why why={caffeine.why} />
      {caffeine.enabled ? (
        <div className="space-y-4">
          <NumberField
            label={t("ui-setup-targets.caffeine.dose")}
            value={settings.mgPerKg}
            onChange={(value) => set("caffeine.mgPerKg", roundField(value))}
            min={minMgPerKg}
            max={maxMgPerKg}
            step={0.5}
            digits={FIELD_DIGITS}
            unit={t("ui-setup-targets.unit.mgPerKg")}
            // The rule and the body mass only; the planned mg are the doses and the total below.
            hint={t("ui-setup-targets.caffeine.doseHint", { massKg: shownMassKg(t, inputs.athlete.massKg) })}
            className="max-w-72"
          />
          <div className="space-y-3 rounded-control border border-line px-3 py-2">
            <Switch
              label={t("ui-setup-targets.caffeine.asTablets")}
              description={t("ui-setup-targets.caffeine.asTabletsHint")}
              checked={settings.asIngredient}
              onChange={(checked) => set("caffeine.asIngredient", checked)}
            />
            {settings.asIngredient ? (
              <div className="pb-1">
                <TargetsGroupLabel id={tabletLabelId}>{t("ui-setup-targets.caffeine.tabletSize")}</TargetsGroupLabel>
                <Segmented
                  labelledBy={tabletLabelId}
                  value={settings.tabletMg}
                  onChange={(mg) => set("caffeine.tabletMg", mg)}
                  options={tabletOptions}
                  data-testid="caffeine-tablet-size"
                />
              </div>
            ) : null}
          </div>
          {caffeine.doses.length > 0 ? (
            <div>
              <p className="caption text-ink-2">{t("ui-setup-targets.caffeine.doses")}</p>
              <ul role="list" aria-label={t("ui-setup-targets.caffeine.dosesList")} className="mt-1">
                {caffeine.doses.map((dose) => (
                  <Lane
                    key={`${dose.kind}-${dose.timeMin}`}
                    as="li"
                    tone="caffeine"
                    label={
                      <>
                        <SupplementsTime
                          visible={elapsedText(t, f, dose.timeMin)}
                          spoken={spokenElapsedText(t, f, dose.timeMin)}
                          className="font-mono text-ink-2"
                        />{" "}
                        {when(dose)}
                      </>
                    }
                    amount={t("ui-setup-targets.caffeine.mg", { mg: dose.mg })}
                    detail={
                      typeof dose.tablets === "number"
                        ? t("ui-setup-targets.caffeine.tablets", { tablets: dose.tablets, tabletMg: settings.tabletMg })
                        : undefined
                    }
                  />
                ))}
              </ul>
              <p data-testid="caffeine-total" className="mt-1 text-body-sm text-ink-2">
                {t("ui-setup-targets.caffeine.total", {
                  mg: caffeine.totalMg,
                  mgPerKg: roundTo(caffeine.totalMgPerKg, 1),
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </TargetsBlock>
  );
}

/**
 * Sodium bicarbonate: for events up to 90 min (or when it is on) the
 * switch with its "Why?", and when on: the dose in g/kg, the dose in g, the
 * sodium it carries and when to take it, and the warnings. Longer events
 * hide it behind "Show sodium bicarbonate"; that button moves focus to the
 * switch. Once shown (or switched) it stays open, so turning it off on a
 * long event does not hide the switch the user just pressed.
 *
 * @param {{ headingLevel?: number, className?: string }} props
 */
export function SupplementsBicarb({ headingLevel = 3, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const bicarb = plan.bicarb;
  const settings = inputs.bicarb;
  const [minGPerKg, maxGPerKg] = INPUT_LIMITS.bicarbGPerKg;
  const [revealed, setRevealed] = useState(false);
  const switchId = useId();
  // Set by "Show sodium bicarbonate": focus the switch once it is rendered.
  const focusSwitch = useRef(false);

  useEffect(() => {
    if (!revealed || !focusSwitch.current) return;
    focusSwitch.current = false;
    document.getElementById(switchId)?.focus();
  }, [revealed, switchId]);

  if (!(bicarb.visibleByDefault || settings.enabled || revealed)) {
    return (
      <div className={cx("min-w-0", className)}>
        <Button
          variant="ghost"
          size="sm"
          icon={FlaskConical}
          onClick={() => {
            focusSwitch.current = true;
            setRevealed(true);
          }}
          data-testid="bicarb-show"
        >
          {t("ui-setup-targets.bicarb.show")}
        </Button>
      </div>
    );
  }

  return (
    <TargetsBlock
      title={t("ui-setup-targets.bicarb.title")}
      icon={FlaskConical}
      headingLevel={headingLevel}
      warnings={bicarb.enabled ? bicarb.warnings : []}
      data-testid="supplements-bicarb"
      className={className}
    >
      <Switch
        id={switchId}
        label={t("ui-setup-targets.bicarb.include")}
        description={t("ui-setup-targets.bicarb.includeHint")}
        checked={settings.enabled}
        onChange={(checked) => {
          // Keep the block open after turning it off on a long event.
          setRevealed(true);
          set("bicarb.enabled", checked);
        }}
      />
      <Why why={bicarb.why} />
      {bicarb.enabled ? (
        <div className="space-y-4">
          <NumberField
            label={t("ui-setup-targets.bicarb.dose")}
            value={settings.gPerKg}
            onChange={(value) => set("bicarb.gPerKg", roundField(value))}
            min={minGPerKg}
            max={maxGPerKg}
            step={0.01}
            digits={FIELD_DIGITS}
            unit={t("ui-setup-targets.unit.gPerKg")}
            hint={t("ui-setup-targets.bicarb.doseHint", { massKg: shownMassKg(t, inputs.athlete.massKg) })}
            className="max-w-72"
          />
          <TargetsFacts>
            <TargetsFact term={t("ui-setup-targets.bicarb.doseFact")} testId="bicarb-dose">
              {t("ui-setup-targets.bicarb.grams", { g: roundTo(bicarb.doseG, 1) })}
            </TargetsFact>
            <TargetsFact term={t("ui-setup-targets.bicarb.sodium")} testId="bicarb-sodium">
              {t("ui-setup-targets.bicarb.grams", { g: roundTo(bicarb.sodiumMg / 1000, 1) })}
            </TargetsFact>
            <TargetsFact term={t("ui-setup-targets.bicarb.timing")} testId="bicarb-timing" className="col-span-2">
              <SupplementsTime
                visible={t("ui-setup-targets.bicarb.timingValue", {
                  time: elapsedText(t, f, bicarb.timingMin.recommended),
                  earliest: elapsedText(t, f, bicarb.timingMin.earliest),
                  latest: elapsedText(t, f, bicarb.timingMin.latest),
                })}
                spoken={t("ui-setup-targets.bicarb.timingSpoken", {
                  time: spokenElapsedText(t, f, bicarb.timingMin.recommended),
                  earliest: spokenElapsedText(t, f, bicarb.timingMin.earliest),
                  latest: spokenElapsedText(t, f, bicarb.timingMin.latest),
                })}
              />
            </TargetsFact>
          </TargetsFacts>
        </div>
      ) : null}
    </TargetsBlock>
  );
}

/**
 * The one-line summary of the section: "Caffeine 210 mg · Bicarbonate off".
 * @returns {string}
 */
export function useSupplementsSummary() {
  const t = useT();
  const { caffeine, bicarb } = usePlan();
  return t("ui-setup-targets.supplements.summary", {
    caffeine: caffeine.enabled
      ? t("ui-setup-targets.supplements.summary.caffeineOn", { mg: caffeine.totalMg })
      : t("ui-setup-targets.supplements.summary.caffeineOff"),
    bicarb: bicarb.enabled
      ? t("ui-setup-targets.supplements.summary.bicarbOn", { g: roundTo(bicarb.doseG, 1) })
      : t("ui-setup-targets.supplements.summary.bicarbOff"),
  });
}

/**
 * Both blocks in order, caffeine then bicarbonate, with a hairline between them.
 * @param {{ headingLevel?: number, className?: string }} props  `headingLevel` of the blocks (default 3).
 */
export default function SupplementsFields({ headingLevel = 3, className }) {
  return (
    <div className={cx("min-w-0 space-y-5 [&>*+*]:border-t [&>*+*]:border-line [&>*+*]:pt-5", className)}>
      <SupplementsCaffeine headingLevel={headingLevel} />
      <SupplementsBicarb headingLevel={headingLevel} />
    </div>
  );
}
