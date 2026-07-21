import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Native/Node-only modules - must be excluded from webpack bundling
  // (including the dual edge/nodejs bundle Next.js builds for
  // instrumentation.ts) or bundlers choke trying to resolve their native
  // bindings (e.g. better-sqlite3 -> bindings -> require('fs')).
  serverExternalPackages: ['mysql2', 'better-sqlite3'],
}

export default nextConfig
