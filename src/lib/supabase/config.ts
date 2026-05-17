const missingSupabaseMessage =
  "Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export function getSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const supabasePublicKey = supabasePublishableKey || supabaseAnonKey;
  const publicKeySource = supabasePublishableKey
    ? "publishable"
    : supabaseAnonKey
      ? "anon"
      : "missing";
  const hasValidUrl =
    supabaseUrl.length > 0 && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);
  const hasLikelyPublicKey =
    supabasePublicKey.length > 0 &&
    (supabasePublicKey.startsWith("eyJ") ||
      supabasePublicKey.startsWith("sb_publishable_"));

  return {
    hasPublishableKey: supabasePublishableKey.length > 0,
    hasAnonKey: supabaseAnonKey.length > 0,
    hasPublicKey: supabasePublicKey.length > 0,
    hasUrl: supabaseUrl.length > 0,
    hasValidUrl,
    hasLikelyPublicKey,
    isConfigured: hasValidUrl && hasLikelyPublicKey,
    keyPreview: supabasePublicKey
      ? `${supabasePublicKey.slice(0, 8)}...${supabasePublicKey.slice(-4)}`
      : "",
    missingSupabaseMessage,
    publicKeySource,
    supabaseAnonKey,
    supabasePublicKey,
    supabasePublishableKey,
    supabaseUrl
  };
}
