"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthCallbackClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase environment variables are missing.");
      return;
    }

    const client = supabase;

    async function finishConfirmation() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const callbackError = params.get("error");
      const callbackErrorDescription = params.get("error_description");

      if (callbackError) {
        setError(
          callbackError === "access_denied"
            ? "Google login was canceled. You can try again or continue as a guest."
            : callbackErrorDescription ?? "OAuth callback failed."
        );
        return;
      }

      if (code) {
        const { error: exchangeError } =
          await client.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const { data } = await client.auth.getSession();

      if (!data.session) {
        setError("Could not finish login. Please try again.");
        return;
      }

      router.replace("/dashboard");
    }

    void finishConfirmation();
  }, [router, supabase]);

  return (
    <Card className="w-full max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">
        Confirming your account
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        Hang tight while GradeMate finishes your sign up.
      </p>
      {error ? (
        <>
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link className={buttonStyles()} href="/login">
              Back to login
            </Link>
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href="/dashboard"
            >
              Continue as guest
            </Link>
          </div>
        </>
      ) : null}
    </Card>
  );
}
