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
import { FlaskConical, Scale, Minus, Plus, Trash2, Pencil, Wheat, CircleAlert } from "lucide-react";
import Card from "../shared/Card";
import Why from "../shared/Why";
import Warnings from "../shared/Warnings";
import NumberInput from "../shared/NumberInput";
import useFocusAfterRender from "../shared/useFocusAfterRender";
import Segmented, { AUTO_ADJUST_OPTIONS } from "../shared/Segmented";
import { fmt } from "../shared/format";
import { customDisplayName } from "../shared/recipe";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { formatRatio } from "../../domain/carbs";
import { ingredientProfile } from "../../domain/solver";
import { formatAmount } from "../../domain/recipe";
import { carbSourceOptions } from "../../constants/constants";

/** @typedef {import('../../domain/plan').PlanInputs} PlanInputs */
/** @typedef {import('../../domain/plan').IngredientRef} IngredientRef */
/** @typedef {import('../../domain/plan').CustomCarb} CustomCarb */
/** @typedef {import('../../domain/solver').IngredientProfile} IngredientProfile */
/** @typedef {'glucose'|'fructose'} Pathway */
/** @typedef {{ name: string, carbsPer100g: string, fructoseSharePct: string, waterPct: string }} CustomDraft */

/** Step of the ratio sliders and +/- buttons, in parts. */
const RATIO_STEP = 0.05;
/** Upper end of the ratio sliders. Larger parts (from a share link) stretch the slider. */
const RATIO_SLIDER_MAX = 2;

/** Preference weight of an ingredient when it is added to the list (the middle of 0–100). */
const NEW_INGREDIENT_WEIGHT = 50;

/** Below this many grams of carbs per gram the solver treats an ingredient as carb-free. */
const MIN_CARBS_PER_GRAM = 1e-6;

const [WEIGHT_MIN, WEIGHT_MAX] = INPUT_LIMITS.ingredientWeight;
const [, MAX_CUSTOM] = INPUT_LIMITS.customIngredients;
const [, MAX_NAME_CHARS] = INPUT_LIMITS.customNameChars;
const [LABEL_PCT_MIN, LABEL_PCT_MAX] = INPUT_LIMITS.labelPct;

/** Built-in carb sources by id, for their group ('powder' or 'syrup'). */
const SOURCE_BY_ID = new Map(carbSourceOptions.map((option) => [option.id, option]));

/** The add menu's groups of built-in sources, in `carbSourceOptions` order (powders first). */
const SOURCE_GROUPS = [
  { group: "powder", label: "Powders" },
  { group: "syrup", label: "Syrups" },
];

/** Tag shown next to each ingredient in the list. */
const KIND_LABELS = { powder: "Powder", syrup: "Syrup", custom: "Yours" };

/** Per-pathway colour classes of the ratio part controls. */
const PATHWAY_STYLES = {
  glucose: {
    stepper: "hover:border-apple-blue hover:text-apple-blue",
    slider: "bg-apple-blue/20 accent-apple-blue",
  },
  fructose: {
    stepper: "hover:border-apple-purple hover:text-apple-purple",
    slider: "bg-apple-purple/20 accent-apple-purple",
  },
};

const LABEL_CLASS = "block text-xs font-medium text-text-secondary mb-1";
const FIELD_CLASS =
  "w-full px-3 py-2 border border-card-border rounded-lg outline-none text-sm font-medium text-text-primary bg-card focus:ring-2 focus:ring-apple-blue focus:border-transparent";
const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const PRIMARY_BUTTON_CLASS = `${BUTTON_CLASS} bg-apple-blue text-white hover:bg-apple-blue/90`;
const SECONDARY_BUTTON_CLASS = `${BUTTON_CLASS} border border-card-border bg-card text-text-primary hover:border-card-border-hover`;
const ICON_BUTTON_CLASS = "p-2 rounded-lg text-text-secondary transition-colors";

const round2 = (x) => Math.round(x * 100) / 100;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * A fructose share (fructose ÷ all carbs) as ratio text, normalised to
 * glucose 1 by {@link formatRatio}: `1/3` → `"1:0.5"`, `1` → `"0:1"`.
 * @param {number} share
 * @returns {string}
 */
const shareText = (share) => formatRatio({ glucose: 1 - share, fructose: share });

/**
 * A share (0–1) as a whole percentage, e.g. `"33%"`.
 * @param {number} share
 * @returns {string}
 */
const percent = (share) => `${fmt(share * 100, 0)}%`;

/**
 * The value of an ingredient in the add menu: the id as text for a built-in
 * source, the key ('c1') for a custom ingredient.
 * @param {number|string} ref
 * @returns {string}
 */
const refToValue = (ref) => String(ref);

/**
 * The ingredient ref behind an add-menu value (see {@link refToValue}).
 * @param {string} value
 * @returns {number|string}
 */
const valueToRef = (value) => (/^\d+$/.test(value) ? Number(value) : value);

/**
 * The first free custom ingredient key ('c1'..'c10'), or null when all ten are used.
 * @param {CustomCarb[]} custom
 * @returns {string|null}
 */
function nextCustomKey(custom) {
  const used = new Set(custom.map((c) => c.key));
  for (let n = 1; n <= MAX_CUSTOM; n++) {
    if (!used.has(`c${n}`)) return `c${n}`;
  }
  return null;
}

/**
 * The name a custom ingredient is shown with ("Custom ingredient N" when the
 * name is blank, which only a share link can give).
 * @param {CustomCarb} custom
 * @returns {string}
 */
const customName = (custom) => customDisplayName("carb", custom);

/**
 * Slider with -/+ buttons for one part of the manual ratio. The buttons move
 * in 0.05 steps between 0 and 2; a larger value from a share link widens the
 * slider so it is never misrepresented, and can be stepped down.
 *
 * @param {{ id: string, label: string, value: number, pathway: Pathway,
 *   onChange: (value: number | ((current: number) => number)) => void }} props
 */
function RatioPartControl({ id, label, value, pathway, onChange }) {
  const { stepper, slider } = PATHWAY_STYLES[pathway];
  const lower = label.toLowerCase();
  const buttonClass = `w-8 h-8 shrink-0 flex items-center justify-center bg-card border border-card-border rounded-full shadow-sm text-text-secondary ${stepper} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-card-border disabled:hover:text-text-secondary`;

  return (
    <div>
      <div className="flex justify-between text-xs text-text-secondary mb-2">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <output htmlFor={id} className="font-bold text-text-primary">
          {value.toFixed(2)}
        </output>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${lower}`}
          disabled={value <= 0}
          onClick={() => onChange((p) => Math.max(0, round2(p - RATIO_STEP)))}
          className={buttonClass}
        >
          <Minus size={14} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="range"
          min="0"
          max={Math.max(RATIO_SLIDER_MAX, value)}
          step={RATIO_STEP}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full h-2.5 rounded-lg appearance-none cursor-pointer ${slider}`}
        />
        <button
          type="button"
          aria-label={`Increase ${lower}`}
          disabled={value >= RATIO_SLIDER_MAX}
          onClick={() => onChange((p) => Math.min(RATIO_SLIDER_MAX, round2(p + RATIO_STEP)))}
          className={buttonClass}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Small legend symbols. Each item on the range bar has its own shape, so the
 * bar never relies on colour alone; the legend text says what each one is.
 */
const LEGEND_SYMBOLS = {
  reachable: <span className="inline-block w-5 h-2.5 rounded-full bg-apple-blue/50" />,
  allowed: <span className="inline-block w-5 h-3 rounded-full border-2 border-dashed border-text-secondary" />,
  target: <span className="inline-block w-0.5 h-3.5 bg-text-primary" />,
  recipe: <span className="inline-block w-3 h-3 rounded-full border-2 border-apple-blue bg-card" />,
};

/**
 * The fructose shares the ingredients can make, drawn on a bar from 1:0
 * (glucose only) through 1:1 to 0:1 (fructose only), with the allowed range
 * (Auto ratio only), the target as a line and the recipe's ratio as a ring.
 * The bar is decorative; the legend under it states every value as text.
 *
 * @param {{ feasible: [number, number]|null, allowed: [number, number]|null, target: number|null,
 *   targetText: string, recipe: number|null }} props
 *   Shares are fructose ÷ all carbs (0–1). `allowed` null hides the allowed band; `target` null
 *   (a 0:0 ratio) hides the target line; `recipe` null (no carbs in the recipe) hides the ring.
 */
function RatioRangeBar({ feasible, allowed, target, targetText, recipe }) {
  const at = (share) => `${clamp01(share) * 100}%`;
  // A range shows at least 8 px wide, so a single reachable ratio stays visible.
  const span = ([lo, hi]) => ({
    left: `calc(${at(lo)} - 4px)`,
    width: `calc(${(clamp01(hi) - clamp01(lo)) * 100}% + 8px)`,
  });
  const reachableText = !feasible
    ? "None"
    : shareText(feasible[0]) === shareText(feasible[1])
      ? `${shareText(feasible[0])} only`
      : `${shareText(feasible[0])}–${shareText(feasible[1])}`;
  const legend = [
    { key: "reachable", term: "Reachable", value: reachableText },
    allowed && { key: "allowed", term: "Allowed", value: `${shareText(allowed[0])}–${shareText(allowed[1])}` },
    { key: "target", term: "Target", value: targetText },
    { key: "recipe", term: "Your recipe", value: recipe === null ? "No carbs yet" : shareText(recipe) },
  ].filter(Boolean);

  return (
    <figure aria-labelledby="carb-ratio-range-caption" className="space-y-2">
      <figcaption id="carb-ratio-range-caption" className="text-sm font-semibold text-text-primary">
        Ratios your ingredients can make
      </figcaption>
      <div aria-hidden="true" className="pt-3 pb-1">
        <div className="relative h-3 rounded-full bg-card-border">
          {/* Positions sit 6 px inside the track ends, so markers at 1:0 and 0:1 stay on it. */}
          <div className="absolute inset-y-0 inset-x-1.5">
            {allowed && (
              <div
                data-testid="ratio-range-allowed"
                className="absolute -inset-y-1 rounded-full border-2 border-dashed border-text-secondary"
                style={span(allowed)}
              />
            )}
            {feasible && (
              <div
                data-testid="ratio-range-reachable"
                className="absolute inset-y-0 rounded-full bg-apple-blue/50"
                style={span(feasible)}
              />
            )}
            {target !== null && (
              <div
                data-testid="ratio-range-target"
                className="absolute -top-2 -bottom-2 w-0.5 -translate-x-1/2 bg-text-primary"
                style={{ left: at(target) }}
              />
            )}
            {recipe !== null && (
              <div
                data-testid="ratio-range-recipe"
                className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-apple-blue bg-card"
                style={{ left: at(recipe) }}
              />
            )}
          </div>
        </div>
        <div className="relative h-4 mt-1.5 text-[11px] text-text-secondary">
          <span className="absolute left-0">1:0</span>
          <span className="absolute left-1/2 -translate-x-1/2">1:1</span>
          <span className="absolute right-0">0:1</span>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {legend.map(({ key, term, value }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-text-secondary">
              <span aria-hidden="true" className="inline-flex w-5 justify-center">
                {LEGEND_SYMBOLS[key]}
              </span>
              {term}
            </dt>
            <dd className="font-semibold text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/**
 * One row of the ingredient list: name, kind, carbs and pathway split, what
 * the recipe uses of it, a remove button and the preference weight (number
 * field and slider, both 0–100, bound to `carbs.ingredients[index].weight`).
 *
 * @param {{ index: number, entry: IngredientRef, profile: IngredientProfile|null,
 *   item: { grams: number, carbsG: number }|undefined, deliveredG: number, duplicate: boolean,
 *   set: (path: string, value: unknown) => void, onRemove: () => void }} props
 */
function IngredientRow({ index, entry, profile, item, deliveredG, duplicate, set, onRemove }) {
  // An unnamed custom ingredient is labelled with its key by the solver.
  const label =
    profile?.custom && profile.label === entry.ref
      ? customDisplayName("carb", { key: entry.ref })
      : (profile?.label ?? String(entry.ref));
  const kind = profile?.custom ? "custom" : (SOURCE_BY_ID.get(entry.ref)?.group ?? "powder");
  const weightId = `carb-ingredient-${index}-weight`;
  const sliderId = `${weightId}-slider`;
  const usageId = `carb-ingredient-${index}-usage`;
  const hasCarbs = profile !== null && profile.carbsPerGram >= MIN_CARBS_PER_GRAM;

  let usage;
  if (!hasCarbs) usage = "Has no carbs, so the recipe leaves it out.";
  else if (duplicate) usage = "Listed above too. The two weights add up.";
  else if (item && deliveredG > 0) {
    usage = `In the recipe: ${formatAmount(item.grams, "g")}, ${percent(item.carbsG / deliveredG)} of the carbs.`;
  } else if (deliveredG > 0) usage = "Not used. The mix reaches the ratio without it.";
  else usage = "Not used. The plan has no carbs to split.";

  const commitWeight = (value) => set(`carbs.ingredients.${index}.weight`, value);

  return (
    <li className="p-3 border border-card-border rounded-xl bg-card shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
            <span>{label}</span>
            <span className="rounded-md border border-card-border bg-card-border/40 px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
              {KIND_LABELS[kind]}
            </span>
          </p>
          {profile && (
            <p className="text-xs text-text-secondary">
              {fmt(profile.carbsPerGram * 100, 1)} g carbs per 100 g · glucose {percent(1 - profile.fructoseShare)} ·
              fructose {percent(profile.fructoseShare)}
            </p>
          )}
          <p id={usageId} className="mt-1 text-xs font-medium text-text-primary" data-testid="ingredient-usage">
            {usage}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className={`${ICON_BUTTON_CLASS} hover:text-apple-red`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={weightId} className="text-xs font-medium text-text-secondary">
          Weight<span className="sr-only"> of {label}</span>
        </label>
        <NumberInput
          id={weightId}
          value={entry.weight}
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          emptyValue={0}
          aria-describedby={usageId}
          onCommit={commitWeight}
          className="w-16 shrink-0 bg-card-border/30 border border-card-border rounded-lg px-2 py-1 text-sm font-semibold text-right text-text-primary outline-none focus:ring-2 focus:ring-apple-blue"
        />
        <label htmlFor={sliderId} className="sr-only">
          Weight of {label} (slider)
        </label>
        <input
          id={sliderId}
          type="range"
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          step={1}
          value={entry.weight}
          onChange={(e) => commitWeight(Number(e.target.value))}
          className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-apple-blue/20 accent-apple-blue"
        />
      </div>
    </li>
  );
}

/**
 * A draft for the custom ingredient form: empty for a new one, the stored
 * values (as text) for an edit.
 * @param {CustomCarb|null} custom
 * @returns {CustomDraft}
 */
function draftFrom(custom) {
  if (!custom) return { name: "", carbsPer100g: "", fructoseSharePct: "", waterPct: "" };
  return {
    name: custom.name,
    carbsPer100g: String(custom.carbsPer100g),
    fructoseSharePct: String(custom.fructoseSharePct),
    waterPct: custom.waterPct === undefined ? "" : String(custom.waterPct),
  };
}

/** Parses a form field; empty text is NaN. */
const parseField = (text) => (String(text).trim() === "" ? NaN : Number(text));

/** Form fields in screen order (the first invalid one gets the focus). */
const DRAFT_FIELDS = /** @type {const} */ (["name", "carbsPer100g", "fructoseSharePct", "waterPct"]);

/**
 * Checks a custom ingredient draft.
 *
 * - Name: required (trimmed).
 * - Carbs per 100 g: more than 0 and at most 100 (an ingredient without carbs adds nothing).
 * - Fructose share of the carbs: 0–100 %.
 * - Water per 100 g: optional; 0–100 and, with the carbs, at most 100 g.
 *
 * @param {CustomDraft} draft
 * @returns {{ errors: Partial<Record<keyof CustomDraft, string>>,
 *   value: Omit<CustomCarb, 'key'> | null }} `value` is null while there are errors.
 */
function checkDraft(draft) {
  /** @type {Partial<Record<keyof CustomDraft, string>>} */
  const errors = {};
  const name = draft.name.trim();
  const carbs = parseField(draft.carbsPer100g);
  const fructose = parseField(draft.fructoseSharePct);
  const hasWater = draft.waterPct.trim() !== "";
  const water = parseField(draft.waterPct);

  if (name === "") errors.name = "Enter a name.";
  if (!(carbs > LABEL_PCT_MIN && carbs <= LABEL_PCT_MAX)) errors.carbsPer100g = "Enter more than 0 and at most 100 g.";
  if (!(fructose >= LABEL_PCT_MIN && fructose <= LABEL_PCT_MAX)) errors.fructoseSharePct = "Enter 0 to 100%.";
  if (hasWater && !(water >= LABEL_PCT_MIN && water <= LABEL_PCT_MAX)) {
    errors.waterPct = "Enter 0 to 100 g, or leave it empty.";
  } else if (hasWater && !errors.carbsPer100g && carbs + water > LABEL_PCT_MAX) {
    errors.waterPct = "Carbs and water add up to more than 100 g.";
  }

  if (Object.keys(errors).length > 0) return { errors, value: null };
  return {
    errors,
    value: { name, carbsPer100g: carbs, fructoseSharePct: fructose, ...(hasWater ? { waterPct: water } : {}) },
  };
}

/**
 * One labelled field of the custom ingredient form, with an optional hint and
 * an error (both linked with `aria-describedby`). `autoFocus` is for the first
 * field: the form opens on a click, so moving the focus into it is expected.
 *
 * @param {{ id: string, name: keyof CustomDraft, label: string, hint?: string, error?: string,
 *   value: string, onChange: (value: string) => void, type?: 'text'|'number', autoFocus?: boolean,
 *   unit?: string }} props
 */
function DraftField({ id, name, label, hint, error, value, onChange, type = "number", autoFocus = false, unit }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const numberProps =
    type === "number" ? { inputMode: "decimal", min: LABEL_PCT_MIN, max: LABEL_PCT_MAX, step: "any" } : {};
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          autoFocus={autoFocus}
          maxLength={type === "text" ? MAX_NAME_CHARS : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_CLASS} ${error ? "border-apple-red" : ""}`}
          {...numberProps}
        />
        {unit && (
          <span aria-hidden="true" className="text-sm text-text-secondary">
            {unit}
          </span>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 flex items-center gap-1 text-xs font-medium text-apple-red">
          <CircleAlert size={12} aria-hidden="true" className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Form for a custom ingredient typed in from a label: name, carbs per 100 g,
 * the fructose share of those carbs and (optional) water per 100 g. Saving
 * checks the values ({@link checkDraft}) and moves the focus to the first
 * field with a problem.
 *
 * @param {{ title: string, initial: CustomCarb|null, onSave: (value: Omit<CustomCarb, 'key'>) => void,
 *   onCancel: () => void }} props
 */
function CustomIngredientForm({ title, initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [errors, setErrors] = useState(/** @type {Partial<Record<keyof CustomDraft, string>>} */ ({}));
  const update = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }));

  const submit = (event) => {
    event.preventDefault();
    const result = checkDraft(draft);
    setErrors(result.errors);
    if (result.value) {
      onSave(result.value);
      return;
    }
    const first = DRAFT_FIELDS.find((field) => result.errors[field]);
    const element = event.currentTarget.elements.namedItem(first);
    if (element && typeof element.focus === "function") element.focus();
  };

  return (
    <form noValidate onSubmit={submit} className="p-4 rounded-xl border border-apple-blue/30 bg-apple-blue/5 space-y-4">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-text-primary">{title}</legend>
        <DraftField
          id="carb-custom-name"
          name="name"
          type="text"
          label="Name"
          autoFocus
          value={draft.name}
          error={errors.name}
          onChange={update("name")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DraftField
            id="carb-custom-carbs"
            name="carbsPer100g"
            label="Carbs per 100 g"
            unit="g"
            hint="Total carbohydrate from the label."
            value={draft.carbsPer100g}
            error={errors.carbsPer100g}
            onChange={update("carbsPer100g")}
          />
          <DraftField
            id="carb-custom-fructose"
            name="fructoseSharePct"
            label="Fructose share of the carbs"
            unit="%"
            hint="Fructose plus half the sucrose. Maltodextrin: 0%. Honey: about 50%."
            value={draft.fructoseSharePct}
            error={errors.fructoseSharePct}
            onChange={update("fructoseSharePct")}
          />
          <DraftField
            id="carb-custom-water"
            name="waterPct"
            label="Water per 100 g (optional)"
            unit="g"
            hint="Leave empty to count the rest of the mass as water."
            value={draft.waterPct}
            error={errors.waterPct}
            onChange={update("waterPct")}
          />
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY_BUTTON_CLASS}>
          Save ingredient
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Id of the "New ingredient" button, where focus goes after a delete. */
const NEW_BUTTON_ID = "carb-custom-new";

/**
 * The user's own ingredients (`inputs.carbs.custom`): each with its label
 * values, Edit and Delete (with an in-place confirmation), and a "New
 * ingredient" button (at most 10). A new ingredient is added to the
 * ingredient list at once; deleting one also removes it from the list.
 *
 * Focus never drops to the page: after saving it moves to the ingredient's
 * Edit button, after Cancel back to the button that opened the form, on
 * Delete to "Keep" (so a second Enter does not delete), after Keep back to
 * Delete, and after deleting to "New ingredient".
 *
 * @param {{ custom: CustomCarb[], set: (path: string, value: unknown) => void }} props
 */
function CustomIngredients({ custom, set }) {
  // null: no form open; 'new': the new-ingredient form; a key: that ingredient's edit form.
  const [editing, setEditing] = useState(/** @type {string|null} */ (null));
  const [confirming, setConfirming] = useState(/** @type {string|null} */ (null));
  const focusAfterRender = useFocusAfterRender();
  const full = custom.length >= MAX_CUSTOM;
  const idOf = (key, what) => `carb-custom-${key}-${what}`;

  const create = (value) => {
    const key = nextCustomKey(custom);
    focusAfterRender(...(key === null ? [] : [idOf(key, "edit")]), NEW_BUTTON_ID);
    set("carbs", (carbs) => {
      const key = nextCustomKey(carbs.custom);
      if (key === null) return carbs;
      return {
        ...carbs,
        custom: [...carbs.custom, { key, ...value }],
        ingredients: [...carbs.ingredients, { ref: key, weight: NEW_INGREDIENT_WEIGHT }],
      };
    });
    setEditing(null);
  };
  const save = (key) => (value) => {
    set("carbs.custom", (list) => list.map((c) => (c.key === key ? { key, ...value } : c)));
    focusAfterRender(idOf(key, "edit"));
    setEditing(null);
  };
  const cancelForm = (key) => {
    focusAfterRender(key === "new" ? NEW_BUTTON_ID : idOf(key, "edit"), NEW_BUTTON_ID);
    setEditing(null);
  };
  const askDelete = (key) => {
    focusAfterRender(idOf(key, "keep"));
    setConfirming(key);
  };
  const keep = (key) => {
    focusAfterRender(idOf(key, "delete"));
    setConfirming(null);
  };
  const remove = (key) => {
    set("carbs", (carbs) => ({
      ...carbs,
      custom: carbs.custom.filter((c) => c.key !== key),
      ingredients: carbs.ingredients.filter((entry) => entry.ref !== key),
    }));
    focusAfterRender(NEW_BUTTON_ID, "carb-custom-name");
    setConfirming(null);
  };

  return (
    <section aria-labelledby="carb-custom-heading" className="pt-6 border-t border-card-border space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 id="carb-custom-heading" className="text-sm font-semibold text-text-primary">
            Your ingredients
          </h4>
          <p className="text-xs text-text-secondary">Type in a gel, drink mix or syrup from its label.</p>
        </div>
        <button
          id={NEW_BUTTON_ID}
          type="button"
          onClick={() => {
            setConfirming(null);
            setEditing("new");
          }}
          disabled={full || editing !== null}
          aria-describedby={full ? "carb-custom-full" : undefined}
          className={SECONDARY_BUTTON_CLASS}
        >
          <Plus size={14} aria-hidden="true" /> New ingredient
        </button>
      </div>
      {full && (
        <p id="carb-custom-full" className="text-xs text-text-secondary">
          You have {MAX_CUSTOM} of your own ingredients, the most the app keeps. Delete one to add another.
        </p>
      )}
      {custom.length > 0 && (
        <ul className="space-y-2" aria-label="Your ingredients">
          {custom.map((c) => {
            const name = customName(c);
            if (editing === c.key) {
              return (
                <li key={c.key}>
                  <CustomIngredientForm
                    title={`Edit ${name}`}
                    initial={c}
                    onSave={save(c.key)}
                    onCancel={() => cancelForm(c.key)}
                  />
                </li>
              );
            }
            return (
              <li
                key={c.key}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-card-border bg-card"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{name}</p>
                  <p className="text-xs text-text-secondary">
                    {fmt(c.carbsPer100g, 1)} g carbs per 100 g · fructose {fmt(c.fructoseSharePct, 1)}% of the carbs
                    {c.waterPct !== undefined && ` · water ${fmt(c.waterPct, 1)} g per 100 g`}
                  </p>
                </div>
                {confirming === c.key ? (
                  <div key="confirm" className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-text-primary">Delete {name}? It leaves the ingredient list too.</p>
                    <button
                      id={idOf(c.key, "confirm")}
                      type="button"
                      onClick={() => remove(c.key)}
                      className={`${BUTTON_CLASS} bg-apple-red text-white`}
                    >
                      Yes, delete
                    </button>
                    <button
                      id={idOf(c.key, "keep")}
                      type="button"
                      onClick={() => keep(c.key)}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <div key="actions" className="flex items-center">
                    <button
                      id={idOf(c.key, "edit")}
                      type="button"
                      aria-label={`Edit ${name}`}
                      disabled={editing !== null}
                      onClick={() => {
                        setConfirming(null);
                        setEditing(c.key);
                      }}
                      className={`${ICON_BUTTON_CLASS} hover:text-apple-blue disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      id={idOf(c.key, "delete")}
                      type="button"
                      aria-label={`Delete ${name}`}
                      onClick={() => askDelete(c.key)}
                      className={`${ICON_BUTTON_CLASS} hover:text-apple-red`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing === "new" && (
        <CustomIngredientForm title="New ingredient" initial={null} onSave={create} onCancel={() => cancelForm("new")} />
      )}
    </section>
  );
}

/**
 * The add menu: every ingredient not yet in the list, grouped into powders,
 * syrups and the user's own ingredients, and an Add button. A new entry gets
 * weight 50.
 *
 * @param {{ ingredients: IngredientRef[], custom: CustomCarb[], onAdd: (ref: number|string) => void }} props
 */
function AddIngredient({ ingredients, custom, onAdd }) {
  const listed = new Set(ingredients.map((entry) => entry.ref));
  const groups = [
    ...SOURCE_GROUPS.map(({ group, label }) => ({
      label,
      options: carbSourceOptions
        .filter((option) => option.group === group && !listed.has(option.id))
        .map((option) => ({ value: refToValue(option.id), label: option.label })),
    })),
    {
      label: "Your ingredients",
      options: custom
        .filter((c) => !listed.has(c.key))
        .map((c) => ({ value: refToValue(c.key), label: customName(c) })),
    },
  ].filter((g) => g.options.length > 0);
  const values = groups.flatMap((g) => g.options.map((o) => o.value));

  const [choice, setChoice] = useState("");
  // The remembered choice may have been added meanwhile; fall back to the first one left.
  const selected = values.includes(choice) ? choice : (values[0] ?? "");

  if (values.length === 0) {
    return <p className="text-sm text-text-secondary">Every ingredient is in the list.</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[12rem]">
        <label htmlFor="carb-ingredient-add" className={LABEL_CLASS}>
          Add an ingredient
        </label>
        <select
          id="carb-ingredient-add"
          value={selected}
          onChange={(e) => setChoice(e.target.value)}
          className={FIELD_CLASS}
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <button type="button" onClick={() => onAdd(valueToRef(selected))} className={SECONDARY_BUTTON_CLASS}>
        <Plus size={14} aria-hidden="true" /> Add
      </button>
    </div>
  );
}

/**
 * Carbohydrate card: the glucose:fructose ratio and the ingredients that make
 * it.
 *
 * - Pathway Ratio, Auto: the recommended ratio for the current carb target,
 *   its allowed range and the "Why?" explanation (`plan.carbs.ratio.recommended`).
 * - Pathway Ratio, Adjust: glucose and fructose part sliders bound to
 *   `inputs.carbs.manualRatio`, with the `checkRatio` warnings. Switching to
 *   Adjust starts from the ratio in use, so nothing jumps.
 * - Ingredients: the ratios the ingredients can make as a bar
 *   (`plan.carbs.ingredients.feasibleRange`) with the allowed range, the
 *   target and the recipe's ratio (`achievedShare`); the solver warnings
 *   (`carbs.ratioNotReachable`, `carbs.noIngredients`); one list
 *   (`inputs.carbs.ingredients`) with a preference weight per ingredient
 *   (number and slider, 0–100) and what the recipe uses of it; the add menu
 *   (powders, syrups, your ingredients); and the user's own ingredients
 *   (`inputs.carbs.custom`) with a form to add, edit or delete them.
 *
 * Reads the plan from `usePlan()` and edits the inputs through
 * `usePlanInputs()`. Domain messages render through `t()` (via `Why` and
 * `Warnings`); ratios are shown with `formatRatio`.
 */
const CarbMatrix = () => {
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();

  const ratio = plan.carbs.ratio;
  const recommended = ratio.recommended;
  const isManual = ratio.mode === "manual";
  const hasRatio = ratio.value.glucose + ratio.value.fructose > 0;
  const setRatioMode = (mode) => {
    if (mode === ratio.mode) return;
    // Adjust starts from the ratio in use, so switching never jumps the value.
    if (mode === "manual") apply({ carbs: { ratioMode: "manual", manualRatio: { ...ratio.value } } });
    else set("carbs.ratioMode", "auto");
  };

  const solution = plan.carbs.ingredients;
  const deliveredG = plan.carbs.deliveredG;
  const recipeShare = solution.items.length > 0 ? solution.achievedShare : null;
  const targetText = formatRatio(ratio.value);
  // In Auto mode the solver may pick another ratio inside the allowed range
  // without a warning (e.g. glucose-only powders at 55 g/h); say so here.
  const substituted =
    !isManual &&
    recipeShare !== null &&
    solution.adjusted &&
    solution.warnings.length === 0 &&
    shareText(recipeShare) !== targetText;

  const itemsByRef = new Map(solution.items.map((item) => [item.ref, item]));
  const seenRefs = new Set();
  const rows = inputs.carbs.ingredients.map((entry, index) => {
    const duplicate = seenRefs.has(entry.ref);
    seenRefs.add(entry.ref);
    // Rows are positions in the input list (paths use the index); the key also names the ref.
    return { entry, index, duplicate, key: `${index}-${String(entry.ref)}` };
  });

  const addIngredient = (ref) =>
    set("carbs.ingredients", (list) =>
      list.some((entry) => entry.ref === ref) ? list : [...list, { ref, weight: NEW_INGREDIENT_WEIGHT }],
    );
  const removeIngredient = (index) => set("carbs.ingredients", (list) => list.filter((_, i) => i !== index));

  return (
    <Card>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-apple-blue/10 p-2 rounded-lg text-apple-blue">
          <FlaskConical size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-primary">Carbohydrate Matrix</h2>
          <p className="text-sm text-text-secondary">
            Pick your ingredients and the glucose to fructose ratio they should make.
          </p>
        </div>
      </div>

      <section
        aria-labelledby="carb-ratio-heading"
        className="bg-card-border/30 rounded-xl p-5 border border-card-border mb-8"
      >
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-apple-blue" aria-hidden="true" />
            <h3 id="carb-ratio-heading" className="font-semibold text-text-primary">
              Pathway Ratio
            </h3>
          </div>
          <Segmented label="Ratio mode" value={ratio.mode} onChange={setRatioMode} options={AUTO_ADJUST_OPTIONS} />
        </div>

        <div className="bg-apple-blue/10 p-4 rounded-xl border border-apple-blue/20 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                {isManual ? "Your ratio" : "Recommended ratio"}
              </p>
              <p className="text-3xl font-bold text-apple-blue" data-testid="carb-ratio-value">
                {targetText}
              </p>
              <p className="text-xs text-text-secondary">
                Glucose : fructose at your {fmt(plan.carbs.gPerHour, 1)} g/h target
              </p>
            </div>
            <dl className="text-sm space-y-1">
              {isManual && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Recommended</dt>
                  <dd className="font-semibold text-text-primary">{formatRatio(recommended.ratio)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Allowed range</dt>
                <dd className="font-semibold text-text-primary">
                  {shareText(recommended.minShare)}–{shareText(recommended.maxShare)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Fructose share</dt>
                <dd className="font-semibold text-text-primary">
                  {percent(ratio.share)}{" "}
                  <span className="font-normal text-text-secondary">
                    (allowed {fmt(recommended.minShare * 100, 0)}–{fmt(recommended.maxShare * 100, 0)}%)
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <Why why={recommended.why} />
        </div>

        {isManual && (
          <div className="space-y-6 mt-6">
            <RatioPartControl
              id="carb-ratio-glucose"
              label="Glucose parts"
              pathway="glucose"
              value={inputs.carbs.manualRatio.glucose}
              onChange={(value) => set("carbs.manualRatio.glucose", value)}
            />
            <RatioPartControl
              id="carb-ratio-fructose"
              label="Fructose parts"
              pathway="fructose"
              value={inputs.carbs.manualRatio.fructose}
              onChange={(value) => set("carbs.manualRatio.fructose", value)}
            />
          </div>
        )}

        <Warnings warnings={ratio.warnings} className="mt-6" />
      </section>

      <section
        aria-labelledby="carb-ingredients-heading"
        className="p-5 rounded-xl border border-card-border bg-card-border/30 space-y-6"
      >
        <div>
          <div className="flex items-center gap-2">
            <Wheat size={18} className="text-apple-blue" aria-hidden="true" />
            <h3 id="carb-ingredients-heading" className="font-semibold text-text-primary">
              Ingredients
            </h3>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Weights say how much of each you prefer. The mix stays as close to them as the ratio allows.
          </p>
        </div>

        <div className="space-y-3">
          <RatioRangeBar
            feasible={solution.feasibleRange}
            allowed={isManual ? null : ratio.allowedShare}
            target={hasRatio ? ratio.share : null}
            targetText={targetText}
            recipe={recipeShare}
          />
          {substituted && (
            <p className="text-xs text-text-secondary" data-testid="ratio-substituted">
              Your ingredients cannot make {targetText}. The recipe uses {shareText(recipeShare)}, which is still in the
              allowed range at {fmt(plan.carbs.gPerHour, 1)} g/h.
            </p>
          )}
          <Warnings warnings={solution.warnings} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-text-secondary">No ingredients yet. Add one below.</p>
        ) : (
          <ul className="space-y-3" aria-label="Ingredient list">
            {rows.map(({ entry, index, duplicate, key }) => (
              <IngredientRow
                key={key}
                index={index}
                entry={entry}
                profile={ingredientProfile(entry.ref, inputs.carbs.custom)}
                item={duplicate ? undefined : itemsByRef.get(entry.ref)}
                deliveredG={deliveredG}
                duplicate={duplicate}
                set={set}
                onRemove={() => removeIngredient(index)}
              />
            ))}
          </ul>
        )}

        <AddIngredient ingredients={inputs.carbs.ingredients} custom={inputs.carbs.custom} onAdd={addIngredient} />

        <CustomIngredients custom={inputs.carbs.custom} set={set} />
      </section>
    </Card>
  );
};

export default CarbMatrix;
