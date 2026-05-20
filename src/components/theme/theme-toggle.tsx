"use client";

import { Moon, Sun } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      aria-label={label}
      className={buttonStyles({
        className: cn("shrink-0", className),
        size: showLabel ? "sm" : "icon",
        variant: "ghost"
      })}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {showLabel ? <span>{isDark ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
