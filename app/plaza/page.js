'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from '../../lib/firebase'

const PlazaChat = dynamic(() => import('../components/PlazaChat'), { ssr: false })

// ════════════════════════════════════════════════
// FUENTE DE DATOS — Firestore
// ════════════════════════════════════════════════
const PAGE_SIZE = 12

// ngrok ya no se usa para el feed — se mantiene solo para auth
const API_BASE = 'https://uncandid-overmighty-jodie.ngrok-free.dev'

// URLs de Firebase Storage se sirven directo. Cualquier otra URL va por el proxy.
function imgUrl(fuente) {
  // Soporte para array: usa el primer elemento
  const url = Array.isArray(fuente) ? fuente[0] : fuente
  if (!url) return null
  if (url.startsWith('http')) {
    try {
      const host = new URL(url).hostname
      if (
        host === 'storage.googleapis.com' ||
        host === 'firebasestorage.googleapis.com' ||
        host.endsWith('.firebasestorage.googleapis.com')
      ) return url
    } catch (_) {}
    return `/api/img?url=${encodeURIComponent(url)}`
  }
  return null
}

// Componente imagen con fallback al emoji cuando falla la carga
// inline=true → sin absolute (para galería con overflow-hidden)
function AnuncioImg({ p, emojiClass, inline = false }) {
  const [err, setErr] = useState(false)
  // imagen_url puede ser array (nuevo) o string (legado)
  const rawUrl = Array.isArray(p.imagen_url) ? p.imagen_url[0] : (p.imagen_url || p.imagen_ref)
  const src = imgUrl(rawUrl)
  if (!src || err) return <span className={`${emojiClass} select-none`}>{p.emoji ?? '📦'}</span>
  return (
    <Image
      src={src}
      alt={p.titulo ?? ''}
      fill
      unoptimized
      sizes={inline ? '160px' : '(max-width: 768px) 100vw, 33vw'}
      className={inline ? 'w-full h-full object-cover' : 'absolute inset-0 w-full h-full object-cover'}
      onError={() => setErr(true)}
    />
  )
}

// Normaliza una fila del DB al shape que espera la UI:
//  · redes: JSON string → array
//  · pagos: CSV string  → array
//  · disponible: 0/1    → boolean
//  · prioridad: 'alta'  → 'destacado' (para compatibilidad con la UI)
function normalizeRow(row) {
  return {
    ...row,
    // El driver MySQL auto-parsea columnas JSON → ya puede venir como array
    redes: Array.isArray(row.redes)
      ? row.redes
      : (() => { try { return JSON.parse(row.redes || '[]') } catch { return [] } })(),
    pagos: Array.isArray(row.pagos)
      ? row.pagos
      : (row.pagos ? row.pagos.split(',').map(s => s.trim()).filter(Boolean) : []),
    disponible: Boolean(row.disponible),
    prioridad: row.prioridad === 'alta' ? 'destacado' : (row.prioridad ?? 'media'),
  }
}

// Filtros especiales por tipo (van antes que las categorías)
const TIPO_FILTROS = {
  'Empleo':      (p) => p.tipo === 'empleo_oferta',
  'Se vende':    (p) => p.tipo === 'vende' || p.tipo === 'ofrece',
  'Se solicita': (p) => p.tipo === 'busca'  || p.tipo === 'solicita',
}

const CAT_EMOJI = {
  Todos:                '🏪',
  Empleo:               '💼',
  'Se vende':           '🏷️',
  'Se solicita':        '🔍',
  Gastronomía:          '🍽️',
  General:              '📌',
  Salud:                '💊',
  'Atención al Cliente':'🎧',
  'Ventas/Marketing':   '📣',
  Transporte:           '🚗',
  Oficios:              '🔧',
  Seguridad:            '🛡️',
  'Comercio/Productos': '🛒',
  Hogar:                '🏠',
  Administración:       '📋',
  Hospitalidad:         '🏨',
}

// Tipo → color de borde del card
const TIPO_BORDER = {
  ofrece:        '#111827',
  vende:         '#FFD700',   // amarillo
  busca:         '#111827',
  solicita:      '#22C55E',   // verde
  empleo_oferta: '#3B82F6',   // azul
}

// Tipo → badge (pestaña en la card)
const TIPO_BADGE = {
  ofrece:        { label: 'Se ofrece', pos: 'tr', bg: '#FFD700', text: '#111827' },
  vende:         { label: 'Se vende',  pos: 'tr', bg: '#FFD700', text: '#111827' },
  busca:         { label: 'Busca',     pos: 'bl', bg: '#111827', text: '#FFD700' },
  solicita:      { label: 'Solicita',  pos: 'bl', bg: '#111827', text: '#FFD700' },
  empleo_oferta: { label: 'Empleo',    pos: 'tr', bg: '#3B82F6', text: '#ffffff' },
}

const WA_NUMBER = '+584123375417'

// Usa el whatsapp propio del anuncio si existe, si no usa el global
const waUrl = (item) => {
  const num   = (item.whatsapp ?? WA_NUMBER).replace(/\s/g, '')
  const texto = item.titulo
    ? `Hola, vi el anuncio: *${item.titulo}* en Plaza – Repuestos Mérida. ¿Está disponible?`
    : 'Hola, vi tu anuncio en Plaza – Repuestos Mérida. ¿Está disponible?'
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

// Si el vendedor es un número de teléfono, mostramos "Contactando..."
const isPhone = (s) => !!s && /^[+\d\s().-]{7,}$/.test(s.trim())
const vendedorLabel = (s) => (!s || isPhone(s)) ? 'Contactando...' : s
const hasRealName = (s) => !!s && !isPhone(s)

const initials = (name) =>
  name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

function chunk(arr, size) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  )
}

// ════════════════════════════════════════════════
// ICONOS de redes sociales y métodos de pago
// ════════════════════════════════════════════════
const REDES_META = {
  facebook: {
    label: 'Facebook',
    desc:  'Disponible en Facebook',
    color: '#1877F2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    desc:  'Disponible en Instagram',
    color: '#E1306C',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
}

const PAGOS_META = {
  efectivo:    { label: 'Efectivo',     desc: 'Acepta efectivo',      color: '#16A34A', text: '$'  },
  zelle:       { label: 'Zelle',        desc: 'Acepta Zelle',         color: '#6600CC', text: 'Z'  },
  binance:     { label: 'Binance',      desc: 'Acepta Binance Pay',   color: '#F0B90B', text: '₿'  },
  pagomovil:   { label: 'Pago Móvil',   desc: 'Acepta Pago Móvil',   color: '#E11D48', text: 'PM' },
  bancolombia: { label: 'Bancolombia',  desc: 'Acepta Bancolombia',   color: '#FDC700', text: 'BC' },
  cashea:      { label: 'Cashea',       desc: 'Acepta Cashea',        color: '#FF6B35', text: 'CA' },
  lysto:       { label: 'Lysto',        desc: 'Acepta Lysto',         color: '#7C3AED', text: 'LY' },
}

function CardMeta({ redes = [], pagos = [], small = false }) {
  const [tooltip, setTooltip] = useState(null) // { desc, x, y, color }
  const timerRef = useRef(null)

  const show = (e, desc, color) => {
    e.stopPropagation()
    if (timerRef.current) clearTimeout(timerRef.current)
    const r = e.currentTarget.getBoundingClientRect()
    setTooltip({ desc, color, x: r.left + r.width / 2, y: r.top })
    timerRef.current = setTimeout(() => setTooltip(null), 3000)
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTooltip(null)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  if (!redes.length && !pagos.length) return null
  const sz = small ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]'

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {redes.map((r) => {
          const m = REDES_META[r]
          if (!m) return null
          return (
            <button
              key={r}
              type="button"
              onClick={(e) => show(e, m.desc, m.color)}
              className={`${sz} rounded-lg flex items-center justify-center p-0.5 shrink-0 cursor-pointer`}
              style={{ backgroundColor: m.color, color: '#fff' }}
            >
              {m.icon}
            </button>
          )
        })}
        {pagos.map((pg) => {
          const m = PAGOS_META[pg]
          if (!m) return null
          return (
            <button
              key={pg}
              type="button"
              onClick={(e) => show(e, m.desc, m.color)}
              className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 cursor-pointer`}
              style={{ backgroundColor: m.color + '22', color: m.color, border: `1.5px solid ${m.color}` }}
            >
              {m.text}
            </button>
          )
        })}
      </div>

      {/* Tooltip flotante — posicionado sobre el ícono, desaparece al click o en 3s */}
      {tooltip && (
        <div
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full pointer-events-auto cursor-pointer select-none"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
          onClick={hide}
        >
          <div
            className="text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap"
            style={{ backgroundColor: tooltip.color }}
          >
            {tooltip.desc}
          </div>
          {/* Flecha apuntando al ícono */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `5px solid ${tooltip.color}`,
            }}
          />
        </div>
      )}
    </>
  )
}

// ════════════════════════════════════════════════
// MODAL DE ANUNCIO — imagen grande + descripción + comentarios
// ════════════════════════════════════════════════
function AnuncioModal({ item: p, onClose }) {
  const color      = p.color ?? '#9CA3AF'
  const emoji      = p.emoji ?? '📦'
  const disponible = p.disponible !== false
  const tieneNombre = hasRealName(p.vendedor)

  const [comments, setComments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`plaza-c-${p.id}`) || '[]') }
    catch { return [] }
  })
  const [input, setInput] = useState('')
  const [autor, setAutor] = useState('')

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submitComment = () => {
    if (!input.trim()) return
    const c = { id: Date.now(), autor: autor.trim() || 'Anónimo', text: input.trim(), ts: Date.now() }
    const updated = [...comments, c]
    setComments(updated)
    try { localStorage.setItem(`plaza-c-${p.id}`, JSON.stringify(updated)) } catch {}
    setInput('')
  }

  const badge = TIPO_BADGE[p.tipo]
  const metaLine = [p.ubicacion, p.tiempo].filter(Boolean).join(' · ')

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Imagen grande */}
        <div className="relative h-56 sm:h-64 flex items-center justify-center shrink-0" style={{ backgroundColor: color + '22' }}>
          <AnuncioImg p={p} emojiClass="text-[7rem] leading-none" />

          {badge && (
            <span
              className={`absolute font-bold text-xs px-3 py-1.5 shadow tracking-wide
                ${badge.pos === 'tr' ? 'top-0 right-0 rounded-bl-2xl' : 'bottom-0 left-0 rounded-tr-2xl'}`}
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >{badge.label}</span>
          )}

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="absolute top-3 left-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-lg leading-none transition-colors"
          >×</button>

          {!disponible && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <span className="text-gray-700 font-bold text-sm bg-white px-4 py-2 rounded-full border border-gray-200 shadow">No disponible</span>
            </div>
          )}
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* Encabezado */}
          <div>
            {p.titulo && <h2 className="font-bold text-gray-900 text-lg leading-snug">{p.titulo}</h2>}
            {metaLine && <p className="text-xs text-gray-400 mt-1">{metaLine}</p>}
            {p.categoria && (
              <span className="inline-block text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-1">
                {CAT_EMOJI[p.categoria] ?? '📦'} {p.categoria}
              </span>
            )}
          </div>

          {/* Precio */}
          {p.precio != null ? (
            <p className="text-2xl font-bold text-gray-900">
              ${p.precio} <span className="text-sm font-normal text-gray-400">USD</span>
            </p>
          ) : (
            <p className="text-base font-semibold text-gray-400">Consultar precio</p>
          )}

          {/* Redes + Pagos */}
          <CardMeta redes={p.redes ?? []} pagos={p.pagos ?? []} />

          {/* Descripción */}
          {p.descripcion && (
            <div className="bg-gray-50 rounded-2xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Descripción</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{p.descripcion}</p>
            </div>
          )}

          {/* CTA WhatsApp */}
          <a
            href={disponible ? waUrl(p) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all
              ${disponible
                ? tieneNombre
                  ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d] active:scale-95'
                  : 'bg-[#3B82F6] text-white hover:bg-[#2563EB] active:scale-95'
                : 'bg-gray-100 text-gray-400 pointer-events-none'}`}
          >
            {disponible ? (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                {tieneNombre ? 'Escribir al WhatsApp' : 'Confirmar disponibilidad'}
              </>
            ) : 'No disponible'}
          </a>

          {/* ── Comentarios ── */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Comentarios ({comments.length})
            </p>

            {comments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-3">Sé el primero en comentar</p>
            )}

            <div className="space-y-2 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-gray-700">{c.autor}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{c.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(c.ts).toLocaleDateString('es-VE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                </div>
              ))}
            </div>

            {/* Input comentario */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Tu nombre (opcional)"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escribe un comentario…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
                />
                <button
                  onClick={submitComment}
                  className="bg-gray-900 text-yellow-400 font-bold text-sm px-4 py-2 rounded-xl hover:bg-gray-700 active:scale-95 transition-all shrink-0"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// FEED CARD — mobile, estilo red social
// ════════════════════════════════════════════════
function FeedCard({ p, onOpen }) {
  const color      = p.color      ?? '#9CA3AF'
  const emoji      = p.emoji      ?? '📦'
  const vendedor   = vendedorLabel(p.vendedor)
  const disponible = p.disponible !== false   // null → true
  const tieneNombre = hasRealName(p.vendedor)

  const metaLine = [p.ubicacion, p.tiempo].filter(Boolean).join(' · ')

  const borderColor = TIPO_BORDER[p.tipo] ?? '#E5E7EB'

  return (
    <article
      className={`bg-white sm:rounded-2xl overflow-hidden border-b sm:border sm:mb-3 ${p.prioridad === 'destacado' ? 'sm:border-2' : ''}`}
      style={{ borderColor }}
    >

      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: color }}
        >
          {initials(vendedor)}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-gray-900 text-sm leading-none truncate cursor-pointer hover:text-yellow-600 transition-colors"
            onClick={onOpen}
          >{vendedor}</p>
          {metaLine && <p className="text-xs text-gray-400 mt-0.5">{metaLine}</p>}
        </div>
        {p.prioridad === 'destacado' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            ⭐ Destacado
          </span>
        )}
        {p.categoria && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-1">
            {CAT_EMOJI[p.categoria] ?? '📦'} {p.categoria}
          </span>
        )}
      </div>

      <div
        className="relative h-52 sm:h-56 flex items-center justify-center cursor-pointer"
        style={{ backgroundColor: color + '18' }}
        onClick={onOpen}
      >
        <AnuncioImg p={p} emojiClass="text-8xl" />

        {(() => { const b = TIPO_BADGE[p.tipo]; return b && (
          <span
            className={`absolute font-bold text-[10px] px-3 py-1.5 shadow-sm tracking-wide
              ${b.pos === 'tr' ? 'top-0 right-0 rounded-bl-2xl' : 'bottom-0 left-0 rounded-tr-2xl'}`}
            style={{ backgroundColor: b.bg, color: b.text }}
          >{b.label}</span>
        )})()}

        {!disponible && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-gray-600 font-bold text-sm bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
              No disponible
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-1">
        {p.titulo && <p className="font-semibold text-gray-900 text-base leading-snug">{p.titulo}</p>}
        {p.precio != null ? (
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${p.precio}
            <span className="text-sm font-normal text-gray-400 ml-1">USD</span>
          </p>
        ) : (
          <p className="text-base font-semibold text-gray-400 mt-2">Consultar precio</p>
        )}
        <div className="mt-2">
          <CardMeta redes={p.redes ?? []} pagos={p.pagos ?? []} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <a
          href={disponible ? waUrl(p) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all
            ${disponible
              ? tieneNombre
                ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d] active:scale-95'
                : 'bg-[#3B82F6] text-white hover:bg-[#2563EB] active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
        >
          {disponible ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              {tieneNombre ? 'Escribir al WhatsApp' : 'Confirmar disponibilidad'}
            </>
          ) : 'No disponible'}
        </a>
      </div>
    </article>
  )
}

// ════════════════════════════════════════════════
// DESKTOP CARD — compacta para columnas
// ════════════════════════════════════════════════
function DesktopCard({ p, onOpen }) {
  const color      = p.color      ?? '#9CA3AF'
  const emoji      = p.emoji      ?? '📦'
  const vendedor   = vendedorLabel(p.vendedor)
  const disponible = p.disponible !== false   // null → true
  const tieneNombre = hasRealName(p.vendedor)

  const metaLine = [p.ubicacion, p.tiempo].filter(Boolean).join(' · ')

  const borderColor = TIPO_BORDER[p.tipo] ?? '#E5E7EB'

  return (
    <article
      className={`bg-white rounded-2xl overflow-hidden shadow-sm ${p.prioridad === 'destacado' ? 'border-2' : 'border'}`}
      style={{ borderColor }}
    >

      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: color }}
        >
          {initials(vendedor)}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-gray-900 text-xs leading-none truncate cursor-pointer hover:text-yellow-600 transition-colors"
            onClick={onOpen}
          >{vendedor}</p>
          {metaLine && <p className="text-[10px] text-gray-400 mt-0.5">{metaLine}</p>}
        </div>
        {p.prioridad === 'destacado' && (
          <span className="text-[9px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            ⭐ Top
          </span>
        )}
      </div>

      <div
        className="relative h-36 flex items-center justify-center cursor-pointer"
        style={{ backgroundColor: color + '1a' }}
        onClick={onOpen}
      >
        <AnuncioImg p={p} emojiClass="text-5xl" />

        {(() => { const b = TIPO_BADGE[p.tipo]; return b && (
          <span
            className={`absolute font-bold text-[9px] px-2.5 py-1 shadow-sm tracking-wide
              ${b.pos === 'tr' ? 'top-0 right-0 rounded-bl-xl' : 'bottom-0 left-0 rounded-tr-xl'}`}
            style={{ backgroundColor: b.bg, color: b.text }}
          >{b.label}</span>
        )})()}

        {!disponible && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-gray-600 font-bold text-xs">No disponible</span>
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        {p.titulo && <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">{p.titulo}</p>}
        {p.precio != null ? (
          <p className="text-base font-bold text-gray-900 mt-1">
            ${p.precio}
            <span className="text-xs font-normal text-gray-400 ml-1">USD</span>
          </p>
        ) : (
          <p className="text-sm font-semibold text-gray-400 mt-1">Consultar precio</p>
        )}
        <div className="mt-1.5">
          <CardMeta redes={p.redes ?? []} pagos={p.pagos ?? []} small />
        </div>
      </div>

      <div className="px-3 pb-3">
        <a
          href={disponible ? waUrl(p) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold transition-all
            ${disponible
              ? tieneNombre
                ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d] active:scale-95'
                : 'bg-[#3B82F6] text-white hover:bg-[#2563EB] active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
        >
          {disponible ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              {tieneNombre ? 'Escribir al WhatsApp' : 'Confirmar disponibilidad'}
            </>
          ) : 'No disponible'}
        </a>
      </div>
    </article>
  )
}

// ════════════════════════════════════════════════
// SCROLLING COLUMN — rAF-driven, control total
// Props:
//   paused      → detiene el auto-scroll (todas cuando hay scroll)
//   isHovered   → esta columna tiene el foco del cursor
//   pps         → pixels por segundo del auto-scroll
// ════════════════════════════════════════════════
function ScrollingColumn({ items, direction = 'up', pps = 50, paused, isHovered, onMouseEnter, onMouseLeave, onOpenItem }) {
  const containerRef  = useRef(null)
  const rafRef        = useRef(null)
  const lastTimeRef   = useRef(null)
  const initializedRef = useRef(false)

  const seed   = items.length < 3 ? [...items, ...items, ...items] : items
  const doubled = [...seed, ...seed]

  // Posición inicial: 'down' empieza en la mitad para poder bajar
  useEffect(() => {
    const el = containerRef.current
    if (!el || initializedRef.current || el.scrollHeight === 0) return
    if (direction === 'down') el.scrollTop = el.scrollHeight / 2
    initializedRef.current = true
  })

  // Loop de animación
  useEffect(() => {
    const el = containerRef.current
    if (!el || paused) {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
      return
    }

    const tick = (ts) => {
      if (!lastTimeRef.current) lastTimeRef.current = ts
      const delta = Math.min((ts - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = ts
      const half = el.scrollHeight / 2

      if (direction === 'up') {
        el.scrollTop += pps * delta
        if (el.scrollTop >= half) el.scrollTop -= half
      } else {
        el.scrollTop -= pps * delta
        if (el.scrollTop <= 0) el.scrollTop += half
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
    }
  }, [paused, direction, pps])

  if (items.length === 0) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Sin resultados</p>
    </div>
  )

  return (
    <div
      className="flex-1 relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Contenedor scroll real */}
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll scrollbar-none"
      >
        <div className="flex flex-col gap-3 px-1.5 py-2">
          {doubled.map((p, i) => (
            <DesktopCard key={`${p.id}-${i}`} p={p} onOpen={() => onOpenItem?.(p)} />
          ))}
        </div>
      </div>

      {/* Fades top / bottom */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-gray-100 to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none z-10" />

      {/* Indicador: columna activa para scroll manual */}
      {paused && isHovered && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gray-900/85 text-white text-[11px] font-medium px-3 py-1 rounded-full pointer-events-none backdrop-blur-sm whitespace-nowrap">
          ↕ Desliza para explorar
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════
// MOBILE IMAGE GALLERY — grid 2×2 con scroll horizontal
// ════════════════════════════════════════════════
function MobileImageGallery({ items }) {
  if (items.length === 0) return null
  const groups = chunk(items, 4)

  return (
    <section className="bg-white border-b border-gray-100 py-3">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="font-bold text-gray-900 text-sm">📸 Galería rápida</h2>
        <span className="text-xs text-gray-400">{items.length} publicaciones · desliza →</span>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="flex gap-3 px-4 pb-1" style={{ width: 'max-content' }}>
          {groups.map((group, gi) => (
            <div key={gi} className="grid grid-cols-2 gap-1.5">
              {group.map((p) => (
                <a
                  key={p.id}
                  href={p.disponible ? waUrl(p.titulo) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[92px] h-[92px] rounded-xl overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
                  style={{ backgroundColor: p.color + '22' }}
                >
                  <AnuncioImg p={p} emojiClass="text-4xl" inline />
                </a>
              ))}
              {group.length < 4 &&
                Array.from({ length: 4 - group.length }).map((_, k) => (
                  <div key={`empty-${k}`} className="w-[92px] h-[92px] rounded-xl bg-gray-50" />
                ))
              }
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ════════════════════════════════════════════════
// USER MENU — bottom sheet con sesión y logout
// ════════════════════════════════════════════════
function UserMenu({ session, onClose, onLogout }) {
  const AUTH = useMemo(() => ({
    'Authorization': `Bearer ${session.token}`,
    'ngrok-skip-browser-warning': '1',
    'Content-Type': 'application/json',
  }), [session.token])

  const [perfil,        setPerfil]        = useState(null)
  const [editando,      setEditando]      = useState(false)
  const [form,          setForm]          = useState({ nombre: '', cedula: '', edad: '', direccion: '' })
  const [coords,        setCoords]        = useState(null)   // { lat, lng, accuracy }
  const [geoLoading,    setGeoLoading]    = useState(false)
  const [geoError,      setGeoError]      = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/perfil`, { headers: AUTH })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setPerfil(data)
        setForm({ nombre: data.nombre || '', cedula: data.cedula || '', edad: data.edad || '', direccion: data.direccion || '' })
        if (data.latitud && data.longitud) setCoords({ lat: data.latitud, lng: data.longitud, accuracy: null })
      })
      .catch(() => {})
  }, [AUTH])

  async function handleGeolocate() {
    if (!navigator.geolocation) { setGeoError('Tu dispositivo no soporta geolocalización'); return }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        setCoords({ lat, lng, accuracy: Math.round(accuracy) })
        try {
          // Reverse geocoding con Nominatim (OpenStreetMap, gratuito, sin API key)
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'es' } }
          )
          const geo = await r.json()
          const a = geo.address || {}
          // Construir dirección legible priorizando datos más precisos
          const partes = [
            a.road || a.pedestrian || a.footway,
            a.house_number,
            a.neighbourhood || a.suburb || a.quarter,
            a.city || a.town || a.village || a.municipality,
            a.state,
          ].filter(Boolean)
          const direccionGeo = partes.join(', ')
          setForm(f => ({ ...f, direccion: direccionGeo || geo.display_name || f.direccion }))
        } catch (_) {
          // Si falla el reverse geocoding igual guardamos las coordenadas
        }
        setGeoLoading(false)
      },
      (err) => {
        const msgs = {
          1: 'Permiso de ubicación denegado',
          2: 'No se pudo obtener la ubicación',
          3: 'Tiempo de espera agotado',
        }
        setGeoError(msgs[err.code] || 'Error de geolocalización')
        setGeoLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = { ...form, ...(coords ? { latitud: coords.lat, longitud: coords.lng } : {}) }
      const res = await fetch(`${API_BASE}/perfil`, { method: 'PUT', headers: AUTH, body: JSON.stringify(body) })
      if (res.ok) { const d = await res.json(); setPerfil(d); setEditando(false) }
    } catch (_) {}
    setSaving(false)
  }

  async function handleLogout() {
    setLogoutLoading(true)
    try { await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: AUTH }) } catch (_) {}
    localStorage.removeItem('plaza_session')
    onLogout()
    onClose()
  }

  const perfilCompleto = perfil?.nombre && perfil?.cedula

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-4 mb-2 shrink-0" />

        <div className="overflow-y-auto px-6 pb-10 pt-2 space-y-5">

          {/* Avatar + teléfono */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-yellow-400 flex items-center justify-center text-2xl shrink-0">
              {perfilCompleto ? '👤' : '⚠️'}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-base">{perfil?.nombre || 'Sin nombre'}</p>
              <p className="text-gray-500 text-sm">{session.whatsapp || session.telefono}</p>
              {!perfilCompleto && (
                <p className="text-xs text-yellow-600 font-medium mt-0.5">Completa tu perfil</p>
              )}
            </div>
          </div>

          {/* Perfil — vista o formulario */}
          {editando ? (
            <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
              <p className="font-semibold text-gray-800 text-sm mb-1">Editar perfil</p>
              {[
                { key: 'nombre', label: 'Nombre completo', placeholder: 'Juan Pérez',      type: 'text'   },
                { key: 'cedula', label: 'Cédula',          placeholder: 'V-12345678',       type: 'text'   },
                { key: 'edad',   label: 'Edad',            placeholder: '25',               type: 'number' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400 bg-white"
                  />
                </div>
              ))}

              {/* Dirección con GPS */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                    placeholder="Av. Principal, Mérida"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleGeolocate}
                    disabled={geoLoading}
                    title="Usar mi ubicación"
                    className="shrink-0 w-11 h-11 rounded-xl border-2 border-gray-200 flex items-center justify-center hover:border-yellow-400 hover:bg-yellow-50 transition-all disabled:opacity-50"
                  >
                    {geoLoading
                      ? <span className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                      : <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    }
                  </button>
                </div>
                {coords && (
                  <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
                    <span>📍</span>
                    GPS obtenido{coords.accuracy ? ` · precisión ±${coords.accuracy}m` : ''}
                  </p>
                )}
                {geoError && (
                  <p className="text-[11px] text-red-500 mt-1">{geoError}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditando(false)} className="flex-1 border border-gray-200 text-gray-600 font-semibold text-sm py-2.5 rounded-xl hover:bg-gray-100 transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-yellow-400 text-gray-900 font-bold text-sm py-2.5 rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              {[
                { label: 'Nombre',    value: perfil?.nombre    },
                { label: 'Cédula',    value: perfil?.cedula    },
                { label: 'Edad',      value: perfil?.edad ? `${perfil.edad} años` : null },
                { label: 'Dirección', value: perfil?.direccion },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm gap-2">
                  <span className="text-gray-500 shrink-0">{label}</span>
                  <span className={`font-medium text-right ${value ? 'text-gray-900' : 'text-gray-300'}`}>{value || '—'}</span>
                </div>
              ))}
              {perfil?.latitud && perfil?.longitud && (
                <a
                  href={`https://www.google.com/maps?q=${perfil.latitud},${perfil.longitud}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 mt-1"
                >
                  <span>📍</span>
                  Ver en mapa · {Number(perfil.latitud).toFixed(5)}, {Number(perfil.longitud).toFixed(5)}
                </a>
              )}
              <button onClick={() => setEditando(true)} className="w-full mt-2 text-yellow-600 font-semibold text-xs hover:text-yellow-700 transition-colors">
                ✏️ Editar datos
              </button>
            </div>
          )}

          {/* Acciones */}
          <div className="space-y-2">
            <Link href="/plaza/publicar" onClick={onClose} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-yellow-400 text-gray-900 font-semibold text-sm hover:bg-yellow-300 transition-colors">
              <span>✏️</span> Publicar anuncio
            </Link>
            <Link href="/plaza/mis-anuncios" onClick={onClose} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-gray-100 text-gray-800 font-semibold text-sm hover:bg-gray-200 transition-colors">
              <span>📋</span> Mis anuncios
            </Link>
            <button onClick={handleLogout} disabled={logoutLoading} className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50">
              {logoutLoading ? <span className="w-5 h-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> : <span>🚪</span>}
              Cerrar sesión
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════
export default function PlazaPage() {
  const [catActiva, setCatActiva]       = useState('Todos')
  const [busqueda, setBusqueda]         = useState('')
  const [selectedItem, setSelectedItem] = useState(null)

  // ── Sesión de usuario ──
  const [session,   setSession]   = useState(null)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('plaza_session') || 'null')
      if (s?.token) setSession(s)
    } catch (_) {}
  }, [])

  // ── Datos desde API ──
  const [anuncios, setAnuncios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  // ── Lazy load mobile ──
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  // ── Estado animación desktop ──
  const [allPaused,  setAllPaused]  = useState(false)
  const [hoveredCol, setHoveredCol] = useState(null)
  const idleTimerRef = useRef(null)

  // ── Fetch inicial — Firestore ──
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getDocs(collection(firestore, 'anuncios'))
      .then(snap => {
        if (cancelled) return
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.disponible !== false)
          .sort((a, b) => {
            const ta = a.creado_en?.seconds ?? 0
            const tb = b.creado_en?.seconds ?? 0
            return tb - ta
          })
        setAnuncios(data.map(normalizeRow))
        setLoading(false)
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // ── Categorías dinámicas ──
  const categorias = useMemo(() => [
    'Todos',
    ...Object.keys(TIPO_FILTROS),
    ...new Set(anuncios.map(p => p.categoria).filter(Boolean)),
  ], [anuncios])

  // ── Reset lazy load al cambiar filtros ──
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [catActiva, busqueda])

  // ── IntersectionObserver para lazy load mobile ──
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE) },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, catActiva, busqueda])

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setAllPaused(false), 5000)
  }, [])

  const handleDesktopWheel = useCallback(() => {
    setAllPaused(true)
    resetIdleTimer()
  }, [resetIdleTimer])

  const handleDesktopMouseMove = useCallback(() => {
    if (allPaused) resetIdleTimer()
  }, [allPaused, resetIdleTimer])

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
  }, [])

  const filtrados = anuncios
    .filter((p) => Boolean(p.whatsapp))
    .filter((p) => {
      if (catActiva === 'Todos') return true
      if (TIPO_FILTROS[catActiva]) return TIPO_FILTROS[catActiva](p)
      return p.categoria === catActiva
    })
    .filter((p) => !busqueda ||
      (p.titulo?.toLowerCase().includes(busqueda.toLowerCase()) ?? false) ||
      (p.vendedor?.toLowerCase().includes(busqueda.toLowerCase()) ?? false) ||
      (p.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ?? false))
    .sort((a, b) => (b.prioridad === 'destacado') - (a.prioridad === 'destacado'))

  // Distribuir en 3 columnas para desktop (round-robin)
  const cols = [
    filtrados.filter((_, i) => i % 3 === 0),
    filtrados.filter((_, i) => i % 3 === 1),
    filtrados.filter((_, i) => i % 3 === 2),
  ]

  // Skeleton card para estado de carga
  const SkeletonCard = () => (
    <div className="bg-white border-b sm:border sm:rounded-2xl sm:mb-3 overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-2.5 bg-gray-100 rounded w-1/4" />
        </div>
      </div>
      <div className="h-52 bg-gray-100" />
      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-5 bg-gray-200 rounded w-1/4" />
        <div className="h-10 bg-gray-100 rounded-xl mt-3" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-gray-900 shadow-lg">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-yellow-400 text-lg leading-none">Plaza</span>
          </Link>

          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Buscar en Plaza…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setCatActiva('Todos') }}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 border-0"
            />
          </div>

          <Link
            href="/plaza/publicar"
            className="shrink-0 bg-yellow-400 text-gray-900 font-bold text-sm px-3 py-2 rounded-xl hover:bg-yellow-300 transition-all active:scale-95 whitespace-nowrap"
          >
            + Publicar
          </Link>

          {/* Botón de usuario */}
          <button
            onClick={() => session ? setMenuOpen(true) : window.location.href = '/plaza/login'}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 bg-gray-700 hover:bg-gray-600"
            title={session ? 'Mi cuenta' : 'Iniciar sesión'}
          >
            {session
              ? <span className="text-yellow-400 font-bold text-xs">●</span>
              : <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            }</button>
        </div>

        {/* Categorías dinámicas */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCatActiva(cat); setBusqueda('') }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                ${catActiva === cat
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              {CAT_EMOJI[cat]} {cat}
            </button>
          ))}
        </div>
      </header>

      {/* ════════════════════════════
          MOBILE — galería + feed
      ════════════════════════════ */}
      <main className="md:hidden max-w-lg mx-auto pb-28">

        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
            <p className="text-red-600 font-semibold text-sm">No se pudo conectar con el servidor</p>
            <p className="text-red-400 text-xs mt-1">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); getDocs(collection(firestore, 'anuncios')).then(snap => { const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.disponible !== false).sort((a, b) => (b.creado_en?.seconds ?? 0) - (a.creado_en?.seconds ?? 0)); setAnuncios(data.map(normalizeRow)); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) }) }}
              className="mt-3 text-xs font-bold text-red-600 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Skeleton de carga */}
        {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

        {/* Galería 2×2 con scroll horizontal */}
        {!loading && filtrados.length > 0 && <MobileImageGallery items={filtrados} />}

        {/* Contador + limpiar */}
        {!loading && (busqueda || catActiva !== 'Todos') && (
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
            <p className="text-gray-500 text-xs">
              <span className="font-bold text-gray-900">{filtrados.length}</span> publicación{filtrados.length !== 1 && 'es'}
              {busqueda && <span> · &ldquo;{busqueda}&rdquo;</span>}
            </p>
            <button
              onClick={() => { setBusqueda(''); setCatActiva('Todos') }}
              className="text-xs text-yellow-600 font-semibold"
            >
              Limpiar ✕
            </button>
          </div>
        )}

        {/* Sin resultados */}
        {!loading && !error && filtrados.length === 0 && (
          <div className="text-center py-24 px-8">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-700 font-semibold text-lg">Sin publicaciones</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">¿No encuentras lo que buscas?</p>
            <Link
              href="/plaza/solicitar"
              className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-all text-sm"
            >
              Crear solicitud →
            </Link>
          </div>
        )}

        {/* Feed de tarjetas — lazy load */}
        {filtrados.slice(0, visibleCount).map((p) => (
          <FeedCard key={p.id} p={p} onOpen={() => setSelectedItem(p)} />
        ))}

        {/* Sentinel: al entrar en viewport carga más */}
        {!loading && visibleCount < filtrados.length && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && filtrados.length > 0 && visibleCount >= filtrados.length && (
          <div className="px-4 pt-4 pb-2">
            <div className="bg-gray-900 rounded-2xl p-5 text-center">
              <p className="text-white font-bold text-base mb-1">¿Tienes algo para publicar?</p>
              <p className="text-gray-400 text-xs mb-4">Vende servicios u objetos gratis y llega a toda la región andina.</p>
              <Link
                href="/plaza/publicar"
                className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition-all text-sm"
              >
                + Publicar gratis
              </Link>
              <p className="mt-3 text-gray-500 text-xs">
                ¿Buscas algo específico?{' '}
                <Link href="/plaza/solicitar" className="text-yellow-400 font-medium">
                  Crear solicitud →
                </Link>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════
          DESKTOP — 3 columnas auto-scroll
          · Scroll en cualquier columna → todas pausan
          · Solo la columna con hover acepta scroll manual
          · 5s sin mover el mouse → reanudan todas
      ════════════════════════════ */}
      <div
        className="hidden md:block"
        onWheel={handleDesktopWheel}
        onMouseMove={handleDesktopMouseMove}
      >
        {/* Skeleton desktop */}
        {loading && (
          <div className="flex gap-4 px-6 pt-4" style={{ height: 'calc(100vh - 116px)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="bg-white rounded-2xl overflow-hidden border border-gray-200 animate-pulse">
                    <div className="h-36 bg-gray-100" />
                    <div className="px-3 py-2 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-8 bg-gray-100 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Error desktop */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-gray-700 font-semibold text-xl">No se pudo cargar</p>
            <p className="text-gray-400 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Filtro activo en desktop */}
        {!loading && !error && (busqueda || catActiva !== 'Todos') && (
          <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-200">
            <p className="text-gray-500 text-sm">
              <span className="font-bold text-gray-900">{filtrados.length}</span> publicación{filtrados.length !== 1 && 'es'}
              {busqueda && <span> · &ldquo;{busqueda}&rdquo;</span>}
            </p>
            <button
              onClick={() => { setBusqueda(''); setCatActiva('Todos') }}
              className="text-sm text-yellow-600 font-semibold hover:text-yellow-700"
            >
              Limpiar filtros ✕
            </button>
          </div>
        )}

        {/* Sin resultados desktop */}
        {!loading && !error && filtrados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-6xl mb-4">🔍</p>
            <p className="text-gray-700 font-semibold text-xl">Sin publicaciones</p>
            <p className="text-gray-400 text-sm mt-1 mb-6">¿No encuentras lo que buscas?</p>
            <Link
              href="/plaza/solicitar"
              className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-all"
            >
              Crear solicitud →
            </Link>
          </div>
        )}

        {!loading && !error && filtrados.length > 0 && (
          <div
            className="flex gap-4 px-6 pt-4"
            style={{ height: 'calc(100vh - 116px)', overflow: 'hidden' }}
          >
            {[
              { dir: 'up',   pps: 45 },
              { dir: 'down', pps: 30 },
              { dir: 'up',   pps: 55 },
            ].map(({ dir, pps }, i) => (
              <ScrollingColumn
                key={i}
                items={cols[i]}
                direction={dir}
                pps={pps}
                paused={allPaused}
                isHovered={hoveredCol === i}
                onMouseEnter={() => setHoveredCol(i)}
                onMouseLeave={() => setHoveredCol(null)}
                onOpenItem={setSelectedItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de anuncio */}
      {selectedItem && (
        <AnuncioModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Menú de usuario */}
      {menuOpen && session && (
        <UserMenu
          session={session}
          onClose={() => setMenuOpen(false)}
          onLogout={() => setSession(null)}
        />
      )}

      <PlazaChat />
    </div>
  )
}
