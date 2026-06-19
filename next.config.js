/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  webpack(config, { dev }) {
    if (dev) config.cache = false
    return config
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google; connect-src 'self' https: wss: blob:; worker-src blob: 'self'; frame-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
