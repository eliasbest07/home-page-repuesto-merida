'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ensureSession, saveSession } from '@/lib/rifaSession'
import { auth } from '@/lib/firebase'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

// WhatsApp oficial del bot (donde el Oso escucha y responde el enlace).
const WA_OFICIAL = '584123375417'
function waOficialUrl(mensaje) {
  return `https://wa.me/${WA_OFICIAL}?text=${encodeURIComponent(mensaje)}`
}

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function loginOriginFromRedirect(redirect) {
  const value = String(redirect || '/').toLowerCase()

  if (value.includes('/plaza')) return 'Plaza'
  if (value.includes('/bingo')) return 'Bingo'
  if (value.includes('/rifa')) return 'Rifa'
  if (value.includes('/solicitados')) return 'Solicitados'
  if (value.includes('crear-solicitud')) return 'Solicitud de repuesto'
  if (value.includes('moto-taxi') || value.includes('mototaxi')) return 'Moto Taxi'
  if (value.includes('/directorio')) return 'Directorio'
  if (value.includes('/registro')) return 'Registro'

  return 'Página principal'
}

function loginMessage(redirect) {
  const origin = loginOriginFromRedirect(redirect)
  return `Hola Oso, quiero iniciar sesión en Repuestos Mérida desde ${origin}. Mándame el link, por favor.`
}

function googleLoginMessage(redirect, user) {
  const origin = loginOriginFromRedirect(redirect)
  const name = user?.displayName || user?.email || 'mi cuenta de Google'
  return `Hola Oso, inicié con Google (${name}) en Repuestos Mérida desde ${origin}. Verifica mi WhatsApp y mándame el link, por favor.`
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Cargando…</div>}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const redirect      = safeRedirect(searchParams.get('redirect'))
  const origin        = loginOriginFromRedirect(redirect)
  const message       = loginMessage(redirect)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  useEffect(() => {
    let cancelled = false

    const checkSession = () => ensureSession().then((s) => {
      if (cancelled) return
      if (!s?.telefono) return
      if (!s.perfil) router.replace(`/registro?redirect=${encodeURIComponent(redirect)}`)
      else router.replace(redirect)
    })

    checkSession()
    const intervalId = window.setInterval(checkSession, 2000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [router, redirect])

  async function loginWithGoogle() {
    setGoogleError('')
    setGoogleLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const credential = await signInWithPopup(auth, provider)
      const user = credential.user
      const idToken = await user.getIdToken()

      // Si esta cuenta de Google ya tiene un WhatsApp vinculado, entra directo
      // sin volver a pedir verificación por WhatsApp.
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.ok && data.linked && data.token) {
          saveSession({
            telefono: data.telefono,
            perfil: data.perfil,
            prefill: data.prefill || null,
            rifas_vendedor: data.rifas_vendedor || [],
            token: data.token,
            expiresAt: data.expiresAt,
          })
          if (!data.perfil) router.replace(`/registro?redirect=${encodeURIComponent(redirect)}`)
          else router.replace(redirect)
          return
        }
      } catch {
        // Si falla el atajo, seguimos con la verificación por WhatsApp.
      }

      try {
        localStorage.setItem('login_redirect', redirect)
        localStorage.setItem('login_google_pending', JSON.stringify({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          idToken,
          at: Date.now(),
        }))
      } catch {}
      window.location.href = waOficialUrl(googleLoginMessage(redirect, user))
    } catch (error) {
      setGoogleError(error?.message || 'No se pudo iniciar con Google.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50 flex flex-col">
      <nav className="bg-gray-900 h-14 flex items-center px-4 shadow-lg">
        <Link href="/" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Inicio
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100">
          <div className="flex flex-col items-center text-center mb-6">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={80} height={80} className="rounded-2xl shadow-md mb-3" />
            <h1 className="text-2xl sm:text-3xl font-bold font-brand text-gray-900">Repuestos Mérida</h1>
            <p className="text-sm text-gray-500 mt-1">Inicia sesión con tu WhatsApp.</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Pulsa el botón: se abrirá WhatsApp con un mensaje listo. Envíalo y el
              Oso te responderá con un enlace. Ábrelo y entrarás automáticamente.
            </p>
            <p className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800">
              Origen: {origin}
            </p>
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {googleLoading ? 'Abriendo Google...' : 'Iniciar sesión con Google'}
            </button>
            {googleError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {googleError}
              </p>
            )}
            <a
              href={waOficialUrl(message)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { try { localStorage.setItem('login_redirect', redirect) } catch {} }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
              </svg>
              Iniciar sesión por WhatsApp
            </a>
            <p className="text-xs text-gray-500 text-center">
              Con Google también se abrirá WhatsApp para verificar tu número con el bot oficial (+{WA_OFICIAL}).
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 13.89a6 6 0 0 1 0-3.78V7.52H3.05a10 10 0 0 0 0 8.96l3.35-2.59z" />
      <path fill="#EA4335" d="M12 5.99c1.47 0 2.8.51 3.84 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.35 2.59C7.2 7.75 9.4 5.99 12 5.99z" />
    </svg>
  )
}
