/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: "/MindLoop-1.0",
  assetPrefix: "/MindLoop-1.0",
};

module.exports = nextConfig;
