'use client'

import Link from 'next/link'
import Script from 'next/script'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'repuestos-merida-cookie-consent'

export default function CookieConsent() {
  const [consent, setConsent] = useState(null)
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(STORAGE_KEY)
    setConsent(savedConsent)
    setShowDialog(!savedConsent)
  }, [])

  const choose = (value) => {
    window.localStorage.setItem(STORAGE_KEY, value)
    setConsent(value)
    setShowDialog(false)
  }

  return (
    <>
      {consent === 'accepted' && (
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6503077569219292"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}

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
            Usamos cookies necesarias para el funcionamiento del sitio. Con tu permiso, Google
            AdSense también puede usar cookies para mostrar y medir anuncios. Consulta nuestra{' '}
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

      {!showDialog && consent && (
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
