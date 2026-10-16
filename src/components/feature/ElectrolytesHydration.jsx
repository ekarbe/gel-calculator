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
import {
  ChevronDown,
  ClipboardList,
  Droplet,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Card from "../shared/Card";
import TooltipInfo from "../shared/TooltipInfo";
import Why from "../shared/Why";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import Segmented, { AUTO_ADJUST_OPTIONS } from "../shared/Segmented";
import BodyMassLevel from "../shared/BodyMassLevel";
import useFocusAfterRender from "../shared/useFocusAfterRender";
import { fmt } from "../shared/format";
import { bodyMassText } from "../shared/bodyMass";
import { LB_PER_KG } from "../shared/units";
import { SETTING_LABELS, SPORT_LABELS, SUN_LABELS } from "../shared/labels";
import { customDisplayName } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { useUi } from "../../state/UiProvider";
import { INPUT_LIMITS, INPUT_OPTIONS, speedForSport } from "../../domain/plan";
import { SWEAT_RATE_PRESETS_LPH, SWEAT_SODIUM_PRESETS_MMOL, sweatTestRate } from "../../domain/sweat";
import { MG_PER_MMOL, saltProfile } from "../../domain/electrolytes";
import { DEFICIT_MILD_PCT } from "../../domain/hydration";
import { formatAmount } from "../../domain/recipe";
import { t } from "../../i18n";
import { electrolyteSourceOptions, SWEAT_RATE_DESCRIPTIONS, SALTINESS_DESCRIPTIONS } from "../../constants/constants";

/** @typedef {import('../../domain/plan').PlanInputs} PlanInputs */
/** @typedef {import('../../domain/plan').SweatTest} SweatTest */
/** @typedef {import('../../domain/plan').SweatTestConditions} SweatTestConditions */
/** @typedef {import('../../domain/plan').CustomSalt} CustomSalt */

/**
 * A sweat test being typed in the form. Same fields as {@link SweatTest}
 * without the id, always in kg and °C (the form converts for display).
 * @typedef {Omit<SweatTest, 'id'>} SweatTestDraft
 */

/** Labels for the enumerated inputs this card shows or edits. */
const SODIUM_SALT_LABELS = { table: "Table salt", citrate: "Sodium citrate", mix: "50:50 mix" };

/** Optional ions under "Advanced": input key and plan key. */
const EXTRAS = [
  { key: "potassium", ion: "Potassium" },
  { key: "magnesium", ion: "Magnesium" },
  { key: "calcium", ion: "Calcium" },
];

/** Where the sweat rate comes from. */
const SWEAT_SOURCE_OPTIONS = [
  { value: "test", label: "Test" },
  { value: "estimate", label: "Estimate" },
  { value: "preset", label: "Presets" },
];

/** Label fields of a custom salt: % of the salt's mass for each element. */
const CUSTOM_SALT_FIELDS = [
  { key: "sodiumPct", label: "Sodium (Na)" },
  { key: "potassiumPct", label: "Potassium (K)" },
  { key: "magnesiumPct", label: "Magnesium (Mg)" },
  { key: "calciumPct", label: "Calcium (Ca)" },
  { key: "chloridePct", label: "Chloride (Cl)" },
];

/** Badge look and text for each `compareIons` status (ink colors keep the text readable in light mode). */
const STATUS_STYLES = {
  met: "text-apple-green-ink bg-apple-green/10 border-apple-green/30",
  short: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30",
  over: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30",
};

/** Salt mode choice: the salts follow the targets, or the user lists them. */
const SALT_MODE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
];

const INPUT_CLASS =
  "w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card focus:ring-2 focus:ring-apple-blue";
const SMALL_INPUT_CLASS =
  "w-full px-3 py-2 text-sm border border-card-border rounded-lg outline-none font-medium text-text-primary bg-card focus:ring-2 focus:ring-apple-blue";
const LABEL_CLASS = "block text-sm font-medium text-text-primary mb-1.5";
const SMALL_LABEL_CLASS = "block text-xs font-medium text-text-primary mb-1";
const PANEL_CLASS = "bg-card-border/30 rounded-xl p-5 border border-card-border";
const LINK_BUTTON_CLASS =
  "text-sm text-apple-blue font-medium flex items-center gap-1 hover:underline disabled:opacity-50 disabled:no-underline";
const ICON_BUTTON_CLASS = "text-text-secondary hover:text-text-primary p-2 rounded-lg";

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
const round3 = (x) => Math.round(x * 1000) / 1000;
const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => ((f - 32) * 5) / 9;

/**
 * °C in the display unit the user picked.
 * @param {number} tempC
 * @param {'C'|'F'} unit
 * @returns {string}
 */
function formatTemp(tempC, unit) {
  return unit === "F" ? `${fmt(cToF(tempC))} °F` : `${fmt(tempC, 1)} °C`;
}

/**
 * Text before the colon of a preset description ("Light sweating").
 * @param {string|undefined} description
 * @returns {string}
 */
const shortDescription = (description) => String(description ?? "").split(":")[0];

/**
 * Today's date as 'YYYY-MM-DD' in local time (default date of a new test).
 * @returns {string}
 */
function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The name a sweat test is shown with: its label, else "Sweat test N".
 * @param {SweatTest} test
 * @param {number} index
 * @returns {string}
 */
const testName = (test, index) => test.label.trim() || `Sweat test ${index + 1}`;

/**
 * The name a custom salt is shown with: its name, else "Custom salt N".
 * @param {CustomSalt} salt
 * @returns {string}
 */
const customSaltName = (salt) => customDisplayName("salt", salt);

/**
 * A short description of exercise conditions ("Cycling at 30 km/h,
 * outdoors, 20 °C, 50% humidity, shade or overcast").
 * @param {SweatTestConditions} c
 * @param {'C'|'F'} tempUnit
 * @param {number} [derivedPowerW]  Cycling power the model derived from the speed, shown after it.
 * @returns {string}
 */
function describeConditions(c, tempUnit, derivedPowerW) {
  let effort;
  if (c.sport === "running") effort = `Running at ${fmt(c.speedKmh, 1)} km/h`;
  else if (c.sport === "cycling" && c.powerW > 0) effort = `Cycling at ${fmt(c.powerW)} W`;
  else if (c.sport === "cycling") {
    effort = `Cycling at ${fmt(c.speedKmh, 1)} km/h`;
    if (derivedPowerW > 0) effort += ` (about ${fmt(derivedPowerW)} W)`;
  } else effort = `${SPORT_LABELS.other} at ${fmt(c.mets, 1)} METs`;
  const parts = [
    effort,
    (SETTING_LABELS[c.setting] ?? c.setting).toLowerCase(),
    formatTemp(c.tempC, tempUnit),
    `${fmt(c.humidity)}% humidity`,
  ];
  if (c.setting === "outdoor") parts.push((SUN_LABELS[c.sun] ?? c.sun).toLowerCase());
  return parts.join(", ");
}

/**
 * The event and environment inputs as sweat test conditions.
 * @param {PlanInputs} inputs
 * @returns {SweatTestConditions}
 */
function currentConditions(inputs) {
  const { event, environment } = inputs;
  return {
    sport: event.sport,
    speedKmh: event.speedKmh,
    powerW: event.powerW,
    mets: event.mets,
    setting: event.setting,
    tempC: environment.tempC,
    humidity: environment.humidity,
    sun: environment.sun,
  };
}

/**
 * The first free test id (`t1`, `t2`, …).
 * @param {SweatTest[]} tests
 * @returns {string}
 */
function freeTestId(tests) {
  const used = new Set(tests.map((test) => test.id));
  let n = 1;
  while (used.has(`t${n}`)) n += 1;
  return `t${n}`;
}

/**
 * The first free custom salt key (`s1`..`s10`), or null when all are taken.
 * @param {CustomSalt[]} custom
 * @returns {string|null}
 */
function freeSaltKey(custom) {
  const used = new Set(custom.map((salt) => salt.key));
  for (let n = 1; n <= INPUT_LIMITS.customSalts[1]; n += 1) {
    if (!used.has(`s${n}`)) return `s${n}`;
  }
  return null;
}

/**
 * One label/value pair in a facts list.
 * @param {{ term: string, children: import('react').ReactNode }} props
 */
function Fact({ term, children }) {
  return (
    <div>
      <dt className="text-text-secondary">{term}</dt>
      <dd className="font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

/**
 * The effective value of a target in large type, with its unit.
 * @param {{ value: string, unit: string, testId: string }} props
 */
function BigValue({ value, unit, testId }) {
  return (
    <p data-testid={testId} className="text-text-primary">
      <span className="text-3xl font-bold">{value}</span>{" "}
      <span className="text-sm font-medium text-text-secondary">{unit}</span>
    </p>
  );
}

/**
 * An on/off switch: a checkbox with `role="switch"` styled as a toggle. The
 * row (text and track) is its label; the hint below it is linked with
 * `aria-describedby`.
 *
 * @param {{ id: string, checked: boolean, onChange: (checked: boolean) => void,
 *   label: import('react').ReactNode, hint?: import('react').ReactNode }} props
 */
function Switch({ id, checked, onChange, label, hint }) {
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="min-w-0 text-sm font-semibold text-text-primary">{label}</span>
        <span className="relative inline-flex items-center flex-shrink-0">
          <input
            id={id}
            type="checkbox"
            role="switch"
            aria-describedby={hint ? hintId : undefined}
            className="sr-only peer"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className="block w-11 h-6 bg-card-border rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-apple-blue peer-focus-visible:ring-offset-2 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-card-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-apple-blue"
          ></span>
        </span>
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 pr-14 text-xs text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A labelled number field for the sweat test form. `emptyValue` is committed
 * when the field is cleared (the measured amounts use 0); without it a
 * cleared field keeps the last value.
 *
 * @param {{ id: string, label: string, value: number, onCommit: (value: number) => void, min: number,
 *   max: number, step?: number, hint?: string, emptyValue?: number, blankZero?: boolean }} props
 */
function NumberField({ id, label, value, onCommit, min, max, step = 1, hint, emptyValue, blankZero = false }) {
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className={SMALL_LABEL_CLASS}>
        {label}
      </label>
      <NumberInput
        id={id}
        className={SMALL_INPUT_CLASS}
        value={value}
        onCommit={onCommit}
        min={min}
        max={max}
        step={step}
        emptyValue={emptyValue}
        blankZero={blankZero}
        aria-describedby={hint ? hintId : undefined}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A labelled select for the sweat test form.
 *
 * @param {{ id: string, label: string, value: string, onChange: (value: string) => void,
 *   options: readonly string[], labels: Record<string, string> }} props
 */
function SelectField({ id, label, value, onChange, options, labels }) {
  return (
    <div>
      <label htmlFor={id} className={SMALL_LABEL_CLASS}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SMALL_INPUT_CLASS}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? option}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Add/edit form for one sweat test. Keeps its own draft until "Save test":
 * the plan does not change while the user types. Masses and the temperature
 * follow the display units from `useUi()`; the draft is kept in kg and °C, so
 * a field the user does not touch is saved unchanged. Shows the protocol and
 * a live preview of the test result (`sweatTestRate`, the same numbers the
 * plan uses). Escape cancels.
 *
 * @param {{ idPrefix: string, mode: 'add'|'edit', initial: SweatTestDraft,
 *   onSave: (draft: SweatTestDraft) => void, onCancel: () => void }} props
 */
function SweatTestForm({ idPrefix, mode, initial, onSave, onCancel }) {
  const { inputs } = usePlanInputs();
  const { massUnit, tempUnit } = useUi();
  const [draft, setDraft] = useState(initial);
  const firstFieldRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const id = (name) => `${idPrefix}-${name}`;

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateConditions = (patch) =>
    setDraft((current) => ({ ...current, conditions: { ...current.conditions, ...patch } }));

  const L = INPUT_LIMITS;
  const inLb = massUnit === "lb";
  const showMass = (kg) => (inLb ? round2(kg * LB_PER_KG) : kg);
  const toKg = (shown) => (inLb ? round3(shown / LB_PER_KG) : shown);
  const massMax = inLb ? Math.floor(L.testMassKg[1] * LB_PER_KG * 10) / 10 : L.testMassKg[1];
  const inF = tempUnit === "F";
  const c = draft.conditions;
  const tempShown = inF ? round1(cToF(c.tempC)) : c.tempC;
  const [tempMinC, tempMaxC] = L.tempC;

  const result = sweatTestRate(draft, inputs.athlete, null);
  const headingId = id("heading");

  return (
    <form
      aria-labelledby={headingId}
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="p-4 rounded-xl border border-card-border bg-card shadow-sm space-y-4"
    >
      <h4 id={headingId} className="font-semibold text-text-primary">
        {mode === "edit" ? "Edit sweat test" : "Add a sweat test"}
      </h4>
      <div className="flex items-start gap-2 p-3 rounded-lg border border-apple-blue/30 bg-apple-blue/10 text-xs text-text-primary">
        <ClipboardList size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-apple-blue" />
        <p>
          <span className="font-semibold">How to test: </span>
          {t("sweat.test.protocol")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("date")} className={SMALL_LABEL_CLASS}>
            Date
          </label>
          <input
            ref={firstFieldRef}
            id={id("date")}
            type="date"
            value={draft.date}
            onChange={(e) => update({ date: e.target.value })}
            className={SMALL_INPUT_CLASS}
          />
        </div>
        <div>
          <label htmlFor={id("label")} className={SMALL_LABEL_CLASS}>
            Name (optional)
          </label>
          <input
            id={id("label")}
            type="text"
            value={draft.label}
            maxLength={L.testLabelChars[1]}
            placeholder="Hot turbo session"
            onChange={(e) => update({ label: e.target.value })}
            className={SMALL_INPUT_CLASS}
          />
        </div>
        <NumberField
          id={id("pre")}
          label={`Body mass before (${massUnit})`}
          value={showMass(draft.preKg)}
          onCommit={(value) => update({ preKg: toKg(value) })}
          min={0}
          max={massMax}
          step={0.1}
          emptyValue={0}
          blankZero
        />
        <NumberField
          id={id("post")}
          label={`Body mass after (${massUnit})`}
          value={showMass(draft.postKg)}
          onCommit={(value) => update({ postKg: toKg(value) })}
          min={0}
          max={massMax}
          step={0.1}
          emptyValue={0}
          blankZero
        />
        <NumberField
          id={id("fluid")}
          label="Fluid drunk (L)"
          value={draft.fluidL}
          onCommit={(value) => update({ fluidL: value })}
          min={L.testFluidL[0]}
          max={L.testFluidL[1]}
          step={0.05}
          emptyValue={0}
        />
        <NumberField
          id={id("urine")}
          label="Urine passed (L)"
          value={draft.urineL}
          onCommit={(value) => update({ urineL: value })}
          min={L.testUrineL[0]}
          max={L.testUrineL[1]}
          step={0.05}
          emptyValue={0}
        />
        <NumberField
          id={id("duration")}
          label="Duration (min)"
          value={draft.durationMin}
          onCommit={(value) => update({ durationMin: value })}
          min={L.testDurationMin[0]}
          max={L.testDurationMin[1]}
          step={1}
          emptyValue={0}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-text-primary mb-2">Conditions during the test</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            id={id("sport")}
            label="Sport"
            value={c.sport}
            onChange={(value) => updateConditions({ sport: value, speedKmh: speedForSport(value, c.speedKmh) })}
            options={INPUT_OPTIONS.sport}
            labels={SPORT_LABELS}
          />
          {c.sport !== "other" && (
            <NumberField
              id={id("speed")}
              label="Speed (km/h)"
              value={c.speedKmh}
              onCommit={(value) => updateConditions({ speedKmh: value })}
              min={L.speedKmh[0]}
              max={L.speedKmh[1]}
              step={0.5}
            />
          )}
          {c.sport === "cycling" && (
            <NumberField
              id={id("power")}
              label="Power (W)"
              value={c.powerW}
              onCommit={(value) => updateConditions({ powerW: value })}
              min={L.powerW[0]}
              max={L.powerW[1]}
              step={5}
              hint="0 = estimate from speed"
            />
          )}
          {c.sport === "other" && (
            <NumberField
              id={id("mets")}
              label="Effort (METs)"
              value={c.mets}
              onCommit={(value) => updateConditions({ mets: value })}
              min={L.mets[0]}
              max={L.mets[1]}
              step={0.5}
            />
          )}
          <SelectField
            id={id("setting")}
            label="Setting"
            value={c.setting}
            onChange={(value) => updateConditions({ setting: value })}
            options={INPUT_OPTIONS.setting}
            labels={SETTING_LABELS}
          />
          <NumberField
            id={id("temp")}
            label={`Temperature (°${tempUnit})`}
            value={tempShown}
            onCommit={(value) => updateConditions({ tempC: inF ? round2(fToC(value)) : value })}
            min={inF ? Math.ceil(cToF(tempMinC)) : tempMinC}
            max={inF ? Math.floor(cToF(tempMaxC)) : tempMaxC}
            step={1}
          />
          <NumberField
            id={id("humidity")}
            label="Humidity (%)"
            value={c.humidity}
            onCommit={(value) => updateConditions({ humidity: value })}
            min={L.humidity[0]}
            max={L.humidity[1]}
            step={5}
          />
          {c.setting === "outdoor" && (
            <SelectField
              id={id("sun")}
              label="Sun"
              value={c.sun}
              onChange={(value) => updateConditions({ sun: value })}
              options={INPUT_OPTIONS.sun}
              labels={SUN_LABELS}
            />
          )}
        </div>
      </fieldset>

      <div aria-live="polite" data-testid="sweat-test-preview" className="text-sm text-text-primary">
        {result.valid ? (
          <p>
            This test gives <strong>{fmt(result.rateLph, 2)} L/h</strong> of sweat.
          </p>
        ) : (
          <ul className="space-y-1">
            {result.problems.map((problem, index) => (
              <li key={`${problem.key}-${index}`} className="flex items-start gap-1.5">
                <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-apple-amber" />
                <span>{t(problem)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-apple-blue text-white text-sm font-semibold hover:opacity-90"
        >
          Save test
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-card-border text-sm font-medium text-text-primary hover:bg-card-border/30"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The sweat test tab: the saved tests (name, date, conditions, measured rate
 * or what is wrong with it), a radio choice of the test the plan uses, the
 * add/edit form, delete with an in-page confirmation, and the calibration
 * switch with its result.
 *
 * @param {{ idPrefix: string }} props
 */
function SweatTestPanel({ idPrefix }) {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { tempUnit } = useUi();
  const focusAfterRender = useFocusAfterRender();
  const [form, setForm] = useState(
    /** @type {{ mode: 'add'|'edit', testId: string|null, initial: SweatTestDraft } | null} */ (null),
  );
  const [confirmingId, setConfirmingId] = useState(/** @type {string|null} */ (null));
  const id = (name) => `${idPrefix}-${name}`;

  const tests = inputs.sweat.tests;
  const results = plan.sweat.tests;
  const maxTests = INPUT_LIMITS.sweatTests[1];
  const selectedId = inputs.sweat.selectedTestId ?? tests.at(-1)?.id ?? null;
  const usingTest = plan.sweat.source === "test";
  const calibration = usingTest ? plan.sweat.calibration : null;
  const measured = usingTest ? plan.sweat.test : null;

  const openAdd = () => {
    setConfirmingId(null);
    setForm({
      mode: "add",
      testId: null,
      initial: {
        date: todayIso(),
        label: "",
        preKg: 0,
        postKg: 0,
        fluidL: 0,
        urineL: 0,
        durationMin: 60,
        conditions: currentConditions(inputs),
      },
    });
  };
  const openEdit = (test) => {
    setConfirmingId(null);
    const { id: testId, ...fields } = test;
    setForm({ mode: "edit", testId, initial: { ...fields, conditions: { ...fields.conditions } } });
  };
  const closeForm = () => {
    const editedStillThere = form?.mode === "edit" && tests.some((test) => test.id === form.testId);
    focusAfterRender(editedStillThere ? id(`${form.testId}-edit`) : id("add"));
    setForm(null);
  };
  const saveForm = (draft) => {
    const fields = { ...draft, label: draft.label.trim() };
    if (form?.mode === "edit") {
      const index = tests.findIndex((test) => test.id === form.testId);
      if (index >= 0) set(["sweat", "tests", index], { id: form.testId, ...fields });
      focusAfterRender(id(`${form.testId}-edit`));
    } else {
      // A new test becomes the one the plan uses.
      const testId = freeTestId(tests);
      apply({ sweat: { tests: [...tests, { id: testId, ...fields }], selectedTestId: testId } });
      focusAfterRender(id(`${testId}-use`));
    }
    setForm(null);
  };

  const askDelete = (testId) => {
    setConfirmingId(testId);
    focusAfterRender(id(`${testId}-cancel-delete`));
  };
  const cancelDelete = () => {
    if (confirmingId !== null) focusAfterRender(id(`${confirmingId}-delete`));
    setConfirmingId(null);
  };
  const confirmDelete = () => {
    const testId = confirmingId;
    setConfirmingId(null);
    if (form?.testId === testId) setForm(null);
    set("sweat.tests", (list) => (Array.isArray(list) ? list.filter((test) => test?.id !== testId) : []));
    focusAfterRender(id("add"));
  };

  return (
    <div className="mb-6 space-y-4" data-testid="sweat-test-panel">
      <p className="text-sm text-text-secondary">
        Weigh yourself before and after a training session to measure your own sweat rate. The plan uses the test
        you pick.
      </p>

      {tests.length === 0 ? (
        <p className="text-sm text-text-secondary">No sweat tests yet.</p>
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold text-text-primary mb-2">Test to use</legend>
          <ul aria-label="Sweat tests" className="space-y-2">
            {tests.map((test, index) => {
              const result = results[index];
              const name = testName(test, index);
              const selected = test.id === selectedId;
              const confirming = confirmingId === test.id;
              const radioId = id(`${test.id}-use`);
              const questionId = id(`${test.id}-delete-question`);
              return (
                <li
                  key={test.id}
                  data-testid={`sweat-test-${test.id}`}
                  className={`p-3 border rounded-xl bg-card shadow-sm ${selected ? "border-apple-blue/60" : "border-card-border"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={radioId}
                      type="radio"
                      name={id("selected")}
                      checked={selected}
                      onChange={() => set("sweat.selectedTestId", test.id)}
                      className="mt-1 text-apple-blue focus:ring-apple-blue"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={radioId} className="text-sm font-medium text-text-primary cursor-pointer">
                          {name}
                        </label>
                        {selected && usingTest && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md border text-apple-blue bg-apple-blue/10 border-apple-blue/30">
                            In use
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary">
                        {test.date || "No date"} · {fmt(test.durationMin)} min ·{" "}
                        {describeConditions(test.conditions, tempUnit)}
                      </p>
                      {result?.valid ? (
                        <p className="text-sm text-text-primary" data-testid="sweat-test-result">
                          Measured <strong>{fmt(result.rateLph, 2)} L/h</strong>
                        </p>
                      ) : (
                        <div className="text-sm text-text-primary" data-testid="sweat-test-result">
                          {(result?.problems ?? []).map((problem, i) => (
                            <p key={`${problem.key}-${i}`} className="flex items-start gap-1.5">
                              <TriangleAlert
                                size={14}
                                aria-hidden="true"
                                className="mt-0.5 flex-shrink-0 text-apple-amber"
                              />
                              <span>
                                <span className="sr-only">Cannot be used: </span>
                                {t(problem)}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0">
                      <button
                        id={id(`${test.id}-edit`)}
                        type="button"
                        aria-label={`Edit ${name}`}
                        onClick={() => openEdit(test)}
                        className={ICON_BUTTON_CLASS}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        id={id(`${test.id}-delete`)}
                        type="button"
                        aria-label={`Delete ${name}`}
                        aria-expanded={confirming}
                        onClick={() => askDelete(test.id)}
                        className={`${ICON_BUTTON_CLASS} hover:text-apple-red`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {confirming && (
                    <div
                      role="group"
                      aria-labelledby={questionId}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelDelete();
                        }
                      }}
                      className="mt-3 p-3 rounded-lg border border-apple-red/30 bg-apple-red/10 text-sm text-text-primary"
                    >
                      <p id={questionId} className="mb-2">
                        Delete {name}? You cannot undo this.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={confirmDelete}
                          className="px-3 py-1.5 rounded-lg bg-apple-red text-white text-sm font-semibold hover:opacity-90"
                        >
                          Yes, delete
                        </button>
                        <button
                          id={id(`${test.id}-cancel-delete`)}
                          type="button"
                          onClick={cancelDelete}
                          className="px-3 py-1.5 rounded-lg border border-card-border bg-card text-sm font-medium text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {form ? (
        <SweatTestForm
          key={form.testId ?? "new"}
          idPrefix={id("form")}
          mode={form.mode}
          initial={form.initial}
          onSave={saveForm}
          onCancel={closeForm}
        />
      ) : (
        <div>
          <button
            id={id("add")}
            type="button"
            onClick={openAdd}
            disabled={tests.length >= maxTests}
            className={LINK_BUTTON_CLASS}
          >
            <Plus size={16} aria-hidden="true" /> Add a sweat test
          </button>
          {tests.length >= maxTests && (
            <p className="mt-1 text-xs text-text-secondary">
              You can keep up to {maxTests} tests. Delete one to add another.
            </p>
          )}
        </div>
      )}

      <div className="pt-2">
        <Switch
          id={id("calibrate")}
          checked={inputs.sweat.calibrate}
          onChange={(checked) => set("sweat.calibrate", checked)}
          label="Scale the test to this event"
          hint={t("sweat.test.calibrateHelp")}
        />
        {measured?.valid && calibration && (
          <p data-testid="sweat-calibration" className="mt-2 text-xs text-text-primary">
            {calibration.applied
              ? `Measured ${fmt(measured.rateLph, 2)} L/h. Scaled to this event: ${fmt(plan.sweat.rateLph, 2)} L/h (factor ${fmt(calibration.factor, 2)}${calibration.clamped ? ", at its limit" : ""}).`
              : `Measured ${fmt(measured.rateLph, 2)} L/h, used as it is.`}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The estimate tab: the heat-balance estimate for the event with its
 * uncertainty, the heat the body makes and the conditions it uses.
 */
function SweatEstimatePanel() {
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const { tempUnit } = useUi();
  const estimate = plan.sweat.estimate;
  const derivedPowerW = estimate.powerFromSpeed ? estimate.powerW : undefined;

  return (
    <div
      data-testid="sweat-estimate-panel"
      className="mb-6 p-4 rounded-xl border border-apple-blue/30 bg-apple-blue/10 text-sm space-y-3"
    >
      <p className="text-text-primary">
        Estimated sweat rate:{" "}
        <strong data-testid="sweat-estimate">
          {fmt(estimate.rateLph, 2)} L/h ± {fmt(estimate.uncertaintyLph, 1)} L/h
        </strong>
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <Fact term="Heat production">{fmt(estimate.heatProductionW)} W</Fact>
        <Fact term="Energy use">{fmt(estimate.energyKcalPerHour)} kcal/h</Fact>
        <Fact term="Heat to lose by sweating">{fmt(Math.max(0, estimate.ereqW))} W</Fact>
      </dl>
      <p className="text-xs text-text-secondary" data-testid="sweat-estimate-conditions">
        Uses: {describeConditions(currentConditions(inputs), tempUnit, derivedPowerW)}
        {inputs.athlete.acclimatised ? ", heat acclimatised" : ""}. Change these in Activity Basics.
      </p>
      {estimate.capped && (
        <p className="text-xs text-text-primary">
          This is the most the model allows for your body size ({fmt(estimate.maxRateLph, 2)} L/h).
        </p>
      )}
    </div>
  );
}

/**
 * Projected change of body mass over the event (`plan.hydration`): what the
 * scale shows afterwards, the water lost or gained and its level.
 *
 * @param {{ hydration: import('../../domain/plan').Plan['hydration'], massUnit: 'kg'|'lb' }} props
 */
function BodyMassProjection({ hydration, massUnit }) {
  const headingId = useId();
  const bodyMass = bodyMassText(hydration, massUnit);

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid="body-mass-projection"
      className="mt-4 p-4 rounded-xl border border-card-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Scale size={16} aria-hidden="true" className="text-apple-blue" /> Projected body-mass change
        </h4>
        <BodyMassLevel level={bodyMass.level} testId="body-mass-level" />
      </div>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Fact term="On the scale after the event">
          <span data-testid="body-mass-scale">{bodyMass.scale}</span>
        </Fact>
        <Fact term={bodyMass.waterTerm}>
          <span data-testid="body-mass-water">{bodyMass.water}</span>
        </Fact>
      </dl>
      <p className="mt-2 text-xs text-text-secondary">
        The scale also drops by the fuel you burn. Try to keep the water loss under {DEFICIT_MILD_PCT}% of your body
        mass and never gain weight.
      </p>
    </div>
  );
}

/**
 * Editor for the salts typed in from a label (`salts.custom`): name and the
 * % of the salt's mass for sodium, potassium, magnesium, calcium and
 * chloride. Changes apply to the plan at once.
 *
 * @param {{ idPrefix: string, onRemove: (key: string) => void }} props
 */
function CustomSaltEditor({ idPrefix, onRemove }) {
  const { inputs, set } = usePlanInputs();
  const custom = inputs.salts.custom;
  const id = (name) => `${idPrefix}-${name}`;

  if (custom.length === 0) return null;
  return (
    <ul aria-label="Salts from a label" className="space-y-3">
      {custom.map((salt, index) => {
        const name = customSaltName(salt);
        const total = CUSTOM_SALT_FIELDS.reduce((acc, field) => acc + salt[field.key], 0);
        const nameId = id(`${salt.key}-name`);
        return (
          <li key={salt.key} className="p-3 border border-card-border rounded-xl bg-card shadow-sm">
            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <label htmlFor={nameId} className={SMALL_LABEL_CLASS}>
                  Salt name
                </label>
                <input
                  id={nameId}
                  type="text"
                  value={salt.name}
                  maxLength={INPUT_LIMITS.customNameChars[1]}
                  placeholder={name}
                  onChange={(e) => set(["salts", "custom", index, "name"], e.target.value)}
                  className={SMALL_INPUT_CLASS}
                />
              </div>
              <button
                type="button"
                aria-label={`Delete ${name} from your salts`}
                onClick={() => onRemove(salt.key)}
                className={`${ICON_BUTTON_CLASS} hover:text-apple-red`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CUSTOM_SALT_FIELDS.map((field) => {
                const fieldId = id(`${salt.key}-${field.key}`);
                return (
                  <div key={field.key}>
                    <label htmlFor={fieldId} className={SMALL_LABEL_CLASS}>
                      {field.label} %
                    </label>
                    <NumberInput
                      id={fieldId}
                      className={SMALL_INPUT_CLASS}
                      value={salt[field.key]}
                      onCommit={(value) => set(["salts", "custom", index, field.key], value)}
                      min={INPUT_LIMITS.labelPct[0]}
                      max={INPUT_LIMITS.labelPct[1]}
                      step={0.1}
                      emptyValue={0}
                    />
                  </div>
                );
              })}
            </div>
            {total > 100 && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-text-primary">
                <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-apple-amber" />
                These values add up to {fmt(total, 1)}%, more than the whole salt. Check the label.
              </p>
            )}
            {total === 0 && (
              <p className="mt-2 text-xs text-text-secondary">Enter at least one value from the label.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Electrolytes and hydration card: sweat (from a sweat test, the
 * heat-balance estimate or a preset), the sodium target (with the optional
 * potassium, magnesium and calcium targets under "Advanced"), the salts that
 * deliver them (with salts typed in from a label in Manual mode), and the
 * fluid target with the projected body-mass change.
 *
 * Reads the plan from `usePlan()` and edits the inputs through
 * `usePlanInputs()`; masses and temperatures follow the display units from
 * `useUi()`. Every recommendation shows its value, range, a "Why?"
 * explanation and an Auto/Adjust switch. Domain messages go through `t()`
 * (directly, and via `Why` and `Warnings`).
 */
const ElectrolytesHydration = () => {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { massUnit } = useUi();
  const focusAfterRender = useFocusAfterRender();
  const uid = useId();
  const id = (name) => `${uid}-${name}`;

  // "Advanced" opens whenever an extra turns on, also when that happens after
  // the first render (a share link is restored after mount). It never closes
  // by itself, so turning the last extra off keeps the checkbox in view.
  const anyExtraOn = EXTRAS.some(({ key }) => inputs.extras[key]);
  const [advancedOpen, setAdvancedOpen] = useState(anyExtraOn);
  const [extrasWereOn, setExtrasWereOn] = useState(anyExtraOn);
  if (anyExtraOn !== extrasWereOn) {
    setExtrasWereOn(anyExtraOn);
    if (anyExtraOn) setAdvancedOpen(true);
  }

  const { sweat, sodium, fluid, salts, extras, hydration } = plan;
  const sodiumRec = sodium.recommended;
  const fluidRec = fluid.recommended;
  const sweatSource = inputs.sweat.source;
  const sweatLo = Math.max(0, sweat.rateLph - sweat.uncertaintyLph);
  const sweatHi = sweat.rateLph + sweat.uncertaintyLph;
  const sweatSodiumMgL = sweat.sodiumMmolL * MG_PER_MMOL.Sodium;

  // Over-drinking gives two dangers that say the same thing; the card shows
  // the fluid one, which names the rates.
  const fluidWarningIds = new Set(fluid.warnings.map((w) => w.id));
  const fluidWarnings = [
    ...fluid.warnings,
    ...hydration.warnings.filter((w) => !(w.id === "fluid.projectedGain" && fluidWarningIds.has("fluid.aboveSweat"))),
  ];

  // Switching to Adjust starts from the value the plan uses now, so nothing jumps.
  const setSodiumMode = (mode) => {
    if (mode === "manual" && inputs.sodium.mode !== "manual") {
      apply({ sodium: { mode: "manual", manualMgPerHour: sodium.mgPerHour } });
    } else {
      set("sodium.mode", mode);
    }
  };
  const setFluidMode = (mode) => {
    if (mode === "manual" && inputs.fluid.mode !== "manual") {
      apply({ fluid: { mode: "manual", manualMlPerHour: fluid.mlPerHour } });
    } else {
      set("fluid.mode", mode);
    }
  };
  // Manual salts start from the auto amounts when there is no manual list yet.
  const setSaltMode = (mode) => {
    if (mode === "manual" && inputs.salts.mode !== "manual" && inputs.salts.manual.length === 0) {
      apply({ salts: { mode: "manual", manual: salts.items.map((s) => ({ ref: s.ref, amountMg: s.amountMg })) } });
    } else {
      set("salts.mode", mode);
    }
  };

  // Manual salts: built-in salts first, then the salts typed in from a label.
  const customSalts = inputs.salts.custom;
  const manualSalts = inputs.salts.manual;
  const saltOptions = [
    ...electrolyteSourceOptions.map((o) => ({ ref: o.id, label: o.label, custom: false })),
    ...customSalts.map((c) => ({ ref: c.key, label: customSaltName(c), custom: true })),
  ];
  const saltName = (ref) => saltOptions.find((o) => o.ref === ref)?.label ?? `Salt ${ref}`;
  const usedSaltRefs = new Set(manualSalts.map((s) => s.ref));
  const nextSaltRef = saltOptions.find((o) => !usedSaltRefs.has(o.ref))?.ref;
  const addSalt = () => {
    if (nextSaltRef === undefined) return;
    focusAfterRender(id(`salt-${manualSalts.length}`));
    set("salts.manual", (list) => [...(Array.isArray(list) ? list : []), { ref: nextSaltRef, amountMg: 0 }]);
  };
  const removeSalt = (index) =>
    set("salts.manual", (list) => (Array.isArray(list) ? list.filter((_, i) => i !== index) : []));
  const nextCustomKey = freeSaltKey(customSalts);
  const addCustomSalt = () => {
    if (nextCustomKey === null) return;
    const salt = {
      key: nextCustomKey,
      name: "",
      sodiumPct: 0,
      potassiumPct: 0,
      magnesiumPct: 0,
      calciumPct: 0,
      chloridePct: 0,
    };
    focusAfterRender(id(`custom-salt-${nextCustomKey}-name`));
    apply({
      salts: {
        custom: [...customSalts, salt],
        manual: [...manualSalts, { ref: nextCustomKey, amountMg: 0 }],
      },
    });
  };
  const removeCustomSalt = (key) => {
    focusAfterRender(id("add-custom-salt"));
    apply({
      salts: {
        custom: customSalts.filter((c) => c.key !== key),
        manual: manualSalts.filter((s) => s.ref !== key),
      },
    });
  };
  /** Text for a salt's tooltip: what it contains. */
  const saltContents = (ref) => {
    const profile = saltProfile(ref, customSalts);
    if (!profile || profile.components.length === 0) return "No values entered yet.";
    return `Contains ${profile.components.map((c) => `${fmt(c.ratio * 100, 1)}% ${c.name}`).join(", ")}`;
  };

  const comparisonRows = Object.entries(salts.comparison);

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
          <Droplet size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Electrolytes & Hydration</h2>
          <p className="text-sm text-text-secondary">Sweat, sodium and fluid targets per hour.</p>
        </div>
      </div>

      {/* Sweat */}
      <section aria-labelledby={id("sweat-heading")} className="mb-8">
        <h3 id={id("sweat-heading")} className="font-semibold text-text-primary mb-4">
          Sweat
        </h3>
        <Segmented
          label="Sweat source"
          value={sweatSource}
          options={SWEAT_SOURCE_OPTIONS}
          onChange={(value) => set("sweat.source", value)}
          size="lg"
          className="mb-6"
        />

        {sweatSource === "test" && <SweatTestPanel idPrefix={id("test")} />}
        {sweatSource === "estimate" && <SweatEstimatePanel />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
          {sweatSource === "preset" && (
            <div>
              <label htmlFor={id("sweat-rate")} className={LABEL_CLASS}>
                Sweat Rate
              </label>
              <select
                id={id("sweat-rate")}
                value={inputs.sweat.rateIndex}
                onChange={(e) => set("sweat.rateIndex", Number(e.target.value))}
                aria-describedby={id("sweat-rate-description")}
                className={INPUT_CLASS}
              >
                {SWEAT_RATE_PRESETS_LPH.map((rate, index) => (
                  <option key={rate} value={index}>
                    {shortDescription(SWEAT_RATE_DESCRIPTIONS[index])} ({rate} L/h)
                  </option>
                ))}
              </select>
              <p id={id("sweat-rate-description")} className="mt-1.5 text-xs text-text-secondary">
                {SWEAT_RATE_DESCRIPTIONS[inputs.sweat.rateIndex]}
              </p>
            </div>
          )}
          <div>
            <div className="flex items-center mb-1.5">
              <label htmlFor={id("saltiness")} className="text-sm font-medium text-text-primary">
                Sweat Saltiness
              </label>
              <TooltipInfo content="How salty your sweat is (sodium per litre of sweat). Most athletes lose 0.5–1.5 g sodium per litre. White salt marks on dark clothing suggest saltier sweat." />
            </div>
            <select
              id={id("saltiness")}
              value={inputs.sweat.saltinessIndex}
              onChange={(e) => set("sweat.saltinessIndex", Number(e.target.value))}
              aria-describedby={id("saltiness-description")}
              className={INPUT_CLASS}
            >
              {SWEAT_SODIUM_PRESETS_MMOL.map((mmol, index) => (
                <option key={mmol} value={index}>
                  {shortDescription(SALTINESS_DESCRIPTIONS[index])} ({fmt(mmol * MG_PER_MMOL.Sodium)} mg/L)
                </option>
              ))}
            </select>
            <p id={id("saltiness-description")} className="mt-1.5 text-xs text-text-secondary">
              {SALTINESS_DESCRIPTIONS[inputs.sweat.saltinessIndex]}
            </p>
          </div>
        </div>

        <Warnings warnings={sweat.warnings} className="mb-4" />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
          <p data-testid="sweat-summary" data-source={sweat.source}>
            Sweat rate used:{" "}
            <strong className="text-text-primary">{fmt(sweat.rateLph, 2)} L/h</strong> (likely{" "}
            {fmt(sweatLo, 2)}–{fmt(sweatHi, 2)} L/h). Sweat sodium:{" "}
            <strong className="text-text-primary">{fmt(sweatSodiumMgL)} mg/L</strong>.
          </p>
          <Why why={sweat.why} />
        </div>
      </section>

      {/* Sodium target */}
      <section aria-labelledby={id("sodium-heading")} className="pt-6 border-t border-card-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 id={id("sodium-heading")} className="font-semibold text-text-primary">
              Sodium target
            </h3>
            {sodiumRec.optional && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md border text-apple-blue bg-apple-blue/10 border-apple-blue/30">
                Optional
              </span>
            )}
          </div>
          <Segmented
            label="Sodium target mode"
            value={inputs.sodium.mode}
            options={AUTO_ADJUST_OPTIONS}
            onChange={setSodiumMode}
          />
        </div>

        <div className={PANEL_CLASS}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <BigValue testId="sodium-value" value={fmt(sodium.mgPerHour)} unit="mg/h" />
            <p className="text-sm text-text-secondary">{fmt(sodium.totalMg)} mg in total</p>
          </div>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <Fact term="Recommended">{fmt(sodiumRec.mgPerHour)} mg/h</Fact>
            <Fact term="Range">
              {fmt(sodiumRec.range[0])}–{fmt(sodiumRec.range[1])} mg/h
            </Fact>
            <Fact term="Estimated sweat loss">about {fmt(sodiumRec.estimatedLossMgPerHour)} mg/h</Fact>
          </dl>
          {inputs.sodium.mode === "manual" && (
            <div className="mt-4 max-w-xs">
              <label htmlFor={id("sodium-manual")} className={LABEL_CLASS}>
                Your sodium target (mg/h)
              </label>
              <NumberInput
                id={id("sodium-manual")}
                className={INPUT_CLASS}
                value={inputs.sodium.manualMgPerHour}
                onCommit={(value) => set("sodium.manualMgPerHour", value)}
                min={INPUT_LIMITS.manualMgPerHour[0]}
                max={INPUT_LIMITS.manualMgPerHour[1]}
                step={10}
              />
            </div>
          )}
          <Why why={sodiumRec.why} className="mt-3" />
        </div>
        <Warnings warnings={sodium.warnings} className="mt-4" />

        {/* Advanced: optional ions */}
        <div className="mt-6">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={id("advanced")}
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex items-center justify-between w-full group focus:outline-none"
          >
            <span className="text-sm font-semibold text-text-primary">
              Advanced: potassium, magnesium, calcium
            </span>
            <ChevronDown
              size={20}
              aria-hidden="true"
              className={`text-text-secondary group-hover:text-text-primary transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div id={id("advanced")} hidden={!advancedOpen} className="mt-4 space-y-3">
            {EXTRAS.map(({ key, ion }) => {
              const enabled = inputs.extras[key];
              return (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      id={id(`extra-${key}`)}
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => set(`extras.${key}`, e.target.checked)}
                      className="rounded text-apple-blue focus:ring-apple-blue"
                    />
                    <label
                      htmlFor={id(`extra-${key}`)}
                      className={`text-sm font-medium cursor-pointer ${enabled ? "text-text-primary" : "text-text-secondary"}`}
                    >
                      {ion}
                    </label>
                  </div>
                  <span
                    data-testid={`extra-${key}`}
                    className={`text-sm font-bold ${enabled ? "text-text-primary" : "text-text-secondary"}`}
                  >
                    {enabled ? `${fmt(extras[ion].mgPerHour)} mg/h` : "Off"}
                  </span>
                </div>
              );
            })}
            <Why why={extras.why} />
          </div>
        </div>
      </section>

      {/* Salts */}
      <section aria-labelledby={id("salts-heading")} className="pt-6 border-t border-card-border mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id={id("salts-heading")} className="font-semibold text-text-primary">
            Salts
          </h3>
          <Segmented
            label="Salt mode"
            value={inputs.salts.mode}
            options={SALT_MODE_OPTIONS}
            onChange={setSaltMode}
          />
        </div>

        {inputs.salts.mode === "auto" ? (
          <div className="space-y-4">
            <div className="max-w-xs">
              <label htmlFor={id("sodium-salt")} className={LABEL_CLASS}>
                Sodium salt
              </label>
              <select
                id={id("sodium-salt")}
                value={inputs.salts.sodiumSalt}
                onChange={(e) => set("salts.sodiumSalt", e.target.value)}
                className={INPUT_CLASS}
              >
                {INPUT_OPTIONS.sodiumSalt.map((salt) => (
                  <option key={salt} value={salt}>
                    {SODIUM_SALT_LABELS[salt] ?? salt}
                  </option>
                ))}
              </select>
            </div>
            {salts.items.length > 0 ? (
              <ul aria-label="Salt amounts for the whole activity" className="space-y-2">
                {salts.items.map((item) => (
                  <li
                    key={item.ref}
                    className="flex items-center justify-between gap-2 p-3 border border-card-border rounded-xl bg-card shadow-sm text-sm"
                  >
                    <span className="font-medium text-text-primary">
                      {saltProfile(item.ref, customSalts)?.label ?? `Salt ${item.ref}`}
                    </span>
                    <span className="font-bold text-text-primary">{formatAmount(item.amountMg, "mg")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">No salts needed for this plan.</p>
            )}
            <p className="text-xs text-text-secondary">Amounts are for the whole activity.</p>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-text-secondary">Enter grams for the whole activity.</p>
              <button type="button" onClick={addSalt} disabled={nextSaltRef === undefined} className={LINK_BUTTON_CLASS}>
                <Plus size={16} aria-hidden="true" /> Add salt
              </button>
            </div>
            {manualSalts.length === 0 && <p className="text-sm text-text-secondary">No salts added.</p>}
            <div className="space-y-4">
              {manualSalts.map((salt, index) => {
                const name = saltName(salt.ref);
                const selectId = id(`salt-${index}`);
                const amountId = id(`salt-${index}-amount`);
                return (
                  // Rows are positions in the list (edits and removal use the index), so the
                  // index is the key: changing a row's salt keeps the row and its focus.
                  <div
                    key={index}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border border-card-border rounded-xl bg-card shadow-sm"
                  >
                    <label htmlFor={selectId} className="sr-only">
                      Salt {index + 1}
                    </label>
                    <select
                      id={selectId}
                      value={String(salt.ref)}
                      onChange={(e) => {
                        const value = e.target.value;
                        const ref = customSalts.some((c) => c.key === value) ? value : Number(value);
                        set(["salts", "manual", index, "ref"], ref);
                      }}
                      className="flex-1 min-w-[120px] bg-card-border/30 border border-card-border rounded-lg px-3 py-2 text-sm font-medium text-text-primary outline-none"
                    >
                      <optgroup label="Salts">
                        {saltOptions
                          .filter((o) => !o.custom)
                          .map((o) => (
                            <option
                              key={o.ref}
                              value={String(o.ref)}
                              disabled={o.ref !== salt.ref && usedSaltRefs.has(o.ref)}
                            >
                              {o.label}
                            </option>
                          ))}
                      </optgroup>
                      {customSalts.length > 0 && (
                        <optgroup label="Your salts">
                          {saltOptions
                            .filter((o) => o.custom)
                            .map((o) => (
                              <option
                                key={o.ref}
                                value={String(o.ref)}
                                disabled={o.ref !== salt.ref && usedSaltRefs.has(o.ref)}
                              >
                                {o.label}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                    <TooltipInfo content={saltContents(salt.ref)} />
                    <label htmlFor={amountId} className="sr-only">
                      {name} amount in g for the whole activity
                    </label>
                    <NumberInput
                      id={amountId}
                      value={round3(salt.amountMg / 1000)}
                      onCommit={(grams) => set(["salts", "manual", index, "amountMg"], Math.round(grams * 1000))}
                      min={INPUT_LIMITS.saltAmountMg[0] / 1000}
                      max={INPUT_LIMITS.saltAmountMg[1] / 1000}
                      step={0.01}
                      className="w-24 px-3 py-2 text-sm border border-card-border rounded-lg text-right font-bold bg-card text-text-primary"
                    />
                    <span className="text-sm text-text-secondary">g total</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      onClick={() => removeSalt(index)}
                      className="text-text-secondary hover:text-apple-red p-2"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-semibold text-text-primary">Salts from a label</h4>
              <p className="text-xs text-text-secondary">
                For a product that is not in the list, enter each element from its label as a % of the product&apos;s
                mass. For example, 39 g of sodium per 100 g is 39%.
              </p>
              <CustomSaltEditor idPrefix={id("custom-salt")} onRemove={removeCustomSalt} />
              <button
                id={id("add-custom-salt")}
                type="button"
                onClick={addCustomSalt}
                disabled={nextCustomKey === null}
                className={LINK_BUTTON_CLASS}
              >
                <Plus size={16} aria-hidden="true" /> Add a salt from a label
              </button>
            </div>
          </div>
        )}

        {comparisonRows.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left text-sm font-semibold text-text-primary mb-2">
                Delivered vs target (whole activity)
              </caption>
              <thead>
                <tr className="text-xs text-text-secondary">
                  <th scope="col" className="text-left font-medium py-1">
                    Ion
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Target
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Delivered
                  </th>
                  <th scope="col" className="text-right font-medium py-1">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([ion, row]) => (
                  <tr key={ion} className="border-t border-card-border">
                    <th scope="row" className="text-left font-medium text-text-primary py-2">
                      {ion}
                    </th>
                    <td className="text-right text-text-primary py-2">{fmt(row.target)} mg</td>
                    <td className="text-right text-text-primary py-2">{fmt(row.delivered)} mg</td>
                    <td className="text-right py-2 pl-2">
                      <span
                        data-status={row.status}
                        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${STATUS_STYLES[row.status] ?? STATUS_STYLES.short}`}
                      >
                        {row.status === "met"
                          ? "On target"
                          : `${row.status === "short" ? "Short by" : "Over by"} ${fmt(Math.abs(row.diff))} mg`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Warnings warnings={salts.warnings} className="mt-4" />
      </section>

      {/* Fluid */}
      <section aria-labelledby={id("fluid-heading")} className="pt-6 border-t border-card-border">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id={id("fluid-heading")} className="font-semibold text-text-primary">
            Fluid
          </h3>
          <Segmented
            label="Fluid target mode"
            value={inputs.fluid.mode}
            options={AUTO_ADJUST_OPTIONS}
            onChange={setFluidMode}
          />
        </div>

        <div className={PANEL_CLASS}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <BigValue testId="fluid-value" value={fmt(fluid.mlPerHour)} unit="ml/h" />
            <p className="text-sm text-text-secondary">{fmt(fluid.totalMl / 1000, 1)} L in total</p>
          </div>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <Fact term="Recommended">{fmt(fluidRec.mlPerHour)} ml/h</Fact>
            <Fact term="Guideline range">
              {fmt(fluidRec.range[0])}–{fmt(fluidRec.range[1])} ml/h
            </Fact>
            <Fact term="Sweat loss">about {fmt(sweat.rateLph * 1000)} ml/h</Fact>
          </dl>
          {fluidRec.drinkToThirst && (
            <p
              data-testid="drink-to-thirst"
              className="mt-4 p-3 rounded-xl border border-apple-blue/30 bg-apple-blue/10 text-xs text-text-primary"
            >
              Drinking to thirst works well for this event. Use this number as a rough guide.
            </p>
          )}
          {inputs.fluid.mode === "manual" && (
            <div className="mt-4 max-w-xs">
              <label htmlFor={id("fluid-manual")} className={LABEL_CLASS}>
                Your fluid target (ml/h)
              </label>
              <NumberInput
                id={id("fluid-manual")}
                className={INPUT_CLASS}
                value={inputs.fluid.manualMlPerHour}
                onCommit={(value) => set("fluid.manualMlPerHour", value)}
                min={INPUT_LIMITS.manualMlPerHour[0]}
                max={INPUT_LIMITS.manualMlPerHour[1]}
                step={50}
              />
            </div>
          )}
          <Why why={fluidRec.why} className="mt-3" />
        </div>
        <BodyMassProjection hydration={hydration} massUnit={massUnit} />
        <Warnings warnings={fluidWarnings} className="mt-4" />
      </section>
    </Card>
  );
};

export default ElectrolytesHydration;
