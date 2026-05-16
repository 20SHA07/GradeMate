import Link from "next/link";
import { Mail, LockKeyhole } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          Use your account to open your GradeMate workspace.
        </p>
      </div>

      <form className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
            <Mail aria-hidden="true" className="h-4 w-4 text-ink-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none"
              placeholder="you@example.com"
              type="email"
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-ink-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none"
              placeholder="Password"
              type="password"
            />
          </span>
        </label>

        <button className={buttonStyles({ className: "w-full" })} type="submit">
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-500">
        New to GradeMate?{" "}
        <Link className="font-medium text-teal-700 hover:text-teal-800" href="/sign-up">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
