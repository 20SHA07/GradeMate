const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const isUserOrOrgPages = repoName?.toLowerCase().endsWith(".github.io");
const basePath = isGitHubActions && repoName && !isUserOrOrgPages ? `/${repoName}` : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true
  },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
