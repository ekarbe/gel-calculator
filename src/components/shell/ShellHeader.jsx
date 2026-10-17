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
import { BookMarked, Settings, Share2 } from "lucide-react";
import { RECIPES_MODAL, SETTINGS_MODAL, SHARE_MODAL, useUi } from "../../state/UiProvider";
import { useT } from "../../i18n/useT";
import Button from "../ui/Button";
import Segmented from "../ui/Segmented";
import FuelBeakerIcon from "../ui/icons/FuelBeakerIcon";
import { HEADER_HEIGHT_VAR, usePinnedHeight } from "../ui/usePinnedHeight";

/**
 * The viewports on which the header and the phone tab bar do not stick
 * (the same query as the guided dock's): a landscape phone, or 400 % zoom
 * at 320 × 256 CSS px, where two pinned bars would cover most of the screen
 * (WCAG 1.4.10, 2.4.11). The class lists use it as
 * `[@media(max-height:32rem)]:static`; a test keeps them in step.
 */
export const SHORT_VIEWPORT_QUERY = "(max-height: 32rem)";

/**
 * Below 640 px the labelled header buttons show their icon only, as square
 * 36 px buttons (44 px on touch screens); the text stays their name.
 */
const COMPACT_BUTTON = "max-sm:size-9 max-sm:px-0 max-sm:pointer-coarse:size-11";

/**
 * The app header, sticky at the top of the screen below the safe area: the
 * logo and the "GEL CALCULATOR" wordmark (the page's one `h1`; below
 * 640 px only the logo shows, the name stays for screen readers), the
 * Guided / Expert switch, and the buttons that open My recipes, Share and
 * Settings (theme, language, units, currency). Each of those buttons says it
 * opens a dialog (`aria-haspopup`); below 640 px My recipes and Share show
 * their icon only. On very narrow screens (320 px) the buttons wrap to a
 * second row instead of overflowing.
 *
 * While it sticks, its height is the page's top scroll padding
 * (`usePinnedHeight`), so a control that takes the focus (Shift+Tab, the
 * skip link) is never left under it. On short viewports
 * ({@link SHORT_VIEWPORT_QUERY}: a landscape phone, 400 % zoom at
 * 320 × 256 CSS px) it does not stick, so it never takes a large part of
 * the screen.
 *
 * The switch is controlled: `mode` is the current mode and
 * `onModeChange(mode)` asks for another one (the shell checks for an open
 * form first).
 *
 * @param {{ mode: 'guided'|'expert', onModeChange: (mode: 'guided'|'expert') => void }} props
 */
export default function ShellHeader({ mode, onModeChange }) {
  const t = useT();
  const { openModal } = useUi();
  const headerRef = useRef(/** @type {HTMLElement|null} */ (null));
  usePinnedHeight(headerRef, HEADER_HEIGHT_VAR);
  return (
    <header
      ref={headerRef}
      data-testid="shell-header"
      className="sticky top-0 z-40 border-b border-line bg-surface pt-safe [@media(max-height:32rem)]:static"
    >
      <div className="mx-auto flex min-h-14 max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 sm:gap-x-3 sm:py-2 lg:px-6">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <FuelBeakerIcon className="size-7 shrink-0 text-ink" />
          <h1 className="display-section truncate text-ink max-sm:sr-only">{t("ui-shell.wordmark")}</h1>
        </div>
        <Segmented
          size="sm"
          label={t("ui-shell.mode.label")}
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "guided", label: t("ui-shell.mode.guided") },
            { value: "expert", label: t("ui-shell.mode.expert") },
          ]}
          data-testid="shell-mode"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={BookMarked}
            aria-haspopup="dialog"
            onClick={() => openModal(RECIPES_MODAL)}
            className={COMPACT_BUTTON}
            data-testid="shell-recipes"
          >
            <span className="max-sm:sr-only">{t("ui-shell.actions.recipes")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Share2}
            aria-haspopup="dialog"
            onClick={() => openModal(SHARE_MODAL)}
            className={COMPACT_BUTTON}
            data-testid="shell-share"
          >
            <span className="max-sm:sr-only">{t("ui-shell.actions.share")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={Settings}
            aria-haspopup="dialog"
            onClick={() => openModal(SETTINGS_MODAL)}
            data-testid="shell-settings"
          >
            {t("ui-shell.actions.settings")}
          </Button>
        </div>
      </div>
    </header>
  );
}
