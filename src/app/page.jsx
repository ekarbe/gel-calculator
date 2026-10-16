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

const siteUrl = 'https://eikekarbe.com';
const pageUrl = `${siteUrl}/gel-calculator`;
const title = 'DIY Energy Gel & Sports Drink Calculator | Optimize Your Fuel';
const description = 'Calculate precise carb ratios (glucose:fructose) and electrolyte needs for your endurance activity. Create custom DIY energy gel or sports drink recipes.';
const imageUrl = `${siteUrl}/favicon.svg`;

export const metadata = {
  title: title,
  description: description,
  keywords: ['energy gel calculator', 'diy sports drink', 'sports nutrition', 'endurance fuel', 'electrolytes', 'carbohydrates', 'homemade gel', 'cycling', 'running', 'triathlon'],
  alternates: {
    canonical: pageUrl,
  },

  openGraph: {
    title: title,
    description: description,
    url: pageUrl,
    siteName: 'Gel Calculator',
    images: [
      {
        url: imageUrl,
        width: 24,
        height: 24,
        alt: 'Gel Calculator Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary',
    title: title,
    description: description,
    images: [imageUrl],
  },
};

/**
 * The calculator page. `PlanProvider` holds the inputs and the computed plan
 * (and restores a `?s=` share link on mount); `UiProvider` holds modals, the
 * toast and display units. `App` renders its own `<main>`, so the wrapper here
 * is a plain `<div>` (a page has one `main` landmark).
 */
export default function Page() {
  return (
    <PlanProvider>
      <UiProvider>
        <div className="min-h-screen">
          <App />
        </div>
      </UiProvider>
    </PlanProvider>
  );
}
