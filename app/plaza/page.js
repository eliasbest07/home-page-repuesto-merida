'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const PlazaChat = dynamic(() => import('../components/PlazaChat'), { ssr: false })

// ════════════════════════════════════════════════
// MOCK DATA — servicios y objetos variados
// ════════════════════════════════════════════════
const MOCK_ITEMS = [
  { id: 1,  titulo: 'Corte de cabello a domicilio (hombre/mujer)',      precio: 8,   categoria: 'Servicios',        vendedor: 'Carlos M.',        prioridad: 'destacado', ubicacion: 'Mérida',   disponible: true,  color: '#8B5CF6', emoji: '✂️', tiempo: 'hace 1h' },
  { id: 2,  titulo: 'iPhone 12 128GB — negro, excelente estado',         precio: 280, categoria: 'Electrónica',      vendedor: 'María R.',         prioridad: 'normal',    ubicacion: 'Mérida',   disponible: true,  color: '#3B82F6', emoji: '📱', tiempo: 'hace 2h' },
  { id: 3,  titulo: 'Lavadora Samsung 20kg — poco uso, con garantía',   precio: 320, categoria: 'Electrodomésticos', vendedor: 'TecnoHogar',       prioridad: 'destacado', ubicacion: 'Mérida',   disponible: true,  color: '#06B6D4', emoji: '🫧', tiempo: 'hace 3h' },
  { id: 4,  titulo: 'Clases de inglés online — nivel básico a avanzado', precio: 15,  categoria: 'Servicios',        vendedor: 'Luis V.',          prioridad: 'normal',    ubicacion: 'Online',   disponible: true,  color: '#10B981', emoji: '📚', tiempo: 'hace 4h' },
  { id: 5,  titulo: 'Bicicleta de montaña Trek — rodada 29',             precio: 180, categoria: 'Deportes',         vendedor: 'Pedro A.',         prioridad: 'normal',    ubicacion: 'Ejido',    disponible: true,  color: '#F59E0B', emoji: '🚵', tiempo: 'hace 5h' },
  { id: 6,  titulo: 'Sofá 3 puestos — cuero sintético, café oscuro',    precio: 250, categoria: 'Hogar',            vendedor: 'Ana G.',           prioridad: 'destacado', ubicacion: 'Mérida',   disponible: true,  color: '#92400E', emoji: '🛋️', tiempo: 'hace 6h' },
  { id: 7,  titulo: 'Diseño de logos y branding profesional',            precio: 40,  categoria: 'Servicios',        vendedor: 'CreativaAndes',    prioridad: 'normal',    ubicacion: 'Online',   disponible: true,  color: '#EC4899', emoji: '🎨', tiempo: 'hace 8h' },
  { id: 8,  titulo: 'PlayStation 5 — 2 controles y 3 juegos incluidos', precio: 550, categoria: 'Electrónica',      vendedor: 'GamersMérida',     prioridad: 'normal',    ubicacion: 'Mérida',   disponible: false, color: '#6366F1', emoji: '🎮', tiempo: 'hace 9h' },
  { id: 9,  titulo: 'Reparación de laptops y computadoras (servicio)',   precio: 20,  categoria: 'Servicios',        vendedor: 'TecnoFix',         prioridad: 'normal',    ubicacion: 'Mérida',   disponible: true,  color: '#0EA5E9', emoji: '💻', tiempo: 'hace 12h' },
  { id: 10, titulo: 'Refrigerador Mabe 14 pies — en buen estado',       precio: 400, categoria: 'Electrodomésticos', vendedor: 'Juan C.',          prioridad: 'destacado', ubicacion: 'El Vigía', disponible: true,  color: '#14B8A6', emoji: '🧊', tiempo: 'hace 1d' },
  { id: 11, titulo: 'Guitarra eléctrica Fender Stratocaster + amplif.', precio: 350, categoria: 'Otros',            vendedor: 'MusicAndina',      prioridad: 'normal',    ubicacion: 'Mérida',   disponible: true,  color: '#F97316', emoji: '🎸', tiempo: 'hace 1d' },
  { id: 12, titulo: 'Plomería y electricidad — instalaciones y reparac.', precio: 25, categoria: 'Servicios',       vendedor: 'MaestroBriceño',   prioridad: 'normal',    ubicacion: 'Mérida',   disponible: true,  color: '#84CC16', emoji: '🔧', tiempo: 'hace 2d' },
]

const CATEGORIAS = ['Todos', 'Servicios', 'Electrónica', 'Electrodomésticos', 'Hogar', 'Deportes', 'Otros']

const CAT_EMOJI = {
  Todos: '🏪', Servicios: '🛠️', Electrónica: '📱', Electrodomésticos: '🏠',
  Hogar: '🛋️', Deportes: '⚽', Otros: '📦',
}

const WA_NUMBER = '+584123375417'
const waUrl = (titulo) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola, estoy interesado en: *${titulo}* que vi en Plaza – Repuestos Mérida. ¿Está disponible?`)}`

const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

// ════════════════════════════════════════════════
// FEED CARD — estilo red social
// ════════════════════════════════════════════════
function FeedCard({ p }) {
  return (
    <article className={`bg-white sm:rounded-2xl overflow-hidden border-b sm:border sm:mb-3
      ${p.prioridad === 'destacado' ? 'sm:border-yellow-400 sm:border-2 border-b-yellow-200' : 'border-b-gray-100 sm:border-gray-200'}`}>

      {/* Post header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: p.color }}
        >
          {initials(p.vendedor)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-none truncate">{p.vendedor}</p>
          <p className="text-xs text-gray-400 mt-0.5">{p.ubicacion} · {p.tiempo}</p>
        </div>
        {p.prioridad === 'destacado' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            ⭐ Destacado
          </span>
        )}
        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-1">
          {CAT_EMOJI[p.categoria]} {p.categoria}
        </span>
      </div>

      {/* Visual */}
      <div
        className="relative h-52 sm:h-56 flex items-center justify-center"
        style={{ backgroundColor: p.color + '18' }}
      >
        <span className="text-8xl select-none">{p.emoji}</span>
        {!p.disponible && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-gray-600 font-bold text-sm bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
              No disponible
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="px-4 pt-3 pb-1">
        <p className="font-semibold text-gray-900 text-base leading-snug">{p.titulo}</p>
        <p className="text-2xl font-bold text-gray-900 mt-2">
          ${p.precio}
          <span className="text-sm font-normal text-gray-400 ml-1">USD</span>
        </p>
      </div>

      {/* CTA */}
      <div className="px-4 pb-4 pt-2">
        <a
          href={p.disponible ? waUrl(p.titulo) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all
            ${p.disponible
              ? 'bg-gray-900 text-yellow-400 hover:bg-gray-700 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
        >
          {p.disponible ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              Contactar por WhatsApp
            </>
          ) : 'No disponible'}
        </a>
      </div>
    </article>
  )
}

// ════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════
export default function PlazaPage() {
  const [catActiva, setCatActiva] = useState('Todos')
  const [busqueda, setBusqueda]   = useState('')

  const filtrados = MOCK_ITEMS
    .filter((p) => catActiva === 'Todos' || p.categoria === catActiva)
    .filter((p) => !busqueda || p.titulo.toLowerCase().includes(busqueda.toLowerCase()) || p.vendedor.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => (b.prioridad === 'destacado') - (a.prioridad === 'destacado'))

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Top bar compacta ── */}
      <header className="sticky top-0 z-40 bg-gray-900 shadow-lg">
        {/* Fila 1: logo + buscador + publicar */}
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
        </div>

        {/* Fila 2: categorías */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {CATEGORIAS.map((cat) => (
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

      {/* ── Feed ── */}
      <main className="max-w-lg mx-auto sm:pt-4 pb-28">

        {/* Contador + limpiar */}
        {(busqueda || catActiva !== 'Todos') && (
          <div className="flex items-center justify-between px-4 py-2 bg-white sm:rounded-2xl sm:mb-3 border-b border-gray-100 sm:border">
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
        {filtrados.length === 0 && (
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

        {/* Feed */}
        {filtrados.map((p) => <FeedCard key={p.id} p={p} />)}

        {/* Bottom CTA */}
        {filtrados.length > 0 && (
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

      <PlazaChat />
    </div>
  )
}
