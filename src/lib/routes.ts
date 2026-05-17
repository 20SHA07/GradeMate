const repositoryBasePath = "/GradeMate";

export function getAppBasePath() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.hostname.endsWith("github.io") &&
    window.location.pathname.startsWith(repositoryBasePath)
    ? repositoryBasePath
    : "";
}

export function getAuthRedirectUrl() {
  if (typeof window === "undefined") {
    return "/auth/callback";
  }

  return `${window.location.origin}${getAppBasePath()}/auth/callback`;
}

export function getCourseDetailHref(courseId: string, options?: { imported?: boolean }) {
  const params = new URLSearchParams({ courseId });

  if (options?.imported) {
    params.set("imported", "1");
  }

  return `/courses/preview/?${params.toString()}`;
}
