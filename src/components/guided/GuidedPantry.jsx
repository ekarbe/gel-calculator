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
import { Circle, CircleCheck, FlaskConical, PackagePlus, PackageSearch } from "lucide-react";
import Button from "../ui/Button";
import Disclosure from "../ui/Disclosure";
import Icon from "../ui/Icon";
import Segmented from "../ui/Segmented";
import Why from "../ui/Why";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan, usePlanInputs } from "../../state/PlanProvider";
import { INPUT_OPTIONS } from "../../domain/plan";
import { ingredientProfile } from "../../domain/solver";
import { roundTo } from "../../domain/units";
import { carbSourceOptions } from "../../constants/constants";
import IngredientsCustom from "../setup/IngredientsCustom";
import IngredientsRatioReach from "../setup/IngredientsRatioReach";
import { SaltsAutoList } from "../setup/SaltsFields";
import { NEW_INGREDIENT_WEIGHT, customIngredientName } from "../setup/IngredientsHelpers";
import { formatAmount, sourceName } from "../recipe/recipeText";
import GuidedScreen from "./GuidedScreen";
import { useFocusRadioAfterRender } from "./guidedFocus";

/** @typedef {import('../../domain/plan').IngredientRef} IngredientRef */

/**
 * The carb sources on the pantry shelf, in this order (design doc: "maltodextrin,
 * dextrose, fructose, sugar, honey, maple…"): maltodextrin, dextrose
 * (monohydrate, the one sold for home use), crystalline fructose, cane
 * sugar, honey and maple syrup. The others are under "More ingredients".
 */
export const PANTRY_SHELF_IDS = Object.freeze([3, 8, 11, 18, 14, 17]);

/** The built-in carb sources that are not on the shelf, by group, in the catalogue's order. */
const MORE_BY_GROUP = Object.freeze(
  ["powder", "syrup"].map((group) => ({
    group,
    ids: carbSourceOptions.filter((o) => o.group === group && !PANTRY_SHELF_IDS.includes(o.id)).map((o) => o.id),
  })),
);

/**
 * What the recipe uses of a picked ingredient ("158 g in the recipe"), or
 * why it uses none: the plan has no carb target; the plan has one but the
 * mix delivers no carbs (a 0:0 ratio, or only carb-free ingredients: the
 * warnings say which); or the mix does not need this one for its ratio.
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {import('../../i18n/formatters').Formatters} f
 * @param {{ grams: number }|undefined} item  The solver's item for it.
 * @param {{ targetG: number, deliveredG: number }} carbs  The plan's carb target and the carbs the recipe delivers (g).
 * @returns {string}
 */
function usageText(t, f, item, { targetG, deliveredG }) {
  if (!(targetG > 0)) return t("ui-guided.pantry.usage.noPlanCarbs");
  if (!(deliveredG > 0)) return t("ui-guided.pantry.usage.cannotMix");
  if (item) return t("ui-guided.pantry.usage.used", { amount: formatAmount(t, f, item.grams, "g") });
  return t("ui-guided.pantry.usage.notNeeded");
}

/**
 * One tile of the pantry grid: a toggle button (`aria-pressed`) named by
 * the ingredient alone, so its name stays the same when it is picked. It
 * shows a marker that differs by shape (an empty circle, a checked one),
 * the name, the glucose/fructose split as a decorative two-colour bar and
 * as text, and, when picked, what the recipe uses of it; the split and the
 * usage describe the button (`aria-describedby`).
 *
 * @param {{ id: string, name: string, fructoseShare: number, picked: boolean, usage: string|null,
 *   onToggle: () => void }} props
 */
function PantryTile({ id, name, fructoseShare, picked, usage, onToggle }) {
  const t = useT();
  const nameId = `${id}-name`;
  const splitId = `${id}-split`;
  const usageId = `${id}-usage`;
  const fructosePct = roundTo(Math.min(1, Math.max(0, fructoseShare)) * 100, 0);
  return (
    <li className="min-w-0">
      <button
        type="button"
        id={id}
        aria-pressed={picked}
        aria-labelledby={nameId}
        aria-describedby={usage === null ? splitId : `${splitId} ${usageId}`}
        onClick={onToggle}
        data-testid="pantry-tile"
        className={cx(
          "num flex h-full min-h-14 w-full flex-col items-stretch rounded-control border p-3 text-left transition-colors duration-150",
          // Unpicked: the control border (3:1 on the panel, like every other control); picked: ink border plus ring.
          picked ? "border-ink bg-surface ring-1 ring-ink" : "border-line-strong bg-surface-2 hover:bg-surface",
        )}
      >
        {/* The marker sits in the name's first line, so a long name wraps under it (tiles are narrow on phones). */}
        <span className="block min-w-0 break-words text-body-sm font-semibold text-ink">
          <Icon
            icon={picked ? CircleCheck : Circle}
            size={18}
            className={cx("mr-1.5 inline-block align-[-4px]", picked ? "text-ink" : "text-muted")}
          />
          <span id={nameId} data-testid="pantry-tile-name">
            {name}
          </span>
        </span>
        <span aria-hidden="true" className="mt-1.5 flex h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-surface-2">
          <span className="bg-glucose" style={{ width: `${100 - fructosePct}%` }} />
          <span className="bg-fructose" style={{ width: `${fructosePct}%` }} />
        </span>
        <span id={splitId} className="mt-1 block text-caption text-ink-2">
          {t("ui-guided.pantry.split", { glucose: 100 - fructosePct, fructose: fructosePct })}
        </span>
        {usage !== null ? (
          <span id={usageId} className="mt-1 block text-body-sm font-medium text-ink" data-testid="pantry-tile-usage">
            {usage}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * A grid of tiles: two columns, three from 32 rem (the screen is a container).
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
function PantryGrid({ children, className }) {
  return (
    <ul role="list" className={cx("grid grid-cols-2 gap-3 @lg:grid-cols-3", className)}>
      {children}
    </ul>
  );
}

/**
 * A titled group of tiles (a group named by its small caption).
 * @param {{ id: string, title: string, children: import('react').ReactNode }} props
 */
function PantryGroup({ id, title, children }) {
  return (
    <div role="group" aria-labelledby={id} className="min-w-0">
      <p id={id} className="caption mb-2 text-ink-2">
        {title}
      </p>
      <PantryGrid>{children}</PantryGrid>
    </div>
  );
}

/**
 * The carbohydrates of the pantry: pick what you have from a grid of tiles,
 * each in or out of the ingredient list (`inputs.carbs.ingredients`; a
 * picked ingredient joins with weight 50, the middle of the preference
 * weights, and a removed one leaves with every entry for it). The tile
 * keeps the focus. Then:
 *
 * - "Your own": the user's own ingredients as tiles, when there are any;
 * - "More ingredients" (a disclosure, open on arrival when one of them is in
 *   the list): every other built-in source, as powders and syrups;
 * - "Add your own from a label" (a disclosure): the setup's custom
 *   ingredient editor; a new one joins the list at once;
 * - the ratio reach bar with the solver's warnings, so a pick that cannot
 *   make the ratio says so here.
 *
 * Every amount comes from the plan (`plan.carbs.ingredients`). A group
 * named by its heading.
 *
 * @param {{ idPrefix: string, headingLevel?: number }} props  `headingLevel` defaults to 3.
 */
export function GuidedPantryCarbs({ idPrefix, headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const custom = inputs.carbs.custom;
  const listed = new Set(inputs.carbs.ingredients.map((entry) => entry.ref));
  const itemsByRef = new Map(plan.carbs.ingredients.items.map((item) => [item.ref, item]));
  const carbTotals = { targetG: plan.carbs.totalG, deliveredG: plan.carbs.deliveredG };
  // Open on arrival when the list already holds one of them, so every picked tile is in view.
  const [moreOpen, setMoreOpen] = useState(() => MORE_BY_GROUP.some(({ ids }) => ids.some((id) => listed.has(id))));
  const level = Math.min(5, Math.max(2, Math.round(headingLevel) || 3));
  const Heading = `h${level}`;
  const headingId = `${idPrefix}-heading`;

  /** @param {IngredientRef['ref']} ref */
  const toggle = (ref) =>
    set("carbs.ingredients", (list) => {
      const entries = Array.isArray(list) ? list : [];
      return entries.some((entry) => entry?.ref === ref)
        ? entries.filter((entry) => entry?.ref !== ref)
        : [...entries, { ref, weight: NEW_INGREDIENT_WEIGHT }];
    });

  /** @param {IngredientRef['ref']} ref */
  const tile = (ref) => {
    const profile = ingredientProfile(ref, custom);
    if (!profile) return null;
    const picked = listed.has(ref);
    const name = profile.custom ? customIngredientName(t, custom.find((c) => c.key === ref)) : (sourceName(t, ref) ?? profile.label);
    return (
      <PantryTile
        key={String(ref)}
        id={`${idPrefix}-tile-${ref}`}
        name={name}
        fructoseShare={profile.fructoseShare}
        picked={picked}
        usage={picked ? usageText(t, f, itemsByRef.get(ref), carbTotals) : null}
        onToggle={() => toggle(ref)}
      />
    );
  };

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0 space-y-4" data-testid="guided-pantry-carbs">
      <div>
        <Heading id={headingId} className="display-title text-ink">
          {t("ui-guided.pantry.carbs")}
        </Heading>
        <p className="text-body-sm text-ink-2">{t("ui-guided.pantry.carbsHint")}</p>
      </div>
      <PantryGrid>{PANTRY_SHELF_IDS.map(tile)}</PantryGrid>
      {custom.length > 0 ? (
        <PantryGroup id={`${idPrefix}-yours`} title={t("ui-guided.pantry.yours")}>
          {custom.map((c) => tile(c.key))}
        </PantryGroup>
      ) : null}
      <Disclosure
        summary={t("ui-guided.pantry.more")}
        icon={PackageSearch}
        open={moreOpen}
        onOpenChange={setMoreOpen}
        id={`${idPrefix}-more`}
        buttonClassName="text-body-sm text-ink-2 hover:text-ink"
        panelClassName="mt-2 space-y-4"
      >
        {MORE_BY_GROUP.map(({ group, ids }) => (
          <PantryGroup key={group} id={`${idPrefix}-${group}s`} title={t(`ui-guided.pantry.${group}s`)}>
            {ids.map(tile)}
          </PantryGroup>
        ))}
      </Disclosure>
      <Disclosure
        summary={t("ui-guided.pantry.custom")}
        icon={PackagePlus}
        id={`${idPrefix}-custom`}
        buttonClassName="text-body-sm text-ink-2 hover:text-ink"
        panelClassName="mt-2"
      >
        <IngredientsCustom idPrefix={`${idPrefix}-own`} headingLevel={level + 1} />
      </Disclosure>
      <IngredientsRatioReach />
    </div>
  );
}

/**
 * The salt of the pantry: which sodium salt the athlete has (table salt,
 * sodium citrate or both, half each; `inputs.salts.sodiumSalt`) as a
 * segmented choice, with the amounts the plan puts in the recipe. When the
 * salts are a manual list (set in expert mode) it says so and offers to let
 * the plan choose again (Auto; the manual list is kept for expert mode),
 * then moves the focus to the choice that appears. With the sodium
 * target's "Why?". A group named by its heading.
 *
 * @param {{ idPrefix: string, headingLevel?: number }} props  `headingLevel` defaults to 3.
 */
export function GuidedPantrySalt({ idPrefix, headingLevel = 3 }) {
  const t = useT();
  const { inputs, set } = usePlanInputs();
  const plan = usePlan();
  const focusRadio = useFocusRadioAfterRender();
  const level = Math.min(6, Math.max(2, Math.round(headingLevel) || 3));
  const Heading = `h${level}`;
  const headingId = `${idPrefix}-heading`;
  const labelId = `${idPrefix}-label`;
  const groupId = `${idPrefix}-choice`;
  const manual = inputs.salts.mode === "manual";

  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0 space-y-3" data-testid="guided-pantry-salt">
      <div>
        <Heading id={headingId} className="display-title text-ink">
          {t("ui-guided.pantry.salt")}
        </Heading>
        <p className="text-body-sm text-ink-2">{t("ui-guided.pantry.saltReason")}</p>
        <Why why={plan.sodium.recommended.why} />
      </div>
      {manual ? (
        <div className="space-y-2 rounded-control border border-line bg-surface-2 p-3" data-testid="guided-salts-manual">
          <p className="text-body-sm text-ink">{t("ui-guided.pantry.saltManual")}</p>
          <Button
            size="sm"
            icon={FlaskConical}
            onClick={() => {
              focusRadio(groupId);
              set("salts.mode", "auto");
            }}
          >
            {t("ui-guided.pantry.saltAuto")}
          </Button>
        </div>
      ) : (
        <>
          <div>
            <p id={labelId} className="caption mb-1 text-ink-2">
              {t("ui-guided.pantry.saltLabel")}
            </p>
            <Segmented
              id={groupId}
              labelledBy={labelId}
              value={inputs.salts.sodiumSalt}
              onChange={(salt) => set("salts.sodiumSalt", salt)}
              options={INPUT_OPTIONS.sodiumSalt.map((salt) => ({ value: salt, label: t(`ui-guided.pantry.salt.${salt}`) }))}
              fullWidth
              data-testid="guided-salt-choice"
            />
          </div>
          <SaltsAutoList />
        </>
      )}
    </div>
  );
}

/**
 * Guided step 3, the pantry: the carbohydrates ({@link GuidedPantryCarbs})
 * and the salt ({@link GuidedPantrySalt}), with the reason and the ratio
 * target's "Why?".
 *
 * @param {{ idPrefix: string, headingId: string, headingRef?: import('react').Ref<HTMLHeadingElement>,
 *   caption: string }} props
 */
export default function GuidedPantryScreen({ idPrefix, headingId, headingRef, caption }) {
  const t = useT();
  const plan = usePlan();
  const generatedId = useId().replace(/:/g, "");
  const prefix = idPrefix ?? `guided-pantry-${generatedId}`;
  return (
    <GuidedScreen
      screen="pantry"
      headingId={headingId}
      headingRef={headingRef}
      caption={caption}
      title={t("ui-guided.pantry.title")}
      reason={t("ui-guided.pantry.reason")}
      why={plan.carbs.ratio.recommended?.why}
    >
      <GuidedPantryCarbs idPrefix={`${prefix}-carbs`} />
      <div className="border-t border-line pt-5">
        <GuidedPantrySalt idPrefix={`${prefix}-salt`} />
      </div>
    </GuidedScreen>
  );
}
