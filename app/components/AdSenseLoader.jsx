'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isAdRoute } from '@/lib/adsenseRoutes'

const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
const STORAGE_KEY = 'repuestos-merida-cookie-consent'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'
const ADSENSE_READY_EVENT = 'repuestos-merida:adsense-ready'

// Carga el script de AdSense únicamente en rutas con contenido del editor.
// En login, formularios, juegos, paneles, etc. no se inyecta el script, de modo
// que esas pantallas nunca muestran anuncios (ni aun con Auto Ads activo).
export default function AdSenseLoader({ force = false }) {
  const pathname = usePathname()
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const update = () => {
      setConsented(window.localStorage.getItem(STORAGE_KEY) === 'accepted')
    }
    update()
    window.addEventListener(CONSENT_EVENT, update)
    return () => window.removeEventListener(CONSENT_EVENT, update)
  }, [])

  if (!ADSENSE_ENABLED || !consented || (!force && !isAdRoute(pathname))) return null

  return (
    <Script
      id="adsbygoogle-js"
      async
      strategy="afterInteractive"
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7506182169131280"
      crossOrigin="anonymous"
      onLoad={() => window.dispatchEvent(new Event(ADSENSE_READY_EVENT))}
    />
  )
}
