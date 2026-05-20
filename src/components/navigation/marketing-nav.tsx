import Link from "next/link";
import { Calculator, GraduationCap, Library, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonStyles } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="overflow-x-hidden border-b border-ink-200 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 font-semibold text-ink-900" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm shadow-teal-950/20">
            <GraduationCap aria-hidden="true" className="h-5 w-5" />
          </span>
          GradeMate
        </Link>
        <nav className="hidden min-w-0 items-center gap-1 text-sm font-medium text-ink-500 md:flex">
          <Link className="rounded-lg px-3 py-2 hover:bg-ink-100 hover:text-ink-900" href="/workspace">
            Workspace
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink-100 hover:text-ink-900" href="/course-library">
            Course Library
          </Link>
          <Link className="rounded-lg px-3 py-2 hover:bg-ink-100 hover:text-ink-900" href="/simple">
            GPA Calc
          </Link>
        </nav>
        <nav className="flex min-w-0 shrink-0 items-center gap-2">
          <ThemeToggle />
          <Link
            className={buttonStyles({ className: "max-[360px]:hidden", variant: "ghost", size: "sm" })}
            href="/login"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            Log in
          </Link>
          <Link
            aria-label="Open Course Library"
            className={buttonStyles({
              className: "md:hidden",
              variant: "secondary",
              size: "icon"
            })}
            href="/course-library"
          >
            <Library aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            className={buttonStyles({
              className: "max-[420px]:hidden",
              variant: "primary",
              size: "sm"
            })}
            href="/workspace"
          >
            Open workspace
          </Link>
          <Link
            aria-label="Quick GPA Calculator"
            className={buttonStyles({
              className: "min-[421px]:hidden",
              variant: "primary",
              size: "icon"
            })}
            href="/simple"
          >
            <Calculator aria-hidden="true" className="h-4 w-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
