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
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Segmented from "../ui/Segmented";
import { LOCALES } from "../../i18n/locales";
import { useT } from "../../i18n/useT";
import { UNIT_SYSTEMS } from "../../domain/units";
import { CURRENCIES } from "../../domain/cost";
import { useUi, SETTINGS_MODAL } from "../../state/UiProvider";

/** Theme choices of `next-themes` (the layout's provider has `enableSystem`). */
export const THEMES = Object.freeze(["system", "light", "dark"]);

/** Icon per theme choice. */
const THEME_ICONS = Object.freeze({ system: Monitor, light: Sun, dark: Moon });

/**
 * One setting: a visible caption that names a segmented control (a radio
 * group), and hints under it that describe it.
 * @param {{ label: string, hints?: string[], children: (ids: { labelId: string, hintId?: string }) => import('react').ReactNode }} props
 */
function Setting({ label, hints = [], children }) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = hints.length > 0 ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="caption text-ink-2">
        {label}
      </p>
      {children({ labelId, hintId })}
      {hints.length > 0 ? (
        <div id={hintId} className="space-y-0.5 text-body-sm text-muted">
          {hints.map((hint) => (
            <p key={hint}>{hint}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The settings, rendered only while the dialog is open (after hydration, so
 * the theme is known).
 */
function SettingsBody() {
  const t = useT();
  const { locale, setLocale, unitSystem, setUnitSystem, currency, setCurrency } = useUi();
  const { theme, setTheme } = useTheme();
  const currentTheme = THEMES.includes(theme) ? theme : "system";

  return (
    <div className="space-y-5">
      <Setting label={t("ui-dialogs.settings.theme")} hints={[t("ui-dialogs.settings.theme.hint")]}>
        {({ labelId, hintId }) => (
          <Segmented
            labelledBy={labelId}
            aria-describedby={hintId}
            value={currentTheme}
            onChange={(value) => setTheme(value)}
            fullWidth
            data-testid="settings-theme"
            options={THEMES.map((value) => ({
              value,
              label: t(`ui-dialogs.settings.theme.${value}`),
              icon: THEME_ICONS[value],
            }))}
          />
        )}
      </Setting>

      <Setting label={t("ui-dialogs.settings.language")}>
        {({ labelId }) => (
          <Segmented
            labelledBy={labelId}
            value={locale}
            onChange={setLocale}
            fullWidth
            data-testid="settings-language"
            options={LOCALES.map((value) => ({
              value,
              // Each language named in itself, marked with its language for screen readers.
              label: <span lang={value}>{t(`ui-dialogs.settings.language.${value}`)}</span>,
            }))}
          />
        )}
      </Setting>

      <Setting
        label={t("ui-dialogs.settings.units")}
        hints={[t(`ui-dialogs.settings.units.hint.${unitSystem}`), t("ui-dialogs.settings.units.nutrients")]}
      >
        {({ labelId, hintId }) => (
          <Segmented
            labelledBy={labelId}
            aria-describedby={hintId}
            value={unitSystem}
            onChange={setUnitSystem}
            fullWidth
            data-testid="settings-units"
            options={UNIT_SYSTEMS.map((value) => ({ value, label: t(`ui-dialogs.settings.units.${value}`) }))}
          />
        )}
      </Setting>

      <Setting label={t("ui-dialogs.settings.currency")} hints={[t("ui-dialogs.settings.currency.hint")]}>
        {({ labelId, hintId }) => (
          <Segmented
            labelledBy={labelId}
            aria-describedby={hintId}
            value={currency}
            onChange={setCurrency}
            fullWidth
            data-testid="settings-currency"
            options={CURRENCIES.map((value) => ({
              value,
              // The visible code, then the full name for screen readers: the accessible name
              // ("€ EUR (Euro)") starts with the visible label, so speech input finds "EUR" (WCAG 2.5.3).
              label: (
                <>
                  {t(`ui-dialogs.settings.currency.${value}`)}{" "}
                  <span className="sr-only">
                    {t("ui-dialogs.settings.currency.spoken", { name: t(`ui-dialogs.settings.currency.name.${value}`) })}
                  </span>
                </>
              ),
            }))}
          />
        )}
      </Setting>
    </div>
  );
}

/**
 * Settings on the `Dialog` primitive: theme (system / light / dark, through
 * `next-themes`, which remembers it), language (English / Deutsch), units
 * (metric / imperial) and currency (EUR / USD / GBP) of the UI prefs
 * (`useUi()`, saved in `gel-calculator:prefs`). Each is a segmented radio
 * group named by its visible caption; changes apply at once (the plan
 * inputs stay metric). Open with `useUi().openModal(SETTINGS_MODAL)` (the
 * header's settings button); "Done", Escape, the close button and a click
 * on the backdrop close it, and focus returns to the opener.
 */
export default function SettingsDialog() {
  const t = useT();
  const { isModalOpen, closeModal } = useUi();
  return (
    <Dialog
      open={isModalOpen(SETTINGS_MODAL)}
      onClose={closeModal}
      title={t("ui-dialogs.settings.title")}
      description={t("ui-dialogs.settings.description")}
      size="sm"
      data-testid="settings-dialog"
      footer={
        <Button variant="primary" onClick={closeModal}>
          {t("ui-dialogs.settings.done")}
        </Button>
      }
    >
      <SettingsBody />
    </Dialog>
  );
}
