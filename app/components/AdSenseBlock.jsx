'use client'

import { useEffect, useRef, useState } from 'react'

const ADSENSE_READY_EVENT = 'repuestos-merida:adsense-ready'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'
const STORAGE_KEY = 'repuestos-merida-cookie-consent'
const ADSENSE_CLIENT = 'ca-pub-7506182169131280'
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'

export default function AdSenseBlock({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
  label = 'Publicidad',
}) {
  const initialized = useRef(false)
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const update = () => {
      setConsented(window.localStorage.getItem(STORAGE_KEY) === 'accepted')
    }
    update()
    window.addEventListener(CONSENT_EVENT, update)
    return () => window.removeEventListener(CONSENT_EVENT, update)
  }, [])

  useEffect(() => {
    if (!ADSENSE_ENABLED || !consented) return undefined

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
  }, [consented])

  if (!ADSENSE_ENABLED || !consented) return null

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
