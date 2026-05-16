const productionBasePath = "/GradeMate";

export function getAppBasePath() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.pathname.startsWith(productionBasePath)
    ? productionBasePath
    : "";
}

export function getAuthRedirectUrl(path = "/auth/callback") {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${getAppBasePath()}${path}`;
}
