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

/**
 * The projected body-mass change (`plan.hydration`) as text, the same in
 * the activity summary, the electrolytes card and the print view. Display
 * only: every number comes from `projectBodyMass` in the domain.
 */

import { fmt, signed } from "./format";
import { LB_PER_KG } from "./units";
import { DEFICIT_HIGH_PCT, DEFICIT_MILD_PCT } from "../../domain/hydration";

/** @typedef {import('../../domain/plan').Plan['hydration']} Hydration */
/** @typedef {'ok'|'mild'|'high'|'gain'} ProjectionLevel */

/**
 * Text of each projection level. The domain sets `mild` above 2.0 % (as
 * shown, one decimal), so a 2.0 % loss is `ok`: "Up to 2% loss".
 */
export const PROJECTION_LABELS = Object.freeze({
  ok: `Up to ${DEFICIT_MILD_PCT}% loss`,
  mild: `${DEFICIT_MILD_PCT}–${DEFICIT_HIGH_PCT}% loss`,
  high: `Over ${DEFICIT_HIGH_PCT}% loss`,
  gain: "Weight gain",
});

/**
 * The projection level to show: `hydration.level`, or `'ok'` for a value the
 * domain never returns.
 * @param {Hydration} hydration
 * @returns {ProjectionLevel}
 */
function projectionLevel(hydration) {
  return Object.hasOwn(PROJECTION_LABELS, hydration?.level) ? hydration.level : "ok";
}

/**
 * The body-mass projection as text.
 *
 * - `scale`: the change on the scale after the event, signed after rounding
 *   to one decimal ("+1.8 kg", "−0.6 lb", "0 kg").
 * - `waterTerm` / `water`: "Water gained" when the plan drinks more than it
 *   sweats (level `gain`), else "Water lost", with the amount and its share
 *   of body mass, both without sign ("2.25 L (3.2% of body mass)").
 *
 * @param {Hydration} hydration
 * @param {'kg'|'lb'} massUnit
 * @returns {{ level: ProjectionLevel, label: string, gain: boolean, scale: string, waterTerm: string, water: string }}
 */
export function bodyMassText(hydration, massUnit) {
  const level = projectionLevel(hydration);
  const unit = massUnit === "lb" ? "lb" : "kg";
  const scaleChange = (hydration?.scaleChangeKg ?? 0) * (unit === "lb" ? LB_PER_KG : 1);
  const gain = level === "gain";
  return {
    level,
    label: PROJECTION_LABELS[level],
    gain,
    scale: `${signed(scaleChange, 1)} ${unit}`,
    waterTerm: gain ? "Water gained" : "Water lost",
    water: `${fmt(Math.abs(hydration?.waterDeficitL ?? 0), 2)} L (${fmt(Math.abs(hydration?.deficitPct ?? 0), 1)}% of body mass)`,
  };
}
