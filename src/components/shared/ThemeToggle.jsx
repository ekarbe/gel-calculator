"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Icons switch via the `dark` class next-themes sets on <html>, so the button
  // renders identically on the server and needs no mounted-state guard.
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-card-border/50 transition-colors"
      aria-label="Toggle theme"
    >
      <Sun size={20} className="text-apple-amber dark:hidden" />
      <Moon size={20} className="hidden text-apple-purple dark:block" />
    </button>
  );
}
