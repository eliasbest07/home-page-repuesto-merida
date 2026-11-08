'use client'

// Botón «Usar»: abre la app si ya está instalada y, si no, la tienda.
//  - Android: un intent:// que Chrome resuelve solo; si la app no está (o es
//    una versión sin el esquema repuestosmerida://), cae en Google Play.
//  - iPhone: prueba el esquema; si en 1,6 s la página sigue a la vista es que
//    no se abrió nada, y va a App Store.
//  - Computador: Google Play (el enlace normal del botón).
// La app acepta repuestosmerida://abrir desde la versión que trae el
// intent-filter (Android) y CFBundleURLSchemes (iOS).

const ESQUEMA = 'repuestosmerida://abrir'
const PAQUETE = 'com.btmstudio.rep_merida'

export default function BotonUsar({ playUrl, appStoreUrl }) {
  function abrir(evento) {
    const ua = navigator.userAgent
    if (/Android/i.test(ua)) {
      evento.preventDefault()
      window.location.href = `intent://abrir#Intent;scheme=repuestosmerida;package=${PAQUETE};S.browser_fallback_url=${encodeURIComponent(playUrl)};end`
      return
    }
    const esIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    if (esIos) {
      evento.preventDefault()
      const reloj = setTimeout(() => {
        if (!document.hidden) window.location.href = appStoreUrl
      }, 1600)
      const cancelar = () => clearTimeout(reloj)
      document.addEventListener('visibilitychange', cancelar, { once: true })
      window.addEventListener('pagehide', cancelar, { once: true })
      window.location.href = ESQUEMA
    }
  }

  return (
    <a
      href={playUrl}
      onClick={abrir}
      aria-label="Usar Repuestos Mérida App: la abre si ya la tienes o te lleva a la tienda"
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-green-700 px-8 text-lg font-bold text-white shadow-[0_10px_24px_-10px_rgba(21,128,61,0.9)] transition-colors hover:bg-green-800 sm:w-auto sm:justify-self-start"
    >
      Usar
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="currentColor">
        <path d="M10.6 4.2a.8.8 0 0 1 1.1 0l5.2 5.2a.8.8 0 0 1 0 1.2l-5.2 5.2a.8.8 0 1 1-1.1-1.2l3.8-3.8H3.8a.8.8 0 0 1 0-1.6h10.6l-3.8-3.8a.8.8 0 0 1 0-1.2Z" />
      </svg>
    </a>
  )
}
