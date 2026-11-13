import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // The Cursor apps gate proxies requests without forwarding the public
      // host, so Server Actions reject the browser's Origin as cross-site.
      allowedOrigins: ["greenroom.apps.grok.bot"],
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
