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
import { Activity, Zap, Thermometer, Droplets, Dumbbell, Timer, Scale, Coffee, FlaskConical } from "lucide-react";
import Card from "../shared/Card";
import Why, { CitationLinks } from "../shared/Why";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import Segmented, { AUTO_ADJUST_OPTIONS } from "../shared/Segmented";
import { fmt, formatRange } from "../shared/format";
import { INTENSITY_LABELS, INTENSITY_ZONES } from "../shared/labels";
import { usePlanInputs, usePlan } from "../../state/PlanProvider";
import { useUi } from "../../state/UiProvider";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { HIGH_CARB_MIN_DURATION_MIN } from "../../domain/carbs";
import { formatElapsed } from "../../domain/schedule";
import { t } from "../../i18n";

/** Pounds per kilogram (1 lb = 0.45359237 kg exactly). */
const LB_PER_KG = 1 / 0.45359237;

const BAND_LABELS = {
  none: "Under 45 min",
  rinse: "45–75 min",
  short: "75–120 min",
  medium: "2–2.5 h",
  long: "Over 2.5 h",
  veryHigh: "Over 2.5 h, gut-trained",
};

/**
 * Carb warnings about the chosen sources, not the target. CarbMatrix shows
 * them next to the source lists and FinalRecipe next to the recipe, where
 * they can be fixed, so the target section leaves them out.
 */
const SOURCE_WARNING_IDS = new Set(["plan.carbSourcesInfeasible"]);

const LABEL_CLASS = "block text-sm font-medium text-text-primary mb-1.5";
const FIELD_CLASS =
  "w-full px-4 py-2.5 border border-card-border rounded-xl outline-none font-medium text-text-primary bg-card focus:ring-2 focus:ring-apple-blue focus:border-transparent";

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => ((f - 32) * 5) / 9;

/**
 * An on/off switch: a checkbox with `role="switch"` styled as a toggle. The
 * row (text and track) is its label; the optional hint below it is linked
 * with `aria-describedby`.
 *
 * @param {{ id: string, checked: boolean, onChange: (checked: boolean) => void,
 *   label: import('react').ReactNode, hint?: import('react').ReactNode,
 *   inputRef?: import('react').Ref<HTMLInputElement> }} props
 */
function Switch({ id, checked, onChange, label, hint, inputRef }) {
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="min-w-0 text-sm font-semibold text-text-primary">{label}</span>
        <span className="relative inline-flex items-center flex-shrink-0">
          <input
            ref={inputRef}
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
 * Section heading with a tinted icon badge, as used across the cards.
 *
 * @param {{ id: string, icon: import('react').ElementType, tint: string, children: import('react').ReactNode }} props
 */
function SectionHeading({ id, icon: Icon, tint, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${tint}`}>
        <Icon size={16} aria-hidden="true" />
      </div>
      <h3 id={id} className="text-base font-bold text-text-primary">
        {children}
      </h3>
    </div>
  );
}

/**
 * Activity card: duration, intensity, body mass, temperature and humidity;
 * the carbohydrate target (recommendation, range, why, Auto/Adjust, the
 * gut-trained opt-in, mouth rinse note, warnings); caffeine; and sodium
 * bicarbonate.
 *
 * Reads the inputs and the plan from `PlanProvider` and the display units
 * from `UiProvider`. Body mass and temperature are shown in the chosen units
 * but always stored in kg and °C.
 */
const ActivityBasics = () => {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const { massUnit, setMassUnit, tempUnit, setTempUnit } = useUi();
  const [bicarbRevealed, setBicarbRevealed] = useState(false);
  const bicarbSwitchRef = useRef(/** @type {HTMLInputElement|null} */ (null));

  useEffect(() => {
    if (bicarbRevealed) bicarbSwitchRef.current?.focus();
  }, [bicarbRevealed]);

  // Duration
  const totalMin = Math.round(inputs.event.durationMin);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const maxHours = INPUT_LIMITS.durationMin[1] / 60;
  const setDuration = (h, m) => set("event.durationMin", Math.max(0, h * 60 + m));

  // Body mass (stored in kg)
  const massKg = inputs.athlete.massKg;
  const [massMinKg, massMaxKg] = INPUT_LIMITS.massKg;
  const inLb = massUnit === "lb";
  const massShown = inLb ? round1(massKg * LB_PER_KG) : round1(massKg);
  const massMin = inLb ? Math.ceil(massMinKg * LB_PER_KG * 10) / 10 : massMinKg;
  const massMax = inLb ? Math.floor(massMaxKg * LB_PER_KG * 10) / 10 : massMaxKg;
  const commitMass = (value) => set("athlete.massKg", inLb ? round2(value / LB_PER_KG) : value);

  // Temperature (stored in °C)
  const tempC = inputs.environment.tempC;
  const [tempMinC, tempMaxC] = INPUT_LIMITS.tempC;
  const inF = tempUnit === "F";
  const tempShown = inF ? Math.round(cToF(tempC)) : Math.round(tempC);
  const tempLabel = inF ? `${tempShown} °F` : `${fmt(tempC, 1)} °C`;
  const commitTemp = (value) => set("environment.tempC", inF ? round1(fToC(value)) : value);

  // Carbohydrate target
  const carbs = plan.carbs;
  const recommended = carbs.recommended;
  const isManual = carbs.mode === "manual";
  const setCarbMode = (mode) => {
    if (mode === carbs.mode) return;
    // Adjust starts from the current target, so switching never jumps the value.
    if (mode === "manual") apply({ carbs: { mode: "manual", manualGPerHour: carbs.gPerHour } });
    else set("carbs.mode", "auto");
  };
  // The switch stays while it is on, so a shorter event never leaves its
  // "only applies over 150 min" note without a control to turn it off.
  const showHighCarb = inputs.event.durationMin > HIGH_CARB_MIN_DURATION_MIN || inputs.event.highCarb;

  // Caffeine
  const caffeine = plan.caffeine;
  const caffeineInputs = inputs.caffeine;
  const [caffeineMin, caffeineMax] = INPUT_LIMITS.caffeineMgPerKg;

  // Bicarbonate
  const bicarb = plan.bicarb;
  const bicarbInputs = inputs.bicarb;
  const [bicarbMin, bicarbMax] = INPUT_LIMITS.bicarbGPerKg;
  const showBicarb = bicarb.visibleByDefault || bicarbInputs.enabled || bicarbRevealed;

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
            <Activity size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Activity Basics</h2>
            <p className="text-sm text-text-secondary">
              Define the scope and target intensity of your session.
            </p>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <fieldset>
          <legend className="text-sm font-medium text-text-primary mb-1.5 flex items-center gap-1">
            <Timer size={14} aria-hidden="true" /> Duration
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="activity-duration-hours" className="block text-xs font-semibold text-text-secondary mb-1">
                Hours
              </label>
              <NumberInput
                id="activity-duration-hours"
                className={FIELD_CLASS}
                value={hours}
                min={0}
                max={maxHours}
                step={1}
                onCommit={(value) => setDuration(Math.max(0, Math.trunc(value)), minutes)}
              />
            </div>
            <div>
              <label htmlFor="activity-duration-minutes" className="block text-xs font-semibold text-text-secondary mb-1">
                Minutes
              </label>
              <NumberInput
                id="activity-duration-minutes"
                className={FIELD_CLASS}
                value={minutes}
                min={0}
                max={59}
                step={1}
                onCommit={(value) => setDuration(hours, Math.max(0, Math.trunc(value)))}
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="activity-intensity" className={`${LABEL_CLASS} flex items-center gap-1`}>
            <Dumbbell size={14} aria-hidden="true" /> Intensity
          </label>
          <select
            id="activity-intensity"
            value={inputs.event.intensity}
            onChange={(e) => set("event.intensity", e.target.value)}
            className={FIELD_CLASS}
          >
            {INPUT_OPTIONS.intensity.map((level) => (
              <option key={level} value={level}>
                {INTENSITY_LABELS[level] ?? level} ({INTENSITY_ZONES[level]})
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="activity-mass" className="text-sm font-medium text-text-primary flex items-center gap-1">
              <Scale size={14} aria-hidden="true" /> Body mass <span className="sr-only">({massUnit})</span>
            </label>
            <Segmented
              label="Mass unit"
              value={massUnit}
              onChange={setMassUnit}
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
            />
          </div>
          <NumberInput
            id="activity-mass"
            className={FIELD_CLASS}
            value={massShown}
            min={massMin}
            max={massMax}
            step={0.1}
            onCommit={commitMass}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="activity-temperature" className="text-sm font-medium text-text-primary flex items-center gap-1">
              <Thermometer size={14} aria-hidden="true" /> Temperature
            </label>
            <Segmented
              label="Temperature unit"
              value={tempUnit}
              onChange={setTempUnit}
              options={[
                { value: "C", label: "°C" },
                { value: "F", label: "°F" },
              ]}
            />
          </div>
          <div className="flex items-center gap-4 bg-card-border/30 px-4 py-2.5 rounded-xl border border-card-border">
            <input
              id="activity-temperature"
              type="range"
              min={inF ? Math.round(cToF(tempMinC)) : tempMinC}
              max={inF ? Math.round(cToF(tempMaxC)) : tempMaxC}
              step={1}
              value={tempShown}
              aria-valuetext={tempLabel}
              onChange={(e) => commitTemp(Number(e.target.value))}
              className="w-full accent-apple-amber"
            />
            <output htmlFor="activity-temperature" className="font-bold text-apple-amber-ink min-w-[4rem] text-right">
              {tempLabel}
            </output>
          </div>
        </div>

        <div>
          <label htmlFor="activity-humidity" className={`${LABEL_CLASS} flex items-center gap-1`}>
            <Droplets size={14} aria-hidden="true" /> Humidity (%)
          </label>
          <NumberInput
            id="activity-humidity"
            className={FIELD_CLASS}
            value={inputs.environment.humidity}
            min={INPUT_LIMITS.humidity[0]}
            max={INPUT_LIMITS.humidity[1]}
            step={1}
            onCommit={(value) => set("environment.humidity", value)}
          />
        </div>
      </div>

      {/* Carbohydrate target */}
      <section aria-labelledby="activity-carbs-heading" className="border-t border-card-border pt-6 mt-2 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SectionHeading id="activity-carbs-heading" icon={Zap} tint="bg-apple-blue/20 text-apple-blue">
            Carbohydrate target
          </SectionHeading>
          <Segmented
            label="Carb target mode"
            value={carbs.mode}
            onChange={setCarbMode}
            options={AUTO_ADJUST_OPTIONS}
          />
        </div>

        <div className="bg-apple-blue/10 p-4 rounded-xl border border-apple-blue/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {isManual ? (
              <div>
                <label htmlFor="carbs-manual-g-per-hour" className={LABEL_CLASS}>
                  Your target (g/h)
                </label>
                <NumberInput
                  id="carbs-manual-g-per-hour"
                  className={FIELD_CLASS}
                  value={inputs.carbs.manualGPerHour}
                  min={INPUT_LIMITS.manualGPerHour[0]}
                  max={INPUT_LIMITS.manualGPerHour[1]}
                  step={1}
                  onCommit={(value) => set("carbs.manualGPerHour", value)}
                />
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-text-secondary">Your target</p>
                <p className="text-3xl font-bold text-apple-blue" data-testid="carbs-target">
                  {fmt(carbs.gPerHour, 1)} <span className="text-base font-semibold">g/h</span>
                </p>
              </div>
            )}
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Recommended</dt>
                <dd className="font-semibold text-text-primary">{recommended.gPerHour} g/h</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Evidence range</dt>
                <dd className="font-semibold text-text-primary">{formatRange(recommended.range, "g/h")}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Duration band</dt>
                <dd>
                  <span className="inline-block rounded-full bg-apple-blue/10 px-2 py-0.5 text-xs font-semibold text-apple-blue">
                    {BAND_LABELS[recommended.band] ?? recommended.band}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <Why why={recommended.why} />
        </div>

        {showHighCarb && (
          <div className="p-4 border border-card-border rounded-xl bg-card">
            <Switch
              id="carbs-high-carb"
              checked={inputs.event.highCarb}
              onChange={(checked) => set("event.highCarb", checked)}
              label="Gut-trained: allow 90–120 g/h"
              hint="Only if you have trained your gut with high intakes for 2–4 weeks."
            />
          </div>
        )}

        {carbs.mouthRinseHowTo && (
          <div
            data-testid="mouth-rinse-note"
            className="p-4 rounded-xl border border-apple-teal/30 bg-apple-teal/10 text-sm text-text-primary space-y-1"
          >
            <p className="font-semibold">Mouth rinse option</p>
            <p>{t(carbs.mouthRinseHowTo.summary)}</p>
            <CitationLinks ids={carbs.mouthRinseHowTo.citations} className="text-xs" />
          </div>
        )}

        <Warnings warnings={carbs.warnings.filter((w) => !SOURCE_WARNING_IDS.has(w.id))} />
      </section>

      {/* Caffeine */}
      <section aria-labelledby="activity-caffeine-heading" className="border-t border-card-border pt-6 mt-6 space-y-4">
        <SectionHeading id="activity-caffeine-heading" icon={Coffee} tint="bg-apple-amber/20 text-apple-amber">
          Caffeine
        </SectionHeading>

        <div className="p-4 border border-card-border rounded-xl bg-card space-y-2">
          <Switch
            id="caffeine-enabled"
            checked={caffeineInputs.enabled}
            onChange={(checked) => set("caffeine.enabled", checked)}
            label="Include caffeine"
          />
          <Why why={caffeine.why} />
        </div>

        {caffeine.enabled && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="caffeine-mg-per-kg" className="text-sm font-medium text-text-primary">
                  Caffeine dose
                </label>
                <output htmlFor="caffeine-mg-per-kg" className="font-bold text-apple-amber-ink">
                  {fmt(caffeineInputs.mgPerKg, 1)} mg/kg
                </output>
              </div>
              <input
                id="caffeine-mg-per-kg"
                type="range"
                min={caffeineMin}
                max={caffeineMax}
                step={0.5}
                value={caffeineInputs.mgPerKg}
                aria-valuetext={`${fmt(caffeineInputs.mgPerKg, 1)} mg per kg`}
                onChange={(e) => set("caffeine.mgPerKg", Number(e.target.value))}
                className="w-full accent-apple-amber"
              />
            </div>

            <div className="p-4 border border-card-border rounded-xl bg-card space-y-3">
              <Switch
                id="caffeine-as-ingredient"
                checked={caffeineInputs.asIngredient}
                onChange={(checked) => set("caffeine.asIngredient", checked)}
                label="Add to gels as tablets"
                hint="Crush caffeine tablets into the gels taken during the event."
              />
              {caffeineInputs.asIngredient && (
                <div>
                  <label htmlFor="caffeine-tablet-mg" className="block text-xs font-semibold text-text-secondary mb-1">
                    Tablet size
                  </label>
                  <select
                    id="caffeine-tablet-mg"
                    value={caffeineInputs.tabletMg}
                    onChange={(e) => set("caffeine.tabletMg", Number(e.target.value))}
                    className={FIELD_CLASS}
                  >
                    {INPUT_OPTIONS.tabletMg.map((mg) => (
                      <option key={mg} value={mg}>
                        {mg} mg
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {caffeine.doses.length > 0 && (
              <div className="bg-apple-amber/10 p-4 rounded-xl border border-apple-amber/20 text-sm">
                <p className="font-semibold text-text-primary mb-2">Planned doses</p>
                <ul aria-label="Planned caffeine doses" className="space-y-1">
                  {caffeine.doses.map((dose) => (
                    <li key={`${dose.kind}-${dose.timeMin}`} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-text-secondary min-w-[5rem]">{formatElapsed(dose.timeMin)}</span>
                      <span className="text-text-primary">
                        {dose.kind === "pre"
                          ? "Before the start"
                          : dose.gelIndex !== null
                            ? `With gel ${dose.gelIndex + 1}`
                            : "During the event"}
                      </span>
                      <span className="font-bold text-text-primary">{dose.mg} mg</span>
                      {dose.tablets !== null && (
                        <span className="text-text-secondary">
                          ({fmt(dose.tablets, 1)} × {caffeineInputs.tabletMg} mg tablet)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-text-secondary">
                  Total <span className="font-bold text-text-primary">{caffeine.totalMg} mg</span> (
                  {fmt(caffeine.totalMgPerKg, 1)} mg/kg)
                </p>
              </div>
            )}

            <Warnings warnings={caffeine.warnings} />
          </div>
        )}
      </section>

      {/* Sodium bicarbonate */}
      <div className="border-t border-card-border pt-6 mt-6">
        {showBicarb ? (
          <section aria-labelledby="activity-bicarb-heading" className="space-y-4">
            <SectionHeading id="activity-bicarb-heading" icon={FlaskConical} tint="bg-apple-purple/20 text-apple-purple">
              Sodium bicarbonate
            </SectionHeading>

            <div className="p-4 border border-card-border rounded-xl bg-card space-y-2">
              <Switch
                id="bicarb-enabled"
                inputRef={bicarbSwitchRef}
                checked={bicarbInputs.enabled}
                onChange={(checked) => {
                  // Keep the section open after turning it off on a long event.
                  setBicarbRevealed(true);
                  set("bicarb.enabled", checked);
                }}
                label="Include sodium bicarbonate"
                hint="A pre-race buffer for hard efforts of up to about 60 min."
              />
              <Why why={bicarb.why} />
            </div>

            {bicarb.enabled && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="bicarb-g-per-kg" className="text-sm font-medium text-text-primary">
                      Bicarbonate dose
                    </label>
                    <output htmlFor="bicarb-g-per-kg" className="font-bold text-apple-purple">
                      {fmt(bicarbInputs.gPerKg, 2)} g/kg
                    </output>
                  </div>
                  <input
                    id="bicarb-g-per-kg"
                    type="range"
                    min={bicarbMin}
                    max={bicarbMax}
                    step={0.01}
                    value={bicarbInputs.gPerKg}
                    aria-valuetext={`${fmt(bicarbInputs.gPerKg, 2)} g per kg`}
                    onChange={(e) => set("bicarb.gPerKg", Number(e.target.value))}
                    className="w-full accent-apple-purple"
                  />
                </div>

                <dl className="bg-apple-purple/10 p-4 rounded-xl border border-apple-purple/20 text-sm space-y-1">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Dose</dt>
                    <dd className="font-bold text-text-primary">{fmt(bicarb.doseG, 1)} g</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Sodium load</dt>
                    <dd className="font-bold text-text-primary">{fmt(bicarb.sodiumMg / 1000, 1)} g</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Take it</dt>
                    <dd className="font-bold text-text-primary">
                      {formatElapsed(bicarb.timingMin.recommended)}{" "}
                      <span className="font-normal text-text-secondary">
                        (window {formatElapsed(bicarb.timingMin.earliest)} to {formatElapsed(bicarb.timingMin.latest)})
                      </span>
                    </dd>
                  </div>
                </dl>

                <Warnings warnings={bicarb.warnings} />
              </div>
            )}
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setBicarbRevealed(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-apple-blue hover:underline"
          >
            <FlaskConical size={16} aria-hidden="true" />
            Show sodium bicarbonate (for efforts under ~60 min)
          </button>
        )}
      </div>
    </Card>
  );
};

export default ActivityBasics;
