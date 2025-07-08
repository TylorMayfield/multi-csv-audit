/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // For server-side rendering, handle SQLite properly
      config.externals.push('better-sqlite3')
    }
    return config
  },
  // Disable x-powered-by header
  poweredByHeader: false,
}

module.exports = nextConfig
