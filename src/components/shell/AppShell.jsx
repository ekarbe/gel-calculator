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

import { useEffect, useLayoutEffect, useRef } from "react";
import { MODES, useUi } from "../../state/UiProvider";
import { usePlanInputs } from "../../state/PlanProvider";
import { useT } from "../../i18n/useT";
import SkipLink from "../ui/SkipLink";
import Toast from "../ui/Toast";
import { cx } from "../ui/cx";
import ShellHeader from "./ShellHeader";
import ShellTabBar from "./ShellTabBar";
import ShellFooter from "./ShellFooter";
// Setup sections (left column on desktop, Setup tab on phones), in order.
import EventSection from "../setup/EventSection";
import BodyWeatherSection from "../setup/BodyWeatherSection";
import SweatSection from "../setup/SweatSection";
import TargetsSection from "../setup/TargetsSection";
import IngredientsSection from "../setup/IngredientsSection";
import SaltsSection from "../setup/SaltsSection";
import FormatSection from "../setup/FormatSection";
import SupplementsSection from "../setup/SupplementsSection";
// The race board, the full schedule, the guided flow and the print view.
import RaceBoard from "../board/RaceBoard";
import Schedule from "../schedule/Schedule";
import GuidedFlow from "../guided/GuidedFlow";
import { focusIntoForm } from "../guided/guidedFocus";
import PrintRecipe from "../print/PrintRecipe";
// Dialogs: each one opens itself from `useUi().isModalOpen(<name>)`.
import MixingDialog from "../dialogs/MixingDialog";
import ShareDialog from "../dialogs/ShareDialog";
import TemplatesDialog from "../dialogs/TemplatesDialog";
import RecipesDialog from "../dialogs/RecipesDialog";
import SettingsDialog from "../dialogs/SettingsDialog";

/** How long the "share link could not be opened" notice stays, in ms. */
export const SHARE_LINK_NOTICE_MS = 8000;

/** How long the "this form is not saved yet" notice of the mode switch stays, in ms. */
export const UNSAVED_NOTICE_MS = 8000;

/** The setup sections in their order on screen (design doc: Event … Caffeine & bicarbonate). */
export const SETUP_SECTIONS = Object.freeze([
  EventSection,
  BodyWeatherSection,
  SweatSection,
  TargetsSection,
  IngredientsSection,
  SaltsSection,
  FormatSection,
  SupplementsSection,
]);

/** The dialogs the shell hosts. */
export const DIALOGS = Object.freeze([MixingDialog, ShareDialog, TemplatesDialog, RecipesDialog, SettingsDialog]);

/**
 * Scrolls the window to `top` (instantly), unless it is there already.
 * @param {number} top
 */
function scrollWindowTo(top) {
  if (typeof window === "undefined" || Math.round(Number(window.scrollY) || 0) === Math.round(top)) return;
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

/**
 * The app frame (spec 3.2): skip link, sticky header (wordmark, Guided /
 * Expert switch, My recipes, Share, Settings), `<main>`, the footer, the
 * phone tab bar (expert mode), the toast, the dialogs host and the print
 * host. It sets `<html lang>` and the document title from the UI locale and
 * shows a warning toast, once, when a `?s=` link could not be opened.
 *
 * **Waiting for the prefs.** Until `useUi().prefsReady` (stored prefs or
 * browser defaults applied after mount) `<main>` stays empty and busy, so a
 * first-time visitor never sees the expert layout flash before the guided
 * flow (the static HTML has no prefs).
 *
 * **Guided mode** shows the guided flow ({@link GuidedFlow}) in `<main>`,
 * with no tab bar (the flow's step list and dock are its navigation; the
 * dock sticks to the bottom of the screen).
 *
 * **Expert mode.** From 1024 px two columns: the setup sections on the
 * left (about 420 px, scrolling with the page) and on the right the race
 * board, a named region that stays in view (sticky under the header,
 * scrolling on its own when taller than the screen) while the setup is
 * edited; the full schedule follows below both columns. Below 1024 px one
 * of the three views at a time, picked in the tab bar (Board by default);
 * each view keeps its own scroll position. The board is a region inside
 * `<main>`, not a complementary landmark: it is the main content on phones
 * (the default tab), and a complementary landmark nested in `<main>` is an
 * axe best-practice failure.
 *
 * **Mode switch.** Leaving a mode unmounts its layout, and with it any open
 * form (a sweat test, a custom ingredient). So the header's switch checks
 * first: from guided mode it goes through the flow's own check (the flow's
 * `leave()`, see `GuidedFlow`); from expert mode, when the setup column
 * holds an open form, the first press stays, shows the Setup tab, moves the
 * focus into that form and says so in a toast ("…select Guided again to
 * leave without it"); pressing again leaves. A mode change scrolls to the
 * top of the page.
 *
 * Must be rendered inside `PlanProvider` and `UiProvider`. Everything except
 * the print host is `print:hidden`; the print host is `hidden print:block`.
 * Horizontal safe-area insets pad the frame (landscape phones with a notch;
 * the layout's viewport uses `viewport-fit=cover`).
 */
export default function AppShell() {
  const t = useT();
  const { locale, mode, setMode, boardTab, setBoardTab, toastMessage, toastTone, showToast, prefsReady } = useUi();
  const { shareLinkFailed } = usePlanInputs();
  const tRef = useRef(t);
  const shareNoticeShown = useRef(false);
  const guidedRef = useRef(/** @type {{ leave: (options?: { buttonKey?: string }) => void }|null} */ (null));
  const setupRef = useRef(/** @type {HTMLElement|null} */ (null));
  // The open form the last expert → guided press warned about (the next press leaves without it).
  const warnedForm = useRef(/** @type {HTMLFormElement|null} */ (null));
  const formToFocus = useRef(/** @type {HTMLFormElement|null} */ (null));
  // Scroll position of each phone tab, and the tab whose position to restore after the switch.
  const tabScroll = useRef(/** @type {Record<string, number>} */ ({}));
  const restoreTab = useRef(/** @type {string|null} */ (null));
  // The mode the page last showed (null until the prefs are resolved).
  const lastMode = useRef(/** @type {string|null} */ (null));

  useEffect(() => {
    tRef.current = t;
  });

  // The page language and its title follow the UI language (the static page is English).
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = tRef.current("ui-shell.meta.title");
  }, [locale]);

  // Once per page load, in the resolved language: `shareLinkFailed` stays true for the session,
  // and a new `t` (another language, unit system or currency) must not show the notice again.
  useEffect(() => {
    if (!shareLinkFailed || !prefsReady || shareNoticeShown.current) return;
    shareNoticeShown.current = true;
    showToast(tRef.current("ui-shell.shareLinkFailed"), { tone: "warn", durationMs: SHARE_LINK_NOTICE_MS });
  }, [shareLinkFailed, prefsReady, showToast]);

  // After a tab bar switch, before paint: the new view at its own scroll position.
  useLayoutEffect(() => {
    if (restoreTab.current !== boardTab) return;
    restoreTab.current = null;
    scrollWindowTo(tabScroll.current[boardTab] ?? 0);
  }, [boardTab]);

  // A new layout starts at the top of the page (not the first one: the browser may restore a position).
  useLayoutEffect(() => {
    if (!prefsReady || lastMode.current === mode) return;
    const first = lastMode.current === null;
    lastMode.current = mode;
    if (first) return;
    warnedForm.current = null;
    tabScroll.current = {};
    scrollWindowTo(0);
  }, [mode, prefsReady]);

  // After the mode switch found an open form (and the Setup tab rendered), move the focus into it.
  useEffect(() => {
    const form = formToFocus.current;
    if (!form) return;
    formToFocus.current = null;
    if (form.isConnected) focusIntoForm(form, setupRef.current);
  });

  const selectTab = (tab) => {
    if (tab === boardTab) return;
    tabScroll.current[boardTab] = window.scrollY;
    restoreTab.current = tab;
    setBoardTab(tab);
  };

  /** @param {'guided'|'expert'} next */
  const changeMode = (next) => {
    if (next === mode || !MODES.includes(next)) return;
    if (next === "expert" && guidedRef.current) {
      guidedRef.current.leave({ buttonKey: "ui-shell.mode.expert" });
      return;
    }
    const form = next === "guided" ? setupRef.current?.querySelector("form") ?? null : null;
    if (form && warnedForm.current !== form) {
      warnedForm.current = form;
      formToFocus.current = form;
      setBoardTab("setup");
      showToast(t("ui-shell.leave.unsaved", { button: t("ui-shell.mode.guided") }), {
        tone: "warn",
        durationMs: UNSAVED_NOTICE_MS,
      });
      return;
    }
    setMode(next);
  };

  const showGuided = prefsReady && mode === "guided";
  const showExpert = prefsReady && mode === "expert";
  const view = (tab) => (boardTab === tab ? "block" : "hidden lg:block");

  return (
    <>
      <div
        data-testid="app-shell"
        className={cx(
          "flex min-h-dvh flex-col bg-bg px-safe text-ink print:hidden",
          // Room for the fixed phone tab bar (56 px, its border and the safe area); none where it is static.
          showExpert && "pb-[calc(3.5rem+1px+env(safe-area-inset-bottom))] lg:pb-0 [@media(max-height:32rem)]:pb-0",
        )}
      >
        <SkipLink targetId="main" />
        <ShellHeader mode={mode} onModeChange={changeMode} />

        <main
          id="main"
          tabIndex={-1}
          aria-busy={prefsReady ? undefined : true}
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-6 pt-4 focus:outline-none lg:px-6 lg:pb-10"
        >
          {showGuided ? <GuidedFlow ref={guidedRef} /> : null}
          {showExpert ? (
            <>
              {/* The two columns are a grid of their own, and the schedule follows it: the sticky board
                  then sticks only while the columns are on screen and never covers the schedule. */}
              <div data-testid="shell-columns" className="lg:grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
                <section
                  ref={setupRef}
                  aria-label={t("ui-setup.heading")}
                  data-testid="shell-setup"
                  className={cx(view("setup"), "min-w-0 space-y-4")}
                >
                  {SETUP_SECTIONS.map((Section, index) => (
                    // A fixed list: the index is a stable key (names are minified in production).
                    <Section key={index} />
                  ))}
                </section>
                {/* Sticky 1 rem under the header while the setup column scrolls past. */}
                <section
                  aria-label={t("ui-shell.board.label")}
                  data-testid="shell-board"
                  className={cx(view("board"), "min-w-0 lg:sticky-below-header lg:self-start lg:overflow-y-auto")}
                >
                  <RaceBoard />
                </section>
              </div>
              <div data-testid="shell-schedule" className={cx(view("schedule"), "min-w-0 lg:mt-6")}>
                <Schedule />
              </div>
            </>
          ) : null}
        </main>

        <ShellFooter className="border-t border-line" />
        {showExpert ? <ShellTabBar tab={boardTab} onSelect={selectTab} /> : null}

        <Toast message={toastMessage} tone={toastTone} />
        {DIALOGS.map((DialogComponent, index) => (
          <DialogComponent key={index} />
        ))}
      </div>
      <div data-testid="print-host" className="hidden print:block">
        <PrintRecipe />
      </div>
    </>
  );
}
