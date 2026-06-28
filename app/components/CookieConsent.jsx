'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'repuestos-merida-cookie-consent'
const CONSENT_EVENT = 'repuestos-merida:cookie-consent'

// Consent Mode v2 — actualiza las señales de Google según la decisión del usuario.
// El estado por defecto (denied) se fija en app/layout.js para servicios de medicion/anuncios.
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
  const [showRejectedWarning, setShowRejectedWarning] = useState(false)

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(STORAGE_KEY)
    setConsent(savedConsent)
    setShowDialog(!savedConsent)
    setShowRejectedWarning(savedConsent === 'rejected')
    if (savedConsent === 'accepted') updateConsent(true)
  }, [])

  const choose = (value) => {
    window.localStorage.setItem(STORAGE_KEY, value)
    setConsent(value)
    setShowDialog(false)
    setShowRejectedWarning(value === 'rejected')
    updateConsent(value === 'accepted')
    window.dispatchEvent(new Event(CONSENT_EVENT))
  }

  useEffect(() => {
    if (consent !== 'rejected' || showDialog || showRejectedWarning) return

    const timeoutId = window.setTimeout(() => {
      setShowRejectedWarning(true)
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [consent, showDialog, showRejectedWarning])

  return (
    <>
      {/* Aqui solo gestionamos el consentimiento. Los servicios de anuncios se
          activan desde configuracion cuando el sitio este aprobado. */}
      {showDialog && (
        <section
          className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-gray-700 bg-gray-950 p-5 text-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-title"
        >
          <h2 id="cookie-title" className="text-lg font-bold">
            Uso de cookies
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            Usamos cookies necesarias para el funcionamiento del sitio. Con tu permiso, los
            servicios opcionales registran la cantidad de visitas a la página principal y el tiempo
            promedio que permanece abierta; también pueden usarse para anuncios. No guardamos tu
            nombre, teléfono ni otros datos personales. Consulta nuestra{' '}
            <Link className="text-yellow-300 underline" href="/politica-cookies">
              Política de Cookies
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="rounded-lg border border-gray-500 px-4 py-2 text-sm font-semibold hover:bg-gray-800"
            >
              Rechazar opcionales
            </button>
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="rounded-lg bg-[#FFD700] px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-400"
            >
              Aceptar
            </button>
          </div>
        </section>
      )}

      {!showDialog && consent === 'rejected' && showRejectedWarning && (
        <section
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border-2 border-red-500 bg-red-950 p-4 text-white shadow-2xl"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-xl font-black"
              aria-hidden="true"
            >
              !
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-100">Cookies opcionales desactivadas</p>
              <p className="mt-1 text-sm leading-5 text-red-100/85">
                El servicio básico seguirá funcionando, pero la publicidad y algunas funciones de
                medición no estarán disponibles. Puedes cambiar tu decisión en cualquier momento.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowRejectedWarning(false)}
                  className="rounded-lg border border-red-300/60 px-4 py-2 text-sm font-semibold hover:bg-red-900"
                >
                  Condiderar
                </button>
                <button
                  type="button"
                  onClick={() => choose('accepted')}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-50"
                >
                  Aceptar cookies
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* {!showDialog && consent && (
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="fixed bottom-3 left-3 z-[90] rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-md hover:bg-gray-100"
          aria-label="Cambiar preferencias de cookies"
        >
          Cookies
        </button>
      )} */}
    </>
  )
}
