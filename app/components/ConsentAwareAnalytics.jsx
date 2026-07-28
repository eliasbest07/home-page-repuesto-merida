'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'

const STORAGE_KEY = 'repuestos-merida-cookie-consent'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'

export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const update = () => {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'accepted')
    }
    update()
    window.addEventListener(CONSENT_EVENT, update)
    return () => window.removeEventListener(CONSENT_EVENT, update)
  }, [])

  return enabled ? <Analytics /> : null
}
