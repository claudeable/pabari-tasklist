/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['web-push'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Allow embedding within the same Pabari workspace (for Core portal iframes)
          { key: 'Content-Security-Policy',    value: "frame-ancestors 'self' https://pabari-workspace.up.railway.app" },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'X-XSS-Protection',           value: '1; mode=block' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // Allow Smart Ops frontend to silently re-auth via Pabari SSO cross-origin
        source: '/api/sso/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',      value: 'https://smart-ops-frontend-production.up.railway.app' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods',     value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Content-Type' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
