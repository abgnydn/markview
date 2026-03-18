import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  assetPrefix: './',
};

export default withSentryConfig(nextConfig, {
  org: "markview",
  project: "markview-web",

  // Suppresses Sentry CLI output unless running in CI
  silent: !process.env.CI,

  // Upload source maps to Sentry for better stack traces in production
  // Requires SENTRY_AUTH_TOKEN env var (in .env.local and Vercel/GitHub Actions)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});


