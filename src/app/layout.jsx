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

import "./globals.css";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "../components/shell/ThemeProvider";
import { t } from "../i18n";

// Self-hosted at build time. Each sets a CSS variable on <html> that the
// font tokens in globals.css (font-display, font-sans, font-mono) read.
// The latin subset covers German (ä, ö, ü, ß), €, £ and the minus sign.

/** Display face: numbers, KPI values, card titles. */
const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

/** Body face: text, labels, inputs. */
const sansFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

/** Data face: tables, schedule times. */
const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata = {
  metadataBase: new URL('https://eikekarbe.com'),
  title: t('ui-shell.wordmark'),
  description: t('ui-shell.meta.description'),
  icons: [
    {
      rel: 'icon',
      url: '/gel-calculator/favicon.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: light)'
    },
    {
      rel: 'icon',
      url: '/gel-calculator/favicon.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: dark)'
    }
  ],
};

/**
 * `viewport-fit=cover` lets the page draw under a notch or home indicator;
 * the shell pads its header, tab bar and sides with the safe-area insets.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * The root layout: fonts, the theme provider (the `dark` class on
 * `<html>`, before the first paint) and the structured data. `lang`
 * starts as English; the shell changes it to the chosen language.
 */
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": t('ui-shell.wordmark'),
              "description": t('ui-shell.meta.description'),
              "url": "https://eikekarbe.com/gel-calculator",
              "image": "https://eikekarbe.com/gel-calculator/og.png",
              "applicationCategory": "HealthApplication",
              "operatingSystem": "Any",
            }),
          }}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
