'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PlazaChat = dynamic(() => import('../../components/PlazaChat'), { ssr: false })

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-sm w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1.5'

export default function SolicitarPage() {
  const [submitted, setSubmit] = useState(false)
  const [form, setForm] = useState({
    titulo: '', descripcion: '', contacto: '',
  })

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const canSubmit = form.titulo.trim() && form.descripcion.trim() && form.contacto.trim()

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
            <h1 className="font-bold text-2xl text-gray-900 mb-3">¡Solicitud publicada!</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Tu solicitud de <strong>&ldquo;{form.titulo}&rdquo;</strong> ya está en Plaza.
              Los usuarios que puedan ayudarte te contactarán por WhatsApp.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left text-sm text-yellow-900 mb-6">
              <p className="font-semibold mb-1">¿Qué sigue?</p>
              <ul className="space-y-1 text-xs">
                <li>✔ Los usuarios de Plaza verán tu solicitud</li>
                <li>✔ Los interesados te escribirán por WhatsApp</li>
                <li>✔ Tú decides con quién acordar</li>
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
          <span className="text-white font-semibold text-sm">Crear solicitud</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 pt-24 pb-16">

        {/* Info card */}
        <div className="bg-gray-900 rounded-2xl p-5 mb-6 flex gap-3 items-start">
          <span className="text-3xl shrink-0">🔎</span>
          <div>
            <p className="text-white font-semibold text-sm">¿No encuentras lo que buscas?</p>
            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
              Publica tu solicitud y los usuarios de Plaza que tengan lo que necesitas te contactarán por WhatsApp. Es gratis y rápido.
            </p>
          </div>
        </div>

        {/* Tip Oso */}
        <div className="border-2 border-yellow-400 bg-yellow-50 rounded-xl px-4 py-3 mb-6 flex gap-2.5 items-start">
          <img src="/iconorm.png" alt="Oso" className="w-8 h-8 rounded-full shrink-0 object-cover" />
          <p className="text-sm text-yellow-900">
            <strong>Oso Frontino Brain:</strong> Cuanto más detallada sea tu solicitud, más rápido recibirás respuestas. Incluye modelo, color, presupuesto u otras características clave.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div>
            <label className={LABEL}>¿Qué estás buscando? *</label>
            <input
              type="text"
              className={FIELD}
              placeholder="Ej: Lavadora usada en buen estado, Clases de guitarra, Silla de oficina…"
              value={form.titulo}
              onChange={set('titulo')}
              maxLength={100}
            />
          </div>

          <div>
            <label className={LABEL}>Descripción detallada *</label>
            <textarea
              rows={4}
              className={FIELD}
              placeholder="Describe características importantes, presupuesto máximo, ubicación preferida, urgencia…"
              value={form.descripcion}
              onChange={set('descripcion')}
            />
            <p className="text-xs text-gray-400 mt-1">Cuanta más información, mejores respuestas recibirás.</p>
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
            <p className="text-xs text-gray-400 mt-1">Los usuarios te contactarán por aquí.</p>
          </div>

          <div>
            <label className={LABEL}>Imagen referencial <span className="font-normal text-gray-400">(opcional)</span></label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-yellow-400 hover:bg-yellow-50 transition-all">
              <span className="text-3xl">🖼️</span>
              <p className="text-sm text-gray-500 mt-2">Agregar imagen de referencia</p>
              <p className="text-xs text-gray-400">JPG o PNG · Máx. 5MB</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => canSubmit && setSubmit(true)}
          disabled={!canSubmit}
          className="mt-6 w-full bg-yellow-400 text-gray-900 font-bold py-3.5 rounded-xl hover:bg-yellow-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          Publicar solicitud 🔎
        </button>

        <p className="text-center text-gray-400 text-xs mt-3">
          Tu solicitud será visible para todos los usuarios de Plaza.
        </p>
      </main>

      <PlazaChat />
    </div>
  )
}
