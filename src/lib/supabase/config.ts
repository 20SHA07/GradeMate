const missingSupabaseMessage =
  "Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.";
const missingSupabaseUrlMessage = "Missing Supabase URL";
const missingSupabasePublicKeyMessage = "Missing Supabase public key";
const invalidSupabaseUrlMessage = "Invalid Supabase URL";
const invalidSupabasePublicKeyMessage = "Invalid Supabase public key";
const rejectedSupabasePublicKeyMessage =
  "Supabase rejected the public key. Check NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.";

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

export function getSupabaseErrorMessage(
  error: unknown,
  fallback = "Supabase request failed."
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

  if (/invalid api key/i.test(message)) {
    return rejectedSupabasePublicKeyMessage;
  }

  return message || fallback;
}
