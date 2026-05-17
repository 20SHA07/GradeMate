import { getAuthRedirectUrl } from "@/lib/routes";
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClient
} from "@/lib/supabase/client";

export async function signInWithGoogle(client?: SupabaseBrowserClient | null) {
  const supabase = client ?? createSupabaseBrowserClient();

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });
}
