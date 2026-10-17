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
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Field, { CONTROL_CLASSES } from "../ui/Field";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { roundTo } from "../../domain/units";
import {
  DRAFT_FIELDS,
  NEW_INGREDIENT_WEIGHT,
  checkIngredientDraft,
  customIngredientName,
  draftFrom,
  freeCustomKey,
} from "./IngredientsHelpers";
import { useFocusAfterRender } from "../ui/useFocusAfterRender";

/** @typedef {import('../../domain/plan').CustomCarb} CustomCarb */
/** @typedef {import('./IngredientsHelpers').IngredientDraft} IngredientDraft */

const [, MAX_CUSTOM] = INPUT_LIMITS.customIngredients;
const [, MAX_NAME_CHARS] = INPUT_LIMITS.customNameChars;

/**
 * Form for a custom ingredient typed in from a label: name, carbs per 100 g,
 * the fructose share of those carbs and (optional) water per 100 g. The
 * draft stays in the form until "Save ingredient"; saving checks it
 * (`checkIngredientDraft`, numbers in the UI locale) and moves the focus to
 * the first field with a problem. The name field gets the focus when the
 * form opens (it opens on a click, so that is expected); Escape cancels
 * (the handler calls `preventDefault`, so a surrounding dialog stays open).
 *
 * @param {{ idPrefix: string, title: string, initial: CustomCarb|null,
 *   onSave: (value: Omit<CustomCarb, 'key'>) => void, onCancel: () => void, headingLevel?: number }} props
 */
export function IngredientsCustomForm({ idPrefix, title, initial, onSave, onCancel, headingLevel = 4 }) {
  const t = useT();
  const f = useFormat();
  const [draft, setDraft] = useState(() => draftFrom(f, initial));
  const [errors, setErrors] = useState(/** @type {Partial<Record<keyof IngredientDraft, string>>} */ ({}));
  const nameRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const id = (name) => `${idPrefix}-${name}`;
  const headingId = id("heading");
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 4))}`;
  const update = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));
  const error = (field) => (errors[field] ? t(errors[field]) : undefined);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const result = checkIngredientDraft(f, draft);
    setErrors(result.errors);
    if (result.value) {
      onSave(result.value);
      return;
    }
    const first = DRAFT_FIELDS.find((field) => result.errors[field]);
    document.getElementById(id(first))?.focus();
  };

  /**
   * A number field of the form: text with a decimal keyboard (checked on save, not while typing).
   * @param {keyof IngredientDraft} field
   * @param {string} unit
   * @param {import('../ui/Field').FieldControlProps} props
   */
  const numberInput = (field, unit, props) => (
    <div className="flex items-center gap-2">
      <input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        name={field}
        value={draft[field]}
        onChange={update(field)}
        className={cx(CONTROL_CLASSES, "num text-right")}
      />
      <span aria-hidden="true" className="w-4 shrink-0 text-body-sm text-muted">
        {unit}
      </span>
    </div>
  );

  return (
    <form
      aria-labelledby={headingId}
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="@container space-y-4 rounded-panel border border-line-strong bg-surface p-3 lg:p-4"
      data-testid="custom-ingredient-form"
    >
      {/* One step below the "Your ingredients" title: the display face at body size. */}
      <Heading id={headingId} className="font-display text-body font-bold uppercase tracking-[0.02em] text-ink">
        {title}
      </Heading>
      <Field label={t("ui-setup-recipe.custom.form.name")} id={id("name")} error={error("name")}>
        {(props) => (
          <input
            {...props}
            ref={nameRef}
            type="text"
            name="name"
            autoComplete="off"
            maxLength={MAX_NAME_CHARS}
            value={draft.name}
            onChange={update("name")}
            className={CONTROL_CLASSES}
          />
        )}
      </Field>
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-3">
        <Field
          label={t("ui-setup-recipe.custom.form.carbs")}
          id={id("carbsPer100g")}
          hint={t("ui-setup-recipe.custom.form.carbsHint")}
          error={error("carbsPer100g")}
        >
          {(props) => numberInput("carbsPer100g", t("ui-setup-recipe.unit.g"), props)}
        </Field>
        <Field
          label={t("ui-setup-recipe.custom.form.fructose")}
          id={id("fructoseSharePct")}
          hint={t("ui-setup-recipe.custom.form.fructoseHint")}
          error={error("fructoseSharePct")}
        >
          {(props) => numberInput("fructoseSharePct", t("ui-setup-recipe.unit.percent"), props)}
        </Field>
        <Field
          label={t("ui-setup-recipe.custom.form.water")}
          id={id("waterPct")}
          hint={t("ui-setup-recipe.custom.form.waterHint")}
          error={error("waterPct")}
        >
          {(props) => numberInput("waterPct", t("ui-setup-recipe.unit.g"), props)}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" icon={Check}>
          {t("ui-setup-recipe.custom.form.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("ui-setup-recipe.custom.form.cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The facts of a custom ingredient as one line, in the UI language.
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {CustomCarb} custom
 * @returns {string}
 */
function customFacts(t, custom) {
  const params = { carbs: roundTo(custom.carbsPer100g, 1), fructose: roundTo(custom.fructoseSharePct, 1) };
  return typeof custom.waterPct === "number"
    ? t("ui-setup-recipe.custom.factsWater", { ...params, water: roundTo(custom.waterPct, 1) })
    : t("ui-setup-recipe.custom.facts", params);
}

/**
 * The user's own ingredients (`inputs.carbs.custom`): each with its label
 * values, Edit and Delete (with an in-place confirmation), and a "New
 * ingredient" button (at most 10). A new ingredient joins the ingredient
 * list at once (weight 50); deleting one also removes it from the list.
 *
 * Focus never drops to the page: after saving it moves to the ingredient's
 * Edit button, after Cancel back to the button that opened the form, on
 * Delete to "Keep" (so a second Enter does not delete), after Keep back to
 * Delete, and after deleting to "New ingredient" (while an add or edit
 * form is open, when that button is off, to the form's Name field). Escape
 * in the confirmation keeps the ingredient.
 *
 * Exported for the guided flow (its pantry step).
 *
 * @param {{ idPrefix?: string, headingLevel?: number, className?: string }} props
 *   `idPrefix` makes the ids unique (default generated); `headingLevel` is the level of the
 *   "Your ingredients" heading (default 3; the form title is one below).
 */
export default function IngredientsCustom({ idPrefix, headingLevel = 3, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const generatedId = useId();
  const prefix = idPrefix ?? `carb-custom-${generatedId.replace(/:/g, "")}`;
  const id = (name) => `${prefix}-${name}`;
  // null: no form open; 'new': the new-ingredient form; a key: that ingredient's edit form.
  const [editing, setEditing] = useState(/** @type {string|null} */ (null));
  const [confirming, setConfirming] = useState(/** @type {string|null} */ (null));
  const focusAfterRender = useFocusAfterRender();
  const custom = inputs.carbs.custom;
  const full = custom.length >= MAX_CUSTOM;
  const newId = id("new");
  const fullId = id("full");
  const level = Math.min(5, Math.max(2, Math.round(headingLevel) || 3));
  const Heading = `h${level}`;
  const headingId = id("heading");

  const create = (value) => {
    const key = freeCustomKey(custom, "c");
    focusAfterRender(...(key === null ? [] : [id(`${key}-edit`)]), newId);
    set("carbs", (carbs) => {
      const next = freeCustomKey(carbs.custom, "c");
      if (next === null) return carbs;
      return {
        ...carbs,
        custom: [...carbs.custom, { key: next, ...value }],
        ingredients: [...carbs.ingredients, { ref: next, weight: NEW_INGREDIENT_WEIGHT }],
      };
    });
    setEditing(null);
  };
  const save = (key) => (value) => {
    set("carbs.custom", (list) => list.map((c) => (c.key === key ? { key, ...value } : c)));
    focusAfterRender(id(`${key}-edit`));
    setEditing(null);
  };
  const cancelForm = (key) => {
    focusAfterRender(key === "new" ? newId : id(`${key}-edit`), newId);
    setEditing(null);
  };
  const askDelete = (key) => {
    focusAfterRender(id(`${key}-keep`));
    setConfirming(key);
  };
  const keep = (key) => {
    focusAfterRender(id(`${key}-delete`));
    setConfirming(null);
  };
  const remove = (key) => {
    // "New ingredient" is off while a form is open: then the form's Name field, else a neighbour's Delete.
    const index = custom.findIndex((c) => c.key === key);
    const formName = editing === null ? [] : [id(`${editing}-form-name`)];
    const neighbours = [custom[index + 1], custom[index - 1]]
      .filter((c) => c !== undefined && c.key !== editing)
      .map((c) => id(`${c.key}-delete`));
    focusAfterRender(newId, ...formName, ...neighbours);
    set("carbs", (carbs) => ({
      ...carbs,
      custom: carbs.custom.filter((c) => c.key !== key),
      ingredients: carbs.ingredients.filter((entry) => entry.ref !== key),
    }));
    setConfirming(null);
  };

  return (
    <div aria-labelledby={headingId} role="group" className={cx("space-y-3", className)} data-testid="ingredients-custom">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading id={headingId} className="display-title text-ink">
            {t("ui-setup-recipe.custom.title")}
          </Heading>
          <p className="text-body-sm text-ink-2">{t("ui-setup-recipe.custom.intro")}</p>
        </div>
        <Button
          id={newId}
          size="sm"
          icon={Plus}
          onClick={() => {
            setConfirming(null);
            setEditing("new");
          }}
          disabled={full || editing !== null}
          aria-describedby={full ? fullId : undefined}
        >
          {t("ui-setup-recipe.custom.new")}
        </Button>
      </div>
      {full ? (
        <p id={fullId} className="text-body-sm text-muted">
          {t("ui-setup-recipe.custom.full", { max: MAX_CUSTOM })}
        </p>
      ) : null}
      {custom.length > 0 ? (
        <ul role="list" className="space-y-2" aria-label={t("ui-setup-recipe.custom.listLabel")}>
          {custom.map((c) => {
            const name = customIngredientName(t, c);
            if (editing === c.key) {
              return (
                <li key={c.key}>
                  <IngredientsCustomForm
                    idPrefix={id(`${c.key}-form`)}
                    title={t("ui-setup-recipe.custom.form.editTitle", { name })}
                    initial={c}
                    onSave={save(c.key)}
                    onCancel={() => cancelForm(c.key)}
                    headingLevel={level + 1}
                  />
                </li>
              );
            }
            const questionId = id(`${c.key}-question`);
            return (
              <li key={c.key} className="rounded-control border border-line bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{name}</p>
                    <p className="text-body-sm text-ink-2">{customFacts(t, c)}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      id={id(`${c.key}-edit`)}
                      variant="ghost"
                      iconOnly
                      icon={Pencil}
                      disabled={editing !== null}
                      onClick={() => {
                        setConfirming(null);
                        setEditing(c.key);
                      }}
                    >
                      {t("ui-setup-recipe.custom.edit", { name })}
                    </Button>
                    <Button
                      id={id(`${c.key}-delete`)}
                      variant="ghost"
                      iconOnly
                      icon={Trash2}
                      aria-expanded={confirming === c.key}
                      onClick={() => askDelete(c.key)}
                    >
                      {t("ui-setup-recipe.custom.delete", { name })}
                    </Button>
                  </div>
                </div>
                {confirming === c.key ? (
                  <div
                    role="group"
                    aria-labelledby={questionId}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        keep(c.key);
                      }
                    }}
                    className="mt-3 rounded-control border border-danger bg-danger-soft p-3 text-body-sm text-ink"
                  >
                    <p id={questionId} className="mb-2">
                      {t("ui-setup-recipe.custom.deleteQuestion", { name })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button id={id(`${c.key}-confirm`)} variant="danger" icon={Trash2} onClick={() => remove(c.key)}>
                        {t("ui-setup-recipe.custom.confirmDelete")}
                      </Button>
                      <Button id={id(`${c.key}-keep`)} onClick={() => keep(c.key)}>
                        {t("ui-setup-recipe.custom.keep")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {editing === "new" ? (
        <IngredientsCustomForm
          idPrefix={id("new-form")}
          title={t("ui-setup-recipe.custom.form.newTitle")}
          initial={null}
          onSave={create}
          onCancel={() => cancelForm("new")}
          headingLevel={level + 1}
        />
      ) : null}
    </div>
  );
}
