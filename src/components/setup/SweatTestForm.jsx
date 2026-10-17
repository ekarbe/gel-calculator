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

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, ClipboardList, TriangleAlert } from "lucide-react";
import Button from "../ui/Button";
import Field, { CONTROL_CLASSES } from "../ui/Field";
import Icon from "../ui/Icon";
import NumberField from "../ui/NumberField";
import Select from "../ui/Select";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS, INPUT_OPTIONS, speedForSport } from "../../domain/plan";
import { sweatTestRate } from "../../domain/sweat";
import { roundTo } from "../../domain/units";
import { rateForText } from "./SweatHelpers";

/** @typedef {import('./SweatHelpers').SweatTestDraft} SweatTestDraft */

/**
 * Add/edit form for one sweat test. It keeps its own draft until "Save
 * test", so the plan does not change while the user types. The fields show
 * the unit system from the UI prefs (kg or lb, L or fl oz, km/h or mph, °C
 * or °F) and the draft stays in the plan's units, so a field the user does
 * not touch is saved unchanged; typed values convert back and are rounded
 * (mass to 1 g, volumes to 1 ml, speed and temperature to 0.01). The form
 * shows the test protocol and a live preview of the result
 * (`sweatTestRate`, the same numbers the plan uses). The form's heading
 * gets the focus when the form opens (not the date field, which would open
 * the iOS date picker at once); Escape cancels.
 *
 * Enter submits without leaving the field, and a number field keeps a typed
 * number outside its range (or text that is no number) until it loses focus.
 * So "Save test" first commits the focused field. When that changes what the
 * field shows (the number was clamped to its range, or the field went back
 * to its last value), the form stays open with the focus on that field, so
 * the user sees the value before it is saved; the next Enter saves it.
 * The body masses carry their unit (kg or lb) in their accessible name, as
 * they start empty and an empty number field has no value text.
 *
 * @param {{ idPrefix: string, mode: 'add'|'edit', initial: SweatTestDraft,
 *   onSave: (draft: SweatTestDraft) => void, onCancel: () => void, headingLevel?: number }} props
 *   `idPrefix` makes the field ids unique; `headingLevel` is the form title's level (default 3).
 */
export default function SweatTestForm({ idPrefix, mode, initial, onSave, onCancel, headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const [draft, setDraft] = useState(initial);
  // The latest draft, for a save right after a field commits (before React renders the new state).
  const draftRef = useRef(initial);
  const headingRef = useRef(/** @type {HTMLHeadingElement|null} */ (null));
  const id = (name) => `${idPrefix}-${name}`;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  /** @param {SweatTestDraft} next */
  const change = (next) => {
    draftRef.current = next;
    setDraft(next);
  };
  const update = (patch) => change({ ...draftRef.current, ...patch });
  const updateConditions = (patch) =>
    change({ ...draftRef.current, conditions: { ...draftRef.current.conditions, ...patch } });

  /**
   * Commits the focused input of the form (its blur handler) and renders the result. Returns false when that
   * changed what the field shows for a typed value that was no number in the field's range: the field then has
   * the focus again and the save waits.
   * @param {HTMLFormElement} formElement
   * @returns {boolean}
   */
  const commitFocusedField = (formElement) => {
    const field = document.activeElement;
    if (!(field instanceof HTMLInputElement) || !formElement.contains(field)) return true;
    const typed = field.value;
    flushSync(() => field.blur());
    if (field.value === typed) return true;
    const min = field.getAttribute("aria-valuemin");
    const max = field.getAttribute("aria-valuemax");
    const accepts = (n) => Number.isFinite(n) && (min === null || n >= Number(min)) && (max === null || n <= Number(max));
    // The same reading as the field's own (NumberField): a lone separator may be the decimal one.
    if (accepts(f.parseInRange(typed, accepts))) return true; // Only the formatting changed (e.g. "70.0" → "70").
    field.focus();
    return false;
  };

  const L = INPUT_LIMITS;
  const imperial = f.unitSystem === "imperial";
  /** NumberField props for a quantity of `kind` stored in metric (`digits`: decimals kept when typed). */
  const quantity = (kind, keepDigits) => ({
    unit: f.unit(kind),
    toInput: (metric) => f.toDisplay(kind, metric),
    fromInput: (shown) => roundTo(f.fromDisplay(kind, shown), keepDigits),
  });
  const c = draft.conditions;
  const result = sweatTestRate(draft, inputs.athlete, null);
  const headingId = id("heading");
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 3))}`;
  const option = (prefix) => (value) => ({ value, label: t(`ui-common.${prefix}.${value}`) });
  /** A label with the unit for screen readers only (the visible unit is the field's suffix). */
  const withUnit = (text, kind) => (
    <>
      {text} <span className="sr-only">{t("ui-setup-sweat.form.unitInName", { unit: f.unit(kind) })}</span>
    </>
  );
  const grid = "grid grid-cols-1 gap-3 @md:grid-cols-2";

  return (
    <form
      aria-labelledby={headingId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (commitFocusedField(event.currentTarget)) onSave(draftRef.current);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="@container space-y-4 rounded-panel border border-line-strong bg-surface p-3 lg:p-4"
    >
      <Heading id={headingId} ref={headingRef} tabIndex={-1} className="display-title text-ink">
        {mode === "edit" ? t("ui-setup-sweat.form.editTitle") : t("ui-setup-sweat.form.addTitle")}
      </Heading>

      <div className="flex items-start gap-2 rounded-control border border-line bg-surface-2 p-3 text-body-sm text-ink-2">
        <Icon icon={ClipboardList} size={18} className="mt-0.5 text-ink-2" />
        <p>
          <span className="font-semibold text-ink">{t("ui-setup-sweat.form.howTo")}</span> {t("sweat.test.protocol")}
        </p>
      </div>

      <div className={grid}>
        <Field label={t("ui-setup-sweat.form.date")} id={id("date")}>
          <input
            type="date"
            value={draft.date}
            onChange={(event) => update({ date: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>
        <Field label={t("ui-setup-sweat.form.name")} id={id("label")}>
          <input
            type="text"
            value={draft.label}
            maxLength={L.testLabelChars[1]}
            placeholder={t("ui-setup-sweat.form.namePlaceholder")}
            autoComplete="off"
            onChange={(event) => update({ label: event.target.value })}
            className={CONTROL_CLASSES}
          />
        </Field>
        <NumberField
          id={id("pre")}
          label={withUnit(t("ui-setup-sweat.form.preMass"), "mass")}
          labelText={t("ui-setup-sweat.form.preMass")}
          value={draft.preKg}
          onChange={(kg) => update({ preKg: kg })}
          {...quantity("mass", 3)}
          min={0}
          max={f.toDisplay("mass", L.testMassKg[1])}
          step={0.1}
          digits={imperial ? 1 : 3}
          emptyValue={0}
          blankZero
        />
        <NumberField
          id={id("post")}
          label={withUnit(t("ui-setup-sweat.form.postMass"), "mass")}
          labelText={t("ui-setup-sweat.form.postMass")}
          value={draft.postKg}
          onChange={(kg) => update({ postKg: kg })}
          {...quantity("mass", 3)}
          min={0}
          max={f.toDisplay("mass", L.testMassKg[1])}
          step={0.1}
          digits={imperial ? 1 : 3}
          emptyValue={0}
          blankZero
        />
        <NumberField
          id={id("fluid")}
          label={t("ui-setup-sweat.form.fluid")}
          value={draft.fluidL}
          onChange={(litres) => update({ fluidL: litres })}
          {...quantity("volumeL", 3)}
          min={0}
          max={f.toDisplay("volumeL", L.testFluidL[1])}
          step={imperial ? 1 : 0.05}
          digits={imperial ? 1 : 3}
          emptyValue={0}
        />
        <NumberField
          id={id("urine")}
          label={t("ui-setup-sweat.form.urine")}
          value={draft.urineL}
          onChange={(litres) => update({ urineL: litres })}
          {...quantity("volumeL", 3)}
          min={0}
          max={f.toDisplay("volumeL", L.testUrineL[1])}
          step={imperial ? 1 : 0.05}
          digits={imperial ? 1 : 3}
          emptyValue={0}
        />
        <NumberField
          id={id("duration")}
          label={t("ui-setup-sweat.form.duration")}
          unit={t("ui-setup-sweat.unit.minutes")}
          value={draft.durationMin}
          onChange={(minutes) => update({ durationMin: minutes })}
          min={L.testDurationMin[0]}
          max={L.testDurationMin[1]}
          step={1}
          emptyValue={0}
        />
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-body-sm font-semibold text-ink">{t("ui-setup-sweat.form.conditions")}</legend>
        <div className={grid}>
          <Select
            id={id("sport")}
            label={t("ui-setup-sweat.form.sport")}
            value={c.sport}
            onChange={(sport) => updateConditions({ sport, speedKmh: speedForSport(sport, c.speedKmh) })}
            options={INPUT_OPTIONS.sport.map(option("sport"))}
          />
          {c.sport !== "other" ? (
            <NumberField
              id={id("speed")}
              label={t("ui-setup-sweat.form.speed")}
              value={c.speedKmh}
              onChange={(kmh) => updateConditions({ speedKmh: kmh })}
              {...quantity("speed", 2)}
              min={f.toDisplay("speed", L.speedKmh[0])}
              max={f.toDisplay("speed", L.speedKmh[1])}
              step={0.5}
            />
          ) : null}
          {c.sport === "cycling" ? (
            <NumberField
              id={id("power")}
              label={t("ui-setup-sweat.form.power")}
              unit={t("ui-setup-sweat.unit.watts")}
              hint={t("ui-setup-sweat.form.powerHint")}
              value={c.powerW}
              onChange={(watts) => updateConditions({ powerW: watts })}
              min={L.powerW[0]}
              max={L.powerW[1]}
              step={5}
            />
          ) : null}
          {c.sport === "other" ? (
            <NumberField
              id={id("mets")}
              label={t("ui-setup-sweat.form.mets")}
              unit={t("ui-setup-sweat.unit.mets")}
              value={c.mets}
              onChange={(mets) => updateConditions({ mets })}
              min={L.mets[0]}
              max={L.mets[1]}
              step={0.5}
            />
          ) : null}
          <Select
            id={id("setting")}
            label={t("ui-setup-sweat.form.setting")}
            value={c.setting}
            onChange={(setting) => updateConditions({ setting })}
            options={INPUT_OPTIONS.setting.map(option("setting"))}
          />
          <NumberField
            id={id("temp")}
            label={t("ui-setup-sweat.form.temp")}
            value={c.tempC}
            onChange={(celsius) => updateConditions({ tempC: celsius })}
            {...quantity("temp", 2)}
            min={f.toDisplay("temp", L.tempC[0])}
            max={f.toDisplay("temp", L.tempC[1])}
            step={1}
          />
          <NumberField
            id={id("humidity")}
            label={t("ui-setup-sweat.form.humidity")}
            unit={t("ui-setup-sweat.unit.percent")}
            value={c.humidity}
            onChange={(humidity) => updateConditions({ humidity })}
            min={L.humidity[0]}
            max={L.humidity[1]}
            step={5}
          />
          {c.setting === "outdoor" ? (
            <Select
              id={id("sun")}
              label={t("ui-setup-sweat.form.sun")}
              value={c.sun}
              onChange={(sun) => updateConditions({ sun })}
              options={INPUT_OPTIONS.sun.map(option("sun"))}
            />
          ) : null}
        </div>
      </fieldset>

      <div aria-live="polite" data-testid="sweat-test-preview" className="text-body-sm text-ink">
        {result.valid ? (
          <p className="font-semibold">{t("ui-setup-sweat.form.preview", { rateLph: rateForText(result.rateLph) })}</p>
        ) : (
          <ul role="list" className="space-y-1">
            {result.problems.map((problem, index) => (
              <li key={`${problem.key}-${index}`} className="flex items-start gap-1.5">
                <Icon icon={TriangleAlert} size={16} className="mt-0.5 text-warn" />
                <span>{t(problem)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={Check} className="font-semibold">
          {t("ui-setup-sweat.form.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("ui-setup-sweat.form.cancel")}
        </Button>
      </div>
    </form>
  );
}
