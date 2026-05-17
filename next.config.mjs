const githubPagesBasePath = "/GradeMate";
const isProductionBuild = process.env.NODE_ENV === "production";
const basePath = isProductionBuild ? githubPagesBasePath : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
