'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage'
import { firestore, storage } from '../../../lib/firebase'

const PlazaChat = dynamic(() => import('../../components/PlazaChat'), { ssr: false })

const CATEGORIAS = [
  'Gastronomía', 'Salud', 'Electrónica', 'Electrodomésticos',
  'Hogar', 'Deportes', 'Ventas/Marketing', 'Atención al Cliente',
  'Servicios', 'General', 'Otros',
]

const TIPOS = [
  { value: 'vende',          label: '🏷️ Vendo algo' },
  { value: 'ofrece_servicio',label: '🔧 Ofrezco un servicio' },
  { value: 'empleo_oferta',  label: '💼 Ofrezco empleo' },
  { value: 'busca',          label: '🔍 Busco algo / solicito' },
]

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1.5'

// Lee un File y devuelve { dataUrl, name }
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve({ dataUrl: reader.result, name: file.name })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function PublicarPage() {
  const router = useRouter()

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const [session,     setSession]     = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('plaza_session') || 'null')
      if (!s?.token) { router.replace('/plaza/login?redirect=/plaza/publicar'); return }
      setSession(s)
    } catch {
      router.replace('/plaza/login?redirect=/plaza/publicar'); return
    }
    setAuthChecked(true)
  }, [router])

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step,      setStep]      = useState(1)
  const [sending,   setSending]   = useState(false)
  const [apiError,  setApiError]  = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [newId,     setNewId]     = useState(null)

  const [form, setForm] = useState({
    tipo: '', titulo: '', descripcion: '', precio: '', categoria: '',
  })
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const canNext = form.tipo && form.titulo.trim() && form.descripcion.trim() && form.precio && form.categoria

  // ── Fotos ───────────────────────────────────────────────────────────────────
  const [fotos, setFotos]   = useState([])   // [{ preview, dataUrl, name }]
  const fileRef             = useRef(null)

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    Promise.all(files.slice(0, 3 - fotos.length).map(readFileAsDataUrl))
      .then(results => setFotos(prev => [...prev, ...results].slice(0, 3)))
    e.target.value = ''
  }

  function removePhoto(i) {
    setFotos(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Submit → Firestore + Storage ────────────────────────────────────────────
  async function handleSubmit() {
    if (!session) return
    setSending(true)
    setApiError(null)

    try {
      const telefono = session.whatsapp || session.telefono || ''

      // 1. Crear documento en Firestore
      const docRef = await addDoc(collection(firestore, 'anuncios'), {
        tipo:        form.tipo,
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        precio:      Number(form.precio),
        categoria:   form.categoria,
        disponible:  true,
        prioridad:   'media',
        telefono,
        whatsapp:    telefono,
        vendedor:    telefono,
        redes:       [],
        pagos:       [],
        imagen_url:  null,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      })

      setNewId(docRef.id)

      // 2. Subir imagen a Firebase Storage si existe
      if (fotos.length > 0) {
        const ext   = fotos[0].name.split('.').pop() || 'jpg'
        const path  = `imagenes_anuncios/${docRef.id}.${ext}`
        const imgRef = storageRef(storage, path)
        await uploadString(imgRef, fotos[0].dataUrl, 'data_url')
        const url = await getDownloadURL(imgRef)
        // actualizar el campo imagen_url (import updateDoc en el bloque siguiente)
        const { updateDoc, doc } = await import('firebase/firestore')
        await updateDoc(doc(firestore, 'anuncios', docRef.id), { imagen_url: url })
      }

      setSubmitted(true)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSending(false)
    }
  }

  // ── Loading / auth ──────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
      </div>
    )
  }

  // ── Éxito ───────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 h-14 flex items-center px-4 shadow-lg">
          <Link href="/plaza" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Volver a Plaza
          </Link>
        </nav>
        <div className="flex-1 flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto mb-6">✅</div>
            <h1 className="font-bold text-2xl text-gray-900 mb-3">¡Publicación enviada!</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Tu publicación <strong>&ldquo;{form.titulo}&rdquo;</strong> fue creada correctamente
              {newId && <span className="text-gray-400"> (#{newId})</span>}.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left text-sm text-yellow-900 mb-6">
              <p className="font-semibold mb-1">¿Qué sigue?</p>
              <ul className="space-y-1 text-xs">
                <li>✔ Revisión manual por el equipo Plaza</li>
                <li>✔ Aprobación o solicitud de correcciones</li>
                <li>✔ Tu publicación aparece en el feed de Plaza</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Link
                href="/plaza"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-900 text-yellow-400 font-bold px-6 py-3 rounded-xl hover:bg-gray-700 transition-all text-sm"
              >
                ← Ver Plaza
              </Link>
              <button
                onClick={() => { setSubmitted(false); setStep(1); setForm({ tipo:'', titulo:'', descripcion:'', precio:'', categoria:'' }); setFotos([]) }}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                + Otro anuncio
              </button>
            </div>
          </div>
        </div>
        <PlazaChat />
      </div>
    )
  }

  // ── Formulario ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 h-14 flex items-center px-4 justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/plaza" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Plaza
          </Link>
          <span className="text-gray-600">·</span>
          <span className="text-white font-semibold text-sm">Nueva publicación</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {[1, 2].map((s) => (
            <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px]
              ${step === s ? 'bg-yellow-400 text-gray-900' : step > s ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {step > s ? '✓' : s}
            </div>
          ))}
          <span className="ml-1">Paso {step} de 2</span>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 pt-24 pb-16">

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            <h2 className="font-bold text-xl text-gray-900 mb-1">¿Qué vas a publicar?</h2>
            <p className="text-gray-500 text-sm mb-6">Completa los datos de tu anuncio.</p>

            <div className="border-2 border-yellow-400 bg-yellow-50 rounded-xl px-4 py-3 mb-6 flex gap-2.5 items-start">
              <img src="/iconorm.png" alt="Oso" className="w-8 h-8 rounded-full shrink-0 object-cover" />
              <p className="text-sm text-yellow-900">
                <strong>Oso Frontino Brain:</strong> Los títulos descriptivos consiguen más respuestas.
                Ejemplo: <em>&ldquo;iPhone 12 128GB negro — excelente estado&rdquo;</em>
              </p>
            </div>

            <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

              {/* Tipo */}
              <div>
                <label className={LABEL}>Tipo de publicación *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: value }))}
                      className={`text-left text-sm px-3 py-2.5 rounded-xl border-2 transition-all font-medium
                        ${form.tipo === value
                          ? 'border-yellow-400 bg-yellow-50 text-gray-900'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className={LABEL}>Título *</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="Ej: Lavadora Samsung 20kg, poco uso"
                  value={form.titulo}
                  onChange={set('titulo')}
                  maxLength={100}
                />
                <p className="text-xs text-gray-400 mt-1">{form.titulo.length}/100</p>
              </div>

              {/* Descripción */}
              <div>
                <label className={LABEL}>Descripción *</label>
                <textarea
                  rows={4}
                  className={FIELD}
                  placeholder="Detalla el estado, marca, modelo, características…"
                  value={form.descripcion}
                  onChange={set('descripcion')}
                />
              </div>

              {/* Precio + Categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Precio ($) *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={FIELD + ' pl-7'}
                      placeholder="0.00"
                      value={form.precio}
                      onChange={set('precio')}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Categoría *</label>
                  <select className={FIELD} value={form.categoria} onChange={set('categoria')}>
                    <option value="">Seleccionar…</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button
              onClick={() => canNext && setStep(2)}
              disabled={!canNext}
              className="mt-6 w-full bg-gray-900 text-yellow-400 font-bold py-3.5 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente → Fotos
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <h2 className="font-bold text-xl text-gray-900 mb-1">Agrega fotos</h2>
            <p className="text-gray-500 text-sm mb-6">Las fotos aumentan las chances de que te contacten.</p>

            <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

              {/* Fotos */}
              <div>
                <label className={LABEL}>Fotos (máx. 3)</label>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleFileChange} />
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                      <img src={f.dataUrl} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/80"
                      >×</button>
                    </div>
                  ))}
                  {fotos.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                    >
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-[10px] text-gray-400">Agregar foto</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG o WebP · Máx. 5MB · La primera foto es la principal</p>
              </div>

              {/* Info sesión */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2.5">
                <span className="text-lg">📋</span>
                <div className="text-sm text-blue-900">
                  <p className="font-semibold">Publicando como {session?.whatsapp || session?.telefono}</p>
                  <p className="text-xs mt-0.5 text-blue-700">Los interesados te contactarán por WhatsApp a ese número.</p>
                </div>
              </div>

              {/* Error */}
              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  ⚠️ {apiError}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setStep(1); setApiError(null) }}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                ← Volver
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className="flex-1 bg-yellow-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-300 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending
                  ? <><span className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> Enviando…</>
                  : 'Publicar ✓'
                }
              </button>
            </div>
          </div>
        )}
      </main>

      <PlazaChat />
    </div>
  )
}
