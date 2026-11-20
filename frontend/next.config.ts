import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Address of the backend (Render). Server-side only; the browser never sees it.
const apiUrl = (process.env.API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const nextConfig: NextConfig = {
  // The browser talks to /api/graphql on its own origin, Next proxies it to the
  // backend. That makes the session cookie first-party (no third-party cookie
  // blocking in Safari etc.) and removes the need for CORS in production.
  async rewrites() {
    return [{ source: "/api/graphql", destination: `${apiUrl}/graphql` }];
  },
};

export default withNextIntl(nextConfig);
