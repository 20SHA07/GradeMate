"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Calculator,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  PlusCircle,
  UploadCloud
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { useAuth } from "@/components/auth/protected-session-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/semesters", label: "Semesters", icon: Library },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/course-library", label: "Course Library", icon: BookMarked },
  { href: "/gpa-calculator", label: "GPA Calculator", icon: Calculator }
];

type PageAction = {
  href: string;
  label: string;
  icon: typeof PlusCircle;
  variant?: "primary" | "secondary";
};

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function getPageActions(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/dashboard") {
    return [
      { href: "/semesters#create-semester", label: "New semester", icon: PlusCircle },
      { href: "/course-library", label: "Import course", icon: BookMarked, variant: "secondary" as const }
    ] satisfies PageAction[];
  }

  if (normalizedPathname === "/course-library") {
    return [
      { href: "/courses", label: "Contribute syllabus", icon: UploadCloud }
    ] satisfies PageAction[];
  }

  if (
    normalizedPathname.startsWith("/courses/") &&
    normalizedPathname !== "/courses"
  ) {
    return [
      { href: "/semesters", label: "Back to semester", icon: ArrowLeft, variant: "secondary" as const },
      { href: "#assessment-form", label: "Add assessment", icon: PlusCircle }
    ] satisfies PageAction[];
  }

  if (normalizedPathname === "/semesters") {
    return [
      { href: "/semesters#create-semester", label: "New semester", icon: PlusCircle },
      { href: "/course-library", label: "Import course", icon: BookMarked, variant: "secondary" as const }
    ] satisfies PageAction[];
  }

  if (normalizedPathname === "/courses") {
    return [
      { href: "/semesters", label: "Add course", icon: PlusCircle },
      { href: "/course-library", label: "Import course", icon: BookMarked, variant: "secondary" as const }
    ] satisfies PageAction[];
  }

  return [] satisfies PageAction[];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname);
  const { isGuest, openSaveProgress, signOut, user } = useAuth();
  const pageActions = getPageActions(normalizedPathname);

  async function handleLogout() {
    await signOut();
  }

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900 lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-white/90 lg:flex lg:flex-col">
        <div className="px-4 py-5">
          <Link className="flex items-center gap-3 font-semibold text-ink-900" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-950/30">
              <GraduationCap aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              <span className="block leading-5">GradeMate</span>
              <span className="block text-xs font-normal text-ink-500">Grades made clear</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const isActive =
              normalizedPathname === item.href ||
              (item.href !== "/dashboard" &&
                normalizedPathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-teal-50 text-teal-700"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
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

        <div className="space-y-3 border-t border-ink-200 p-3">
          {isGuest ? (
            <div className="rounded-2xl bg-ink-100 p-3">
              <p className="text-sm font-semibold text-ink-900">
                Guest workspace
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-500">Saved on this device</p>
              <Button
                className="mt-3 w-full"
                onClick={openSaveProgress}
                size="sm"
              >
                Save progress
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl bg-ink-100 p-3">
              <p className="text-xs font-medium uppercase tracking-normal text-ink-400">
                Student workspace
              </p>
              <p className="mt-1 truncate text-sm font-medium text-ink-900">
                {user.email}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isGuest ? (
              <Link
                className={buttonStyles({
                  className: "flex-1",
                  size: "sm",
                  variant: "ghost"
                })}
                href="/login"
              >
                Log in
              </Link>
            ) : (
              <button
                className={buttonStyles({
                  className: "flex-1",
                  size: "sm",
                  variant: "ghost"
                })}
                onClick={handleLogout}
                type="button"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/80 backdrop-blur-xl">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-7">
            <Link className="flex items-center gap-2 font-semibold text-ink-900 lg:hidden" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              </span>
              GradeMate
            </Link>

            <div className="hidden min-w-0 items-center gap-2 text-sm text-ink-500 lg:flex">
              <span className="font-medium text-ink-900">
                {navItems.find((item) =>
                  normalizedPathname === item.href ||
                  (item.href !== "/dashboard" &&
                    normalizedPathname.startsWith(item.href))
                )?.label ?? "Workspace"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isGuest ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <Link
                    className={buttonStyles({ size: "sm", variant: "ghost" })}
                    href="/login"
                  >
                    Log in
                  </Link>
                  <Button onClick={openSaveProgress} size="sm">
                    Save progress
                  </Button>
                </div>
              ) : null}
              <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
                {pageActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      className={buttonStyles({
                        size: "sm",
                        variant: action.variant ?? "primary"
                      })}
                      href={action.href}
                      key={`${action.href}-${action.label}`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
              <div className="lg:hidden">
                <ThemeToggle />
              </div>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-ink-200 px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive =
                normalizedPathname === item.href ||
                (item.href !== "/dashboard" &&
                  normalizedPathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-ink-500 hover:bg-ink-100"
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

          {pageActions.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto border-t border-ink-200 px-4 py-2 sm:hidden">
              {pageActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    className={buttonStyles({
                      className: "shrink-0",
                      size: "sm",
                      variant: action.variant ?? "primary"
                    })}
                    href={action.href}
                    key={`${action.href}-${action.label}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {action.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </header>

        {isGuest ? (
          <div className="border-b border-ink-200 bg-ink-100/80 px-4 py-2 text-sm text-ink-600 sm:px-6 lg:px-7">
            You&apos;re using Guest Mode. Sign up to save across devices.
          </div>
        ) : null}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
          {children}
        </main>

        <div className="border-t border-ink-200 bg-white/80 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-normal text-ink-400">
                {isGuest ? "Guest workspace" : "Signed in as"}
              </p>
              <p className="truncate text-sm font-medium text-ink-900">
                {isGuest ? "Saved on this device" : user.email}
              </p>
            </div>
            {isGuest ? (
              <Button onClick={openSaveProgress} size="sm">
                Save progress
              </Button>
            ) : (
              <button
                className={buttonStyles({ size: "sm", variant: "ghost" })}
                onClick={handleLogout}
                type="button"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
