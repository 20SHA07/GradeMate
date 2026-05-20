"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

const modes = [
  {
    href: "/simple",
    label: "Quick",
    icon: Calculator,
    isActive: (pathname: string) => pathname === "/simple"
  },
  {
    href: "/workspace",
    label: "Workspace",
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
  className
}: {
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div
      aria-label="Switch GradeMate mode"
      className={cn(
        "grid w-full max-w-full grid-cols-2 gap-1 overflow-hidden rounded-md border border-ink-200 bg-ink-100 p-1",
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
              "group flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[3px] px-1.5 py-2 text-center text-[12.5px] font-semibold leading-none transition-colors",
              isActive
                ? "bg-teal-600 text-[color:var(--accent-on)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                : "text-ink-500 hover:bg-ink-200/70 hover:text-ink-900"
            )}
            href={mode.href}
            key={mode.href}
            title={mode.label}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded text-current transition-colors",
                isActive
                  ? "text-[color:var(--accent-on)]"
                  : "text-ink-500 group-hover:text-teal-700"
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="block min-w-0 max-w-full truncate whitespace-nowrap">
              {mode.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
