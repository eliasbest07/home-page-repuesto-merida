'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from '../../../lib/firebase'
import { ensureSession } from '@/lib/rifaSession'
import { plazaApprovalStatus } from '@/lib/plazaApproval'

function imgUrl(ref) {
  if (!ref) return null
  if (ref.startsWith('http')) return ref
  return null
}

function canonPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('58') && digits.length >= 12) digits = digits.slice(2)
  return digits.replace(/^0+/, '')
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
  const [saving, setSaving] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ titulo: '', descripcion: '', categoria: '', precio: '' })

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) {
        router.replace('/login?redirect=' + encodeURIComponent('/plaza/mis-anuncios'))
        return
      }
      setSession({ ...s, whatsapp: s.telefono })
    })
  }, [router])

  // ── Fetch anuncios desde Firestore ──────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const telefono = session.whatsapp || session.telefono || ''
    if (!telefono) return
    setLoading(true)
    const ownerPhone = canonPhone(telefono)
    getDocs(collection(firestore, 'anuncios'))
      .then(snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(item => canonPhone(item.whatsapp) === ownerPhone)
        setAnuncios(data)
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [session])

  async function updateAd(anuncio, body) {
    setSaving(anuncio.id)
    setError(null)
    try {
      const response = await fetch(`/api/plaza/anuncios/${encodeURIComponent(anuncio.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el anuncio.')
      if (body.action === 'retire') {
        setAnuncios(prev => prev.map(item => item.id === anuncio.id
          ? { ...item, aprobado: false, disponible: false, estado_aprobacion: 'retirado' }
          : item))
      } else {
        setAnuncios(prev => prev.map(item => item.id === anuncio.id
          ? { ...item, ...body, aprobado: false, disponible: true, estado_aprobacion: 'pendiente' }
          : item))
        setEditingId(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  function beginEdit(anuncio) {
    setEditingId(anuncio.id)
    setEditForm({
      titulo: anuncio.titulo || '',
      descripcion: anuncio.descripcion || '',
      categoria: anuncio.categoria || '',
      precio: anuncio.precio ?? '',
    })
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
              const imgSrc   = imgUrl(Array.isArray(a.imagen_url) ? a.imagen_url[0] : (a.imagen_url || a.imagen_ref))
              const activo   = Boolean(a.disponible)
              const approval = plazaApprovalStatus(a)

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
                        ? <Image src={imgSrc} alt="" width={80} height={80} unoptimized className="w-full h-full object-cover" />
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
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          approval === 'aprobado'
                            ? 'bg-green-100 text-green-700'
                            : approval === 'rechazado' || approval === 'retirado'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {approval === 'aprobado' ? 'Aprobado' : approval === 'rechazado' ? 'Rechazado' : approval === 'retirado' ? 'Retirado' : 'Pendiente de aprobación'}
                        </span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-xs text-gray-400">#{a.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  {a.descripcion && (
                    <p className="text-xs text-gray-500 px-3 pb-3 line-clamp-2 leading-relaxed">{a.descripcion}</p>
                  )}

                  {editingId === a.id ? (
                    <form
                      className="space-y-2 border-t border-gray-100 p-3"
                      onSubmit={(event) => { event.preventDefault(); updateAd(a, { action: 'edit', ...editForm }) }}
                    >
                      <input value={editForm.titulo} onChange={e => setEditForm(form => ({ ...form, titulo: e.target.value }))} placeholder="Título" required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      <textarea value={editForm.descripcion} onChange={e => setEditForm(form => ({ ...form, descripcion: e.target.value }))} placeholder="Descripción" required rows={3} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editForm.categoria} onChange={e => setEditForm(form => ({ ...form, categoria: e.target.value }))} placeholder="Categoría" required className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        <input type="number" min="0" step="0.01" value={editForm.precio} onChange={e => setEditForm(form => ({ ...form, precio: e.target.value }))} placeholder="Precio" required className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button disabled={saving === a.id} className="rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-gray-900 disabled:opacity-50">Guardar y enviar a revisión</button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex gap-2 border-t border-gray-100 p-3">
                      <button onClick={() => beginEdit(a)} disabled={saving === a.id || approval === 'retirado'} className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-40">Editar</button>
                      <button
                        onClick={() => window.confirm('¿Retirar este anuncio? Dejará de mostrarse en Plaza.') && updateAd(a, { action: 'retire' })}
                        disabled={saving === a.id || approval === 'retirado'}
                        className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40"
                      >
                        {saving === a.id ? 'Procesando…' : 'Retirar anuncio'}
                      </button>
                    </div>
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
