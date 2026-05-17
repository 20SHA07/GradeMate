const repositoryBasePath = "/GradeMate";

export function getAuthRedirectUrl() {
  if (typeof window === "undefined") {
    return "/auth/callback";
  }

  const isGitHubPagesProject =
    window.location.hostname.endsWith("github.io") &&
    window.location.pathname.startsWith(repositoryBasePath);
  const basePath = isGitHubPagesProject ? repositoryBasePath : "";

  return `${window.location.origin}${basePath}/auth/callback`;
}

export function getCourseDetailHref(courseId: string, options?: { imported?: boolean }) {
  const params = new URLSearchParams({ courseId });

  if (options?.imported) {
    params.set("imported", "1");
  }

  return `/courses/preview/?${params.toString()}`;
}
