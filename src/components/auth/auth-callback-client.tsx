"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  clearPendingAuthEmail,
  readPendingAuthEmail,
  rememberPendingAuthEmail
} from "@/lib/auth/pending-email";
import { startGuestSession } from "@/lib/guest-session";
import { getAuthRedirectUrl } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getSupabaseErrorMessage,
  getSupabasePublicConfig
} from "@/lib/supabase/config";

const expiredSignInLinkMessage =
  "This sign-in link expired or was opened in a different browser. Please log in again.";

function isPkceVerifierError(error: unknown) {
  const message =
    typeof error === "string" ? error : getSupabaseErrorMessage(error, "");

  return /pkce|code verifier|verifier.*storage|auth code/i.test(message);
}

function getCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  if (hash) {
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  return params;
}

export function AuthCallbackClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isResending, setIsResending] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const supabaseConfig = useMemo(() => getSupabasePublicConfig(), []);

  useEffect(() => {
    const params = getCallbackParams();
    const emailFromUrl = params.get("email") ?? "";
    const emailFromStorage = readPendingAuthEmail();
    setEmail(emailFromUrl || emailFromStorage);

    if (!supabase) {
      setError(supabaseConfig.missingSupabaseMessage);
      return;
    }

    const client = supabase;

    async function finishConfirmation() {
      const params = getCallbackParams();
      const code = params.get("code");
      const callbackError = params.get("error");
      const callbackErrorDescription = params.get("error_description");

      if (callbackError) {
        setError(
          callbackError === "access_denied"
            ? "Sign-in was canceled. You can try again or continue as a guest."
            : isPkceVerifierError(callbackErrorDescription)
              ? expiredSignInLinkMessage
              : "We could not complete verification. Please try logging in again."
        );
        return;
      }

      if (code) {
        const { error: exchangeError } =
          await client.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(
            isPkceVerifierError(exchangeError)
              ? expiredSignInLinkMessage
              : "We could not complete verification. Please try logging in again."
          );
          return;
        }
      }

      const { data, error: sessionError } = await client.auth.getSession();

      if (sessionError) {
        setError(
          isPkceVerifierError(sessionError)
            ? expiredSignInLinkMessage
            : "We could not finish checking your session. Please try signing in again."
        );
        return;
      }

      if (!data.session) {
        setError(expiredSignInLinkMessage);
        return;
      }

      clearPendingAuthEmail();
      router.replace("/workspace");
    }

    void finishConfirmation();
  }, [router, supabase, supabaseConfig.missingSupabaseMessage]);

  async function resendConfirmationEmail() {
    setMessage("");

    if (!supabase) {
      setError(supabaseConfig.missingSupabaseMessage);
      return;
    }

    if (!email.trim()) {
      setError("Enter your email on the login page, then request a new confirmation email.");
      return;
    }

    setIsResending(true);
    const { error: resendError } = await supabase.auth.resend({
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthRedirectUrl()
      },
      type: "signup"
    });
    setIsResending(false);

    if (resendError) {
      setError(getFriendlyCallbackAuthErrorMessage(resendError));
      return;
    }

    rememberPendingAuthEmail(email.trim());
    setMessage("Verification email sent. Check your inbox and spam folder.");
  }

  function continueAsGuest() {
    startGuestSession();
    router.replace("/workspace");
  }

  return (
    <Card className="w-full max-w-md p-6 text-center">
      <h1 className="text-[26px] font-bold leading-tight text-ink-900">
        {error ? "Verification needs a reset" : "Signing you in"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        {error
          ? "Try logging in again from the same browser you used to create the account."
          : "Hang tight while GradeMate finishes signing you in."}
      </p>
      {error ? (
        <>
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
          {message ? (
            <p className="mt-3 rounded-lg border border-lime-200 bg-lime-50 px-3 py-2 text-sm text-lime-700">
              {message}
            </p>
          ) : null}
          {email ? (
            <Button
              className="mt-4 w-full"
              disabled={isResending}
              onClick={() => void resendConfirmationEmail()}
              variant="secondary"
            >
              {isResending ? "Sending..." : `Resend verification email`}
            </Button>
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link className={buttonStyles()} href="/login">
              Back to login
            </Link>
            <button
              className={buttonStyles({ variant: "secondary" })}
              onClick={continueAsGuest}
              type="button"
            >
              Continue as guest
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-500">
            If you requested a verification email on another device, open the new email
            on that same device, or log in again from this browser.
          </p>
        </>
      ) : null}
    </Card>
  );
}

function getFriendlyCallbackAuthErrorMessage(error: unknown) {
  const message = getSupabaseErrorMessage(error, "");

  if (/rate limit|too many|security purposes|after \d+/i.test(message)) {
    return "Please wait before requesting another email.";
  }

  if (/smtp|email.*not.*configured|error sending|send.*email|provider/i.test(message)) {
    return "Email sending is not configured yet. Continue as guest or try later.";
  }

  return "We could not send another verification email. Please try again from the login page.";
}
