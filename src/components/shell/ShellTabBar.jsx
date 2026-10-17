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

import { useRef } from "react";
import { LayoutDashboard, ListOrdered, SlidersHorizontal } from "lucide-react";
import { useT } from "../../i18n/useT";
import Icon from "../ui/Icon";
import { cx } from "../ui/cx";
import { BOTTOM_HEIGHT_VAR, usePinnedHeight } from "../ui/usePinnedHeight";

/** The phone tabs of the expert layout, in order (`useUi().boardTab`). */
export const SHELL_TABS = Object.freeze([
  { id: "board", labelKey: "ui-shell.tabs.board", icon: LayoutDashboard },
  { id: "setup", labelKey: "ui-shell.tabs.setup", icon: SlidersHorizontal },
  { id: "schedule", labelKey: "ui-shell.tabs.schedule", icon: ListOrdered },
]);

/**
 * The phone tab bar of the expert layout: Board, Setup and Schedule, fixed
 * to the bottom of the screen above the safe area (hidden from 1024 px,
 * where all three are on screen). A navigation landmark ("Sections") of
 * toggle buttons: the current one is `aria-pressed` and marked by a bar
 * on its top edge and bold text (never colour alone). Each tab is at least
 * 56 px tall.
 *
 * While it is fixed, its height is the page's bottom scroll padding
 * (`usePinnedHeight`), so the browser scrolls a control that takes the
 * focus above it instead of leaving it behind the bar (WCAG 2.4.11). On
 * short viewports (`SHORT_VIEWPORT_QUERY` in `ShellHeader`) it is not fixed
 * and sits at the end of the page.
 *
 * @param {{ tab: 'board'|'setup'|'schedule', onSelect: (tab: 'board'|'setup'|'schedule') => void }} props
 */
export default function ShellTabBar({ tab, onSelect }) {
  const t = useT();
  const navRef = useRef(/** @type {HTMLElement|null} */ (null));
  usePinnedHeight(navRef, BOTTOM_HEIGHT_VAR);
  return (
    <nav
      ref={navRef}
      aria-label={t("ui-shell.tabs.label")}
      data-testid="shell-tabbar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-safe pb-safe lg:hidden [@media(max-height:32rem)]:static"
    >
      <ul role="list" className="mx-auto flex max-w-md">
        {SHELL_TABS.map((item) => {
          const active = tab === item.id;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item.id)}
                data-testid={`shell-tab-${item.id}`}
                className={cx(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 border-t-2 transition-colors duration-150",
                  active ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                <Icon icon={item.icon} size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="caption">{t(item.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
