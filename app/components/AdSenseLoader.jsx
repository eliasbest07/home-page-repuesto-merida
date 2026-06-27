'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { isAdRoute } from '@/lib/adsenseRoutes'

const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'

// Carga el script de AdSense únicamente en rutas con contenido del editor.
// En login, formularios, juegos, paneles, etc. no se inyecta el script, de modo
// que esas pantallas nunca muestran anuncios (ni aun con Auto Ads activo).
export default function AdSenseLoader() {
  const pathname = usePathname()
  if (!ADSENSE_ENABLED || !isAdRoute(pathname)) return null

  return (
    <Script
      id="adsbygoogle-js"
      async
      strategy="afterInteractive"
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7506182169131280"
      crossOrigin="anonymous"
    />
  )
}
