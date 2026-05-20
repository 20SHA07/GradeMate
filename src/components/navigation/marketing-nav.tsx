import Link from "next/link";
import { Calculator, Library, LogIn } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="overflow-x-hidden border-b border-ink-200 bg-ink-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link className="text-xl font-bold text-teal-300" href="/">
          GradeMate
        </Link>
        <nav className="hidden min-w-0 items-center gap-5 text-[13px] font-semibold text-ink-800 md:flex">
          <Link className="hover:text-teal-300" href="/workspace">
            Dashboard
          </Link>
          <Link className="hover:text-teal-300" href="/course-library">
            Course Library
          </Link>
          <Link className="hover:text-teal-300" href="/simple">
            GPA Calc
          </Link>
        </nav>
        <nav className="flex min-w-0 shrink-0 items-center gap-2">
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
            Workspace
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
