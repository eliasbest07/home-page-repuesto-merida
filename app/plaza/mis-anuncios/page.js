'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = 'https://uncandid-overmighty-jodie.ngrok-free.dev'

function imgUrl(ref) {
  if (!ref) return null
  if (ref.startsWith('http')) return ref
  if (ref.startsWith('/')) return `/api/img?url=${encodeURIComponent(`${API_BASE}/public${ref}`)}`
  return `/api/img?url=${encodeURIComponent(`${API_BASE}/public/imagenes_anuncios/${ref}`)}`
}

const TIPO_LABEL = {
  vende:           { label: 'Venta',    color: '#10B981' },
  ofrece_servicio: { label: 'Servicio', color: '#8B5CF6' },
  empleo_oferta:   { label: 'Empleo',   color: '#3B82F6' },
  busca:           { label: 'Busca',    color: '#F59E0B' },
  solicita:        { label: 'Solicita', color: '#F59E0B' },
  ofrece:          { label: 'Ofrece',   color: '#10B981' },
}

export default function MisAnunciosPage() {
  const router = useRouter()
  const [session,   setSession]   = useState(null)
  const [anuncios,  setAnuncios]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [toggling,  setToggling]  = useState(null) // id del anuncio que se está toggling

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('plaza_session') || 'null')
      if (!s?.token) { router.replace('/plaza/login?redirect=/plaza/mis-anuncios'); return }
      setSession(s)
    } catch {
      router.replace('/plaza/login?redirect=/plaza/mis-anuncios')
    }
  }, [router])

  // ── Fetch anuncios ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.token) return
    setLoading(true)
    fetch(`${API_BASE}/mis-anuncios`, {
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'ngrok-skip-browser-warning': '1',
      },
    })
      .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() })
      .then(data => { setAnuncios(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [session])

  // ── Cambiar disponibilidad ──────────────────────────────────────────────────
  async function toggleDisponible(anuncio) {
    setToggling(anuncio.id)
    try {
      const res = await fetch(`${API_BASE}/anuncios/${anuncio.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({ disponible: !anuncio.disponible }),
      })
      if (res.ok) {
        setAnuncios(prev =>
          prev.map(a => a.id === anuncio.id ? { ...a, disponible: !a.disponible } : a)
        )
      }
    } catch (_) {}
    setToggling(null)
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!session || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
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
          <span className="text-white font-semibold text-sm">Mis anuncios</span>
        </div>
        <Link
          href="/plaza/publicar"
          className="bg-yellow-400 text-gray-900 font-bold text-sm px-3 py-1.5 rounded-xl hover:bg-yellow-300 transition-all"
        >
          + Publicar
        </Link>
      </nav>

      <main className="max-w-xl mx-auto px-4 pt-20 pb-16">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center text-red-600 text-sm mt-4">
            No se pudieron cargar tus anuncios. {error}
          </div>
        )}

        {/* Vacío */}
        {!error && anuncios.length === 0 && (
          <div className="text-center mt-20">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold text-gray-900 text-lg mb-2">No tienes anuncios aún</p>
            <p className="text-gray-500 text-sm mb-6">Publica tu primer anuncio y aparecerá aquí.</p>
            <Link
              href="/plaza/publicar"
              className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-all text-sm"
            >
              + Publicar ahora
            </Link>
          </div>
        )}

        {/* Lista */}
        {anuncios.length > 0 && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-gray-400 font-medium px-1">
              {anuncios.length} publicación{anuncios.length !== 1 ? 'es' : ''}
            </p>

            {anuncios.map(a => {
              const tipo     = TIPO_LABEL[a.tipo] ?? { label: a.tipo, color: '#9CA3AF' }
              const imgSrc   = imgUrl(a.imagen_ref)
              const activo   = Boolean(a.disponible)

              return (
                <article
                  key={a.id}
                  className={`bg-white rounded-2xl overflow-hidden border transition-all ${activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                >
                  <div className="flex gap-3 p-3">

                    {/* Miniatura */}
                    <div
                      className="w-20 h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center text-3xl"
                      style={{ backgroundColor: (a.color ?? '#9CA3AF') + '22' }}
                    >
                      {imgSrc
                        ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                        : <span>{a.emoji ?? '📦'}</span>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{a.titulo}</p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 text-white"
                          style={{ backgroundColor: tipo.color }}
                        >{tipo.label}</span>
                      </div>

                      {a.precio != null && (
                        <p className="text-base font-bold text-gray-900 mt-1">
                          ${a.precio} <span className="text-xs font-normal text-gray-400">USD</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        {/* Toggle disponible */}
                        <button
                          onClick={() => toggleDisponible(a)}
                          disabled={toggling === a.id}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all
                            ${activo
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            } disabled:opacity-50`}
                        >
                          {toggling === a.id
                            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            : <span className={`w-2 h-2 rounded-full ${activo ? 'bg-green-500' : 'bg-gray-400'}`} />
                          }
                          {activo ? 'Activo' : 'Pausado'}
                        </button>

                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-xs text-gray-400">#{a.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  {a.descripcion && (
                    <p className="text-xs text-gray-500 px-3 pb-3 line-clamp-2 leading-relaxed">{a.descripcion}</p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
