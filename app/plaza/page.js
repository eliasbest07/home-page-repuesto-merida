'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PlazaChat = dynamic(() => import('../components/PlazaChat'), { ssr: false })

// ════════════════════════════════════════════════
// MOCK DATA
// ════════════════════════════════════════════════
const MOCK_PRODUCTS = [
  { id: 1,  titulo: 'Filtro de aceite Toyota Hilux 2020 original',    precio: 15,  categoria: 'Filtros',      vendedor: 'Carlos M.',        prioridad: 'destacado', ubicacion: 'Mérida',  disponible: true,  color: '#F59E0B', emoji: '🛢️' },
  { id: 2,  titulo: 'Pastillas de freno delanteras Brembo nuevas',     precio: 45,  categoria: 'Frenos',       vendedor: 'María R.',         prioridad: 'normal',    ubicacion: 'Mérida',  disponible: true,  color: '#EF4444', emoji: '🛞' },
  { id: 3,  titulo: 'Batería 12V Willard 75Ah (nueva, con garantía)',  precio: 90,  categoria: 'Eléctrico',    vendedor: 'TecnoAuto',        prioridad: 'destacado', ubicacion: 'Mérida',  disponible: true,  color: '#3B82F6', emoji: '⚡' },
  { id: 4,  titulo: 'Amortiguadores Gabriel Toyota Land Cruiser',      precio: 120, categoria: 'Frenos',       vendedor: 'Luis V.',          prioridad: 'normal',    ubicacion: 'Ejido',   disponible: true,  color: '#8B5CF6', emoji: '🔧' },
  { id: 5,  titulo: 'Correa de distribución Gates Mitsubishi L200',   precio: 35,  categoria: 'Motor',        vendedor: 'RepuestosAndes',   prioridad: 'normal',    ubicacion: 'Mérida',  disponible: true,  color: '#F59E0B', emoji: '⚙️' },
  { id: 6,  titulo: 'Alternador reacondicionado Chevrolet D-MAX',      precio: 150, categoria: 'Eléctrico',    vendedor: 'ElectrAuto',       prioridad: 'destacado', ubicacion: 'Mérida',  disponible: true,  color: '#10B981', emoji: '⚡' },
  { id: 7,  titulo: 'Faro delantero LED Kia Sportage 2019-2022',       precio: 85,  categoria: 'Carrocería',   vendedor: 'Auto Parts Mérida',prioridad: 'normal',    ubicacion: 'Mérida',  disponible: false, color: '#EC4899', emoji: '🚗' },
  { id: 8,  titulo: 'Aceite motor Mobil 10W-40 × 4 litros',           precio: 25,  categoria: 'Filtros',      vendedor: 'Lubricentro Andes',prioridad: 'normal',    ubicacion: 'Mérida',  disponible: true,  color: '#F97316', emoji: '🛢️' },
  { id: 9,  titulo: 'Radiador Toyota Hilux aluminio reforzado',        precio: 280, categoria: 'Refrigeración',vendedor: 'Juan C.',          prioridad: 'normal',    ubicacion: 'El Vigía',disponible: true,  color: '#06B6D4', emoji: '💧' },
  { id: 10, titulo: 'Diagnóstico computarizado eléctrico (servicio)',  precio: 20,  categoria: 'Servicios',    vendedor: 'TallerAndes',      prioridad: 'destacado', ubicacion: 'Mérida',  disponible: true,  color: '#6366F1', emoji: '🔍' },
  { id: 11, titulo: 'Bujías NGK Iridio set × 4 (varios modelos)',     precio: 30,  categoria: 'Eléctrico',    vendedor: 'Electro Parts',    prioridad: 'normal',    ubicacion: 'Mérida',  disponible: true,  color: '#84CC16', emoji: '⚡' },
  { id: 12, titulo: 'Bomba de agua Aisin Toyota Fortuner',             precio: 65,  categoria: 'Refrigeración',vendedor: 'MotorParts',       prioridad: 'normal',    ubicacion: 'Mérida',  disponible: true,  color: '#0EA5E9', emoji: '💧' },
]

const CATEGORIAS = ['Todas', 'Motor', 'Frenos', 'Eléctrico', 'Carrocería', 'Filtros', 'Refrigeración', 'Servicios']

const CAT_EMOJI = {
  Todas: '🔧', Motor: '⚙️', Frenos: '🛞', Eléctrico: '⚡',
  Carrocería: '🚗', Filtros: '🛢️', Refrigeración: '💧', Servicios: '🔍',
}

const WA_NUMBER = '+584123375417'
const waProductUrl = (titulo) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Hola, estoy interesado en: *${titulo}* que vi en Plaza – Repuestos Mérida. ¿Está disponible?`)}`

// ════════════════════════════════════════════════
// COMPONENTES INTERNOS
// ════════════════════════════════════════════════
function ProductCard({ p }) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 flex flex-col
      ${p.prioridad === 'destacado' ? 'border-yellow-400 border-2' : 'border-gray-200'}`}>

      {/* Imagen placeholder */}
      <div
        className="relative h-28 flex items-center justify-center"
        style={{ backgroundColor: p.color + '22' }}
      >
        <span className="text-4xl">{p.emoji}</span>
        {p.prioridad === 'destacado' && (
          <span className="absolute top-2 left-2 bg-yellow-400 text-gray-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
            ⭐ Destacado
          </span>
        )}
        {!p.disponible && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-gray-500 font-semibold text-xs bg-white px-3 py-1 rounded-full border">Sin stock</span>
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div className="px-4 py-3 flex-1 flex flex-col gap-2">
        <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{p.titulo}</p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-xl text-gray-900">${p.precio}</span>
          <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.categoria}</span>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          {p.vendedor} · {p.ubicacion}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-4 pb-4">
        <a
          href={p.disponible ? waProductUrl(p.titulo) : undefined}
          target="_blank" rel="noopener noreferrer"
          className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-sm font-semibold transition-all
            ${p.disponible
              ? 'bg-gray-900 text-yellow-400 hover:bg-gray-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
            }`}
        >
          {p.disponible ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              Consultar
            </>
          ) : 'Sin stock'}
        </a>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════
export default function PlazaPage() {
  const [catActiva, setCatActiva] = useState('Todas')
  const [busqueda, setBusqueda]   = useState('')

  const filtrados = MOCK_PRODUCTS
    .filter((p) => catActiva === 'Todas' || p.categoria === catActiva)
    .filter((p) => !busqueda || p.titulo.toLowerCase().includes(busqueda.toLowerCase()) || p.vendedor.toLowerCase().includes(busqueda.toLowerCase()))
    // Destacados primero
    .sort((a, b) => (b.prioridad === 'destacado') - (a.prioridad === 'destacado'))

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900 h-14 flex items-center px-4 justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            <span className="hidden sm:inline">Repuestos Mérida</span>
          </Link>
          <span className="text-gray-600 hidden sm:inline">·</span>
          <span className="font-bold text-yellow-400 text-lg">Plaza</span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full hidden sm:inline">Marketplace</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/plaza/solicitar"
            className="text-sm text-yellow-400 border border-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-400 hover:text-gray-900 transition-all font-medium"
          >
            Solicitar
          </Link>
          <Link
            href="/plaza/publicar"
            className="text-sm bg-yellow-400 text-gray-900 px-4 py-1.5 rounded-lg hover:bg-yellow-300 transition-all font-bold"
          >
            + Publicar
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gray-900 pt-20 pb-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-3 py-1.5 rounded-full mb-4 border border-gray-700">
            🏪 Plaza · Marketplace de Repuestos
          </span>
          <h1 className="font-bold text-3xl sm:text-4xl text-white mb-3 leading-tight">
            El mercado de repuestos de{' '}
            <span className="text-yellow-400">Los Andes</span>
          </h1>
          <p className="text-gray-400 text-base mb-6 max-w-xl mx-auto">
            Compra, vende y solicita repuestos automotrices directo con vendedores de Mérida.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto mb-6">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Busca repuestos, marca, vendedor…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setCatActiva('Todas') }}
              className="w-full pl-12 pr-4 py-3 rounded-xl border-0 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 text-xs">
            <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700">📦 500+ productos</span>
            <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full border border-gray-700">✅ Vendedores verificados</span>
          </div>
        </div>
      </section>

      {/* ── Category tabs (sticky) ── */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCatActiva(cat); setBusqueda('') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                ${catActiva === cat
                  ? 'bg-gray-900 text-yellow-400'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {CAT_EMOJI[cat]} {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Product grid ── */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500 text-sm">
            <span className="font-semibold text-gray-900">{filtrados.length}</span> resultado{filtrados.length !== 1 && 's'}
            {busqueda && <span> para &ldquo;{busqueda}&rdquo;</span>}
          </p>
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-xs text-gray-400 hover:text-gray-700 underline">
              Limpiar búsqueda
            </button>
          )}
        </div>

        {filtrados.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-600 font-semibold text-lg">Sin resultados</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">¿No encuentras lo que buscas?</p>
            <Link href="/plaza/solicitar" className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition-all text-sm">
              Crear solicitud
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtrados.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </main>

      {/* ── Bottom CTA ── */}
      <section className="bg-gray-900 py-14 px-4 mt-8">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-bold text-2xl sm:text-3xl text-white mb-2">
            ¿Tienes un repuesto para vender?
          </h2>
          <p className="text-gray-400 text-base mb-6">
            Publica gratis en Plaza y llega a compradores de toda la región andina.
          </p>
          <Link
            href="/plaza/publicar"
            className="inline-flex items-center gap-2 bg-yellow-400 text-gray-900 font-bold text-base px-8 py-3 rounded-xl hover:bg-yellow-300 transition-all hover:shadow-lg"
          >
            + Publicar gratis
          </Link>
          <p className="mt-4 text-gray-500 text-sm">
            ¿No encuentras lo que buscas?{' '}
            <Link href="/plaza/solicitar" className="text-yellow-400 hover:underline font-medium">
              Crear una solicitud →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Plaza AI Chat ── */}
      <PlazaChat />
    </div>
  )
}
