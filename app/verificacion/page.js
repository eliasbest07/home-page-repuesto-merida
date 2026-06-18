'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ensureSession } from '@/lib/rifaSession'

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/verificacion')) return '/'
  return value
}

export default function VerificacionPage() {
  return (
    <Suspense fallback={<Shell texto="Cargando…" />}>
      <VerificacionInner />
    </Suspense>
  )
}

function VerificacionInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const required = params.get('required') === '1'
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ensureSession().then(async (current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent(`/verificacion?redirect=${redirect}`)}`)
        return
      }
      setSession(current)
      try {
        const res = await fetch('/api/verificacion/edad', {
          headers: { Authorization: `Bearer ${current.token}` },
          cache: 'no-store',
        })
        const data = await res.json()
        if (!cancelled) setStatus(res.ok ? data : { estado: 'sin_verificar' })
      } catch {
        if (!cancelled) setStatus({ estado: 'sin_verificar' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [redirect, router])

  if (!session || loading) return <Shell texto="Verificando sesión…" />

  const estado = status?.estado || 'sin_verificar'
  const label = {
    sin_verificar: 'Sin verificar',
    pendiente: 'En revisión',
    aprobado: 'Verificado',
    rechazado: 'Requiere corrección',
  }[estado] || 'Sin verificar'

  return (
    <div className="min-h-screen bg-[#f5f7f9] text-gray-900">
      <nav className="flex h-14 items-center justify-between bg-gray-950 px-4 text-white shadow-lg">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
          <Image src="/iconorm.png" alt="" width={28} height={28} className="rounded-md" />
          Repuestos Mérida
        </Link>
        <Link href={redirect} className="text-sm font-semibold text-gray-300 hover:text-white">
          Continuar
        </Link>
      </nav>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-8">
        <section className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Cuenta iniciada</p>
            <h1 className="mt-2 font-brand text-2xl leading-tight text-gray-950">Verificación de edad</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Puedes verificar tu edad subiendo una foto de tu cédula y una selfie sosteniendo la cédula.
            </p>
            {required && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-relaxed text-amber-900">
                Para vender o publicar anuncios necesitas completar la verificación.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500">Estado</p>
            <p className="mt-1 text-sm font-extrabold text-gray-950">{label}</p>
            {estado === 'rechazado' && status?.rechazado_motivo && (
              <p className="mt-1 text-xs text-red-600">{status.rechazado_motivo}</p>
            )}
          </div>

          <div className="mt-5 grid gap-3">
            {estado !== 'aprobado' && (
              <Link
                href={`/verificacion/edad?redirect=${encodeURIComponent(redirect)}${required ? '&required=1' : ''}`}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300"
              >
                {estado === 'pendiente' ? 'Reenviar documentos' : 'Verificar edad'}
              </Link>
            )}
            {(!required || estado === 'aprobado') && (
              <Link
                href={redirect}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                {estado === 'aprobado' ? 'Continuar' : 'Continuar sin verificar'}
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Shell({ texto }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7f9] p-4">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm font-semibold text-gray-600 shadow-sm">
        {texto}
      </div>
    </div>
  )
}
