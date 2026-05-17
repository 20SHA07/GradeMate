const fallbackSupabaseUrl = "https://ipadimpttadajubxubyd.supabase.co";
const fallbackSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIcGFkaW1wdHRhZGFqdWJ4dWJ5ZCIsInJlZiI6ImlwYWRpbXB0dGFkYWp1Ynh1YnlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTE2MzYsImV4cCI6MjA5NDUyNzYzNn0.skAPign9k2KC2QKk8QGwOLEx98CGh19XCZsE8TOj87Q";

export function getSupabasePublicConfig() {
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl,
    supabaseAnonKey: anonKey
  };
}
