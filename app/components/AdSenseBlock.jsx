'use client'

import { useEffect, useRef, useState } from 'react'

const CONSENT_KEY = 'repuestos-merida-cookie-consent'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'
const ADSENSE_READY_EVENT = 'repuestos-merida:adsense-ready'
const ADSENSE_CLIENT = 'ca-pub-7506182169131280'

export default function AdSenseBlock({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Publicidad',
}) {
  const [allowed, setAllowed] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    const syncConsent = () => {
      setAllowed(window.localStorage.getItem(CONSENT_KEY) === 'accepted')
    }

    syncConsent()
    window.addEventListener(CONSENT_EVENT, syncConsent)
    window.addEventListener('storage', syncConsent)

    return () => {
      window.removeEventListener(CONSENT_EVENT, syncConsent)
      window.removeEventListener('storage', syncConsent)
    }
  }, [])

  useEffect(() => {
    if (!allowed || initialized.current) return

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
  }, [allowed])

  if (!allowed) return null

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
