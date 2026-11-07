'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'repuestos-merida-cookie-consent'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'

function updateConsent(granted) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const value = granted ? 'granted' : 'denied'
  window.gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  })
}

export default function CookieConsent() {
  const [consent, setConsent] = useState(null)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(STORAGE_KEY)
    setConsent(savedConsent)
    setShowDialog(!savedConsent)
    updateConsent(savedConsent === 'accepted')
  }, [])

  function choose(value) {
    window.localStorage.setItem(STORAGE_KEY, value)
    setConsent(value)
    setShowDialog(false)
    updateConsent(value === 'accepted')
    window.dispatchEvent(new Event(CONSENT_EVENT))
  }

  return (
    <>
      {showDialog && (
        // Barra baja y corta: en un teléfono pequeño no tapa la portada.
        <section
          className="fixed inset-x-2 bottom-2 z-[100] mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-gray-950 px-4 py-3 text-white shadow-lg"
          role="dialog"
          aria-label="Preferencias de cookies"
        >
          <p className="min-w-0 flex-1 basis-56 text-sm leading-5 text-gray-200">
            Con tu permiso medimos cómo se usa la página. Lo esencial funciona igual si no aceptas.{' '}
            <Link className="text-yellow-300 underline" href="/politica-cookies">
              Más información
            </Link>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="min-h-10 rounded-lg border border-gray-500 px-3 text-sm font-semibold hover:bg-gray-800"
            >
              No, gracias
            </button>
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="min-h-10 rounded-lg bg-[#FFD700] px-3 text-sm font-bold text-gray-950 hover:bg-yellow-400"
            >
              Aceptar
            </button>
          </div>
        </section>
      )}

      {!showDialog && consent === 'rejected' && (
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="fixed bottom-3 left-3 z-[90] rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-md hover:bg-gray-100"
          aria-label="Cambiar preferencias de cookies"
        >
          Cookies
        </button>
      )}
    </>
  )
}
