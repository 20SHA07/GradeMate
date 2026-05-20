"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Calculator,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  PlusCircle
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { useAuth } from "@/components/auth/protected-session-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/workspace", label: "Dashboard", icon: LayoutDashboard },
  { href: "/course-library", label: "Course Library", icon: BookMarked },
  { href: "/simple", label: "GPA Calculator", icon: Calculator },
  { href: "/courses", label: "Syllabus Review", icon: FileText },
  { href: "/semesters", label: "Semesters", icon: BookOpen }
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

function isWorkspaceHomePath(pathname: string) {
  return pathname === "/workspace" || pathname === "/dashboard";
}

function isNavItemActive(itemHref: string, pathname: string) {
  if (itemHref === "/workspace") {
    return isWorkspaceHomePath(pathname);
  }

  return pathname === itemHref || pathname.startsWith(itemHref);
}

function getPageActions(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);

  if (isWorkspaceHomePath(normalizedPathname)) {
    return [
      { href: "/semesters#create-semester", label: "New semester", icon: PlusCircle },
      { href: "/course-library", label: "Import course", icon: BookMarked, variant: "secondary" as const }
    ] satisfies PageAction[];
  }

  if (
    normalizedPathname.startsWith("/courses/") &&
    normalizedPathname !== "/courses"
  ) {
    return [
      { href: "/semesters", label: "Back to semester", icon: ArrowLeft, variant: "secondary" as const },
      { href: "#add-assessment", label: "Add assessment", icon: PlusCircle }
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
    <div className="min-h-screen overflow-x-hidden bg-ink-50 text-ink-900 lg:flex">
      <aside className="hidden w-56 shrink-0 border-r border-ink-200 bg-ink-100 lg:flex lg:flex-col">
        <div className="px-4 py-5">
          <Link className="block font-semibold text-teal-300" href="/">
            <span className="block text-[21px] font-bold leading-5">GradeMate</span>
            <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Built for KU students
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.href, normalizedPathname);
            const Icon = item.icon;

            return (
              <Link
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-[3px] px-3 py-2.5 text-[13px] font-semibold leading-none transition-colors",
                  isActive
                    ? "bg-teal-700 text-ink-900"
                    : "text-ink-700 hover:bg-ink-200/55 hover:text-ink-900"
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

        <div className="space-y-3 border-t border-ink-200 p-3.5">
          <Link
            className={buttonStyles({
              className: "w-full uppercase tracking-[0.06em]",
              size: "sm"
            })}
            href="/semesters#create-semester"
          >
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            New course
          </Link>
          {isGuest ? (
            <div className="border border-ink-200 bg-white/70 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-900">
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
            <div className="border border-ink-200 bg-white/70 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
                Student workspace
              </p>
              <p className="mt-1 truncate text-sm font-medium text-ink-900">
                {user.email}
              </p>
            </div>
          )}
          <div className="grid gap-1">
            <Link
              className={buttonStyles({
                className: "justify-start",
                size: "sm",
                variant: "ghost"
              })}
              href="/"
            >
              <HelpCircle aria-hidden="true" className="h-4 w-4" />
              Help
            </Link>
            {isGuest ? (
              <Link
                className={buttonStyles({
                  className: "justify-start",
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
                  className: "justify-start",
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
          <p className="border-t border-ink-200 pt-3 text-[10px] leading-4 text-ink-500">
            Made by a Khalifa University student for KU students.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-ink-200 bg-ink-50/95 lg:hidden">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-7">
            <Link className="flex items-center gap-2 font-semibold text-ink-900 lg:hidden" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-600 text-[color:var(--accent-on)]">
                <GraduationCap aria-hidden="true" className="h-5 w-5" />
              </span>
              GradeMate
            </Link>

            <div className="hidden min-w-0 items-center gap-2 text-sm text-ink-500 lg:flex">
              <span className="font-medium text-ink-900">
                {navItems.find((item) =>
                  isNavItemActive(item.href, normalizedPathname)
                )?.label ?? "Workspace"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isGuest ? (
                <div className="hidden items-center gap-2 md:flex">
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
              <div className="hidden flex-wrap items-center justify-end gap-2 md:flex">
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
            </div>
          </div>

          <nav className="flex max-w-full gap-2 overflow-x-auto border-t border-ink-200 px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.href, normalizedPathname);
              const Icon = item.icon;

              return (
                <Link
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-[13px] font-semibold",
                    isActive
                      ? "bg-teal-600 text-[color:var(--accent-on)]"
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
            <div className="flex max-w-full gap-2 overflow-x-auto border-t border-ink-200 px-4 py-2 md:hidden">
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
          <div className="border-b border-ink-200 bg-ink-100/80 px-4 py-2 text-sm text-ink-600 sm:px-6 lg:hidden">
            You&apos;re using Guest Mode. Sign up to save across devices.
          </div>
        ) : null}

        <main className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          {children}
        </main>

        <div className="border-t border-ink-200 bg-ink-100/80 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-400">
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
          <p className="mt-2 text-[10px] leading-4 text-ink-500">
            Made by a Khalifa University student for KU students.
          </p>
        </div>
      </div>
    </div>
  );
}
