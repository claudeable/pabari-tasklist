import type { NextConfig } from "next";

// CSP/HSTS/etc. are set at the edge (Caddy) and reinforced by the backend for API
// responses (Security Architecture doc §3). This config intentionally does not
// duplicate header logic — strict source maps are disabled to avoid leaking
// internal paths in prod bundles.
//
// NOTE: `output: "standalone"` is deliberately NOT set here even though
// docker/frontend.Dockerfile wants it for a minimal image — this repo is also
// deployed via Railway's Railpack builder, which runs the plain `next start`
// (from package.json) and does not work correctly with standalone output
// (static assets won't serve). If you switch back to the Dockerfile-based
// deploy path, re-add `output: "standalone"` there via a build-time env var
// or a separate config, rather than breaking the Railpack path silently.
const backendUrl = process.env.BACKEND_INTERNAL_URL;

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // Proxies API calls through the frontend's own origin instead of hitting the
  // backend's Railway domain directly from the browser. Without this, the
  // refresh-token cookie is a third-party cookie (frontend and backend are
  // different Railway subdomains) — many browsers block or restrict those, so
  // the silent-refresh-on-reload flow silently fails and every reload looks
  // like a logout. Routing through the same origin makes the cookie first-party.
  async rewrites() {
    if (!backendUrl) return [];
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
