const missingSupabaseMessage =
  "Account sync is not available right now. You can continue as guest.";
const missingSupabaseUrlMessage = "Account sync is not available right now.";
const missingSupabasePublicKeyMessage = "Account sync is not available right now.";
const invalidSupabaseUrlMessage = "Account sync is not available right now.";
const invalidSupabasePublicKeyMessage = "Account sync is not available right now.";
const rejectedSupabasePublicKeyMessage =
  "Account sync is unavailable right now. You can continue as guest.";

function getConfigError({
  hasLikelyPublicKey,
  hasPublicKey,
  hasUrl,
  hasValidUrl,
  supabasePublicKey
}: {
  hasLikelyPublicKey: boolean;
  hasPublicKey: boolean;
  hasUrl: boolean;
  hasValidUrl: boolean;
  supabasePublicKey: string;
}) {
  if (!hasUrl) {
    return missingSupabaseUrlMessage;
  }

  if (!hasPublicKey) {
    return missingSupabasePublicKeyMessage;
  }

  if (!hasValidUrl) {
    return invalidSupabaseUrlMessage;
  }

  if (
    !hasLikelyPublicKey ||
    supabasePublicKey.toLowerCase().includes("your_")
  ) {
    return invalidSupabasePublicKeyMessage;
  }

  return "";
}

export function getSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const supabaseKey =
    supabasePublishableKey.trim().length > 0
      ? supabasePublishableKey
      : supabaseAnonKey;
  const supabasePublicKey = supabaseKey;
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
  const hasUrl = supabaseUrl.length > 0;
  const hasPublicKey = supabasePublicKey.length > 0;
  const configError = getConfigError({
    hasLikelyPublicKey,
    hasPublicKey,
    hasUrl,
    hasValidUrl,
    supabasePublicKey
  });

  return {
    configError,
    hasPublishableKey: supabasePublishableKey.length > 0,
    hasAnonKey: supabaseAnonKey.length > 0,
    hasPublicKey,
    hasUrl,
    hasValidUrl,
    hasLikelyPublicKey,
    isConfigured: configError.length === 0,
    keyPreview: supabasePublicKey
      ? `${supabasePublicKey.slice(0, 8)}...${supabasePublicKey.slice(-4)}`
      : "",
    missingSupabaseMessage: configError || missingSupabaseMessage,
    publicKeySource,
    supabaseAnonKey,
    supabasePublicKey,
    supabasePublishableKey,
    supabaseUrl
  };
}

export function logSupabaseConfigDebug() {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log("Supabase env check", {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasPublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  });
}

export function getSupabaseErrorMessage(
  error: unknown,
  fallback = "This request could not be completed right now."
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  if (/invalid api key|anon key|publishable key|supabase|schema cache|pgrst|pkce|code verifier|jwt/i.test(message)) {
    return rejectedSupabasePublicKeyMessage;
  }

  return message || fallback;
}
