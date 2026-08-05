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
        <section
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-gray-700 bg-gray-950 p-5 text-white shadow-2xl"
          role="dialog"
          aria-labelledby="cookie-title"
        >
          <h2 id="cookie-title" className="text-lg font-bold">
            Preferencias de cookies
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            Las tecnologías estrictamente necesarias están siempre activas porque permiten la
            sesión, la seguridad y guardar tu elección. Con tu autorización activamos medición de
            uso y, cuando corresponda, publicidad de Google. Puedes usar las funciones esenciales
            aunque rechaces las opcionales. Consulta la{' '}
            <Link className="text-yellow-300 underline" href="/politica-cookies">
              Política de Cookies
            </Link>
            .
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-bold hover:bg-gray-800"
            >
              Rechazar opcionales
            </button>
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-400"
            >
              Aceptar opcionales
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
