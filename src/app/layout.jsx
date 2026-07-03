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
import { Inter } from "next/font/google";
import { ThemeProvider } from "../components/shared/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: 'Gel Calculator',
  description: 'Calculate your energy gel mixture',
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Gel Calculator",
              "description": "Calculate the perfect energy gel mixture for your endurance activities.",
              "url": "https://eikekarbe.com/gel-calculator",
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
