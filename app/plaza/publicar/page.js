'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PlazaChat = dynamic(() => import('../../components/PlazaChat'), { ssr: false })

const CATEGORIAS = [
  'Servicios', 'Electrónica', 'Electrodomésticos', 'Hogar', 'Deportes', 'Otros',
]

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1.5'

export default function PublicarPage() {
  const [step, setStep]        = useState(1)
  const [submitted, setSubmit] = useState(false)
  const [form, setForm]        = useState({
    titulo: '', descripcion: '', precio: '', categoria: '', contacto: '',
  })

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const canNext = form.titulo.trim() && form.descripcion.trim() && form.precio && form.categoria

  // ── Pantalla de confirmación ──
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
              Tu publicación <strong>&ldquo;{form.titulo}&rdquo;</strong> fue enviada para revisión.
              El equipo de Plaza la revisará en menos de 24 horas.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left text-sm text-yellow-900 mb-6">
              <p className="font-semibold mb-1">¿Qué sigue?</p>
              <ul className="space-y-1 text-xs">
                <li>✔ Revisión manual por el equipo Plaza</li>
                <li>✔ Aprobación o solicitud de correcciones</li>
                <li>✔ Tu publicación aparece en el feed de Plaza</li>
              </ul>
            </div>
            <Link
              href="/plaza"
              className="inline-flex items-center gap-2 bg-gray-900 text-yellow-400 font-bold px-8 py-3 rounded-xl hover:bg-gray-700 transition-all text-sm"
            >
              ← Ver Plaza
            </Link>
          </div>
        </div>
        <PlazaChat />
      </div>
    )
  }

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
            <p className="text-gray-500 text-sm mb-6">Puede ser un objeto, un servicio o cualquier cosa que quieras ofrecer.</p>

            {/* Tip Oso */}
            <div className="border-2 border-yellow-400 bg-yellow-50 rounded-xl px-4 py-3 mb-6 flex gap-2.5 items-start">
              <img src="/iconorm.png" alt="Oso" className="w-8 h-8 rounded-full shrink-0 object-cover" />
              <p className="text-sm text-yellow-900">
                <strong>Oso Frontino Brain:</strong> Los títulos descriptivos consiguen más respuestas.
                Ejemplo: <em>&ldquo;iPhone 12 128GB negro — excelente estado&rdquo;</em> o <em>&ldquo;Clases de inglés online, nivel básico&rdquo;</em>
              </p>
            </div>

            <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div>
                <label className={LABEL}>Título de la publicación *</label>
                <input
                  type="text"
                  className={FIELD}
                  placeholder="Ej: Lavadora Samsung 20kg, poco uso"
                  value={form.titulo}
                  onChange={set('titulo')}
                  maxLength={100}
                />
                <p className="text-xs text-gray-400 mt-1">{form.titulo.length}/100 caracteres</p>
              </div>

              <div>
                <label className={LABEL}>Descripción *</label>
                <textarea
                  rows={4}
                  className={FIELD}
                  placeholder="Detalla el estado, marca, modelo, características, condiciones de entrega…"
                  value={form.descripcion}
                  onChange={set('descripcion')}
                />
              </div>

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
              className="mt-6 w-full bg-gray-900 text-yellow-400 font-bold py-3.5 rounded-xl hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Siguiente → Fotos y contacto
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <h2 className="font-bold text-xl text-gray-900 mb-1">Fotos y contacto</h2>
            <p className="text-gray-500 text-sm mb-6">Agrega imágenes y tu número para que los interesados te contacten.</p>

            <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div>
                <label className={LABEL}>Fotos (mín. 2 recomendadas)</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                    >
                      <span className="text-2xl mb-1">📷</span>
                      <span className="text-[10px] text-gray-400">Agregar foto</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">JPG o PNG · Máx. 5MB · Fotos reales del artículo o servicio</p>
              </div>

              <div>
                <label className={LABEL}>Tu número de WhatsApp *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">🇻🇪</span>
                  <input
                    type="tel"
                    className={FIELD + ' pl-8'}
                    placeholder="+58 424 000 0000"
                    value={form.contacto}
                    onChange={set('contacto')}
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2.5">
                <span className="text-lg">📋</span>
                <div className="text-sm text-blue-900">
                  <p className="font-semibold">Proceso de aprobación</p>
                  <p className="text-xs mt-0.5 text-blue-700">Revisamos en menos de 24 horas. Si necesitamos correcciones te avisamos por WhatsApp.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                ← Volver
              </button>
              <button
                onClick={() => setSubmit(true)}
                className="flex-1 bg-yellow-400 text-gray-900 font-bold py-3 rounded-xl hover:bg-yellow-300 transition-all text-sm"
              >
                Enviar para revisión ✓
              </button>
            </div>
          </div>
        )}
      </main>

      <PlazaChat />
    </div>
  )
}
