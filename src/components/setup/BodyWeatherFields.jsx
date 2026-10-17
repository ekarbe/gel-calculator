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

import { useContext, useId } from "react";
import NumberField from "../ui/NumberField";
import Select from "../ui/Select";
import Segmented from "../ui/Segmented";
import Switch from "../ui/Switch";
import { cx } from "../ui/cx";
import { usePlanInputs } from "../../state/PlanProvider";
import { UiContext } from "../../state/UiProvider";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { UNIT_SYSTEMS, roundTo } from "../../domain/units";

/*  The Body & weather field groups: the unit system switch, body mass,
    height, heat acclimatisation, temperature, humidity and sun.
    Each one reads and writes the plan inputs itself, so the Body & weather
    section and the guided flow (step 2) use the same components. The plan
    stores kg, cm and °C; the fields show the unit system of the UI prefs
    (lb, in, °F) and convert typed values back (`useFormat().fromDisplay`). */

/** Decimals of the humidity field, shown and stored (0.1 %). */
const HUMIDITY_DIGITS = 1;

/**
 * The unit system switch (metric or imperial), a quick way to the app-wide
 * pref that Settings also holds. It changes every quantity in the app (speed
 * and fluid too), so it sits above the Body and Weather groups, not next to
 * one field, and its visible name and hint say it applies to the whole app.
 * Renders nothing outside a `UiProvider`.
 * @param {{ className?: string }} props
 */
export function BodyWeatherUnitsField({ className }) {
  const t = useT();
  const ui = useContext(UiContext);
  const labelId = useId();
  const hintId = useId();
  if (!ui) return null;
  return (
    <div className={cx("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p id={labelId} className="caption text-ink-2">
          {t("ui-setup-event.units.label")}
        </p>
        <Segmented
          size="sm"
          labelledBy={labelId}
          aria-describedby={hintId}
          value={ui.unitSystem}
          onChange={ui.setUnitSystem}
          options={UNIT_SYSTEMS.map((system) => ({ value: system, label: t(`ui-setup-event.units.${system}`) }))}
          data-testid="units-switch"
        />
      </div>
      <p id={hintId} className="mt-1 text-body-sm text-muted">
        {t("ui-setup-event.units.hint")}
      </p>
    </div>
  );
}

/**
 * Body mass in kg or lb (stored in kg).
 * @param {{ className?: string }} props
 */
export function BodyWeatherMassField({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const [minKg, maxKg] = INPUT_LIMITS.massKg;
  const imperial = f.unitSystem === "imperial";
  return (
    <NumberField
      label={t("ui-setup-event.mass.label")}
      value={inputs.athlete.massKg}
      onChange={(kg) => set("athlete.massKg", kg)}
      toInput={(kg) => f.toDisplay("mass", kg)}
      fromInput={(shown) => f.fromDisplay("mass", shown)}
      min={f.toDisplay("mass", minKg)}
      max={f.toDisplay("mass", maxKg)}
      step={imperial ? 1 : 0.5}
      digits={1}
      unit={f.unit("mass")}
      className={className}
    />
  );
}

/**
 * Height in cm or inches (stored in cm). In imperial the hint shows it in
 * feet and inches too.
 * @param {{ className?: string }} props
 */
export function BodyWeatherHeightField({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const [minCm, maxCm] = INPUT_LIMITS.heightCm;
  const imperial = f.unitSystem === "imperial";
  return (
    <NumberField
      label={t("ui-setup-event.height.label")}
      value={inputs.athlete.heightCm}
      onChange={(cm) => set("athlete.heightCm", cm)}
      toInput={(cm) => f.toDisplay("height", cm)}
      fromInput={(shown) => f.fromDisplay("height", shown)}
      min={f.toDisplay("height", minCm)}
      max={f.toDisplay("height", maxCm)}
      step={imperial ? 0.5 : 1}
      digits={1}
      unit={f.unit("height")}
      hint={imperial ? f.height(inputs.athlete.heightCm) : undefined}
      className={className}
    />
  );
}

/**
 * Heat acclimatisation (a switch). It moves the heat strain limit, not the
 * sweat estimate.
 * @param {{ className?: string }} props
 */
export function BodyWeatherAcclimatisedField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  return (
    <Switch
      label={t("ui-setup-event.acclimatised.label")}
      description={t("ui-setup-event.acclimatised.hint")}
      checked={inputs.athlete.acclimatised}
      onChange={(checked) => set("athlete.acclimatised", checked)}
      className={className}
    />
  );
}

/**
 * Air temperature in °C or °F (stored in °C). The only field here that takes
 * negative numbers, so `NumberField` asks for the text keyboard (its minimum
 * is below 0): the decimal keypad of phones (iOS) has no minus key. "-5"
 * and "−5" both parse.
 * @param {{ className?: string }} props
 */
export function BodyWeatherTemperatureField({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const [minC, maxC] = INPUT_LIMITS.tempC;
  return (
    <NumberField
      label={t("ui-setup-event.temperature.label")}
      value={inputs.environment.tempC}
      onChange={(celsius) => set("environment.tempC", celsius)}
      toInput={(celsius) => f.toDisplay("temp", celsius)}
      fromInput={(shown) => f.fromDisplay("temp", shown)}
      min={f.toDisplay("temp", minC)}
      max={f.toDisplay("temp", maxC)}
      step={1}
      digits={1}
      unit={f.unit("temp")}
      hint={t("ui-setup-event.temperature.hint")}
      className={className}
    />
  );
}

/**
 * Relative humidity in % (0–100). The field shows 0.1 % and typed humidity
 * is stored to 0.1 %, so the field shows the humidity the sweat estimate
 * uses (a 62.5 % from a link or autosave reads 62.5, not 63).
 * @param {{ className?: string }} props
 */
export function BodyWeatherHumidityField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const [minPct, maxPct] = INPUT_LIMITS.humidity;
  return (
    <NumberField
      label={t("ui-setup-event.humidity.label")}
      value={inputs.environment.humidity}
      onChange={(pct) => set("environment.humidity", roundTo(pct, HUMIDITY_DIGITS))}
      min={minPct}
      max={maxPct}
      step={5}
      digits={HUMIDITY_DIGITS}
      unit={t("ui-setup-event.humidity.unit")}
      className={className}
    />
  );
}

/**
 * Sun: shade, partly sunny or full sun. Indoors the hint says it only
 * counts outdoors (the choice is kept for when the session moves outside).
 * @param {{ className?: string }} props
 */
export function BodyWeatherSunField({ className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const indoors = inputs.event.setting !== "outdoor";
  const options = INPUT_OPTIONS.sun.map((value) => ({ value, label: t(`ui-common.sun.${value}`) }));
  return (
    <Select
      label={t("ui-setup-event.sun.label")}
      value={inputs.environment.sun}
      onChange={(value) => set("environment.sun", value)}
      options={options}
      hint={indoors ? t("ui-setup-event.sun.indoors") : undefined}
      className={className}
    />
  );
}

/**
 * The one-line summary of body and weather: "70 kg · 20 °C · 50%" (in the
 * unit system of the prefs).
 * @returns {string}
 */
export function useBodyWeatherSummary() {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  // Formatted here (rounded to 0.1 in either unit system): a mass typed in lb is stored with many decimals.
  return t("ui-setup-event.bodyWeather.summary", {
    mass: f.mass(inputs.athlete.massKg),
    temp: f.temp(inputs.environment.tempC),
    humidity: f.percent(inputs.environment.humidity),
  });
}

/** Classes of a group heading inside the section. */
const LEGEND_CLASSES = "mb-3 text-body-sm font-semibold text-ink";

/**
 * The body fields (a group named "Body"): mass, height, acclimatisation.
 * @param {{ className?: string }} props
 */
export function BodyWeatherBodyFields({ className }) {
  const t = useT();
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className={LEGEND_CLASSES}>{t("ui-setup-event.bodyWeather.body")}</legend>
      <div className="space-y-4">
        <BodyWeatherMassField />
        <BodyWeatherHeightField />
        <BodyWeatherAcclimatisedField />
      </div>
    </fieldset>
  );
}

/**
 * The weather fields (a group named "Weather"): temperature and humidity
 * (side by side when there is room, 28 rem), then sun.
 * @param {{ className?: string }} props
 */
export function BodyWeatherWeatherFields({ className }) {
  const t = useT();
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className={LEGEND_CLASSES}>{t("ui-setup-event.bodyWeather.weather")}</legend>
      <div className="@container">
        <div className="grid grid-cols-1 gap-4 @min-[28rem]:grid-cols-2">
          <BodyWeatherTemperatureField />
          <BodyWeatherHumidityField />
          <BodyWeatherSunField className="@min-[28rem]:col-span-2" />
        </div>
      </div>
    </fieldset>
  );
}

/**
 * Every Body & weather field: the unit system switch, the body group, then
 * the weather group.
 * @param {{ className?: string, unitSwitch?: boolean }} props
 *   `unitSwitch` (default true) shows {@link BodyWeatherUnitsField} at the top.
 */
export default function BodyWeatherFields({ className, unitSwitch = true }) {
  return (
    <div className={cx("min-w-0 space-y-6", className)}>
      {unitSwitch ? <BodyWeatherUnitsField className="border-b border-line pb-4" /> : null}
      <BodyWeatherBodyFields />
      <div className="border-t border-line pt-4">
        <BodyWeatherWeatherFields />
      </div>
    </div>
  );
}
