const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export default function sitemap() {
  const now = new Date()
  const legales = [
    ['/politica-privacidad', 0.5],
    ['/terminos-condiciones', 0.5],
    ['/aviso-legal', 0.5],
    ['/politica-cookies', 0.5],
    ['/eliminar-datos', 0.4],
    ['/propiedad-intelectual', 0.5],
  ]

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/soporte`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...legales.map(([ruta, priority]) => ({
      url: `${SITE_URL}${ruta}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority,
    })),
  ]
}
