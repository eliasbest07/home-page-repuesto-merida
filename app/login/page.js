'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ensureSession } from '@/lib/rifaSession'

// WhatsApp oficial del bot (donde el Oso escucha y responde el enlace).
const WA_OFICIAL = '584123375417'
const MSG_LOGIN = 'Hola Oso, quiero iniciar sesión en Repuestos Mérida. Mándame el link, por favor.'
function waOficialUrl(mensaje) {
  return `https://wa.me/${WA_OFICIAL}?text=${encodeURIComponent(mensaje)}`
}

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
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

  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) return
      if (!s.perfil) router.replace(`/registro?redirect=${encodeURIComponent(redirect)}`)
      else router.replace(redirect)
    })
  }, [router, redirect])

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
            <a
              href={waOficialUrl(MSG_LOGIN)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
              </svg>
              Iniciar sesión por WhatsApp
            </a>
            <p className="text-xs text-gray-500 text-center">
              Se abrirá un chat con nuestro WhatsApp oficial (+{WA_OFICIAL}).
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
