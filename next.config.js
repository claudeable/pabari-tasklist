/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['web-push'],
  },
}
module.exports = nextConfig
