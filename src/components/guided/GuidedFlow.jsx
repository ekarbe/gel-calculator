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

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, SlidersHorizontal, TriangleAlert } from "lucide-react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { cx } from "../ui/cx";
import { useT } from "../../i18n/useT";
import { useUi } from "../../state/UiProvider";
import GuidedProgress from "./GuidedProgress";
import GuidedDock from "./GuidedDock";
import { BOTTOM_HEIGHT_VAR, usePinnedHeight } from "../ui/usePinnedHeight";
import GuidedPantryScreen from "./GuidedPantry";
import { GuidedConditionsScreen, GuidedEventScreen, GuidedPlanScreen, GuidedSweatScreen } from "./GuidedScreens";
import {
  GUIDED_SCREENS,
  GUIDED_STEPS,
  clampPosition,
  nextPosition,
  positionOfScreen,
  previousPosition,
  screenAt,
} from "./guidedSteps";
import { focusIntoForm, scrollToTop } from "./guidedFocus";

/** @typedef {import('./guidedSteps').GuidedPosition} GuidedPosition */
/** @typedef {import('./guidedSteps').GuidedScreenId} GuidedScreenId */

/** The component of each screen. */
const SCREENS = Object.freeze({
  event: GuidedEventScreen,
  conditions: GuidedConditionsScreen,
  sweat: GuidedSweatScreen,
  pantry: GuidedPantryScreen,
  board: GuidedPlanScreen,
});

/**
 * Screens that stay mounted (hidden) once visited, so what is typed there
 * survives Back, Next and the step list: every question screen. The board
 * holds no draft and announces warnings from a portal, so it mounts only
 * while it is shown (the dock announces them on the other screens).
 * @param {GuidedScreenId} id
 */
const keepsMounted = (id) => id !== "board";

/**
 * The first open form (an unsaved draft: a sweat test, a custom
 * ingredient) on the flow's screens, shown or hidden, or null.
 * @param {HTMLElement|null} root
 * @returns {HTMLFormElement|null}
 */
function openFormIn(root) {
  return root?.querySelector("[data-guided-slot] form") ?? null;
}

/**
 * Guided mode (design doc, "Guided mode", P6): four steps with a progress
 * bar, phone first, one question group per screen.
 *
 * 1. Event: sport, duration, intensity, speed/power (or METs).
 * 2. Body & weather: the body and weather fields with the setting, then
 *    "Have you done a sweat test?" with the sweat test list and form, or
 *    the estimate (two screens).
 * 3. Ingredients: the pantry grid (carbs) and the sodium salt.
 * 4. Recipe & plan: the Race board and the full schedule.
 *
 * Every screen has a one-line reason and a "Why?" (the plan's explanation
 * of what the answers drive; the board's numbers have their own). The
 * fields are the setup field groups, so expert mode shows everything the
 * flow set, and the reverse. Layout, top to bottom: the progress bar (the
 * step list, which also jumps to a step) with "Switch to expert" (on every
 * step; on its own row under the list while the flow is narrower than
 * 28 rem, so the four steps keep 44 px targets), the screen, and the dock
 * pinned to the bottom of the screen: the live carbs, sodium and fluid per
 * hour and the warnings count (not on the board, which shows them), and
 * Back / Next (each also names, for screen readers, the screen it goes to;
 * Next is the primary action, so the board screen, whose primary action is
 * Start mixing, has Back only).
 *
 * State: the step is the UI prefs' `guidedStep` (0–3); the screen within a
 * step is kept here, per step (Back from the pantry returns to the sweat
 * screen; a step chosen elsewhere starts at its first screen). A question
 * screen, once visited, stays mounted while hidden (`hidden` on its slot,
 * `data-guided-slot` names it), so an open form (a sweat test, a custom
 * ingredient) keeps what was typed across Back, Next and the step list;
 * only the shown screen is visible to anyone (query the shown one, e.g.
 * `[data-guided-slot]:not([hidden])`). The board mounts only while shown.
 *
 * Focus: after Back, Next or a step in the list, the flow scrolls to its
 * top (below the sticky header) and moves the focus to the new screen's
 * heading, so the keyboard and screen readers start at the new question.
 * Nothing moves on the first render or when the step changes from outside.
 *
 * "Switch to expert" sets `mode` to `'expert'` and first moves the focus to
 * the surrounding `<main>` (when it can take it), which stays while the
 * guided flow goes away. While a form is open on any screen it does not
 * leave at once (expert mode would drop the unsaved draft): it shows that
 * form's screen, moves the focus into the form and says so in the dock
 * (`role="alert"`); pressing it again leaves without the draft. The note
 * goes when no form is open any more, or on the next move.
 *
 * The shell's own mode switch leaves through the same check: the flow's
 * `ref` gets `{ leave({ buttonKey }) }`, which does what "Switch to
 * expert" does but leaves the focus where it is (on the shell's switch,
 * which stays) and names the shell's button (`buttonKey`, a catalog key) in
 * the note.
 *
 * Must be rendered inside `PlanProvider` and `UiProvider` (the shell
 * renders it in `<main>` when `mode` is `'guided'`). The dock is the flow's
 * last part and sticks to the bottom of the screen (not on short
 * viewports); a shell that shows a fixed bar under it passes
 * `dockOffsetClassName` (default `bottom-0`) to lift it, e.g. `bottom-16`.
 *
 * @param {{ className?: string, dockOffsetClassName?: string,
 *   ref?: import('react').Ref<{ leave: () => void }> }} props
 */
export default function GuidedFlow({ className, dockOffsetClassName, ref }) {
  const t = useT();
  const { guidedStep, setGuidedStep, setMode } = useUi();
  const uid = useId().replace(/:/g, "");
  // The screen within the current step; another step starts at its first screen.
  const [remembered, setRemembered] = useState(/** @type {GuidedPosition} */ ({ step: 0, part: 0 }));
  const [moves, setMoves] = useState(0);
  // Question screens visited so far (they stay mounted, hidden, while another one is shown).
  const [visited, setVisited] = useState(/** @type {GuidedScreenId[]} */ ([]));
  // "Switch to expert" found an open form: the note shows (naming the button that was pressed,
  // by its catalog key), and the next press leaves anyway. False while there is no note.
  const [leaveNote, setLeaveNote] = useState(/** @type {string|false} */ (false));
  const rootRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const headingRef = useRef(/** @type {HTMLHeadingElement|null} */ (null));
  const dockRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const formToFocus = useRef(/** @type {HTMLFormElement|null} */ (null));
  // Focused fields stay clear of the sticky dock (the page's scroll padding; none while it does not stick).
  usePinnedHeight(dockRef, BOTTOM_HEIGHT_VAR);

  // A step chosen elsewhere (the shell, the header) starts at its first screen: adjust during render.
  if (remembered.step !== guidedStep) setRemembered({ step: guidedStep, part: 0 });
  const position = clampPosition(guidedStep, remembered.step === guidedStep ? remembered.part : 0);
  const screen = screenAt(position.step, position.part);
  const next = nextPosition(position.step, position.part);
  const previous = previousPosition(position.step, position.part);
  if (keepsMounted(screen) && !visited.includes(screen)) setVisited([...visited, screen]);

  useEffect(() => {
    if (moves === 0) return;
    scrollToTop(rootRef.current);
    headingRef.current?.focus({ preventScroll: true });
  }, [moves]);

  // After "Switch to expert" found an open form (and its screen rendered), move the focus into it.
  useEffect(() => {
    const form = formToFocus.current;
    if (!form) return;
    formToFocus.current = null;
    focusIntoForm(form, rootRef.current);
  });

  // The note goes when the last open form closes (saved, cancelled or gone).
  useEffect(() => {
    const root = rootRef.current;
    if (!leaveNote || !root || typeof MutationObserver === "undefined") return undefined;
    const observer = new MutationObserver(() => {
      if (!openFormIn(root)) setLeaveNote(false);
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [leaveNote]);

  /** @param {GuidedPosition} target */
  const goTo = (target) => {
    const clamped = clampPosition(target.step, target.part);
    setRemembered(clamped);
    setGuidedStep(clamped.step);
    setLeaveNote(false);
    setMoves((count) => count + 1);
  };

  /**
   * @param {{ moveFocus?: boolean, buttonKey?: string }} [options]  `moveFocus: false` keeps the focus
   *   (the caller's control stays); `buttonKey` is the catalog key of the pressed button's name, for the note.
   */
  const switchToExpert = ({ moveFocus = true, buttonKey = "ui-guided.switchToExpert" } = {}) => {
    const form = leaveNote ? null : openFormIn(rootRef.current);
    if (form) {
      const target = positionOfScreen(form.closest("[data-guided-slot]")?.getAttribute("data-guided-slot"));
      if (target && screenAt(target.step, target.part) !== screen) {
        setRemembered(target);
        setGuidedStep(target.step);
      }
      formToFocus.current = form;
      setLeaveNote(buttonKey);
      return;
    }
    const main = rootRef.current?.closest("main");
    if (moveFocus && main instanceof HTMLElement && main.hasAttribute("tabindex")) main.focus({ preventScroll: true });
    setMode("expert");
  };

  // The shell's mode switch: the same check, the focus stays on the switch.
  useImperativeHandle(ref, () => ({ leave: ({ buttonKey } = {}) => switchToExpert({ moveFocus: false, buttonKey }) }));

  /** The title of the screen at a position, for the Back and Next names. */
  const titleAt = (target) => t(`ui-guided.${screenAt(target.step, target.part)}.title`);
  /** "Step 2 of 4 · Body & weather", over the heading of each screen of a step. */
  const captionOf = (step) =>
    t("ui-guided.screen.caption", {
      step: t("ui-guided.progress.step", { number: step + 1, total: GUIDED_STEPS.length }),
      name: t(`ui-guided.step.${GUIDED_STEPS[step].id}`),
    });
  const expertHintId = `guided-${uid}-expert-hint`;
  const mounted = GUIDED_SCREENS.filter((id) => id === screen || (keepsMounted(id) && visited.includes(id)));

  return (
    <div ref={rootRef} data-testid="guided-flow" data-screen={screen} className={cx("mx-auto w-full min-w-0 max-w-3xl space-y-4", className)}>
      {/* Narrow: the step list gets the whole row, "Switch to expert" goes under it (the steps keep 44 px). */}
      <div className="@container">
        <div className="flex flex-col items-end gap-3 @md:flex-row" data-testid="guided-top">
          <GuidedProgress
            step={position.step}
            part={position.part}
            onSelect={(step) => goTo({ step, part: 0 })}
            className="w-full @md:w-auto @md:flex-1"
          />
          <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => switchToExpert()} aria-describedby={expertHintId} className="shrink-0">
            {t("ui-guided.switchToExpert")}
          </Button>
          <span id={expertHintId} className="sr-only">
            {t("ui-guided.switchToExpertHint")}
          </span>
        </div>
      </div>

      {mounted.map((id) => {
        const Screen = SCREENS[id];
        const shown = id === screen;
        return (
          <div key={id} data-guided-slot={id} hidden={!shown} className="space-y-4">
            <Screen
              idPrefix={`guided-${uid}-${id}`}
              headingId={`guided-${uid}-${id}-heading`}
              headingRef={shown ? headingRef : undefined}
              caption={captionOf(positionOfScreen(id)?.step ?? 0)}
            />
          </div>
        );
      })}

      <GuidedDock ref={dockRef} stats={screen !== "board"} offsetClassName={dockOffsetClassName}>
        <div role="alert" className="empty:hidden" data-testid="guided-leave-note">
          {leaveNote ? (
            <p className="flex items-start gap-1.5 text-body-sm text-ink">
              <Icon icon={TriangleAlert} size={16} className="mt-0.5 shrink-0 text-warn" />
              <span>{t("ui-guided.leave.unsaved", { button: t(leaveNote) })}</span>
            </p>
          ) : null}
        </div>
        <div role="group" aria-label={t("ui-guided.nav.label")} className="flex items-center gap-2" data-testid="guided-nav">
          {previous ? (
            <Button icon={ArrowLeft} onClick={() => goTo(previous)} data-testid="guided-back">
              {t("ui-guided.nav.back")}{" "}
              <span className="sr-only">{t("ui-guided.nav.target", { name: titleAt(previous) })}</span>
            </Button>
          ) : null}
          {next ? (
            <Button variant="primary" onClick={() => goTo(next)} className="ml-auto" data-testid="guided-next">
              {t("ui-guided.nav.next")}{" "}
              <span className="sr-only">{t("ui-guided.nav.target", { name: titleAt(next) })}</span>
              <Icon icon={ArrowRight} size={20} />
            </Button>
          ) : null}
        </div>
      </GuidedDock>
    </div>
  );
}
