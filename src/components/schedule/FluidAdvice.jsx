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
import { Droplets } from "lucide-react";
import Icon from "../ui/Icon";
import WarningList from "../ui/WarningList";
import { CitationLinks } from "../ui/Why";
import { cx } from "../ui/cx";
import { fluidAdvice } from "./scheduleText";
import { usePlan } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";

/**
 * Fluid advice under the schedule (a named region): the explanation of the
 * fluid recommendation, or for a manual target the chosen and the
 * recommended amounts; its details (the drink-to-thirst hint for short
 * events), links to the cited studies, and the fluid warnings. Renders
 * nothing when no fluid is planned.
 * @param {{ headingLevel?: 3|4|5|6, className?: string }} props
 */
export default function FluidAdvice({ headingLevel = 3, className }) {
  const t = useT();
  const plan = usePlan();
  const headingId = useId();
  const advice = fluidAdvice(t, plan);
  if (!advice) return null;
  const Heading = `h${Math.min(6, Math.max(3, headingLevel))}`;
  return (
    <section aria-labelledby={headingId} className={cx("space-y-3", className)}>
      <Heading id={headingId} className="caption flex items-center gap-2 text-muted">
        <Icon icon={Droplets} size={16} className="text-fluid" />
        {t("ui-schedule.fluid.title")}
      </Heading>
      <div className="space-y-1 text-body-sm text-ink-2">
        <p className="text-ink">{advice.summary}</p>
        {advice.details.map((detail, index) => (
          <p key={`${index}-${detail}`}>{detail}</p>
        ))}
        <CitationLinks ids={advice.citations} className="text-caption" />
      </div>
      <WarningList warnings={plan.fluid.warnings} />
    </section>
  );
}
