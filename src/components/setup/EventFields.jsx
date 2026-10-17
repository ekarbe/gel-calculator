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

import { useId, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import NumberField from "../ui/NumberField";
import Select from "../ui/Select";
import Segmented from "../ui/Segmented";
import Icon from "../ui/Icon";
import { cx } from "../ui/cx";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { INPUT_LIMITS, INPUT_OPTIONS, SPORT_SPEED_RANGE_KMH, speedForSport } from "../../domain/plan";
import { paceFromSpeed, roundTo } from "../../domain/units";

/*  The Event field groups: sport, duration, intensity, the effort driver
    (speed with the running pace, cycling power, METs for other sports) and
    the setting. Each one reads and writes the plan inputs itself, so the
    Event section and the guided flow (step 1) use the same components.
    Values are stored in the plan's metric units (minutes, km/h, W) and shown
    in the unit system of the UI prefs (speed in mph, pace in min/mi). */

/** The longest event in minutes (48 h). */
const MAX_DURATION_MIN = INPUT_LIMITS.durationMin[1];

/** Decimals of the power field, shown and stored (0.1 W). */
const POWER_DIGITS = 1;

/** Keys that step a number field (they replace any typed text). */
const STEP_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown"]);

/**
 * The visible label of a group of controls that is not a single input (a
 * segmented choice), styled like a `Field` label.
 * @param {{ id: string, children: import('react').ReactNode }} props
 */
function GroupLabel({ id, children }) {
  return (
    <p id={id} className="caption mb-1 text-ink-2">
      {children}
    </p>
  );
}

/**
 * Sport: running, cycling or another sport, as a segmented choice. Running
 * and cycling share one speed, so a speed that does not fit the new sport
 * (a 30 km/h ride as a run) becomes that sport's typical speed
 * (`speedForSport`); other sports keep the speed for later. The third option
 * shows the short "Other" (three fit on a phone) and is named "Other sport".
 *
 * @param {{ className?: string }} props
 */
export function EventSportField({ className }) {
  const t = useT();
  const { inputs, apply } = usePlanInputs();
  const labelId = useId();
  const { sport, speedKmh } = inputs.event;
  const options = INPUT_OPTIONS.sport.map((value) =>
    value === "other"
      ? { value, label: t("ui-setup-event.sport.otherShort"), ariaLabel: t("ui-common.sport.other") }
      : { value, label: t(`ui-common.sport.${value}`) },
  );
  return (
    <div className={cx("min-w-0", className)}>
      <GroupLabel id={labelId}>{t("ui-setup-event.sport.label")}</GroupLabel>
      <Segmented
        labelledBy={labelId}
        value={sport}
        onChange={(next) => apply({ event: { sport: next, speedKmh: speedForSport(next, speedKmh) } })}
        options={options}
        fullWidth
        data-testid="event-sport"
      />
    </div>
  );
}

/**
 * Duration as hours and minutes (a group named "Duration"). The plan
 * stores minutes, at most 48 h. Both fields stay at 0 or more; minutes step
 * within 0–59, and a typed number of minutes above 59 carries into the
 * hours when the field is left (90 → 1 h 30 min). Fractions of an hour are
 * dropped.
 *
 * @param {{ className?: string }} props
 */
export function EventDurationField({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  // Minutes typed above 59, applied (carried into the hours) on blur.
  const carry = useRef(/** @type {number|null} */ (null));

  const totalMin = Math.max(0, Math.round(Number.isFinite(inputs.event.durationMin) ? inputs.event.durationMin : 0));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const setDuration = (h, m) => set("event.durationMin", Math.max(0, h * 60 + m));

  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className="caption mb-1 text-ink-2">{t("ui-setup-event.duration.label")}</legend>
      <div className="@container">
        <div className="grid grid-cols-1 gap-3 @min-[23rem]:grid-cols-2">
          <NumberField
            label={t("ui-setup-event.duration.hours")}
            labelHidden
            value={hours}
            onChange={(value) => setDuration(Math.max(0, Math.trunc(value)), minutes)}
            min={0}
            max={MAX_DURATION_MIN / 60}
            step={1}
            digits={0}
            unit={t("ui-setup-event.duration.hoursUnit")}
          />
          {/* The wrapper sees the minutes input's events after the field has handled them. */}
          <div
            className="min-w-0"
            onChange={(event) => {
              const n = f.parseNumber(/** @type {HTMLInputElement} */ (event.target).value);
              carry.current = Number.isFinite(n) && n > 59 ? Math.trunc(n) : null;
            }}
            onKeyDown={(event) => {
              if (STEP_KEYS.has(event.key)) carry.current = null;
            }}
            onClick={(event) => {
              // A stepper button sets the minutes itself.
              if (/** @type {HTMLElement} */ (event.target).closest("button")) carry.current = null;
            }}
            onBlur={() => {
              // The field has just committed the clamped value (59); the typed minutes replace it.
              if (carry.current !== null) setDuration(hours, carry.current);
              carry.current = null;
            }}
          >
            <NumberField
              label={t("ui-setup-event.duration.minutes")}
              labelHidden
              value={minutes}
              onChange={(value) => setDuration(hours, Math.max(0, Math.trunc(value)))}
              min={0}
              max={Math.max(0, Math.min(59, MAX_DURATION_MIN - hours * 60))}
              step={1}
              digits={0}
              unit={t("ui-setup-event.duration.minutesUnit")}
            />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

/**
 * Intensity: easy, moderate, hard or race, each with its heart-rate zone.
 * @param {{ className?: string }} props
 */
export function EventIntensityField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const options = INPUT_OPTIONS.intensity.map((level) => ({
    value: level,
    label: t("ui-setup-event.intensity.option", {
      name: t(`ui-common.intensity.${level}`),
      zone: t(`ui-setup-event.intensity.zone.${level}`),
    }),
  }));
  return (
    <Select
      label={t("ui-setup-event.intensity.label")}
      value={inputs.event.intensity}
      onChange={(value) => set("event.intensity", value)}
      options={options}
      className={className}
    />
  );
}

/**
 * Speed (running and cycling) in km/h or mph. For running the hint shows
 * the pace (min/km or min/mi) and, above the fastest plausible running
 * speed, a warning (icon and text) to check it. The warning sits in a polite
 * live region (`role="status"`, mounted with the running hint, only its
 * content toggles), so screen readers announce it while focus stays in the
 * field; the pace is outside it, so it is not re-read on every keystroke.
 * @param {{ className?: string }} props
 */
export function EventSpeedField({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const { sport, speedKmh } = inputs.event;
  const [minKmh, maxKmh] = INPUT_LIMITS.speedKmh;
  const isRunning = sport === "running";
  const implausible = isRunning && speedKmh > SPORT_SPEED_RANGE_KMH.running[1];

  const hint = isRunning ? (
    <>
      <span>
        {t("ui-setup-event.speed.pace")} <span className="num font-medium text-ink">{f.pace(paceFromSpeed(speedKmh))}</span>
      </span>
      <span role="status" className="block" data-testid="pace-status">
        {implausible ? (
          <>
            {" "}
            <span data-testid="pace-implausible" className="mt-1 flex items-start gap-1.5 font-medium text-warn">
              <Icon icon={TriangleAlert} size={16} className="mt-0.5" />
              <span>
                <span className="sr-only">{t("ui-common.level.warning")}: </span>
                {t("ui-setup-event.speed.implausible")}
              </span>
            </span>
          </>
        ) : null}
      </span>
    </>
  ) : undefined;

  return (
    <NumberField
      label={t("ui-setup-event.speed.label")}
      value={speedKmh}
      onChange={(value) => set("event.speedKmh", value)}
      toInput={(kmh) => f.toDisplay("speed", kmh)}
      fromInput={(shown) => f.fromDisplay("speed", shown)}
      min={f.toDisplay("speed", minKmh)}
      max={f.toDisplay("speed", maxKmh)}
      step={isRunning ? 0.1 : 0.5}
      digits={1}
      unit={f.unit("speed")}
      hint={hint}
      className={className}
    />
  );
}

/**
 * Cycling power in W. 0 (or an empty field) means "estimate it from the
 * speed"; the hint then shows the power the sweat estimate used. Typed power
 * is kept to 0.1 W, the precision the field shows, so the field always shows
 * the power the estimate uses.
 * @param {{ className?: string }} props
 */
export function EventPowerField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const estimate = plan.sweat.estimate;
  const [minW, maxW] = INPUT_LIMITS.powerW;
  const fromSpeed = inputs.event.sport === "cycling" && estimate.powerFromSpeed;
  return (
    <NumberField
      label={t("ui-setup-event.power.label")}
      value={inputs.event.powerW}
      onChange={(value) => set("event.powerW", roundTo(value, POWER_DIGITS))}
      min={minW}
      max={maxW}
      step={5}
      digits={POWER_DIGITS}
      emptyValue={0}
      unit={t("ui-setup-event.power.unit")}
      hint={
        <>
          <span>{t("ui-setup-event.power.hint")}</span>
          {fromSpeed ? (
            <>
              {" "}
              <span className="block" data-testid="power-estimate">
                {t("ui-setup-event.power.estimated", { watts: Math.round(estimate.powerW) })}
              </span>
            </>
          ) : null}
        </>
      }
      className={className}
    />
  );
}

/**
 * Effort in METs for sports other than running and cycling (1 MET = sitting
 * at rest), with examples in the hint.
 * @param {{ className?: string }} props
 */
export function EventMetsField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const [minMets, maxMets] = INPUT_LIMITS.mets;
  return (
    <NumberField
      label={t("ui-setup-event.mets.label")}
      value={inputs.event.mets}
      onChange={(value) => set("event.mets", value)}
      min={minMets}
      max={maxMets}
      step={0.5}
      digits={1}
      unit={t("ui-setup-event.mets.unit")}
      hint={t("ui-setup-event.mets.hint")}
      className={className}
    />
  );
}

/**
 * What drives the effort of the chosen sport: speed (running and cycling)
 * plus power (cycling), or METs (other sports). Side by side when there is
 * room (28 rem), stacked otherwise.
 * @param {{ className?: string }} props
 */
export function EventEffortFields({ className }) {
  const { inputs } = usePlanInputs();
  const { sport } = inputs.event;
  const usesSpeed = sport === "running" || sport === "cycling";
  return (
    <div className={cx("@container min-w-0", className)}>
      <div className="grid grid-cols-1 gap-4 @min-[28rem]:grid-cols-2">
        {usesSpeed ? <EventSpeedField /> : <EventMetsField />}
        {sport === "cycling" ? <EventPowerField /> : null}
      </div>
    </div>
  );
}

/**
 * Setting: outdoors, indoors with a fan or indoors without one (air speed
 * and sun in the sweat estimate).
 * @param {{ className?: string }} props
 */
export function EventSettingField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const options = INPUT_OPTIONS.setting.map((value) => ({ value, label: t(`ui-common.setting.${value}`) }));
  return (
    <Select
      label={t("ui-setup-event.setting.label")}
      value={inputs.event.setting}
      onChange={(value) => set("event.setting", value)}
      options={options}
      className={className}
    />
  );
}

/**
 * The one-line summary of the event: "3 h · Cycling · Moderate" (with the
 * full sport names: "3 h · Other sport · Moderate").
 * @returns {string}
 */
export function useEventSummary() {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const { durationMin, sport, intensity } = inputs.event;
  return t("ui-setup-event.event.summary", {
    duration: f.duration(durationMin),
    sport: t(`ui-common.sport.${sport}`),
    intensity: t(`ui-common.intensity.${intensity}`),
  });
}

/**
 * Every Event field in order: sport, duration, intensity, effort, setting.
 * @param {{ className?: string }} props
 */
export default function EventFields({ className }) {
  return (
    <div className={cx("min-w-0 space-y-4", className)}>
      <EventSportField />
      <EventDurationField />
      <EventIntensityField />
      <EventEffortFields />
      <EventSettingField />
    </div>
  );
}
