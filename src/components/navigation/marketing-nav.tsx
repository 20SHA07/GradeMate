import Link from "next/link";
import { GraduationCap, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonStyles } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="border-b border-ink-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 font-semibold text-ink-900" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
            <GraduationCap aria-hidden="true" className="h-5 w-5" />
          </span>
          GradeMate
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            className={buttonStyles({ variant: "ghost", size: "sm" })}
            href="/login"
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            Log in
          </Link>
          <Link
            className={buttonStyles({ variant: "primary", size: "sm" })}
            href="/workspace"
          >
            Open workspace
          </Link>
        </nav>
      </div>
    </header>
  );
}
