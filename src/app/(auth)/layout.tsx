import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-ink-50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3 font-semibold text-ink-900" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-700 text-white">
            <GraduationCap aria-hidden="true" className="h-5 w-5" />
          </span>
          GradeMate
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          {children}
        </div>
      </div>
    </main>
  );
}
