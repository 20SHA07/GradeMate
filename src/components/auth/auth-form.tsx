"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  endGuestSession,
  startGuestSession
} from "@/lib/guest-session";
import { getAuthRedirectUrl } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;

    async function redirectIfSignedIn() {
      const { data } = await client.auth.getSession();

      if (data.session) {
        router.replace("/dashboard");
      }
    }

    void redirectIfSignedIn();
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }

    setIsSubmitting(true);

    const authResponse = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              full_name: name
            }
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (authResponse.error) {
      setError(authResponse.error.message);
      return;
    }

    if (authResponse.data.session) {
      endGuestSession();
      router.replace("/dashboard");
      return;
    }

    setMessage("Check your email to confirm your account, then log in.");
  }

  function continueAsGuest() {
    startGuestSession();
    router.replace("/dashboard");
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">
          {isSignup ? "Create account" : "Log in"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {isSignup
            ? "Create your GradeMate workspace with email and password."
            : "Log in to manage your semesters, courses, and GPA plan."}
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {isSignup ? (
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Name</span>
            <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
              <UserRound aria-hidden="true" className="h-4 w-4 text-ink-400" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none"
                onChange={(event) => setName(event.target.value)}
                placeholder="Student name"
                value={name}
              />
            </span>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Email</span>
          <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
            <Mail aria-hidden="true" className="h-4 w-4 text-ink-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink-700">Password</span>
          <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-100">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-ink-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink-900 outline-none"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
          </span>
        </label>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-sm text-lime-700">
            {message}
          </p>
        ) : null}

        <button
          className={buttonStyles({ className: "w-full" })}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Working..." : isSignup ? "Create account" : "Log in"}
        </button>

        <button
          className={buttonStyles({
            className: "w-full",
            variant: "secondary"
          })}
          onClick={continueAsGuest}
          type="button"
        >
          Continue as guest
        </button>
      </form>

      <p className="mt-3 text-center text-xs leading-5 text-ink-500">
        Guest work is temporary and is cleared when you exit the guest session.
      </p>

      <p className="mt-5 text-center text-sm text-ink-500">
        {isSignup ? "Already have an account?" : "New to GradeMate?"}{" "}
        <Link
          className="font-medium text-teal-700 hover:text-teal-800"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </Card>
  );
}
