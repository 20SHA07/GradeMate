import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabasePublicConfig,
  logSupabaseConfigDebug
} from "@/lib/supabase/config";

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function createSupabaseBrowserClient(): SupabaseBrowserClient {
  if (browserClient) {
    return browserClient;
  }

  logSupabaseConfigDebug();

  const { isConfigured, missingSupabaseMessage, supabaseUrl, supabasePublicKey } =
    getSupabasePublicConfig();

  if (!isConfigured) {
    throw new Error(missingSupabaseMessage);
  }

  browserClient = createBrowserClient(supabaseUrl, supabasePublicKey);
  return browserClient;
}
