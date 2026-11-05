import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "../..");

const publicTokenHeaders = [
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "Cache-Control",
    value: "no-store",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
  serverExternalPackages: ["pdfkit"],

  async headers() {
    return [
      {
        source: "/e/:token",
        headers: publicTokenHeaders,
      },
      {
        source: "/i/:token",
        headers: publicTokenHeaders,
      },
    ];
  },
};

const configWithIntl = withNextIntl(nextConfig);

export default withSentryConfig(configWithIntl, {
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
