'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const API_BASE = 'https://uncandid-overmighty-jodie.ngrok-free.dev'
const HEADERS  = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }

// ── Sesión en localStorage ──────────────────────────────────────────────────
export function saveSession(whatsapp, token) {
  localStorage.setItem('plaza_session', JSON.stringify({
    whatsapp, token, at: Date.now(),
  }))
}
export function getSession() {
  try {
    const raw = localStorage.getItem('plaza_session')
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
export function clearSession() { localStorage.removeItem('plaza_session') }
export function isLoggedIn()   { return Boolean(getSession()?.token) }

// ─────────────────────────────────────────────────────────────────────────────

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const redirect      = searchParams.get('redirect') || '/plaza/publicar'

  const [step,    setStep]    = useState('phone')   // 'phone' | 'otp' | 'done'
  const [phone,   setPhone]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  // ── Paso 1: solicitar OTP ─────────────────────────────────────────────────
  async function sendOtp() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/solicitar-otp`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ telefono: phone.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error || `Error ${res.status}`)
      setStep('otp')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Paso 2: verificar OTP ─────────────────────────────────────────────────
  async function verifyOtp() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/verificar-otp`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ telefono: phone.trim(), codigo: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      saveSession(phone.trim(), data.token)
      setStep('done')
      setTimeout(() => router.push(redirect), 900)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 h-14 flex items-center px-4 shadow-lg">
        <Link href="/plaza" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Plaza
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-14">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="text-center mb-8">
            <Image src="/iconorm.png" alt="Logo" width={64} height={64} className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow" />
            <h1 className="font-bold text-xl text-gray-900">Inicia sesión en Plaza</h1>
            <p className="text-gray-500 text-sm mt-1">
              {step === 'phone' && 'Verificamos tu número por WhatsApp'}
              {step === 'otp'   && `Enviamos un código a ${phone}`}
              {step === 'done'  && '¡Verificado!'}
            </p>
          </div>

          {/* ── STEP: phone ── */}
          {step === 'phone' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tu número de WhatsApp
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">🇻🇪</span>
                  <input
                    type="tel"
                    className={FIELD + ' pl-8'}
                    placeholder="+58 424 000 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && phone.trim() && sendOtp()}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                onClick={sendOtp}
                disabled={!phone.trim() || loading}
                className="w-full bg-gray-900 text-yellow-400 font-bold py-3 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                  : <>Enviar código por WhatsApp <span>→</span></>
                }
              </button>
            </div>
          )}

          {/* ── STEP: otp ── */}
          {step === 'otp' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex gap-2 text-sm text-green-800">
                <span>✅</span>
                <span>Código enviado por WhatsApp. Revisa tus mensajes.</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Código de verificación
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={FIELD + ' text-center text-2xl tracking-widest font-bold'}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && verifyOtp()}
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                onClick={verifyOtp}
                disabled={otp.length !== 6 || loading}
                className="w-full bg-yellow-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                  : 'Verificar código ✓'
                }
              </button>

              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
                className="w-full text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                Cambiar número
              </button>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-bold text-gray-900">¡Verificado!</p>
              <p className="text-gray-500 text-sm mt-1">Redirigiendo…</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function LoginFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 h-14 flex items-center px-4 shadow-lg">
        <Link href="/plaza" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Plaza
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 pt-14">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Image src="/iconorm.png" alt="Logo" width={64} height={64} className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow" />
            <h1 className="font-bold text-xl text-gray-900">Inicia sesión en Plaza</h1>
            <p className="text-gray-500 text-sm mt-1">Cargando acceso…</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-center py-6">
              <span className="w-6 h-6 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
