"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-card-border/50 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Moon size={20} className="text-apple-purple" />
      ) : (
        <Sun size={20} className="text-apple-amber" />
      )}
    </button>
  );
}
