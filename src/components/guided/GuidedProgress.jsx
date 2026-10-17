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

import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { GUIDED_STEPS, segmentFill } from "./guidedSteps";

/**
 * The progress bar of the guided flow, which is also the list of steps: a
 * navigation landmark ("Guided setup") with an ordered list of the four
 * steps. Each step is a button (at least 44 × 44 px; the flow gives the
 * list a row of its own on narrow screens, so four of them fit) that jumps
 * to the step's first screen; the current one has `aria-current="step"`.
 *
 * Each button shows a bar segment (full for the steps before, filled by the
 * share of screens reached for the current step, empty after: decorative,
 * the caption over the screen says "Step 2 of 4") and a numbered marker
 * that differs by shape, not only colour: filled up to the current step,
 * outlined after it, and ringed on the current one. Steps before are not
 * marked done: every step has answers from the start, and a step can be
 * skipped. The step name is visible when the list has room (28 rem), else
 * for screen readers only; screen readers always hear "Step 2: Body &
 * weather".
 *
 * @param {{ step: number, part: number, onSelect: (step: number) => void, className?: string }} props
 */
export default function GuidedProgress({ step, part, onSelect, className }) {
  const t = useT();
  return (
    <nav aria-label={t("ui-guided.progress.label")} className={cx("@container min-w-0", className)} data-testid="guided-progress">
      <ol role="list" className="grid grid-cols-4 gap-1.5">
        {GUIDED_STEPS.map((item, index) => {
          const current = index === step;
          const reached = index <= step;
          const fill = segmentFill(step, part, index);
          return (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(index)}
                data-testid={`guided-step-${item.id}`}
                className="flex min-h-11 w-full min-w-11 flex-col justify-center gap-1.5 rounded-control py-1.5 text-left"
              >
                <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <span
                    data-testid="guided-step-fill"
                    className="block h-full rounded-full bg-ink"
                    style={{ width: `${Math.round(fill * 100)}%` }}
                  />
                </span>
                {/* Marker and name aligned at the top (a name may wrap to two lines in German), with room for
                    the current marker's ring (4 px outside the marker, drawn as a shadow) before the name. */}
                <span className="flex min-w-0 items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    data-testid="guided-step-marker"
                    data-state={current ? "current" : reached ? "before" : "after"}
                    className={cx(
                      "num inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-caption font-semibold",
                      // Forced colours (Windows high contrast) drop fills and shadows: system colours keep the
                      // filled / outlined difference, and an outline replaces the ring.
                      "forced-colors:forced-color-adjust-none",
                      reached
                        ? "border-ink bg-ink text-surface forced-colors:border-[color:CanvasText] forced-colors:bg-[color:CanvasText] forced-colors:text-[color:Canvas]"
                        : "border-line-strong bg-surface text-ink-2 forced-colors:border-[color:CanvasText] forced-colors:bg-[color:Canvas] forced-colors:text-[color:CanvasText]",
                      current &&
                        "ring-2 ring-ink ring-offset-2 ring-offset-bg forced-colors:outline-2 forced-colors:outline-offset-2 forced-colors:outline-solid forced-colors:outline-[color:Highlight]",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cx("caption mt-0.5 min-w-0 break-words sr-only @md:not-sr-only", current ? "text-ink" : "text-ink-2")}>
                    <span className="sr-only">{t("ui-guided.progress.stepNumber", { number: index + 1 })}</span>{" "}
                    {t(`ui-guided.step.${item.id}`)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
