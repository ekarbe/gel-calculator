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
import { Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Chip from "../ui/Chip";
import NumberField from "../ui/NumberField";
import Select from "../ui/Select";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { ingredientProfile } from "../../domain/solver";
import { roundTo } from "../../domain/units";
import { carbSourceOptions } from "../../constants/constants";
import IngredientsCustom from "./IngredientsCustom";
import IngredientsRatioReach from "./IngredientsRatioReach";
import { MIN_CARBS_PER_GRAM, NEW_INGREDIENT_WEIGHT, customIngredientName, listText, shareRatio } from "./IngredientsHelpers";
import { formatAmount, sourceName } from "../recipe/recipeText";
import { useFocusAfterRender } from "../ui/useFocusAfterRender";

/*  The Ingredients field groups: the ratio reach bar, the ingredient list
    with a preference weight per ingredient, the add menu and the user's own
    ingredients. Each reads and writes the plan inputs itself, so the
    Ingredients section and the guided flow (step 3) use the same parts. */

/** @typedef {import('../../domain/plan').IngredientRef} IngredientRef */
/** @typedef {import('../../domain/solver').IngredientProfile} IngredientProfile */

const [WEIGHT_MIN, WEIGHT_MAX] = INPUT_LIMITS.ingredientWeight;

/** Built-in carb sources by id, for their group ('powder' or 'syrup'). */
const SOURCE_BY_ID = new Map(carbSourceOptions.map((option) => [option.id, option]));

/**
 * The name an ingredient row shows: the built-in source's name in the UI
 * language, the custom ingredient's name, or "Custom ingredient N" for an
 * unnamed one (the solver labels those with their key).
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {IngredientRef} entry
 * @param {IngredientProfile|null} profile
 * @returns {string}
 */
export function ingredientName(t, entry, profile) {
  if (profile?.custom) return customIngredientName(t, { key: String(entry.ref), name: profile.label === entry.ref ? "" : profile.label });
  return sourceName(t, entry.ref) ?? profile?.label ?? String(entry.ref);
}

/**
 * One row of the ingredient list: name and kind, the carbs per 100 g with
 * the glucose/fructose split (as text and a decorative two-colour bar),
 * what the recipe uses of it, a remove button and the preference weight
 * (number field and slider, both 0–100, bound to
 * `carbs.ingredients[index].weight`). The slider is described by the usage
 * line (`NumberField` keeps its `aria-describedby` for its own hint and
 * error, so the number field is not).
 *
 * @param {{ idPrefix: string, index: number, entry: IngredientRef, profile: IngredientProfile|null,
 *   item: { grams: number, carbsG: number }|undefined, deliveredG: number, duplicate: boolean,
 *   onRemove: () => void }} props
 */
function IngredientsRow({ idPrefix, index, entry, profile, item, deliveredG, duplicate, onRemove }) {
  const t = useT();
  const f = useFormat();
  const { set } = usePlanInputs();
  const name = ingredientName(t, entry, profile);
  const kind = profile?.custom ? "custom" : (SOURCE_BY_ID.get(entry.ref)?.group ?? "powder");
  const usageId = `${idPrefix}-usage`;
  const hasCarbs = profile !== null && profile.carbsPerGram >= MIN_CARBS_PER_GRAM;
  const fructosePct = profile ? roundTo(profile.fructoseShare * 100, 0) : 0;

  let usage;
  if (!hasCarbs) usage = t("ui-setup-recipe.ingredients.usage.noCarbs");
  else if (duplicate) usage = t("ui-setup-recipe.ingredients.usage.duplicate");
  else if (item && deliveredG > 0) {
    usage = t("ui-setup-recipe.ingredients.usage.used", {
      amount: formatAmount(t, f, item.grams, "g"),
      share: roundTo((item.carbsG / deliveredG) * 100, 0),
    });
  } else if (deliveredG > 0) usage = t("ui-setup-recipe.ingredients.usage.notNeeded");
  else usage = t("ui-setup-recipe.ingredients.usage.noPlanCarbs");

  const commitWeight = (value) => set(["carbs", "ingredients", index, "weight"], value);
  const weightName = t("ui-setup-recipe.ingredients.weightOf", { name });

  return (
    <li className="space-y-2 rounded-control border border-line bg-surface-2 p-3" data-testid="ingredient-row" data-ref={String(entry.ref)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink" data-testid="ingredient-name">
              {name}
            </span>
            {/* The neutral chip's tint is this row's background: a hairline gives it its shape. */}
            <Chip className="border border-line">{t(`ui-setup-recipe.ingredients.kind.${kind}`)}</Chip>
          </p>
          {profile ? (
            <>
              <p className="mt-0.5 text-body-sm text-ink-2" data-testid="ingredient-facts">
                {t("ui-setup-recipe.ingredients.facts", {
                  carbs: roundTo(profile.carbsPerGram * 100, 1),
                  glucose: 100 - fructosePct,
                  fructose: fructosePct,
                })}
              </p>
              {hasCarbs ? (
                <div aria-hidden="true" className="mt-1.5 flex h-1.5 max-w-48 overflow-hidden rounded-full bg-surface">
                  <div className="bg-glucose" style={{ width: `${100 - fructosePct}%` }} />
                  <div className="bg-fructose" style={{ width: `${fructosePct}%` }} />
                </div>
              ) : null}
            </>
          ) : null}
          <p id={usageId} className="mt-1.5 text-body-sm font-medium text-ink" data-testid="ingredient-usage">
            {usage}
          </p>
        </div>
        <Button variant="ghost" iconOnly icon={Trash2} onClick={onRemove} id={`${idPrefix}-remove`}>
          {t("ui-setup-recipe.ingredients.remove", { name })}
        </Button>
      </div>
      <div className="flex items-end gap-3">
        <NumberField
          id={`${idPrefix}-weight`}
          label={t("ui-setup-recipe.ingredients.weight")}
          labelText={weightName}
          aria-label={weightName}
          value={entry.weight}
          onChange={commitWeight}
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          step={5}
          emptyValue={0}
          steppers={false}
          className="w-20 shrink-0"
        />
        <input
          id={`${idPrefix}-weight-slider`}
          type="range"
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          step={1}
          value={entry.weight}
          aria-label={t("ui-setup-recipe.ingredients.weightSlider", { name })}
          aria-describedby={usageId}
          onChange={(event) => commitWeight(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-ink"
        />
      </div>
    </li>
  );
}

/**
 * The ingredient list (`inputs.carbs.ingredients`) with what the recipe
 * uses of each (`plan.carbs.ingredients`), or a note when it is empty. An
 * ingredient listed twice (only a share link can do that) shows the recipe
 * amount once and a note on the second row. Removing a row moves the focus
 * to the next row's remove button (else the add menu).
 *
 * @param {{ idPrefix?: string, addMenuId?: string, className?: string }} props
 *   `addMenuId` is where the focus goes after the last row is removed.
 */
export function IngredientsList({ idPrefix, addMenuId, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const generatedId = useId();
  const prefix = idPrefix ?? `carb-ingredient-${generatedId.replace(/:/g, "")}`;
  const focusAfterRender = useFocusAfterRender();
  const solution = plan.carbs.ingredients;
  const itemsByRef = new Map(solution.items.map((item) => [item.ref, item]));
  const seen = new Set();
  const rows = inputs.carbs.ingredients.map((entry, index) => {
    const duplicate = seen.has(entry.ref);
    seen.add(entry.ref);
    // Rows are positions in the input list (paths use the index); the key also names the ref.
    return { entry, index, duplicate, key: `${index}-${String(entry.ref)}` };
  });

  const remove = (index) => {
    // After the update the next row takes this index.
    const targets = [`${prefix}-${index}-remove`, `${prefix}-${index - 1}-remove`];
    focusAfterRender(...targets, ...(addMenuId ? [addMenuId] : []));
    set("carbs.ingredients", (list) => list.filter((_, i) => i !== index));
  };

  if (rows.length === 0) {
    return <p className={cx("text-body-sm text-muted", className)}>{t("ui-setup-recipe.ingredients.empty")}</p>;
  }
  return (
    <ul role="list" className={cx("space-y-2", className)} aria-label={t("ui-setup-recipe.ingredients.listLabel")}>
      {rows.map(({ entry, index, duplicate, key }) => (
        <IngredientsRow
          key={key}
          idPrefix={`${prefix}-${index}`}
          index={index}
          entry={entry}
          profile={ingredientProfile(entry.ref, inputs.carbs.custom)}
          item={duplicate ? undefined : itemsByRef.get(entry.ref)}
          deliveredG={plan.carbs.deliveredG}
          duplicate={duplicate}
          onRemove={() => remove(index)}
        />
      ))}
    </ul>
  );
}

/**
 * The add menu: every ingredient not yet in the list, grouped into powders,
 * syrups and the user's own ingredients, and an Add button. A new entry
 * gets weight 50. When every ingredient is listed it says so; adding the
 * last one moves the focus to that note (the Add button leaves).
 *
 * @param {{ id?: string, className?: string }} props  `id` is the menu's id (default generated).
 */
export function IngredientsAdd({ id, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const generatedId = useId();
  const selectId = id ?? `carb-ingredient-add-${generatedId.replace(/:/g, "")}`;
  const [choice, setChoice] = useState(/** @type {number|string|null} */ (null));
  const focusAfterRender = useFocusAfterRender();
  const buttonId = `${selectId}-button`;
  const allListedId = `${selectId}-all`;
  const listed = new Set(inputs.carbs.ingredients.map((entry) => entry.ref));
  const groups = [
    ...["powder", "syrup"].map((group) => ({
      label: t(`ui-setup-recipe.ingredients.add.${group}s`),
      options: carbSourceOptions
        .filter((option) => option.group === group && !listed.has(option.id))
        .map((option) => ({ value: option.id, label: sourceName(t, option.id) ?? option.label })),
    })),
    {
      label: t("ui-setup-recipe.ingredients.add.custom"),
      options: inputs.carbs.custom
        .filter((c) => !listed.has(c.key))
        .map((c) => ({ value: c.key, label: customIngredientName(t, c) })),
    },
  ].filter((group) => group.options.length > 0);
  const values = groups.flatMap((group) => group.options.map((option) => option.value));
  // The remembered choice may have been added meanwhile; fall back to the first one left.
  const selected = values.includes(choice) ? choice : (values[0] ?? null);

  if (selected === null) {
    return (
      <p id={allListedId} tabIndex={-1} className={cx("text-body-sm text-muted", className)}>
        {t("ui-setup-recipe.ingredients.add.allListed")}
      </p>
    );
  }
  const add = () => {
    focusAfterRender(buttonId, allListedId);
    set("carbs.ingredients", (list) =>
      list.some((entry) => entry.ref === selected) ? list : [...list, { ref: selected, weight: NEW_INGREDIENT_WEIGHT }],
    );
  };
  return (
    <div className={cx("flex items-end gap-2", className)}>
      <Select
        id={selectId}
        label={t("ui-setup-recipe.ingredients.add.label")}
        value={selected}
        onChange={setChoice}
        options={groups}
        className="min-w-0 flex-1"
      />
      <Button id={buttonId} icon={Plus} onClick={add}>
        {t("ui-setup-recipe.ingredients.add.button")}
      </Button>
    </div>
  );
}

/**
 * The one-line summary of the ingredients for a collapsed section: the
 * names as a list and the ratio the recipe makes ("Maltodextrin and
 * Crystalline Fructose · recipe 1:0.5").
 * @returns {string}
 */
export function useIngredientsSummary() {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const names = [
    ...new Set(
      inputs.carbs.ingredients.map((entry) => ingredientName(t, entry, ingredientProfile(entry.ref, inputs.carbs.custom))),
    ),
  ];
  if (names.length === 0) return t("ui-setup-recipe.ingredients.summaryEmpty");
  const solution = plan.carbs.ingredients;
  const share = solution.items.length > 0 ? solution.achievedShare : null;
  const list = listText(f, names);
  return share === null ? list : t("ui-setup-recipe.ingredients.summary", { names: list, ratio: shareRatio(share) });
}

/**
 * Every Ingredients field group in screen order: the intro, the ratio
 * reach bar with the solver's warnings, the ingredient list, the add menu
 * and the user's own ingredients.
 *
 * @param {{ idPrefix?: string, headingLevel?: number }} props
 *   `headingLevel` is the level of the "Your ingredients" heading (default 3).
 */
export default function IngredientsFields({ idPrefix, headingLevel = 3 }) {
  const t = useT();
  const generatedId = useId();
  const prefix = idPrefix ?? `ingredients-${generatedId.replace(/:/g, "")}`;
  const addId = `${prefix}-add`;
  return (
    <div className="space-y-5">
      <p className="text-body-sm text-ink-2">{t("ui-setup-recipe.ingredients.intro")}</p>
      <IngredientsRatioReach />
      <div className="space-y-3">
        <IngredientsList idPrefix={`${prefix}-row`} addMenuId={addId} />
        <IngredientsAdd id={addId} />
      </div>
      <IngredientsCustom idPrefix={`${prefix}-custom`} headingLevel={headingLevel} className="border-t border-line pt-4" />
    </div>
  );
}
