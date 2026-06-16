'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { rtdb, storage } from '@/lib/firebase'
import { ref as dbRef, set, serverTimestamp } from 'firebase/database'
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { saveSession, phoneKey, clearSession, ensureSession } from '@/lib/rifaSession'

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-base w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export default function RegistroPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Cargando…</div>}>
      <RegistroInner />
    </Suspense>
  )
}

function RegistroInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = safeRedirect(searchParams.get('redirect'))

  const [session, setSessionState] = useState(null)
  const [nombre, setNombre]       = useState('')
  const [fotoFile, setFotoFile]   = useState(null)
  const [fotoPreview, setPreview] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [step, setStep]           = useState('')
  const [error, setError]         = useState(null)
  const [coords, setCoords]       = useState(null)
  const [pickerOpen, setPicker]   = useState(false)

  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) { router.replace(`/login?redirect=${encodeURIComponent('/registro?redirect=' + redirect)}`); return }
      if (s.perfil) { router.replace(redirect); return }
      setSessionState(s)
      // Prellenar con la info ya guardada/oficial recuperada por el login.
      const p = s.prefill
      if (p) {
        if (p.nombre) setNombre(p.nombre)
        if (p.foto_url) setPreview(p.foto_url)
        if (p.lat != null && p.lng != null) setCoords({ lat: p.lat, lng: p.lng })
      }
    })
  }, [router, redirect])

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function guardar() {
    setError(null); setLoading(true); setStep('validando')
    try {
      if (!nombre.trim()) throw new Error('Ingresa tu nombre')
      if (!coords) throw new Error('Elige tu ubicación en el mapa')
      if (!session?.telefono) throw new Error('Sesión inválida')

      const key = phoneKey(session.telefono)
      // Conserva la foto oficial/recuperada si el usuario no sube una nueva.
      let foto_url = session.prefill?.foto_url || null

      if (fotoFile) {
        const ext = (fotoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const stPath = `rifas_usuarios/${key}.${ext}`

        setStep('subiendo')
        const snap = await Promise.race([
          uploadBytes(stRef(storage, stPath), fotoFile),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo agotado subiendo foto.')), 30000)),
        ])
        setStep('url')
        foto_url = await getDownloadURL(snap.ref)
      }

      setStep('guardando')
      const perfil = {
        telefono: session.telefono,
        whatsapp: session.telefono,
        nombre: nombre.trim(),
        lat: coords.lat,
        lng: coords.lng,
        foto_url,
        // Enlaza con el registro oficial de /users si el login lo encontró.
        ...(session.prefill?.uid ? { uid: session.prefill.uid } : {}),
        creado_en: serverTimestamp(),
      }
      await Promise.race([
        set(dbRef(rtdb, `rifas_usuarios/${key}`), perfil),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo agotado guardando perfil.')), 15000)),
      ])

      setStep('listo')
      saveSession({ ...session, prefill: null, perfil: { ...perfil, creado_en: Date.now() } })
      router.replace(redirect)
    } catch (e) {
      setError(e.message || 'No se pudo guardar el perfil')
      setLoading(false)
      setStep('')
    }
  }

  const iniciales = (nombre || '').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).filter(Boolean).join('') || '?'

  const stepLabel = {
    validando: 'Validando datos…',
    subiendo:  'Subiendo foto…',
    url:       'Procesando imagen…',
    guardando: 'Guardando perfil…',
    listo:     '¡Listo!…',
  }[step] || 'Guardando…'

  function salir() {
    clearSession()
    router.replace('/login')
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50">
      <nav className="bg-gray-900 h-14 flex items-center justify-between px-4 shadow-lg">
        <Link href="/login" className="text-gray-400 hover:text-white text-sm">← Atrás</Link>
        <button onClick={salir} className="text-gray-400 hover:text-white text-sm">Salir</button>
      </nav>

      <main className="flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold font-brand text-gray-900">Completa tu perfil</h1>
            <p className="text-sm text-gray-500 mt-1">Estos datos solo se usan para identificarte.</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <label className="cursor-pointer group relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-emerald-500 border-2 border-white shadow-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold font-brand text-white select-none">{iniciales}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white border border-gray-200 rounded-full w-7 h-7 flex items-center justify-center shadow group-hover:bg-yellow-50">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                <span className="block text-xs text-center text-gray-500 mt-2">Foto (opcional)</span>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Nombre completo</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={FIELD} placeholder="Juan Pérez" />
            </label>

            <div>
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Tu ubicación</span>
              {coords ? (
                <button
                  type="button"
                  onClick={() => setPicker(true)}
                  className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-emerald-100 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-emerald-800">Ubicación seleccionada</div>
                    <div className="text-xs font-mono text-emerald-700 mt-0.5">
                      {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                    </div>
                  </div>
                  <span className="text-xs text-emerald-700 font-semibold">Cambiar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPicker(true)}
                  className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 flex items-center justify-center gap-2 hover:border-yellow-400 hover:bg-yellow-50 transition-colors text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span className="text-sm font-semibold">Elegir en el mapa</span>
                </button>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              📱 {session.telefono}
            </div>

            <button onClick={guardar} disabled={loading} className="btn-brand w-full justify-center gap-2">
              {loading && <Spinner />}
              {loading ? stepLabel : 'Continuar'}
            </button>

            {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}
          </div>
        </div>
      </main>

      {pickerOpen && (
        <MapPicker
          initialLat={coords?.lat}
          initialLng={coords?.lng}
          onConfirm={(c) => { setCoords(c); setPicker(false) }}
          onClose={() => setPicker(false)}
        />
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-2xl px-6 py-5 shadow-2xl flex items-center gap-3 max-w-xs">
            <Spinner big />
            <div className="text-sm font-semibold text-gray-800">{stepLabel}</div>
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
