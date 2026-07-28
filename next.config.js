const NOINDEX_HEADERS = [
  '/api/:path*',
  '/login',
  '/registro',
  '/auth/:path*',
  '/configurador',
  '/configurador/:path*',
  '/bingo',
  '/bingo/:path*',
  '/rifa',
  '/rifa/:path*',
  '/rifas',
  '/piedra-papel-tijera',
  '/verificacion',
  '/verificacion/:path*',
  '/usuario/:path*',
  '/directorio',
  '/anuncio/:path*',
  '/repuesto/:path*',
  '/plaza/login',
  '/plaza/publicar',
  '/plaza/mis-anuncios',
  '/plaza/solicitar',
]

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://apis.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google; connect-src 'self' https: wss: blob:; worker-src blob: 'self'; frame-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  serverExternalPackages: ['firebase-admin'],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async headers() {
    return [
      ...NOINDEX_HEADERS.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      })),
      {
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

module.exports = nextConfig
