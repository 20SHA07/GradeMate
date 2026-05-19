"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { rememberPendingAuthEmail } from "@/lib/auth/pending-email";
import { startGuestSession } from "@/lib/guest-session";
import { getAuthRedirectUrl } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getSupabaseErrorMessage,
  getSupabasePublicConfig
} from "@/lib/supabase/config";

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
  const [isResending, setIsResending] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const supabaseConfig = useMemo(() => getSupabasePublicConfig(), []);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;

    async function redirectIfSignedIn() {
      const { data } = await client.auth.getSession();

      if (data.session) {
        router.replace("/workspace");
      }
    }

    void redirectIfSignedIn();
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setCanResendConfirmation(false);

    if (!supabase) {
      setError(supabaseConfig.missingSupabaseMessage);
      return;
    }

    setIsSubmitting(true);
    rememberPendingAuthEmail(email);

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
      const friendlyMessage = getFriendlyAuthErrorMessage(authResponse.error);

      if (/confirm|verify/i.test(friendlyMessage)) {
        setCanResendConfirmation(true);
        setError(friendlyMessage);
      } else {
        setError(friendlyMessage);
      }
      return;
    }

    if (authResponse.data.session) {
      router.replace("/workspace");
      return;
    }

    setCanResendConfirmation(true);
    setMessage(
      `Check your email to verify your account. We sent a verification link to ${email.trim()}. Open it in the same browser if possible.`
    );
  }

  function continueAsGuest() {
    startGuestSession();
    router.replace("/workspace");
  }

  async function resendConfirmationEmail() {
    setError("");
    setMessage("");

    if (!supabase) {
      setError(supabaseConfig.missingSupabaseMessage);
      return;
    }

    if (!email.trim()) {
      setError("Enter your email address first, then resend the confirmation email.");
      return;
    }

    setIsResending(true);
    rememberPendingAuthEmail(email);
    const { error: resendError } = await supabase.auth.resend({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthRedirectUrl()
      },
      type: "signup"
    });
    setIsResending(false);

    if (resendError) {
      setError(getFriendlyAuthErrorMessage(resendError));
      return;
    }

    setCanResendConfirmation(true);
    setMessage("Verification email sent. Check your inbox and spam folder.");
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">
          {isSignup ? "Create account" : "Log in"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {isSignup
            ? "Create your GradeMate workspace with a normal email and password."
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

        {canResendConfirmation ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              className={buttonStyles({
                className: "w-full",
                variant: "secondary"
              })}
              href="/login"
            >
              I verified, go to login
            </Link>
            <button
              className={buttonStyles({
                className: "w-full",
                variant: "secondary"
              })}
              disabled={isSubmitting || isResending}
              onClick={() => void resendConfirmationEmail()}
              type="button"
            >
              {isResending ? "Sending..." : "Resend verification email"}
            </button>
          </div>
        ) : null}

        <button
          className={buttonStyles({ className: "w-full" })}
          disabled={isSubmitting || isResending}
          type="submit"
        >
          {isSubmitting ? "Working..." : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-normal text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />
        or
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <div className="space-y-3">
        <button
          className={buttonStyles({
            className: "w-full",
            variant: "secondary"
          })}
          disabled={isSubmitting || isResending}
          onClick={continueAsGuest}
          type="button"
        >
          Continue as guest
        </button>
      </div>

      <p className="mt-3 text-center text-xs leading-5 text-ink-500">
        Guest work is saved on this device. Sign up anytime to sync across devices.
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

function getFriendlyAuthErrorMessage(error: unknown) {
  const message = getSupabaseErrorMessage(error, "");

  if (/rate limit|too many|security purposes|after \d+/i.test(message)) {
    return "Please wait before requesting another email.";
  }

  if (/smtp|email.*not.*configured|error sending|send.*email|provider/i.test(message)) {
    return "Email sending is not configured yet. Continue as guest or try later.";
  }

  if (/email not confirmed|not confirmed/i.test(message)) {
    return "This account still needs email verification. You can resend the verification email below.";
  }

  if (/invalid login|invalid.*credentials/i.test(message)) {
    return "Email or password is incorrect.";
  }

  return message || "Something went wrong. Please try again or continue as guest.";
}
