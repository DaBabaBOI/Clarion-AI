import type { NextConfig } from "next";

// GitHub Pages serves the site from /<repo name>; the deploy workflow passes that path in.
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Every screen talks to Supabase from the browser, so the app builds to plain
  // static files (out/) that GitHub Pages or any static host can serve. Static
  // exports cannot use Cache Components, and nothing here needs them.
  output: "export",
  basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
