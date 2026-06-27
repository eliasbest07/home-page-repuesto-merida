const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rutas funcionales / juegos / paneles: sin contenido del editor, fuera del índice.
        disallow: [
          '/api/',
          '/login',
          '/registro',
          '/auth/',
          '/configurador',
          '/bingo',
          '/rifa',
          '/rifas',
          '/piedra-papel-tijera',
          '/verificacion',
          '/usuario/',
          '/plaza/login',
          '/plaza/publicar',
          '/plaza/mis-anuncios',
          '/plaza/solicitar',
        ],
      },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Bytespider', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
