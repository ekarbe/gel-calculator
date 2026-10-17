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

import Panel from "../ui/Panel";
import Why from "../ui/Why";
import { cx } from "../ui/cx";

/**
 * One screen of the guided flow (one question group): a named region with
 * the step caption ("Step 2 of 4 · Body & weather"), the screen heading
 * (level 2; `tabIndex={-1}` so the flow can move the focus to it after Back
 * or Next), the one-line reason the question is asked, its "Why?" (the
 * plan's explanation of what the answer drives) and the fields.
 *
 * `panel` (default true) puts the screen on a flat panel; the last screen
 * passes false, because the race board brings its own panels. Numbers use
 * tabular figures throughout (`num`), so amounts line up from tile to tile.
 *
 * @param {{ screen: string, headingId: string, headingRef?: import('react').Ref<HTMLHeadingElement>,
 *   caption: string, title: string, reason: string, why?: import('../ui/Why').Explanation|null,
 *   panel?: boolean, className?: string, children?: import('react').ReactNode }} props
 */
export default function GuidedScreen({ screen, headingId, headingRef, caption, title, reason, why, panel = true, className, children }) {
  const intro = (
    <div className="space-y-1">
      <p className="caption text-muted" data-testid="guided-caption">
        {caption}
      </p>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="display-section text-ink">
        {title}
      </h2>
      <p className="text-body text-ink-2" data-testid="guided-reason">
        {reason}
      </p>
      {why ? <Why why={why} /> : null}
    </div>
  );
  if (!panel) {
    return (
      <section aria-labelledby={headingId} data-testid="guided-screen" data-screen={screen} className={cx("num min-w-0 space-y-4", className)}>
        <div className="px-1">{intro}</div>
        {children}
      </section>
    );
  }
  return (
    <Panel aria-labelledby={headingId} data-testid="guided-screen" data-screen={screen} className={cx("num @container min-w-0 space-y-6", className)}>
      {intro}
      {children}
    </Panel>
  );
}
