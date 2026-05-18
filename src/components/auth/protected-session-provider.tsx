"use client";

import type { Session, User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  clearGuestWorkspaceData,
  guestUser,
  hasGuestWorkspaceData,
  migrateGuestWorkspaceToSupabase
} from "@/lib/data/workspace-store";
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClient
} from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";

type AppUser = Pick<User, "id" | "email">;

type AuthContextValue = {
  isGuest: boolean;
  session: Session | null;
  user: AppUser;
  supabase: SupabaseBrowserClient | null;
  signOut: () => Promise<void>;
  openSaveProgress: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; session: Session };

const migrationDismissedKey = "grademate_guest_migration_dismissed_for";
const authSessionTimeoutMs = 5000;

export function ProtectedSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [savePrompt, setSavePrompt] = useState<"auth" | "migrate" | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthState({ status: "guest" });
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadSession() {
      const timeoutId = window.setTimeout(() => {
        if (isMounted) {
          setAuthState({ status: "guest" });
        }
      }, authSessionTimeoutMs);

      try {
        const { data } = await client.auth.getSession();
        window.clearTimeout(timeoutId);

        if (!isMounted) {
          return;
        }

        setAuthState(
          data.session
            ? { status: "authenticated", session: data.session }
            : { status: "guest" }
        );
      } catch {
        window.clearTimeout(timeoutId);

        if (isMounted) {
          setAuthState({ status: "guest" });
        }
      }
    }

    void loadSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      setAuthState(
        session ? { status: "authenticated", session } : { status: "guest" }
      );
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (authState.status !== "authenticated") {
      return;
    }

    const dismissedFor = window.localStorage.getItem(migrationDismissedKey);

    if (
      hasGuestWorkspaceData() &&
      dismissedFor !== authState.session.user.id
    ) {
      setSavePrompt("migrate");
    }
  }, [authState]);

  async function signOut() {
    await supabase?.auth.signOut();
    setAuthState({ status: "guest" });
    router.replace("/dashboard");
  }

  function openSaveProgress() {
    setMigrationError("");

    if (authState.status === "authenticated") {
      setSavePrompt("migrate");
      return;
    }

    setSavePrompt("auth");
  }

  async function saveGuestWorkspace() {
    if (authState.status !== "authenticated" || !supabase) {
      setSavePrompt("auth");
      return;
    }

    setIsMigrating(true);
    setMigrationError("");

    try {
      await migrateGuestWorkspaceToSupabase({
        supabase,
        userId: authState.session.user.id
      });
      window.localStorage.removeItem(migrationDismissedKey);
      setSavePrompt(null);
      router.refresh();
    } catch (error) {
      setMigrationError(
        getSupabaseErrorMessage(error, "Could not save your guest workspace.")
      );
    } finally {
      setIsMigrating(false);
    }
  }

  function keepGuestWorkspaceLocal() {
    if (authState.status === "authenticated") {
      window.localStorage.setItem(
        migrationDismissedKey,
        authState.session.user.id
      );
    }

    setSavePrompt(null);
  }

  function discardGuestWorkspace() {
    clearGuestWorkspaceData();
    setSavePrompt(null);
    router.refresh();
  }

  const contextValue: AuthContextValue =
    authState.status === "authenticated"
      ? {
          isGuest: false,
          session: authState.session,
          user: authState.session.user,
          supabase,
          signOut,
          openSaveProgress
        }
      : {
          isGuest: true,
          session: null,
          user: guestUser,
          supabase,
          signOut,
          openSaveProgress
        };

  return (
    <AuthContext.Provider value={contextValue}>
      {authState.status === "loading" ? (
        <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
          <div className="rounded-2xl border border-ink-200 bg-white p-5 text-sm font-medium text-ink-600 shadow-sm">
            Loading GradeMate...
          </div>
        </div>
      ) : (
        children
      )}

      {savePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="w-full max-w-md p-6">
            {savePrompt === "auth" ? (
              <>
                <h2 className="text-xl font-semibold text-ink-900">
                  Save your progress
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Create an account or log in to save your courses across
                  devices. Your guest workspace stays on this device until you
                  choose what to do with it.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Link
                    className={buttonStyles()}
                    href="/signup"
                    onClick={() => setSavePrompt(null)}
                  >
                    Create account
                  </Link>
                  <Link
                    className={buttonStyles({ variant: "secondary" })}
                    href="/login"
                    onClick={() => setSavePrompt(null)}
                  >
                    Log in
                  </Link>
                </div>
                <Button
                  className="mt-3 w-full"
                  onClick={() => setSavePrompt(null)}
                  variant="ghost"
                >
                  Keep using Guest Mode
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-ink-900">
                  Save your guest workspace to your account?
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  GradeMate found local guest data on this device. You can save
                  it to your account, keep it local, or discard it.
                </p>
                {migrationError ? (
                  <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {migrationError}
                  </p>
                ) : null}
                <div className="mt-5 space-y-2">
                  <Button
                    className="w-full"
                    disabled={isMigrating}
                    onClick={() => void saveGuestWorkspace()}
                  >
                    {isMigrating ? "Saving..." : "Save to account"}
                  </Button>
                  <Button
                    className="w-full"
                    disabled={isMigrating}
                    onClick={keepGuestWorkspaceLocal}
                    variant="secondary"
                  >
                    Keep only on this device
                  </Button>
                  <Button
                    className="w-full"
                    disabled={isMigrating}
                    onClick={discardGuestWorkspace}
                    variant="danger"
                  >
                    Discard guest data
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside ProtectedSessionProvider.");
  }

  return context;
}
