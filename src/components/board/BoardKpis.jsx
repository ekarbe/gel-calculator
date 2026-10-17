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

import { Coffee, Droplets, Hexagon, Info, OctagonAlert, TriangleAlert, Zap } from "lucide-react";
import Icon from "../ui/Icon";
import Stat from "../ui/Stat";
import { hasWhy, useWhyParts } from "../ui/Why";
import { cx, toneClasses } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { DEFICIT_HIGH_PCT, DEFICIT_MILD_PCT } from "../../domain/hydration";
import { roundTo } from "../../domain/units";
import { countText } from "../../i18n/plural";
import { deliveredRatio } from "../recipe/recipeText";

/** @typedef {import('../../domain/plan').Plan} Plan */
/** @typedef {import('../../i18n/index').TranslateFn} TranslateFn */
/** @typedef {import('../../i18n/formatters').Formatters} Formatters */
/** @typedef {{ tone: 'warn'|'danger'|'neutral', text: string }} StatusLine */
/** @typedef {import('../ui/Why').Explanation} Explanation */

/** Icon of each status-line tone: its own shape, so the meaning never depends on colour. */
const STATUS_ICONS = Object.freeze({ danger: OctagonAlert, warn: TriangleAlert, neutral: Info });

/**
 * A short status line under a tile's sub-info (a target the recipe does not
 * meet, a body-mass level to watch), with its icon and the text.
 * @param {{ status: StatusLine|null, testId: string }} props
 */
function StatusText({ status, testId }) {
  if (!status) return null;
  return (
    <p data-testid={testId} data-tone={status.tone} className={cx("mt-1 flex items-start gap-1.5 text-body-sm", toneClasses(status.tone).text)}>
      <Icon icon={STATUS_ICONS[status.tone] ?? Info} size={16} className="mt-0.5" />
      <span className="min-w-0">{status.text}</span>
    </p>
  );
}

/**
 * The "Why?" label of a tile: "Why?" with the tile's name for screen
 * readers, so the four buttons do not share one name.
 * @param {TranslateFn} t
 * @param {string} target
 */
function whyLabel(t, target) {
  return (
    <>
      {t("ui-common.why")}{" "}
      <span className="sr-only">{t("ui-board.kpi.whyFor", { target })}</span>
    </>
  );
}

/**
 * The carbs tile's numbers: target g/h, the ratio the recipe delivers, the
 * whole-activity target, and a status line when the recipe delivers less
 * (no carb ingredient, a 0:0 ratio).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 */
function carbsTile(t, f, plan) {
  const { gPerHour, totalG, deliveredG } = plan.carbs;
  const short = totalG > 0 && Math.round(deliveredG) < Math.round(totalG);
  return {
    value: f.number(gPerHour),
    sub:
      totalG > 0
        ? t("ui-board.kpi.carbs.sub", { ratio: deliveredRatio(plan), g: f.number(totalG) })
        : t("ui-board.kpi.carbs.none"),
    status: short
      ? {
          tone: /** @type {const} */ ("warn"),
          text: t("ui-board.kpi.carbs.short", { g: f.number(totalG - deliveredG), delivered: f.number(deliveredG) }),
        }
      : null,
  };
}

/**
 * The sodium tile's numbers: target mg/h and the whole-activity target, and
 * a status line when the salts deliver less or more than the target
 * (`plan.salts.comparison`) or a manual target is below the evidence range.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 */
function sodiumTile(t, f, plan) {
  const target = plan.sodium.totalMg;
  const row = plan.salts.comparison?.Sodium ?? {
    target,
    delivered: plan.salts.delivered?.Sodium ?? 0,
    diff: (plan.salts.delivered?.Sodium ?? 0) - target,
    status: "met",
  };
  const belowRange = plan.sodium.warnings.some((warning) => warning.id === "plan.sodiumBelowRange");
  /** @type {StatusLine|null} */
  let status = null;
  if (row.target > 0 && row.status === "short") {
    status = { tone: "warn", text: t("ui-board.kpi.sodium.short", { mg: f.number(-row.diff), delivered: f.number(row.delivered) }) };
  } else if (row.target > 0 && row.status === "over") {
    status = { tone: "warn", text: t("ui-board.kpi.sodium.over", { mg: f.number(row.diff), delivered: f.number(row.delivered) }) };
  } else if (belowRange) {
    status = { tone: "neutral", text: t("ui-board.kpi.sodium.belowRange") };
  }
  return {
    value: f.number(plan.sodium.mgPerHour),
    sub: target > 0 ? t("ui-board.kpi.sodium.sub", { mg: f.number(target) }) : t("ui-board.kpi.sodium.none"),
    status,
  };
}

/**
 * The fluid tile's numbers: ml/h (fl oz/h in imperial), the total and the
 * projected water loss or gain as a share of body mass, and a status line
 * for a projection level to watch (mild or high loss, a gain).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 */
function fluidTile(t, f, plan) {
  const { mlPerHour, totalMl } = plan.fluid;
  const { level, deficitPct } = plan.hydration;
  const pct = roundTo(Math.abs(deficitPct ?? 0), 1);
  const ml = Math.round(totalMl);
  let sub;
  if (!(totalMl > 0)) sub = t("ui-board.kpi.fluid.none");
  else sub = t(level === "gain" ? "ui-board.kpi.fluid.gain" : "ui-board.kpi.fluid.loss", { ml, pct });
  /** @type {StatusLine|null} */
  let status = null;
  if (level === "mild") status = { tone: "neutral", text: t("ui-board.kpi.fluid.level.mild", { lo: DEFICIT_MILD_PCT, hi: DEFICIT_HIGH_PCT }) };
  else if (level === "high") status = { tone: "warn", text: t("ui-board.kpi.fluid.level.high", { pct: DEFICIT_HIGH_PCT }) };
  else if (level === "gain") status = { tone: "danger", text: t("ui-board.kpi.fluid.level.gain") };
  return {
    value: f.volume(mlPerHour, { unit: false }),
    unit: t("ui-board.unit.perHour", { unit: f.unit("volume") }),
    sub,
    status,
  };
}

/**
 * The caffeine tile's numbers: the planned total mg with mg/kg and the
 * number of doses, or "Off".
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 */
function caffeineTile(t, f, plan) {
  const { caffeine } = plan;
  if (!caffeine.enabled) return { value: t("ui-common.off"), unit: null, sub: t("ui-board.kpi.caffeine.offSub") };
  return {
    value: f.number(caffeine.totalMg),
    unit: t("ui-board.unit.mg"),
    sub: t("ui-board.kpi.caffeine.sub", {
      mgPerKg: f.number(caffeine.totalMgPerKg, 1),
      doses: countText(t, f, "ui-board.kpi.caffeine.doses", caffeine.doses.length),
    }),
  };
}

/**
 * The energy line of the carbs "Why?": kcal from the carbs the recipe delivers
 * (with the planned kcal when the recipe delivers less or more) and the
 * energy the event burns (the heat-balance estimate, rounded to 10 kcal).
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {string}
 */
export function energyText(t, f, plan) {
  const { kcal: planned, deliveredKcal, expenditureKcal } = plan.energy;
  const delivered =
    planned > 0 && Math.round(deliveredKcal) !== Math.round(planned)
      ? t("ui-board.energy.deliveredOf", { kcal: f.number(deliveredKcal), planned: f.number(planned) })
      : t("ui-board.energy.delivered", { kcal: f.number(deliveredKcal) });
  if (!(expenditureKcal > 0)) return delivered;
  const burned = t("ui-board.energy.burned", { kcal: f.number(Math.round(expenditureKcal / 10) * 10) });
  return t("ui-board.energy.both", { delivered, burned });
}

/**
 * The carbs explanation with two more lines: the g/h on each pathway the
 * recipe delivers (`plan.carbs.ratio`; not without a carb target) and the
 * energy line ({@link energyText}). Detail one tap away, so the tile keeps
 * to its big number and one line of sub-info.
 * @param {TranslateFn} t
 * @param {Formatters} f
 * @param {Plan} plan
 * @returns {Explanation|null}
 */
export function carbsWhy(t, f, plan) {
  const why = plan.carbs.recommended?.why;
  if (!hasWhy(why)) return null;
  const { glucoseGPerHour, fructoseGPerHour } = plan.carbs.ratio;
  /** @type {Explanation['details']} */
  const extra = [];
  if (plan.carbs.totalG > 0) {
    extra.push({
      key: "ui-board.kpi.carbs.pathways",
      params: { glucose: f.number(glucoseGPerHour), fructose: f.number(fructoseGPerHour) },
    });
  }
  extra.push({ key: "ui-board.kpi.carbs.energy", params: { energy: energyText(t, f, plan) } });
  return { ...why, details: [...(Array.isArray(why.details) ? why.details : []), ...extra] };
}

/**
 * The KPI row of the race board: four tiles (2 × 2 on phones, one row in a
 * wide board), each with its substance colour, the big number, a caption, a
 * one-line sub-info, a status line when something needs attention, and
 * "Why?" with the plan's explanation:
 * - Carbs: g/h, the ratio the recipe delivers and the total (target) g;
 *   its "Why?" adds the g/h on each pathway and the energy.
 * - Sodium: mg/h and the total mg.
 * - Fluid: ml/h (fl oz/h), the total and the projected water loss or gain.
 * - Caffeine: the planned total mg, or "Off".
 * A tile's "Why?" button sits at the end of its caption row (compact, with
 * a full-size target), so a tile spends no row on it; its explanation opens
 * full width under the tile row (a grid row of its own,
 * `grid-flow-row-dense` keeps the tiles in their rows), so it never
 * squeezes into a narrow tile or stretches the tile next to it. Every number comes from the plan; the
 * tiles only format it. Exported for the guided flow's last step.
 */
export default function BoardKpis() {
  const t = useT();
  const f = useFormat();
  const plan = usePlan();
  const carbs = carbsTile(t, f, plan);
  const sodium = sodiumTile(t, f, plan);
  const fluid = fluidTile(t, f, plan);
  const caffeine = caffeineTile(t, f, plan);
  const names = {
    carbs: t("ui-board.kpi.carbs"),
    sodium: t("ui-board.kpi.sodium"),
    fluid: t("ui-board.kpi.fluid"),
    caffeine: t("ui-board.kpi.caffeine"),
  };
  // The "Why?" buttons sit in the tiles' caption rows (compact, same target size), the panels full width.
  const whyOptions = { panelClassName: "col-span-full", compact: true };
  const carbsWhyParts = useWhyParts(carbsWhy(t, f, plan), { label: whyLabel(t, names.carbs), ...whyOptions });
  const sodiumWhyParts = useWhyParts(plan.sodium.recommended.why, { label: whyLabel(t, names.sodium), ...whyOptions });
  const fluidWhyParts = useWhyParts(plan.fluid.recommended.why, { label: whyLabel(t, names.fluid), ...whyOptions });
  const caffeineWhyParts = useWhyParts(plan.caffeine.why, { label: whyLabel(t, names.caffeine), ...whyOptions });

  return (
    <div data-testid="board-kpis" className="num">
      <div className="grid grid-flow-row-dense grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Stat
          data-testid="kpi-carbs"
          tone="glucose"
          icon={Zap}
          label={names.carbs}
          value={carbs.value}
          unit={t("ui-board.unit.gPerHour")}
          sub={carbs.sub}
          aside={carbsWhyParts.button}
          valueProps={{ "data-testid": "kpi-carbs-value" }}
        >
          <StatusText status={carbs.status} testId="kpi-carbs-status" />
        </Stat>
        {carbsWhyParts.panel}
        <Stat
          data-testid="kpi-sodium"
          tone="sodium"
          icon={Hexagon}
          label={names.sodium}
          value={sodium.value}
          unit={t("ui-board.unit.mgPerHour")}
          sub={sodium.sub}
          aside={sodiumWhyParts.button}
          valueProps={{ "data-testid": "kpi-sodium-value" }}
        >
          <StatusText status={sodium.status} testId="kpi-sodium-status" />
        </Stat>
        {sodiumWhyParts.panel}
        <Stat
          data-testid="kpi-fluid"
          tone="fluid"
          icon={Droplets}
          label={names.fluid}
          value={fluid.value}
          unit={fluid.unit}
          sub={fluid.sub}
          aside={fluidWhyParts.button}
          valueProps={{ "data-testid": "kpi-fluid-value" }}
        >
          <StatusText status={fluid.status} testId="kpi-fluid-status" />
        </Stat>
        {fluidWhyParts.panel}
        <Stat
          data-testid="kpi-caffeine"
          data-enabled={plan.caffeine.enabled}
          tone="caffeine"
          icon={Coffee}
          label={names.caffeine}
          value={caffeine.value}
          unit={caffeine.unit}
          sub={caffeine.sub}
          aside={caffeineWhyParts.button}
          valueProps={{ "data-testid": "kpi-caffeine-value" }}
        />
        {caffeineWhyParts.panel}
      </div>
    </div>
  );
}
