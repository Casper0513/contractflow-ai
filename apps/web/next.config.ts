import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  serverExternalPackages: ["pdfkit"],

  // keep any other existing settings here
};

export default nextConfig;
