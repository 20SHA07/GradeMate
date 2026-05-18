"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

const modes = [
  {
    href: "/simple",
    label: "Quick",
    description: "Fast calculator",
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
        "grid grid-cols-2 rounded-2xl border border-ink-200 bg-ink-100 p-1",
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
              "flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-white text-teal-700 shadow-sm shadow-ink-950/5"
                : "text-ink-500 hover:bg-white/60 hover:text-ink-900"
            )}
            href={mode.href}
            key={mode.href}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate">{mode.label}</span>
              {!compact ? (
                <span className="block truncate text-[11px] font-normal text-ink-400">
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
