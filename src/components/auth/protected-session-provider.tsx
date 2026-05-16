"use client";

import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClient
} from "@/lib/supabase/client";

type AuthContextValue = {
  session: Session;
  user: User;
  supabase: SupabaseBrowserClient;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "authenticated"; session: Session };

export function ProtectedSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthState({
        status: "error",
        message:
          "Supabase environment variables are missing. Add them to .env.local."
      });
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadSession() {
      const { data, error } = await client.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({ status: "error", message: error.message });
        return;
      }

      if (!data.session) {
        setAuthState({ status: "unauthenticated" });
        router.replace("/login");
        return;
      }

      setAuthState({ status: "authenticated", session: data.session });
    }

    void loadSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setAuthState({ status: "unauthenticated" });
        router.replace("/login");
        return;
      }

      setAuthState({ status: "authenticated", session });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (authState.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="max-w-md rounded-lg border border-rose-200 bg-white p-5 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-ink-900">Auth setup needed</h1>
          <p className="mt-2 text-sm leading-6 text-ink-500">{authState.message}</p>
        </div>
      </div>
    );
  }

  if (authState.status !== "authenticated" || !supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="rounded-lg border border-ink-200 bg-white p-5 text-sm font-medium text-ink-600 shadow-sm">
          Loading GradeMate...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session: authState.session,
        user: authState.session.user,
        supabase
      }}
    >
      {children}
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
