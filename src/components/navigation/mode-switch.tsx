"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

const modes = [
  {
    href: "/simple",
    label: "Quick",
    description: "Calculator",
    icon: Calculator,
    isActive: (pathname: string) => pathname === "/simple"
  },
  {
    href: "/workspace",
    label: "Workspace",
    description: "Full tracker",
    icon: Layers3,
    isActive: (pathname: string) =>
      pathname === "/workspace" ||
      pathname === "/dashboard" ||
      pathname.startsWith("/semesters") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/course-library") ||
      pathname.startsWith("/gpa-calculator")
  }
];

export function ModeSwitch({
  className,
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div
      aria-label="Switch GradeMate mode"
      className={cn(
        "grid grid-cols-2 rounded-2xl border border-ink-200 bg-white/70 p-1 shadow-sm shadow-ink-950/5",
        className
      )}
      role="navigation"
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = mode.isActive(pathname);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex min-w-0 items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all",
              isActive
                ? "bg-teal-600 text-white shadow-sm shadow-teal-950/20"
                : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            )}
            href={mode.href}
            key={mode.href}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "bg-white text-ink-500 group-hover:text-teal-700"
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="min-w-0 text-left leading-tight">
              <span className="block whitespace-nowrap">{mode.label}</span>
              {!compact ? (
                <span
                  className={cn(
                    "hidden whitespace-nowrap text-[11px] font-normal sm:block",
                    isActive ? "text-teal-50/80" : "text-ink-400"
                  )}
                >
                  {mode.description}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
