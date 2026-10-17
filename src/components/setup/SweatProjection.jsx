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
import { CircleCheck, Info, OctagonAlert, Scale, TriangleAlert } from "lucide-react";
import Chip from "../ui/Chip";
import Icon from "../ui/Icon";
import { useT } from "../../i18n/useT";
import { useFormat } from "../../i18n/format";
import { usePlan } from "../../state/PlanProvider";
import { DEFICIT_HIGH_PCT, DEFICIT_MILD_PCT } from "../../domain/hydration";
import { roundTo } from "../../domain/units";
import { SweatFact } from "./SweatEstimatePanel";

/** @typedef {'ok'|'mild'|'high'|'gain'} ProjectionLevel */

/** Chip tone and icon of each projection level: every level has its own icon and text, never colour alone. */
const LEVEL_LOOKS = Object.freeze({
  ok: { tone: "ok", icon: CircleCheck },
  mild: { tone: "neutral", icon: Info },
  high: { tone: "warn", icon: TriangleAlert },
  gain: { tone: "danger", icon: OctagonAlert },
});

/**
 * The projection level to show: `level`, or `'ok'` for a value the domain never returns.
 * @param {unknown} level
 * @returns {ProjectionLevel}
 */
export const projectionLevel = (level) =>
  typeof level === "string" && Object.hasOwn(LEVEL_LOOKS, level) ? /** @type {ProjectionLevel} */ (level) : "ok";

/**
 * The text of a projection level. The domain sets `mild` above 2.0 % (as
 * shown, one decimal), so a 2.0 % loss is `ok`: "Up to 2% loss".
 * @param {import('../../i18n/index').TranslateFn} t
 * @param {unknown} level
 * @returns {string}
 */
export function projectionLevelLabel(t, level) {
  switch (projectionLevel(level)) {
    case "mild":
      return t("ui-setup-sweat.projection.level.mild", { lo: DEFICIT_MILD_PCT, hi: DEFICIT_HIGH_PCT });
    case "high":
      return t("ui-setup-sweat.projection.level.high", { pct: DEFICIT_HIGH_PCT });
    case "gain":
      return t("ui-setup-sweat.projection.level.gain");
    default:
      return t("ui-setup-sweat.projection.level.ok", { pct: DEFICIT_MILD_PCT });
  }
}

/**
 * The level chip of the body-mass projection (icon, tone and text; `data-level`).
 * @param {{ level: unknown, testId?: string }} props
 */
export function SweatProjectionLevel({ level, testId }) {
  const t = useT();
  const known = projectionLevel(level);
  const look = LEVEL_LOOKS[known];
  return (
    <Chip tone={look.tone} icon={look.icon} data-level={known} data-testid={testId}>
      {projectionLevelLabel(t, known)}
    </Chip>
  );
}

/**
 * Projected change of body mass over the event (`plan.hydration`, from the
 * sweat rate and the fluid target): what the scale shows afterwards (signed,
 * in kg or lb), the water lost or gained with its share of body mass (never
 * a negative loss: a gain reads "Water gained"), and the level chip. The
 * plan's warnings about it are on the race board. Exported for the guided
 * flow and the board.
 * @param {{ headingLevel?: number }} props  Level of the group's heading (default 3).
 */
export default function SweatProjection({ headingLevel = 3 }) {
  const t = useT();
  const f = useFormat();
  const { hydration } = usePlan();
  const headingId = useId();
  const level = projectionLevel(hydration?.level);
  const gain = level === "gain";
  const Heading = `h${Math.min(6, Math.max(2, Math.round(headingLevel) || 3))}`;

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-testid="body-mass-projection"
      className="rounded-control border border-line p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading id={headingId} className="flex items-center gap-2 text-body-sm font-semibold text-ink">
          <Icon icon={Scale} size={16} className="text-ink-2" />
          {t("ui-setup-sweat.projection.title")}
        </Heading>
        <SweatProjectionLevel level={level} testId="body-mass-level" />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <SweatFact term={t("ui-setup-sweat.projection.scale")} testId="body-mass-scale">
          {f.mass(hydration?.scaleChangeKg ?? 0, { signed: true })}
        </SweatFact>
        <SweatFact
          term={t(gain ? "ui-setup-sweat.projection.waterGained" : "ui-setup-sweat.projection.waterLost")}
          testId="body-mass-water"
        >
          {t("ui-setup-sweat.projection.waterValue", {
            waterL: roundTo(Math.abs(hydration?.waterDeficitL ?? 0), 2),
            pct: roundTo(Math.abs(hydration?.deficitPct ?? 0), 1),
          })}
        </SweatFact>
      </dl>
      <p className="mt-2 text-body-sm text-ink-2">{t("ui-setup-sweat.projection.note", { pct: DEFICIT_MILD_PCT })}</p>
    </div>
  );
}
