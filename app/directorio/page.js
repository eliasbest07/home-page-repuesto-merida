'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const WA_NUMBER = '+584123375417'
const STORAGE_KEY = 'repuestos-merida-directorio'

const waUrl = (nombre, mensaje = '') =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    mensaje?.trim() || `Hola, me interesa el repuesto: *${nombre}*. ¿Está disponible y cuál es el precio?`
  )}`

function formatFecha(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DirectorioPage() {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      setItems(Array.isArray(parsed) ? parsed : [])
    } catch {
      setItems([])
    }
    setLoaded(true)
  }, [])

  function persist(next) {
    setItems(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  function eliminar(id) {
    if (!confirm('¿Quitar este repuesto de tu directorio?')) return
    persist(items.filter((it) => String(it.id) !== String(id)))
  }

  function actualizarNota(id, nota) {
    persist(items.map((it) => (String(it.id) === String(id) ? { ...it, nota } : it)))
  }

  const filtrados = useMemo(() => {
    let lista = [...items]
    if (tab === 'con-nota') lista = lista.filter((it) => it.nota?.trim())
    if (tab === 'con-mensaje') lista = lista.filter((it) => it.preguntas?.trim())
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter(
        (it) =>
          it.nombre?.toLowerCase().includes(q) ||
          it.marca?.toLowerCase().includes(q) ||
          it.compat?.toLowerCase().includes(q) ||
          it.comercio?.toLowerCase().includes(q),
      )
    }
    return lista.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  }, [items, tab, busqueda])

  const stats = useMemo(
    () => ({
      total: items.length,
      conNota: items.filter((it) => it.nota?.trim()).length,
      conMensaje: items.filter((it) => it.preguntas?.trim()).length,
    }),
    [items],
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver al catálogo
            </Link>
            <Link href="/plaza" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FFD700] text-gray-900 hover:bg-yellow-300 transition-colors">
              🏪 Plaza
            </Link>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-gray-900">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-4-7 4V5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">Mi directorio</h1>
              <p className="mt-1 text-sm text-gray-400">
                Repuestos guardados, notas privadas y mensajes que preparaste para los vendedores.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center backdrop-blur">
              <p className="text-xl font-extrabold text-yellow-400">{stats.total}</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Guardados</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center backdrop-blur">
              <p className="text-xl font-extrabold text-yellow-400">{stats.conNota}</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Con nota</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5 text-center backdrop-blur">
              <p className="text-xl font-extrabold text-yellow-400">{stats.conMensaje}</p>
              <p className="mt-0.5 text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Con mensaje</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabs + búsqueda ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {[
              { id: 'todos', label: 'Todos', count: stats.total },
              { id: 'con-nota', label: 'Con nota', count: stats.conNota },
              { id: 'con-mensaje', label: 'Con mensaje', count: stats.conMensaje },
            ].map((t) => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-700'}`}>
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" />
              </svg>
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por nombre, marca, vehículo o comercio…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-100"
            />
          </div>
        </div>
      </div>

      {/* ── Lista ── */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {!loaded ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState hasItems={items.length > 0} onResetTab={() => { setTab('todos'); setBusqueda('') }} />
        ) : (
          <div className="space-y-3">
            {filtrados.map((it) => (
              <DirectorioCard
                key={`${it.id}-${it.savedAt}`}
                item={it}
                onEliminar={() => eliminar(it.id)}
                onActualizarNota={(nota) => actualizarNota(it.id, nota)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function DirectorioCard({ item, onEliminar, onActualizarNota }) {
  const [editandoNota, setEditandoNota] = useState(false)
  const [notaTemp, setNotaTemp] = useState(item.nota || '')

  function guardarNota() {
    onActualizarNota(notaTemp.trim())
    setEditandoNota(false)
  }

  return (
    <article className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Imagen */}
        <div className="relative aspect-[4/3] sm:aspect-auto sm:h-auto sm:w-44 sm:shrink-0 bg-gradient-to-br from-gray-100 to-gray-200">
          {item.imagen ? (
            <Image
              src={item.imagen}
              alt={item.nombre || 'Repuesto'}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 176px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl text-gray-300">📦</div>
          )}
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            {formatFecha(item.savedAt)}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex-1 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-extrabold leading-tight text-gray-900 truncate">
                {item.nombre || 'Repuesto'}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 truncate">
                {[item.marca, item.compat].filter(Boolean).join(' · ') || 'Sin detalle'}
              </p>
            </div>
            <button
              type="button"
              onClick={onEliminar}
              aria-label="Eliminar"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7m3 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16" />
              </svg>
            </button>
          </div>

          {item.precio && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-sm font-bold text-yellow-900">
              {item.precio}
            </div>
          )}

          {/* Comercio */}
          {(item.comercio || item.ubicacion) && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Comercio</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 truncate">{item.comercio || '—'}</p>
              {item.ubicacion && (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-gray-500">
                  <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  </svg>
                  <span className="leading-snug">{item.ubicacion}</span>
                </p>
              )}
            </div>
          )}

          {/* Mensaje preparado */}
          {item.preguntas?.trim() && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Mensaje preparado</p>
              <p className="mt-1 text-xs leading-snug text-gray-700 whitespace-pre-line line-clamp-3">
                {item.preguntas}
              </p>
            </div>
          )}

          {/* Nota */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Nota privada</p>
              {!editandoNota && (
                <button
                  type="button"
                  onClick={() => { setNotaTemp(item.nota || ''); setEditandoNota(true) }}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900"
                >
                  {item.nota?.trim() ? 'Editar' : 'Añadir'}
                </button>
              )}
            </div>
            {editandoNota ? (
              <div className="mt-1.5 space-y-2">
                <textarea
                  value={notaTemp}
                  onChange={(e) => setNotaTemp(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="Tu recordatorio sobre este repuesto."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={guardarNota}
                    className="flex-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoNota(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs leading-snug text-gray-700 whitespace-pre-line">
                {item.nota?.trim() || <span className="italic text-gray-400">Sin nota.</span>}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <a
              href={waUrl(item.nombre, item.preguntas)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-green-500/20 transition hover:bg-[#128C7E]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.554-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z" />
              </svg>
              Contactar por WhatsApp
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition"
            >
              Ver en catálogo
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function EmptyState({ hasItems, onResetTab }) {
  if (hasItems) {
    return (
      <div className="rounded-2xl bg-white border border-dashed border-gray-200 px-6 py-12 text-center">
        <p className="text-4xl">🔍</p>
        <p className="mt-3 text-base font-bold text-gray-900">Sin resultados con ese filtro.</p>
        <p className="mt-1 text-sm text-gray-500">Probá otro tab o limpiá la búsqueda.</p>
        <button
          type="button"
          onClick={onResetTab}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition"
        >
          Ver todos
        </button>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white border border-dashed border-gray-200 px-6 py-12 text-center">
      <p className="text-5xl">📭</p>
      <p className="mt-3 text-lg font-extrabold text-gray-900">Tu directorio está vacío</p>
      <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
        Cuando guardes un repuesto desde el catálogo, aparecerá acá con tu nota y el mensaje que preparaste para el vendedor.
      </p>
      <Link
        href="/#catalogo"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-extrabold text-gray-900 hover:bg-yellow-300 transition"
      >
        Explorar catálogo
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}
