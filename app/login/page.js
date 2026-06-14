'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { saveSession, ensureSession } from '@/lib/rifaSession'
import { buildWhatsAppRequest } from '@/lib/whatsappClient'

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-base w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'

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

  const [step, setStep]       = useState('phone')
  const [phone, setPhone]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) return
      if (!s.perfil) router.replace(`/registro?redirect=${encodeURIComponent(redirect)}`)
      else router.replace(redirect)
    })
  }, [router, redirect])

  async function pedirCodigo() {
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/rifa/enviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await buildWhatsAppRequest({
          telefono: phone.trim(),
          intent: 'login',
        })),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el código.')
      setStep('otp')
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }

  async function verificarCodigo() {
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/rifa/verificar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await buildWhatsAppRequest({
          telefono: phone.trim(),
          codigo: otp.trim(),
          intent: 'login',
        })),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')

      saveSession({
        telefono: data.telefono,
        perfil: data.perfil,
        rifas_vendedor: data.rifas_vendedor || [],
        token: data.token,
        expiresAt: data.expiresAt,
      })

      if (!data.perfil) router.replace(`/registro?redirect=${encodeURIComponent(redirect)}`)
      else router.replace(redirect)
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
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
            <p className="text-sm text-gray-500 mt-1">Ingresa con tu WhatsApp para continuar.</p>
          </div>

          {step === 'phone' && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Tu número de WhatsApp</span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+58 424 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={FIELD}
                  autoFocus
                />
              </label>
              <button
                onClick={pedirCodigo}
                disabled={loading || !phone.trim()}
                className="btn-brand w-full justify-center gap-2"
              >
                {loading && <Spinner />}
                {loading ? 'Enviando código…' : 'Recibir código por WhatsApp'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Te enviamos un código de 4 dígitos por WhatsApp al <b>{phone.trim()}</b>. Escríbelo aquí para entrar.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className={`${FIELD} text-center tracking-[0.5em] text-3xl font-bold`}
                autoFocus
              />
              <button
                onClick={verificarCodigo}
                disabled={loading || otp.length !== 4}
                className="btn-brand w-full justify-center gap-2"
              >
                {loading && <Spinner />}
                {loading ? 'Verificando...' : 'Verificar y entrar'}
              </button>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cambiar número
              </button>
              <button
                onClick={pedirCodigo}
                disabled={loading}
                className="block w-full text-center text-sm font-semibold text-green-600 hover:text-green-700 disabled:opacity-50"
              >
                Reenviar código
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">
              {error}
            </div>
          )}
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-3 max-w-xs">
            <Spinner big />
            <div className="text-sm font-semibold text-gray-800">
              Verificando código…
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Spinner({ big }) {
  const sz = big ? 'w-6 h-6' : 'w-5 h-5'
  return (
    <svg className={`${sz} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4"/>
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  )
}
