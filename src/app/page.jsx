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

import App from "./app";
import { PlanProvider } from "../state/PlanProvider";
import { UiProvider } from "../state/UiProvider";
import { t } from "../i18n";

export const SITE_URL = 'https://eikekarbe.com';
export const PAGE_URL = `${SITE_URL}/gel-calculator`;
/** The social preview card (1200 × 630, `public/og.png`), as an absolute URL. */
export const OG_IMAGE_URL = `${PAGE_URL}/og.png`;

const title = t('ui-shell.meta.title');
const description = t('ui-shell.meta.description');
const image = { url: OG_IMAGE_URL, width: 1200, height: 630, alt: t('ui-shell.meta.imageAlt'), type: 'image/png' };

export const metadata = {
  title,
  description,
  keywords: ['energy gel calculator', 'diy sports drink', 'sports nutrition', 'endurance fuel', 'electrolytes', 'carbohydrates', 'homemade gel', 'cycling', 'running', 'triathlon'],
  alternates: {
    canonical: PAGE_URL,
  },

  openGraph: {
    title,
    description,
    url: PAGE_URL,
    siteName: t('ui-shell.wordmark'),
    images: [image],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [image],
  },
};

/**
 * The calculator page. `PlanProvider` holds the inputs and the computed plan
 * (and restores a `?s=` share link or the autosave on mount); `UiProvider`
 * holds the dialogs, the toast, the UI prefs (language, units, currency,
 * mode) and the layout state. `App` renders the whole page frame, including
 * its one `<main>`. The metadata is English (the static page has no
 * language preference yet; the shell sets `<html lang>` after mount).
 */
export default function Page() {
  return (
    <PlanProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </PlanProvider>
  );
}
