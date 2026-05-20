import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-ink-50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link className="block font-semibold text-teal-300" href="/">
            <span className="block text-[21px] font-bold leading-5">GradeMate</span>
            <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Built for KU students
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-ink-200 bg-ink-100 text-teal-300" href="/workspace">
              <GraduationCap aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          {children}
        </div>
      </div>
    </main>
  );
}
