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

import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { PROJECTION_LABELS } from "./bodyMass";

/** Icon and chip colors of each projection level ("ink" colors keep the text readable in light mode). */
const LEVEL_LOOKS = Object.freeze({
  ok: { Icon: CircleCheck, chip: "text-apple-green-ink bg-apple-green/10 border-apple-green/30" },
  mild: { Icon: Info, chip: "text-text-primary bg-apple-blue/10 border-apple-blue/30" },
  high: { Icon: TriangleAlert, chip: "text-apple-amber-ink bg-apple-amber/10 border-apple-amber/30" },
  gain: { Icon: OctagonAlert, chip: "text-text-primary bg-apple-red/10 border-apple-red/30" },
});

/**
 * The level chip of the body-mass projection: its own icon and text for
 * every level, so the meaning never depends on color alone.
 * @param {{ level: 'ok'|'mild'|'high'|'gain', testId?: string }} props
 */
export default function BodyMassLevel({ level, testId }) {
  const known = Object.hasOwn(LEVEL_LOOKS, level) ? level : "ok";
  const { Icon, chip } = LEVEL_LOOKS[known];
  return (
    <span
      data-level={known}
      data-testid={testId}
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${chip}`}
    >
      <Icon size={14} aria-hidden="true" />
      {PROJECTION_LABELS[known]}
    </span>
  );
}
