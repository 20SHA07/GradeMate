const fallbackSupabaseUrl = "https://ipadimpttadajubxubyd.supabase.co";
const fallbackSupabasePublishableKey =
  "sb_publishable_T4CVUWq_pU1fsAKncAITcQ_aSfNYk8F";

export function getSupabasePublicConfig() {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    fallbackSupabasePublishableKey;

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl,
    supabaseAnonKey: publishableKey
  };
}
