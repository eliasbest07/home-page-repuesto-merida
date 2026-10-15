'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.btmstudio.rep_merida'
const APP_STORE_URL = 'https://apps.apple.com/app/repuestos-m%C3%A9rida-app/id6783600411'

// Rutas con botones flotantes propios abajo (chat de Plaza) donde el banner estorbaría.
const HIDDEN_PREFIXES = ['/plaza']

// iPhone/iPod/iPad (incluye iPadOS, que se reporta como Mac con pantalla táctil).
// Safari en iOS cae aquí; cualquier navegador iOS debe ir al App Store igual.
function detectPlatform() {
  const ua = navigator.userAgent || ''
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return null
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.84c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z" />
    </svg>
  )
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="#00D7FE" d="M3.6 2.2c-.3.3-.4.7-.4 1.3v17c0 .6.2 1 .4 1.3l.1.1 9.5-9.5v-.2L3.7 2.1l-.1.1z" />
      <path fill="#FFCE00" d="M16.4 15.6l-3.2-3.2v-.2l3.2-3.2.1.1 3.8 2.1c1.1.6 1.1 1.6 0 2.2l-3.8 2.1-.1.1z" />
      <path fill="#FF3A44" d="M16.5 15.5l-3.3-3.2-9.6 9.5c.4.4 1 .4 1.6.1l11.3-6.4" />
      <path fill="#00F076" d="M16.5 9.1L5.2 2.7c-.7-.4-1.2-.3-1.6.1l9.6 9.5 3.3-3.2z" />
    </svg>
  )
}

export default function AppDownloadBanner() {
  const pathname = usePathname() || '/'
  const [platform, setPlatform] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const p = detectPlatform()
    if (!p) return
    setPlatform(p)

    // El banner aparece con el primer scroll del usuario (o de inmediato si la
    // página ya carga desplazada, p. ej. al volver atrás).
    if (window.scrollY > 0) {
      setVisible(true)
      return
    }
    const onFirstScroll = () => setVisible(true)
    window.addEventListener('scroll', onFirstScroll, { passive: true, once: true })
    return () => window.removeEventListener('scroll', onFirstScroll)
  }, [])

  if (!visible || !platform) return null
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null

  // Cerrar solo oculta el banner en esta carga; al recargar la página vuelve a aparecer.
  const close = () => setVisible(false)

  const isIOS = platform === 'ios'
  const href = isIOS ? APP_STORE_URL : GOOGLE_PLAY_URL

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[2147483647] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="region"
      aria-label="Descargar la app de Repuestos Mérida"
    >
      <div className="app-banner-enter relative flex items-center gap-3 rounded-2xl border border-gray-700 bg-gray-900 p-3 pr-10 text-white shadow-2xl">
        <img src="/iconorm.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-brand text-sm leading-tight">Repuestos Mérida</p>
          <p className="text-xs text-gray-400 leading-tight">Tu repuesto, disponible ahora</p>
        </div>
        <span className="app-badge-pop shrink-0">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isIOS ? 'Descargar en el App Store' : 'Disponible en Google Play'}
            className="app-badge-glow block active:scale-95 transition-transform"
          >
            <span className="flex items-center gap-1.5 rounded-[0.5rem] bg-black px-2.5 py-1.5 text-white">
              {isIOS ? <AppleLogo /> : <PlayLogo />}
              <span className="text-left leading-none">
                <span className="block text-[9px] uppercase tracking-wide text-gray-300">
                  {isIOS ? 'Descárgalo en el' : 'Disponible en'}
                </span>
                <span className="block text-sm font-semibold">{isIOS ? 'App Store' : 'Google Play'}</span>
              </span>
            </span>
          </a>
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
