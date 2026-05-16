import { createBrowserClient } from "@supabase/ssr";

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function createSupabaseBrowserClient(): SupabaseBrowserClient {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
