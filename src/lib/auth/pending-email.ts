export const pendingAuthEmailStorageKey = "grademate_pending_auth_email";

export function rememberPendingAuthEmail(email: string) {
  if (typeof window === "undefined" || !email.trim()) {
    return;
  }

  window.localStorage.setItem(pendingAuthEmailStorageKey, email.trim());
}

export function readPendingAuthEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(pendingAuthEmailStorageKey) ?? "";
}

export function clearPendingAuthEmail() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(pendingAuthEmailStorageKey);
}
