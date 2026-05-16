"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calculator,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  PlusCircle
} from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/semesters", label: "Semesters", icon: Library },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/gpa-calculator", label: "GPA Calculator", icon: Calculator }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ink-50 lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-ink-200 bg-white lg:flex lg:flex-col">
        <div className="flex h-20 items-center border-b border-ink-200 px-6">
          <Link className="flex items-center gap-3 font-semibold text-ink-900" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
              <GraduationCap aria-hidden="true" className="h-5 w-5" />
            </span>
            GradeMate
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-teal-50 text-teal-800"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                )}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-200 p-4">
          <div className="rounded-lg bg-ink-50 p-4">
            <p className="text-sm font-medium text-ink-900">Student workspace</p>
            <p className="mt-1 text-xs leading-5 text-ink-500">
              Personal course data, semester plans, and GPA tracking.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link className="flex items-center gap-2 font-semibold text-ink-900 lg:hidden" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              </span>
              GradeMate
            </Link>
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                className={buttonStyles({ variant: "primary", size: "sm" })}
                href="/courses"
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Add course
              </Link>
            </div>
            <Link
              className={buttonStyles({ variant: "ghost", size: "sm" })}
              href="/sign-in"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              Sign out
            </Link>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-ink-200 px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium",
                    isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-ink-600 hover:bg-ink-100"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
