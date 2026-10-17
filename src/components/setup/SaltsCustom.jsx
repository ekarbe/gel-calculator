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

import { useId } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import Button from "../ui/Button";
import Field, { CONTROL_CLASSES } from "../ui/Field";
import Icon from "../ui/Icon";
import NumberField from "../ui/NumberField";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS } from "../../domain/plan";
import { roundTo } from "../../domain/units";
import { customSaltName, freeCustomKey } from "./IngredientsHelpers";
import { useFocusAfterRender } from "../ui/useFocusAfterRender";

/** @typedef {import('../../domain/plan').CustomSalt} CustomSalt */

/** Label fields of a custom salt: % of the salt's mass for each element, in screen order. */
export const CUSTOM_SALT_FIELDS = Object.freeze(["sodiumPct", "potassiumPct", "magnesiumPct", "calciumPct", "chloridePct"]);

const [LABEL_MIN, LABEL_MAX] = INPUT_LIMITS.labelPct;
const [, MAX_CUSTOM_SALTS] = INPUT_LIMITS.customSalts;
const [, MAX_NAME_CHARS] = INPUT_LIMITS.customNameChars;

/**
 * Salts typed in from a label (`inputs.salts.custom`), for Manual salts:
 * per salt its name and the % of its mass for sodium, potassium, magnesium,
 * calcium and chloride (changes apply to the plan at once), with a note
 * when the values add up to more than 100 % or to nothing (in a polite
 * live region per salt, so it is read out while typing), and a delete
 * button that also removes the salt from the manual list. "Add a salt from
 * a label" adds a salt (at most 10) and a manual row for it, and moves the
 * focus to its name; after a delete the focus goes back to that button.
 *
 * Each salt is a fieldset named by its name, so the five label fields of
 * one salt are announced with it. The field labels are uppercase captions;
 * the chemical symbols after the element names keep their case ("SODIUM
 * (Na)", never "(NA)" or "(MG)"). Exported for the guided flow.
 *
 * @param {{ idPrefix?: string, headingLevel?: number, className?: string }} props
 *   `headingLevel` is the level of the "Salts from a label" heading (default 3).
 */
export default function SaltsCustom({ idPrefix, headingLevel = 3, className }) {
  const t = useT();
  const { inputs, set, apply } = usePlanInputs();
  const focusAfterRender = useFocusAfterRender();
  const generatedId = useId();
  const prefix = idPrefix ?? `custom-salt-${generatedId.replace(/:/g, "")}`;
  const id = (name) => `${prefix}-${name}`;
  const custom = inputs.salts.custom;
  const manual = inputs.salts.manual;
  const nextKey = freeCustomKey(custom, "s");
  const headingId = id("heading");
  const addId = id("add");
  const fullId = id("full");
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 3))}`;

  const add = () => {
    if (nextKey === null) return;
    const salt = { key: nextKey, name: "", sodiumPct: 0, potassiumPct: 0, magnesiumPct: 0, calciumPct: 0, chloridePct: 0 };
    focusAfterRender(id(`${nextKey}-name`));
    apply({ salts: { custom: [...custom, salt], manual: [...manual, { ref: nextKey, amountMg: 0 }] } });
  };
  const remove = (key) => {
    focusAfterRender(addId);
    apply({
      salts: {
        custom: custom.filter((c) => c.key !== key),
        manual: manual.filter((s) => s.ref !== key),
      },
    });
  };

  return (
    <div role="group" aria-labelledby={headingId} className={cx("space-y-3", className)} data-testid="salts-custom">
      <div>
        <Heading id={headingId} className="display-title text-ink">
          {t("ui-setup-recipe.salts.custom.title")}
        </Heading>
        <p className="text-body-sm text-ink-2">{t("ui-setup-recipe.salts.custom.intro")}</p>
      </div>
      {custom.length > 0 ? (
        <ul role="list" aria-label={t("ui-setup-recipe.salts.custom.listLabel")} className="space-y-2">
          {custom.map((salt, index) => {
            const name = customSaltName(t, salt);
            const total = CUSTOM_SALT_FIELDS.reduce((sum, field) => sum + (salt[field] ?? 0), 0);
            return (
              <li key={salt.key} className="@container rounded-control border border-line bg-surface-2 p-3">
                <fieldset className="min-w-0">
                  <legend className="sr-only">{name}</legend>
                  <div className="flex items-end gap-2">
                    <Field label={t("ui-setup-recipe.salts.custom.name")} id={id(`${salt.key}-name`)} className="min-w-0 flex-1">
                      {(props) => (
                        <input
                          {...props}
                          type="text"
                          autoComplete="off"
                          value={salt.name}
                          maxLength={MAX_NAME_CHARS}
                          placeholder={name}
                          onChange={(event) => set(["salts", "custom", index, "name"], event.target.value)}
                          className={CONTROL_CLASSES}
                        />
                      )}
                    </Field>
                    <Button variant="ghost" iconOnly icon={Trash2} onClick={() => remove(salt.key)}>
                      {t("ui-setup-recipe.salts.custom.delete", { name })}
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 @md:grid-cols-3">
                    {CUSTOM_SALT_FIELDS.map((field) => {
                      const element = t(`ui-setup-recipe.salts.custom.${field}`);
                      const symbol = t(`ui-setup-recipe.salts.custom.symbol.${field}`);
                      return (
                        <NumberField
                          key={field}
                          id={id(`${salt.key}-${field}`)}
                          label={
                            <>
                              {element} <span className="normal-case">{symbol}</span>
                            </>
                          }
                          labelText={`${element} ${symbol}`}
                          value={salt[field]}
                          onChange={(value) => set(["salts", "custom", index, field], value)}
                          min={LABEL_MIN}
                          max={LABEL_MAX}
                          step={0.1}
                          emptyValue={0}
                          unit={t("ui-setup-recipe.unit.percent")}
                          steppers={false}
                        />
                      );
                    })}
                  </div>
                  {/* Always in the DOM (a live region must exist before its content changes); no space while empty. */}
                  <div role="status" className="not-empty:mt-3" data-testid="custom-salt-status">
                    {total > LABEL_MAX ? (
                      <p className="flex items-start gap-1.5 text-body-sm text-ink" data-testid="custom-salt-over">
                        <Icon icon={TriangleAlert} size={16} className="mt-0.5 text-warn" />
                        <span>
                          <span className="sr-only">{t("ui-common.level.warning")}: </span>
                          {t("ui-setup-recipe.salts.custom.overTotal", { total: roundTo(total, 1) })}
                        </span>
                      </p>
                    ) : null}
                    {total === 0 ? <p className="text-body-sm text-muted">{t("ui-setup-recipe.salts.custom.empty")}</p> : null}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div>
        <Button
          id={addId}
          size="sm"
          icon={Plus}
          onClick={add}
          disabled={nextKey === null}
          aria-describedby={nextKey === null ? fullId : undefined}
        >
          {t("ui-setup-recipe.salts.custom.add")}
        </Button>
        {nextKey === null ? (
          <p id={fullId} className="mt-1 text-body-sm text-muted">
            {t("ui-setup-recipe.salts.custom.full", { max: MAX_CUSTOM_SALTS })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
