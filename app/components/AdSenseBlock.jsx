'use client'

import { useEffect, useRef } from 'react'

const ADSENSE_READY_EVENT = 'repuestos-merida:adsense-ready'
const ADSENSE_CLIENT = 'ca-pub-7506182169131280'

export default function AdSenseBlock({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Publicidad',
}) {
  const initialized = useRef(false)

  // Con Consent Mode (app/layout.js + CookieConsent), AdSense decide si el
  // anuncio es personalizado o no según el consentimiento. El bloque se
  // renderiza y solicita relleno siempre.
  useEffect(() => {
    const initializeAd = () => {
      if (initialized.current || !window.adsbygoogle) return false

      try {
        window.adsbygoogle.push({})
        initialized.current = true
        return true
      } catch {
        return false
      }
    }

    if (initializeAd()) return

    const intervalId = window.setInterval(() => {
      if (initializeAd()) window.clearInterval(intervalId)
    }, 300)
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 10000)

    window.addEventListener(ADSENSE_READY_EVENT, initializeAd)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      window.removeEventListener(ADSENSE_READY_EVENT, initializeAd)
    }
  }, [])

  return (
    <aside className={`adsense-placement ${className}`} aria-label={label}>
      <span className="adsense-label">{label}</span>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : undefined}
      />
    </aside>
  )
}
