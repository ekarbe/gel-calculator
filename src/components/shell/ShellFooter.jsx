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

import { useT } from "../../i18n/useT";
import { cx } from "../ui/cx";
import GithubIcon from "../ui/icons/GithubIcon";
import StravaIcon from "../ui/icons/StravaIcon";

/** The author's profiles, in order. */
export const FOOTER_LINKS = Object.freeze([
  { href: "https://www.strava.com/athletes/58442765", labelKey: "ui-shell.footer.strava", icon: StravaIcon },
  { href: "https://github.com/ekarbe", labelKey: "ui-shell.footer.github", icon: GithubIcon },
]);

/**
 * The page footer (the `contentinfo` landmark): the author and links to
 * the author's Strava and GitHub profiles. Each link is a 44 px icon button
 * that opens in a new tab and says so to screen readers ("Strava (opens in
 * a new tab)").
 *
 * @param {{ className?: string }} props
 */
export default function ShellFooter({ className }) {
  const t = useT();
  const newTab = t("ui-common.opensInNewTab");
  return (
    <footer
      data-testid="shell-footer"
      className={cx(
        "mx-auto flex w-full max-w-[1440px] flex-col items-center gap-2 px-4 py-6 text-ink-2 sm:flex-row sm:justify-between lg:px-6",
        className,
      )}
    >
      <p className="text-body-sm">{t("ui-shell.footer.author")}</p>
      <ul role="list" aria-label={t("ui-shell.footer.links")} className="flex items-center gap-1">
        {FOOTER_LINKS.map(({ href, labelKey, icon: LinkIcon }) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              <LinkIcon size={20} />
              <span className="sr-only">
                {t(labelKey)} {newTab}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
