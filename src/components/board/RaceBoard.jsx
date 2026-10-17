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

import { useEffect, useId, useRef, useState } from "react";
import { useUi } from "../../state/UiProvider";
import { cx } from "../ui/cx";
import BoardTitle from "./BoardTitle";
import BoardKpis from "./BoardKpis";
import BoardRecipe from "./BoardRecipe";
import BoardNextUp from "./BoardNextUp";
import BoardWarnings from "./BoardWarnings";
import BoardCost from "./BoardCost";
import BoardAnnouncer from "./BoardAnnouncer";

/**
 * The full schedule's panel (`src/components/schedule/Schedule.jsx`), which
 * "Full schedule" reveals on phones. Its `aria-labelledby` names its heading.
 */
export const SCHEDULE_SELECTOR = '[data-testid="schedule"]';

/**
 * Space kept between the sticky header and the revealed schedule, in px, on
 * top of the page's scroll padding (the header's height and 0.5 rem).
 */
const REVEAL_GAP_PX = 8;

/**
 * Moves the focus to the full schedule's heading (its panel when it has no
 * heading) and scrolls the panel to the top of the screen, below the sticky
 * header. The heading gets `tabindex="-1"` for as long as it has the focus.
 * Does nothing when the schedule is not on the page.
 * @returns {boolean}  Whether the schedule was found.
 */
export function revealSchedule() {
  const region = document.querySelector(SCHEDULE_SELECTOR);
  if (!(region instanceof HTMLElement)) return false;
  const headingId = region.getAttribute("aria-labelledby");
  const heading = headingId ? document.getElementById(headingId) : null;
  const target = heading ?? region;
  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
    target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
  }
  target.focus({ preventScroll: true });
  if (typeof region.scrollIntoView === "function") {
    // The page's scroll padding keeps it below the sticky header (usePinnedHeight).
    const previous = region.style.scrollMarginTop;
    region.style.scrollMarginTop = `${REVEAL_GAP_PX}px`;
    region.scrollIntoView({ block: "start" });
    region.style.scrollMarginTop = previous;
  }
  return true;
}

/**
 * The Race board: everything needed on race morning in one view (design
 * doc, "Race board"), in this order:
 *
 * 1. Title row ({@link BoardTitle}): the "Race board" heading over the
 *    event summary, the sweat-source chip and the warnings-count chip (it
 *    opens the warnings panel and moves the focus to it).
 * 2. KPI row ({@link BoardKpis}): carbs g/h, sodium mg/h, fluid ml/h and
 *    caffeine mg, each with "Why?" in its caption row (the explanation opens
 *    full width under the tile row; the carbs one adds the pathways and the
 *    energy).
 * 3. Recipe ({@link BoardRecipe}): Total ↔ Per serving, one block of lanes
 *    per gel batch or drink with the water line, START MIXING, Print and
 *    Share, then the per-serving facts and the osmolality chip.
 * 4. Next up ({@link BoardNextUp}): the first schedule events, with "Full
 *    schedule".
 * 5. Warnings ({@link BoardWarnings}): every plan warning, danger first,
 *    with a polite announcement when their number changes ({@link BoardAnnouncer}).
 * 6. The cost estimate ({@link BoardCost}), a side note last.
 *
 * Landmarks: the shell wraps the board in the region named "Race board"
 * (`ui-shell.board.label`), so the root here is a plain `<div>` (the
 * "Race board" heading names the content, not a second landmark), and the
 * panels inside are regions named by their own titles ("Recipe", "Next up",
 * "Warnings (n)"); recipe sections are groups, not regions.
 *
 * Layout follows the board's own width (container queries), so it works in
 * the shell's right column, on a phone tab and in the guided flow: tiles 2 × 2,
 * in one row from 42 rem; from 48 rem (a desktop board) the recipe on the
 * left and Next up, the warnings and the cost on the right, so a 1440 × 900
 * screen shows the lanes, START MIXING and Next up at once; gel and drink
 * side by side in a recipe of 48 rem.
 *
 * Must be rendered inside `PlanProvider` and `UiProvider`. Every string comes
 * from the `ui-board` catalog (plus domain messages), every quantity is
 * formatted for the UI language and unit system, and every number uses
 * tabular figures (`num` on the root, inherited by the display headings).
 *
 * @param {{ headingLevel?: number, onShowSchedule?: (() => void)|null, className?: string }} props
 *   `headingLevel` is the level of the "Race board" heading, 2–4 (default 2; the panels use one
 *   level below, recipe sections two, so the outline never passes h6). `onShowSchedule` replaces
 *   what "Full schedule" does; by default, in expert mode it brings the full schedule into view and
 *   moves the focus to its heading (on a phone it switches the tab to Schedule first: the board, and
 *   the focused button with it, is hidden then; on a desktop the schedule is under the columns), and
 *   in guided mode there is no button.
 */
export default function RaceBoard({ headingLevel = 2, onShowSchedule, className }) {
  const { mode, boardTab, setBoardTab } = useUi();
  const baseId = useId().replace(/:/g, "");
  const warningsHeadingId = `${baseId}-warnings`;
  const warningsBodyId = `${baseId}-warnings-body`;
  const [warningsOpen, setWarningsOpen] = useState(true);
  const focusWarnings = useRef(false);
  const focusSchedule = useRef(false);
  const level = Math.min(4, Math.max(2, Math.round(headingLevel) || 2));
  const panelLevel = level + 1;

  // After the chip opened the panel (and it rendered open), focus its toggle; that also scrolls it into view.
  useEffect(() => {
    if (!focusWarnings.current || !warningsOpen) return;
    focusWarnings.current = false;
    document.getElementById(warningsHeadingId)?.querySelector("button")?.focus();
  }, [warningsOpen, warningsHeadingId]);

  const showWarnings = () => {
    if (warningsOpen) {
      document.getElementById(warningsHeadingId)?.querySelector("button")?.focus();
      return;
    }
    focusWarnings.current = true;
    setWarningsOpen(true);
  };

  // After "Full schedule" switched the phone tab (and the schedule rendered), move the focus there:
  // the board, and the focused button with it, is hidden now.
  useEffect(() => {
    if (!focusSchedule.current || boardTab !== "schedule") return;
    focusSchedule.current = false;
    revealSchedule();
  }, [boardTab]);

  const openSchedule = () => {
    // Already on screen (a desktop shows it under the columns, or its phone tab is open): go there.
    const region = document.querySelector(SCHEDULE_SELECTOR);
    if (boardTab === "schedule" || (region instanceof HTMLElement && region.getClientRects().length > 0)) {
      revealSchedule();
      return;
    }
    focusSchedule.current = true;
    setBoardTab("schedule");
  };

  const customSchedule = typeof onShowSchedule === "function";
  const showSchedule = customSchedule ? onShowSchedule : mode === "expert" ? openSchedule : null;

  return (
    <div data-testid="race-board" className={cx("@container num min-w-0 space-y-3 @4xl:space-y-4", className)}>
      <BoardTitle headingLevel={level} onShowWarnings={showWarnings} warningsPanelId={warningsBodyId} />
      <BoardKpis />
      <div data-testid="board-body" className="grid items-start gap-3 @3xl:grid-cols-2 @4xl:gap-4">
        <BoardRecipe headingLevel={panelLevel} />
        <div className="grid min-w-0 items-start gap-3 @4xl:gap-4">
          <BoardNextUp headingLevel={panelLevel} onShowSchedule={showSchedule} />
          <BoardWarnings
            open={warningsOpen}
            onOpenChange={setWarningsOpen}
            headingId={warningsHeadingId}
            bodyId={warningsBodyId}
            headingLevel={panelLevel}
          />
          <BoardCost />
        </div>
      </div>
      <BoardAnnouncer />
    </div>
  );
}
