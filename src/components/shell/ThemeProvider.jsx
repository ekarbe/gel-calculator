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

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The colour theme (light, dark or the system's), from `next-themes`: it
 * puts the `dark` class on `<html>` (the tokens in `globals.css` follow
 * it), remembers the choice in localStorage and sets it before the first
 * paint. The root layout renders it with `attribute="class"`,
 * `defaultTheme="system"` and `enableSystem`; the Settings dialog changes
 * it with `useTheme()`. Props go to the `next-themes` provider.
 *
 * @param {{ children?: import('react').ReactNode } & Record<string, unknown>} props
 */
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
