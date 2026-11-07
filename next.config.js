const NOINDEX_HEADERS = ['/api/:path*']

// La web ahora es una sola landing que enseña a usar la app. Las páginas que
// había antes redirigen a la guía más cercana (o al inicio), para no romper
// enlaces compartidos ni perder lo que Google ya tenía indexado.
const REDIRECCIONES_A_LA_GUIA = [
  ['/blog', '/'],
  ['/blog/:path*', '/'],
  ['/guia-repuesto', '/#buscar'],
  ['/rio-albarregas', '/'],
  ['/rifa', '/'],
  ['/rifa/:path*', '/'],
  ['/rifas', '/'],
  ['/bingo', '/'],
  ['/bingo/:path*', '/'],
  ['/piedra-papel-tijera', '/'],
  ['/verificacion', '/#cuenta'],
  ['/verificacion/:path*', '/#cuenta'],
  ['/auth/:path*', '/#cuenta'],
  ['/plaza', '/#plaza'],
  ['/plaza/:path*', '/#plaza'],
  ['/anuncio/:path*', '/#plaza'],
  ['/solicitados', '/#pedir'],
  ['/repuesto/:path*', '/#buscar'],
  ['/mapa', '/#mapa'],
  ['/directorio', '/#mapa'],
  ['/configurador', '/#mi-carro'],
  ['/configurador/:path*', '/#mi-carro'],
  ['/login', '/#cuenta'],
  ['/registro', '/#cuenta'],
  ['/usuario/:path*', '/#cuenta'],
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
  async redirects() {
    return REDIRECCIONES_A_LA_GUIA.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }))
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
