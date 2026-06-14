'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { saveSession } from '@/lib/rifaSession'

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/solicitados'
  if (!value.startsWith('/') || value.startsWith('//')) return '/solicitados'
  return value
}

export default function MagicPage() {
  return (
    <Suspense fallback={<Estado texto="Validando enlace…" />}>
      <MagicInner />
    </Suspense>
  )
}

function MagicInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const token = params.get('token')
    if (!token) { setError('Enlace inválido.'); return }
    ;(async () => {
      try {
        const res = await fetch('/api/auth/magic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo validar el enlace.')

        saveSession({
          telefono: data.telefono,
          perfil: data.perfil,
          rifas_vendedor: data.rifas_vendedor || [],
          token: data.token,
          expiresAt: data.expiresAt,
        })

        const dest = safeRedirect(data.redirect)
        // Si no tiene perfil, primero registro (y de ahí al debate).
        if (!data.perfil) {
          router.replace(`/registro?redirect=${encodeURIComponent(dest)}`)
        } else {
          router.replace(dest)
        }
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [params, router])

  if (error) {
    return (
      <Estado
        texto={error}
        error
        extra={
          <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-green-600 hover:text-green-700">
            Ir a iniciar sesión
          </Link>
        }
      />
    )
  }
  return <Estado texto="Iniciando tu sesión…" />
}

function Estado({ texto, error, extra }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
        {!error && (
          <svg className="w-8 h-8 animate-spin mx-auto mb-4 text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
        <p className={`text-sm font-semibold ${error ? 'text-red-600' : 'text-gray-700'}`}>{texto}</p>
        {extra}
      </div>
    </div>
  )
}
