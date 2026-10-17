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
import { ArrowDown, ArrowUp, CircleCheck, Plus, Trash2 } from "lucide-react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Lane from "../ui/Lane";
import NumberField from "../ui/NumberField";
import Segmented from "../ui/Segmented";
import Select from "../ui/Select";
import WarningList from "../ui/WarningList";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_LIMITS, INPUT_OPTIONS } from "../../domain/plan";
import { saltProfile } from "../../domain/electrolytes";
import { roundTo } from "../../domain/units";
import { electrolyteSourceOptions } from "../../constants/constants";
import SaltsCustom from "./SaltsCustom";
import { customSaltName, listText } from "./IngredientsHelpers";
import { formatAmount, sourceName } from "../recipe/recipeText";
import { useFocusAfterRender } from "../ui/useFocusAfterRender";

/*  The Salts field groups: the Auto/Manual choice, the sodium salt and the
    salt amounts of Auto mode, the manual salt list and the salts typed in
    from a label, the delivered-vs-target comparison and the salt warnings.
    Each reads and writes the plan inputs itself, so the Salts section and
    the guided flow use the same parts. */

/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../domain/plan').CustomSalt} CustomSalt */

const [AMOUNT_MIN_MG, AMOUNT_MAX_MG] = INPUT_LIMITS.saltAmountMg;

/** Look of each comparison status: an icon shape and a status colour, always with text. */
const STATUS_LOOK = Object.freeze({
  met: { icon: CircleCheck, className: "text-ok" },
  short: { icon: ArrowDown, className: "text-warn" },
  over: { icon: ArrowUp, className: "text-warn" },
});

/**
 * The name a salt is shown with: the built-in salt's name in the UI
 * language, the custom salt's name ("Custom salt N" without one), or
 * "Salt N" for an unknown ref.
 * @param {TranslateFn} t
 * @param {number|string} ref
 * @param {CustomSalt[]} custom
 * @returns {string}
 */
export function saltName(t, ref, custom) {
  if (typeof ref === "string") {
    const salt = custom.find((c) => c.key === ref);
    if (salt) return customSaltName(t, salt);
  }
  const builtIn = sourceName(t, ref);
  if (builtIn) return builtIn;
  const profile = saltProfile(ref, custom);
  return profile?.label ?? t("ui-setup-recipe.salts.unknownName", { ref: String(ref) });
}

/**
 * What a salt holds, as one line ("Contains 39.3% Sodium, 60.7% Chloride"),
 * or a note when a custom salt has no values yet.
 * @param {TranslateFn} t
 * @param {import('../../i18n/formatters').Formatters} f
 * @param {number|string} ref
 * @param {CustomSalt[]} custom
 * @returns {string}
 */
export function saltContents(t, f, ref, custom) {
  const profile = saltProfile(ref, custom);
  if (!profile || profile.components.length === 0) return t("ui-setup-recipe.salts.noValues");
  const parts = profile.components.map((c) =>
    t("ui-setup-recipe.salts.part", { pct: roundTo(c.ratio * 100, 1), ion: t(`ui-setup-recipe.ion.${c.name}`) }),
  );
  return t("ui-setup-recipe.salts.contains", { parts: listText(f, parts, "unit") });
}

/**
 * The Auto/Manual choice for the salts. Manual starts from the auto
 * amounts when there is no manual list yet, so nothing jumps; an existing
 * manual list is kept when switching back and forth.
 * @param {{ size?: 'sm'|'md', className?: string }} props
 */
export function SaltsModeField({ size = "sm", className }) {
  const t = useT();
  const { inputs, set, apply } = usePlanInputs();
  const plan = usePlan();
  const setMode = (mode) => {
    if (mode === "manual" && inputs.salts.mode !== "manual" && inputs.salts.manual.length === 0) {
      apply({ salts: { mode: "manual", manual: plan.salts.items.map((s) => ({ ref: s.ref, amountMg: s.amountMg })) } });
    } else {
      set("salts.mode", mode);
    }
  };
  return (
    <Segmented
      size={size}
      label={t("ui-setup-recipe.salts.mode.label")}
      value={inputs.salts.mode}
      onChange={setMode}
      options={INPUT_OPTIONS.mode.map((mode) => ({ value: mode, label: t(`ui-setup-recipe.salts.mode.${mode}`) }))}
      className={className}
      data-testid="salts-mode"
    />
  );
}

/**
 * The sodium salt of Auto mode: table salt, sodium citrate or half of each.
 * @param {{ id?: string, className?: string }} props
 */
export function SaltsSodiumSaltField({ id, className }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  return (
    <Select
      id={id}
      label={t("ui-setup-recipe.salts.sodiumSalt.label")}
      hint={t("ui-setup-recipe.salts.sodiumSalt.hint")}
      value={inputs.salts.sodiumSalt}
      onChange={(salt) => set("salts.sodiumSalt", salt)}
      options={INPUT_OPTIONS.sodiumSalt.map((salt) => ({ value: salt, label: t(`ui-setup-recipe.salts.sodiumSalt.${salt}`) }))}
      className={className}
    />
  );
}

/**
 * The salts Auto mode puts in the recipe (`plan.salts.items`), whole
 * activity, as plain rows with the sodium colour dot; or a note when the
 * plan needs none.
 * @param {{ className?: string }} props
 */
export function SaltsAutoList({ className }) {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const items = plan.salts.items;
  return (
    <div className={cx("space-y-1", className)}>
      {items.length > 0 ? (
        <ul role="list" aria-label={t("ui-setup-recipe.salts.auto.listLabel")} className="divide-y divide-line">
          {items.map((item) => (
            <Lane
              key={item.ref}
              as="li"
              tone="sodium"
              label={saltName(t, item.ref, inputs.salts.custom)}
              amount={formatAmount(t, f, item.amountMg, "mg")}
              amountProps={{ "data-testid": "salt-amount" }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-body-sm text-muted">{t("ui-setup-recipe.salts.auto.none")}</p>
      )}
      <p className="text-body-sm text-muted">{t("ui-setup-recipe.salts.auto.note")}</p>
    </div>
  );
}

/**
 * The manual salt list (`inputs.salts.manual`, whole-activity amounts in
 * mg, entered in g): per row the salt (built-in salts, then the salts typed
 * in from a label; a salt used by another row is disabled), what it holds,
 * the amount and a remove button. Rows are positions in the list, so
 * changing a row's salt keeps the row and its focus. "Add salt" adds the
 * first salt not in the list yet and focuses it; after a remove the focus
 * goes to the next row (else "Add salt").
 * @param {{ idPrefix?: string, className?: string }} props
 */
export function SaltsManualList({ idPrefix, className }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const focusAfterRender = useFocusAfterRender();
  const generatedId = useId();
  const prefix = idPrefix ?? `salt-${generatedId.replace(/:/g, "")}`;
  const id = (name) => `${prefix}-${name}`;
  const custom = inputs.salts.custom;
  const manual = inputs.salts.manual;
  const used = new Set(manual.map((s) => s.ref));
  const choices = [
    ...electrolyteSourceOptions.map((o) => ({ ref: o.id, label: sourceName(t, o.id) ?? o.label, custom: false })),
    ...custom.map((c) => ({ ref: c.key, label: customSaltName(t, c), custom: true })),
  ];
  const nextRef = choices.find((choice) => !used.has(choice.ref))?.ref;
  const addId = id("add");

  const add = () => {
    if (nextRef === undefined) return;
    focusAfterRender(id(`${manual.length}`));
    set("salts.manual", (list) => [...(Array.isArray(list) ? list : []), { ref: nextRef, amountMg: 0 }]);
  };
  const remove = (index) => {
    focusAfterRender(id(`${index}`), id(`${index - 1}`), addId);
    set("salts.manual", (list) => (Array.isArray(list) ? list.filter((_, i) => i !== index) : []));
  };

  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body-sm text-ink-2">{t("ui-setup-recipe.salts.manual.hint")}</p>
        <Button id={addId} size="sm" icon={Plus} onClick={add} disabled={nextRef === undefined}>
          {t("ui-setup-recipe.salts.manual.add")}
        </Button>
      </div>
      {manual.length === 0 ? (
        <p className="text-body-sm text-muted">{t("ui-setup-recipe.salts.manual.empty")}</p>
      ) : (
        <ul role="list" aria-label={t("ui-setup-recipe.salts.manual.listLabel")} className="space-y-2">
          {manual.map((salt, index) => {
            const name = saltName(t, salt.ref, custom);
            const option = (choice) => ({
              value: choice.ref,
              label: choice.label,
              disabled: choice.ref !== salt.ref && used.has(choice.ref),
            });
            const groups = [
              { label: t("ui-setup-recipe.salts.manual.builtIn"), options: choices.filter((c) => !c.custom).map(option) },
              ...(custom.length > 0
                ? [{ label: t("ui-setup-recipe.salts.manual.custom"), options: choices.filter((c) => c.custom).map(option) }]
                : []),
            ];
            const amountName = t("ui-setup-recipe.salts.manual.amountOf", { name });
            return (
              // Rows are positions in the list (edits and removal use the index), so the index is
              // the key: changing a row's salt keeps the row and its focus.
              <li key={index} className="space-y-2 rounded-control border border-line bg-surface-2 p-3" data-testid="manual-salt">
                <div className="flex items-start gap-2">
                  <Select
                    id={id(`${index}`)}
                    label={t("ui-setup-recipe.salts.manual.salt", { number: index + 1 })}
                    value={salt.ref}
                    onChange={(ref) => set(["salts", "manual", index, "ref"], ref)}
                    options={groups}
                    hint={saltContents(t, f, salt.ref, custom)}
                    className="min-w-0 flex-1"
                  />
                  <Button variant="ghost" iconOnly icon={Trash2} onClick={() => remove(index)} className="mt-5">
                    {t("ui-setup-recipe.salts.manual.remove", { name })}
                  </Button>
                </div>
                <NumberField
                  id={id(`${index}-amount`)}
                  label={t("ui-setup-recipe.salts.manual.amount")}
                  labelText={amountName}
                  aria-label={amountName}
                  value={salt.amountMg}
                  onChange={(mg) => set(["salts", "manual", index, "amountMg"], mg)}
                  toInput={(mg) => mg / 1000}
                  fromInput={(grams) => Math.round(grams * 1000)}
                  min={AMOUNT_MIN_MG / 1000}
                  max={AMOUNT_MAX_MG / 1000}
                  step={0.1}
                  digits={3}
                  unit={t("ui-setup-recipe.unit.g")}
                  className="max-w-56"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Delivered vs target for the whole activity (`plan.salts.comparison`):
 * one row per ion with a target or a delivered amount, and its status
 * ("On target", "Short by 924 mg", "Over by 6,150 mg") with an icon, never
 * colour alone. The status sits under the delivered amount, so the table
 * fits the narrow setup column without scrolling.
 * @param {{ className?: string }} props
 */
export function SaltsComparison({ className }) {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const rows = Object.entries(plan.salts.comparison);
  if (rows.length === 0) return null;
  const mg = (value) => t("ui-setup-recipe.salts.compare.mg", { mg: f.number(Math.round(value)) });
  return (
    <table className={cx("w-full text-body-sm", className)} data-testid="salts-comparison">
      <caption className="caption mb-1 text-left text-ink-2">{t("ui-setup-recipe.salts.compare.caption")}</caption>
      <thead>
        <tr className="text-caption text-muted">
          <th scope="col" className="py-1 pr-2 text-left font-medium">
            {t("ui-setup-recipe.salts.compare.ion")}
          </th>
          <th scope="col" className="px-2 py-1 text-right font-medium">
            {t("ui-setup-recipe.salts.compare.target")}
          </th>
          <th scope="col" className="py-1 pl-2 text-right font-medium">
            {t("ui-setup-recipe.salts.compare.delivered")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([ion, row]) => {
          const look = STATUS_LOOK[row.status] ?? STATUS_LOOK.short;
          const status =
            row.status === "met"
              ? t("ui-setup-recipe.salts.compare.met")
              : t(`ui-setup-recipe.salts.compare.${row.status === "over" ? "over" : "short"}`, {
                  mg: f.number(Math.round(Math.abs(row.diff))),
                });
          return (
            <tr key={ion} className="border-t border-line align-top">
              <th scope="row" className="py-2 pr-2 text-left font-medium text-ink">
                {t(`ui-setup-recipe.ion.${ion}`)}
              </th>
              <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-ink">{mg(row.target)}</td>
              <td className="py-2 pl-2 text-right">
                <span className="block whitespace-nowrap font-mono text-ink">{mg(row.delivered)}</span>
                {/* On a phone the status may wrap ("Over by" / "6,350 mg"; the catalog keeps the number and
                    unit together): the icon stays with the first line. */}
                <span
                  data-status={row.status}
                  className={cx("mt-0.5 inline-flex items-start justify-end gap-1 font-medium", look.className)}
                >
                  <Icon icon={look.icon} size={14} className="mt-0.5" />
                  {status}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The one-line summary of the salts for a collapsed section: "Auto · Table
 * salt", or "Manual ·" with the listed salts.
 * @returns {string}
 */
export function useSaltsSummary() {
  const t = useT();
  const f = useFormat();
  const { inputs } = usePlanInputs();
  const salts = inputs.salts;
  if (salts.mode !== "manual") {
    return t("ui-setup-recipe.salts.summary.auto", { salt: t(`ui-setup-recipe.salts.sodiumSalt.${salts.sodiumSalt}`) });
  }
  if (salts.manual.length === 0) return t("ui-setup-recipe.salts.summary.manualEmpty");
  return t("ui-setup-recipe.salts.summary.manual", {
    salts: listText(f, salts.manual.map((s) => saltName(t, s.ref, salts.custom))),
  });
}

/**
 * Every Salts field group for the current mode: Auto shows the sodium salt
 * and the amounts it gives; Manual shows the salt list and the salts from a
 * label. Both show the delivered-vs-target table and the salt warnings
 * (`plan.salts.warnings`). The Auto/Manual choice itself is
 * {@link SaltsModeField} (the section puts it in its title row); pass
 * `withMode` to show it here too.
 *
 * @param {{ idPrefix?: string, headingLevel?: number, withMode?: boolean }} props
 */
export default function SaltsFields({ idPrefix, headingLevel = 3, withMode = false }) {
  const { inputs } = usePlanInputs();
  const plan = usePlan();
  const generatedId = useId();
  const prefix = idPrefix ?? `salts-${generatedId.replace(/:/g, "")}`;
  const manual = inputs.salts.mode === "manual";
  return (
    <div className="space-y-5">
      {withMode ? <SaltsModeField size="md" /> : null}
      {manual ? (
        <>
          <SaltsManualList idPrefix={`${prefix}-manual`} />
          <SaltsCustom idPrefix={`${prefix}-custom`} headingLevel={headingLevel} className="border-t border-line pt-4" />
        </>
      ) : (
        <>
          <SaltsSodiumSaltField id={`${prefix}-sodium-salt`} />
          <SaltsAutoList />
        </>
      )}
      <SaltsComparison />
      <WarningList warnings={plan.salts.warnings} />
    </div>
  );
}
