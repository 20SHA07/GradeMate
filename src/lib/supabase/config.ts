const fallbackSupabaseUrl = "https://ipadimpttadajubxubyd.supabase.co";
const fallbackSupabaseAnonKey = "sb_publishable_T4CVUWq_pU1fsAKncAITcQ_aSfNYk8F";

export function getSupabasePublicConfig() {
  return {
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl,
    supabaseAnonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey
  };
}
