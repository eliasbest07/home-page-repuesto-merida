'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { LOCAL_SEO_SIGNALS } from '@/lib/localSeoSignals'
import { collection, getDocs } from 'firebase/firestore'
import { get, ref } from 'firebase/database'
import { firestore, rtdb } from '@/lib/firebase'

const PlazaChat = dynamic(() => import('./components/PlazaChat'), { ssr: false })
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'
const CITAS_TECNICAS = [
  { nombre: 'NHTSA Vehicle Maintenance', url: 'https://www.nhtsa.gov/road-safety/vehicle-safety-maintenance' },
  { nombre: 'Bosch Automotive Aftermarket', url: 'https://www.boschaftermarket.com/' },
  { nombre: 'NGK Spark Plugs Catalog', url: 'https://www.ngkntk.com/' },
  { nombre: 'Gates Automotive', url: 'https://www.gates.com/us/en.html' },
]

// ════════════════════════════════════════════════
// CONFIGURACIÓN DE CONTACTO
// ════════════════════════════════════════════════
const WA_NUMBER = '+584123375417' // <— Reemplazar con número real
const waUrl = (producto) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Hola, me interesa el repuesto: *${producto}*. ¿Está disponible y cuál es el precio?`
  )}`

// ════════════════════════════════════════════════
// DATOS DEL CATÁLOGO
// ════════════════════════════════════════════════
const CATEGORIAS = [
  { id: 'todos',         nombre: 'Todos',              emoji: '🔧', bg: 'bg-gray-900',   text: 'text-white'    },
  { id: 'motor',         nombre: 'Motor y Transmisión',emoji: '⚙️', bg: 'bg-amber-100',  text: 'text-amber-900'},
  { id: 'frenos',        nombre: 'Frenos y Suspensión',emoji: '🛞', bg: 'bg-red-100',    text: 'text-red-900'  },
  { id: 'electrico',     nombre: 'Sistema Eléctrico',  emoji: '⚡', bg: 'bg-blue-100',   text: 'text-blue-900' },
  { id: 'carroceria',    nombre: 'Carrocería',         emoji: '🚗', bg: 'bg-purple-100', text: 'text-purple-900'},
  { id: 'filtros',       nombre: 'Filtros y Lubric.',  emoji: '🛢️', bg: 'bg-green-100',  text: 'text-green-900'},
  { id: 'refrigeracion', nombre: 'Refrigeración',      emoji: '💧', bg: 'bg-cyan-100',   text: 'text-cyan-900' },
]

const PRODUCTOS = [
  // ── Motor y Transmisión ──
  { id: 1,  nombre: 'Filtro de Aceite Universal',       categoria: 'motor',         precio: '$4 – $12',    marca: 'Mann / Bosch',        compat: 'Toyota · Ford · Chevrolet · Kia',      disponible: true,  destacado: true  },
  { id: 2,  nombre: 'Correa de Distribución',           categoria: 'motor',         precio: '$15 – $45',   marca: 'Gates / Continental', compat: 'Toyota · Hyundai · Mitsubishi',        disponible: true,  destacado: false },
  { id: 3,  nombre: 'Kit de Empaquetadura Motor',       categoria: 'motor',         precio: '$25 – $80',   marca: 'Victor Reinz',        compat: 'Múltiples modelos',                    disponible: true,  destacado: false },
  { id: 4,  nombre: 'Junta de Culata',                  categoria: 'motor',         precio: '$20 – $60',   marca: 'Elring / Victor',     compat: 'Toyota Land Cruiser · Hilux',          disponible: false, destacado: false },
  { id: 5,  nombre: 'Banda Poly-V / Serpentina',        categoria: 'motor',         precio: '$8 – $25',    marca: 'Gates / Dayco',       compat: 'Ford · Chevrolet · Kia',               disponible: true,  destacado: false },
  { id: 6,  nombre: 'Aceite de Transmisión ATF',        categoria: 'motor',         precio: '$6 – $18',    marca: 'Mobil / Valvoline',   compat: 'Automático y Manual',                  disponible: true,  destacado: true  },
  { id: 7,  nombre: 'Cadena de Distribución',           categoria: 'motor',         precio: '$35 – $95',   marca: 'Iwis / Morse',        compat: 'Toyota · Mitsubishi · Ford',           disponible: true,  destacado: false },
  { id: 8,  nombre: 'Sello / Retén Cigüeñal',           categoria: 'motor',         precio: '$8 – $22',    marca: 'SKF / National',      compat: 'Múltiples modelos',                    disponible: true,  destacado: false },
  // ── Frenos y Suspensión ──
  { id: 9,  nombre: 'Pastillas de Freno Delanteras',    categoria: 'frenos',        precio: '$18 – $55',   marca: 'Brembo / ATE',        compat: 'Toyota · Ford · Hyundai · Kia',        disponible: true,  destacado: true  },
  { id: 10, nombre: 'Discos de Freno Ventilados',       categoria: 'frenos',        precio: '$35 – $90',   marca: 'Brembo / DBA',        compat: 'Toyota Fortuner · Hilux 4×4',          disponible: true,  destacado: false },
  { id: 11, nombre: 'Amortiguadores Delanteros',        categoria: 'frenos',        precio: '$45 – $120',  marca: 'Gabriel / Monroe',    compat: 'Toyota · Mitsubishi L200',             disponible: true,  destacado: true  },
  { id: 12, nombre: 'Kit Rótula y Muñón',               categoria: 'frenos',        precio: '$30 – $75',   marca: 'Moog / TRW',          compat: 'Ford Explorer · Expedition',           disponible: false, destacado: false },
  { id: 13, nombre: 'Líquido de Frenos DOT 4',          categoria: 'frenos',        precio: '$5 – $12',    marca: 'Bosch / Prestone',    compat: 'Universal',                            disponible: true,  destacado: false },
  { id: 14, nombre: 'Muelles / Espirales Suspensión',   categoria: 'frenos',        precio: '$40 – $100',  marca: 'KYB / Bilstein',      compat: 'Chevrolet D-MAX · Colorado',           disponible: true,  destacado: false },
  { id: 15, nombre: 'Barra Estabilizadora (Bujes)',     categoria: 'frenos',        precio: '$15 – $40',   marca: 'Moog / Rare Parts',   compat: 'Ford · Chevrolet · Toyota',            disponible: true,  destacado: false },
  // ── Sistema Eléctrico ──
  { id: 16, nombre: 'Batería 12V / 65Ah',               categoria: 'electrico',     precio: '$60 – $120',  marca: 'Bosch / Varta / Willard', compat: 'Universal',                       disponible: true,  destacado: true  },
  { id: 17, nombre: 'Alternador Reconstruido',           categoria: 'electrico',     precio: '$80 – $180',  marca: 'Denso / Bosch',       compat: 'Toyota · Ford · Chevrolet',            disponible: true,  destacado: false },
  { id: 18, nombre: 'Bujías de Iridio',                  categoria: 'electrico',     precio: '$8 – $25',    marca: 'NGK / Bosch',         compat: 'Motores gasolina y diesel',            disponible: true,  destacado: true  },
  { id: 19, nombre: 'Motor de Arranque',                 categoria: 'electrico',     precio: '$90 – $200',  marca: 'Denso / Bosch',       compat: 'Toyota Land Cruiser · Hilux',          disponible: false, destacado: false },
  { id: 20, nombre: 'Sensor de Oxígeno (Lambda)',        categoria: 'electrico',     precio: '$25 – $70',   marca: 'Bosch / Denso',       compat: 'Toyota · Hyundai · Kia',               disponible: true,  destacado: false },
  { id: 21, nombre: 'Bobina de Encendido',               categoria: 'electrico',     precio: '$20 – $55',   marca: 'Bosch / NGK',         compat: 'Ford · Chevrolet · Mitsubishi',        disponible: true,  destacado: false },
  { id: 22, nombre: 'Cables de Bujías / High Performance',categoria:'electrico',     precio: '$15 – $38',   marca: 'NGK / Belden',        compat: 'Motores gasolina',                     disponible: true,  destacado: false },
  // ── Carrocería ──
  { id: 23, nombre: 'Espejo Retrovisor Completo',        categoria: 'carroceria',    precio: '$35 – $90',   marca: 'OEM Compatible',      compat: 'Toyota Hilux · Land Cruiser',          disponible: true,  destacado: false },
  { id: 24, nombre: 'Parachoques Delantero',             categoria: 'carroceria',    precio: '$80 – $250',  marca: 'OEM / Aftermarket',   compat: 'Ford · Chevrolet · Toyota',            disponible: true,  destacado: false },
  { id: 25, nombre: 'Faro Delantero LED',                categoria: 'carroceria',    precio: '$45 – $150',  marca: 'Depo / TYC',          compat: 'Toyota · Kia · Hyundai',               disponible: true,  destacado: true  },
  { id: 26, nombre: 'Stop Trasero LED',                  categoria: 'carroceria',    precio: '$35 – $100',  marca: 'Depo / OEM',          compat: 'Múltiples modelos',                    disponible: true,  destacado: false },
  { id: 27, nombre: 'Guardafango / Salpicadera',         categoria: 'carroceria',    precio: '$40 – $120',  marca: 'OEM / Dorman',        compat: 'Toyota · Ford · Chevrolet',            disponible: false, destacado: false },
  // ── Filtros y Lubricantes ──
  { id: 28, nombre: 'Aceite Motor 10W-40 (4L)',          categoria: 'filtros',       precio: '$12 – $30',   marca: 'Mobil / Shell / Castrol', compat: 'Gasolina y diesel',              disponible: true,  destacado: true  },
  { id: 29, nombre: 'Filtro de Aire Panel',              categoria: 'filtros',       precio: '$6 – $18',    marca: 'Mann / K&N / Bosch',  compat: 'Toyota · Ford · Hyundai',              disponible: true,  destacado: false },
  { id: 30, nombre: 'Filtro de Combustible',             categoria: 'filtros',       precio: '$8 – $22',    marca: 'Mann / Bosch',        compat: 'Diesel y gasolina',                    disponible: true,  destacado: false },
  { id: 31, nombre: 'Filtro de Cabina / Habitáculo',     categoria: 'filtros',       precio: '$10 – $28',   marca: 'Mann / Valeo',        compat: 'Toyota · Kia · Hyundai',               disponible: true,  destacado: false },
  { id: 32, nombre: 'Aceite de Diferencial 80W-90',      categoria: 'filtros',       precio: '$8 – $20',    marca: 'Mobil / Shell',       compat: '4x4 y tracción total',                 disponible: true,  destacado: false },
  { id: 33, nombre: 'Grasa Multipropósito (1 Kg)',       categoria: 'filtros',       precio: '$4 – $10',    marca: 'Mobil / Shell',       compat: 'Universal',                            disponible: true,  destacado: false },
  // ── Refrigeración ──
  { id: 34, nombre: 'Termostato Motor',                  categoria: 'refrigeracion', precio: '$8 – $25',    marca: 'Gates / OEM',         compat: 'Toyota · Ford · Chevrolet',            disponible: true,  destacado: false },
  { id: 35, nombre: 'Bomba de Agua',                     categoria: 'refrigeracion', precio: '$30 – $80',   marca: 'Aisin / Gates',       compat: 'Toyota · Mitsubishi · Hyundai',        disponible: true,  destacado: true  },
  { id: 36, nombre: 'Radiador Aluminio',                 categoria: 'refrigeracion', precio: '$120 – $350', marca: 'Denso / Valeo',       compat: 'Toyota Hilux · Land Cruiser',          disponible: false, destacado: false },
  { id: 37, nombre: 'Anticongelante / Refrigerante (4L)',categoria: 'refrigeracion', precio: '$8 – $20',    marca: 'Prestone / Peak',     compat: 'Universal',                            disponible: true,  destacado: false },
  { id: 38, nombre: 'Manguera Superior Radiador',        categoria: 'refrigeracion', precio: '$12 – $35',   marca: 'Gates / Goodyear',    compat: 'Múltiples modelos',                    disponible: true,  destacado: false },
  { id: 39, nombre: 'Tapa de Radiador (Presión)',        categoria: 'refrigeracion', precio: '$5 – $15',    marca: 'Stant / OEM',         compat: 'Universal',                            disponible: true,  destacado: false },
]

const HOME_CATEGORY_KEYWORDS = [
  { id: 'motor', terms: ['motor', 'transmision', 'transmisión', 'correa', 'empaque', 'culata', 'reten', 'retén'] },
  { id: 'frenos', terms: ['freno', 'suspension', 'suspensión', 'amortiguador', 'rotula', 'rótula', 'muñon', 'muñón', 'disco'] },
  { id: 'electrico', terms: ['electr', 'bateria', 'batería', 'alternador', 'arranque', 'sensor', 'bujia', 'bujía', 'bobina'] },
  { id: 'carroceria', terms: ['carroceria', 'carrocería', 'parachoque', 'faro', 'retrovisor', 'guardafango', 'stop', 'espejo'] },
  { id: 'filtros', terms: ['filtro', 'aceite', 'lubric', 'liquido', 'liquido', 'líquido', 'grasa'] },
  { id: 'refrigeracion', terms: ['radiador', 'refriger', 'termostato', 'bomba de agua', 'manguera', 'anticongelante'] },
]

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function inferHomeCategory(item) {
  const haystack = normalizeText([
    item.categoria,
    item.marca,
    item.descripcion,
    item.modelos,
    item.vehiculo,
  ].filter(Boolean).join(' '))

  for (const category of HOME_CATEGORY_KEYWORDS) {
    if (category.terms.some((term) => haystack.includes(term))) {
      return category.id
    }
  }

  return 'motor'
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Consultar'
  const raw = String(value).trim()
  if (!raw) return 'Consultar'
  if (raw.startsWith('$')) return raw
  const number = Number(raw.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(number) || number <= 0) return raw
  return `$${number}`
}

function normalizeHomeProduct(item, id) {
  const img = Array.isArray(item.img) ? item.img[0] : item.img
  const nombre =
    item.marca ||
    item.categoria ||
    item.descripcion ||
    item.vehiculo ||
    'Repuesto'

  const compat =
    item.modelos ||
    item.vehiculo ||
    item.descripcion ||
    'Consulta compatibilidad por WhatsApp'

  return {
    id,
    nombre,
    categoria: inferHomeCategory(item),
    precio: formatPrice(item.precio),
    marca: item.categoria || item.vehiculo || 'Catálogo Mérida',
    compat: String(compat).slice(0, 120),
    disponible: item.publicado !== 'agotado' && item.estado !== 'agotado',
    destacado: item.relevancia === '0' || item.relevancia === 0,
    imagen: typeof img === 'string' ? img : '',
    whatsapp: item.whatsapp || WA_NUMBER,
    descripcion: item.descripcion || '',
    userID: item.userID || '',
  }
}

function buildSellerMapUrl(user = {}) {
  if (user.googleMapsUrl) return user.googleMapsUrl

  const query = [
    user.ubicacion,
    user.zona,
    user.ciudad,
  ].filter(Boolean).join(', ')

  if (!query) return 'https://maps.google.com/'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function openOsoForProduct(producto) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('plaza-chat:open-prompt', {
    detail: {
      prompt: `Consulta repuesto: ${producto.nombre}`,
    },
  }))
}

// ════════════════════════════════════════════════
// ÍCONOS SVG INLINE
// ════════════════════════════════════════════════
const IconSearch = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
  </svg>
)
const IconWhatsApp = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.531 5.845L.054 23.447a.5.5 0 00.609.61l5.703-1.49A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.853 0-3.603-.498-5.11-1.371l-.363-.215-3.755.983.998-3.648-.236-.374A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
)
const IconMenu = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
)
const IconX = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
  </svg>
)
const IconStar = () => (
  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
)
const IconMapPin = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)
const IconClock = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IconShield = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
  </svg>
)
const IconStore = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.5 4.5 4h15L21 9.5M5 10v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M9 19v-5h6v5M3 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
  </svg>
)

// ════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════
export default function Home() {
  const [catActiva, setCatActiva]   = useState('todos')
  const [busqueda, setBusqueda]     = useState('')
  const [scrolled, setScrolled]     = useState(false)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [catalogo, setCatalogo]     = useState(PRODUCTOS)
  const [catalogoError, setCatalogoError] = useState('')
  const [usersById, setUsersById]   = useState({})
  const [rutaTienda, setRutaTienda] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let cancelled = false

    getDocs(collection(firestore, 'merida'))
      .then((snap) => {
        if (cancelled) return

        const items = snap.docs
          .map((doc) => normalizeHomeProduct(doc.data(), doc.id))
          .filter((item) => item.imagen)

        if (items.length > 0) {
          setCatalogo(items)
          setCatalogoError('')
        } else {
          setCatalogo(PRODUCTOS)
          setCatalogoError('La colección de repuestos no devolvió imágenes visibles.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setCatalogo(PRODUCTOS)
        setCatalogoError('No se pudo cargar el catálogo de repuestos desde Firebase.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    get(ref(rtdb, 'users'))
      .then((snapshot) => {
        if (cancelled) return
        setUsersById(snapshot.exists() ? snapshot.val() : {})
      })
      .catch(() => {
        if (!cancelled) setUsersById({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  const productosFiltrados = catalogo.filter((p) => {
    const matchCat    = catActiva === 'todos' || p.categoria === catActiva
    const q           = busqueda.toLowerCase()
    const matchSearch = !q ||
      p.nombre.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q)  ||
      p.compat.toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  const handleCat = (id) => {
    setCatActiva(id)
    setBusqueda('')
  }

  const featuredProducts = catalogo.filter((p) => p.destacado).slice(0, 8)
  const homepageUrl = `${SITE_URL}/`
  const flattenedTrendPatterns = LOCAL_SEO_SIGNALS.intentClusters.flatMap((cluster) => cluster.patterns)
  const topLocalTerms = LOCAL_SEO_SIGNALS.highValueKeywords.slice(0, 6)
  const faq = [
    {
      q: '¿Qué es Repuestos Mérida y en qué zona atiende?',
      a: 'Repuestos Mérida es una tienda de repuestos automotrices en Mérida, Venezuela, enfocada en atención directa por WhatsApp y catálogo digital para la región andina.',
    },
    {
      q: '¿Qué marcas y categorías maneja?',
      a: 'El catálogo incluye categorías de motor, frenos, sistema eléctrico, carrocería, filtros y refrigeración, con marcas como Bosch, NGK, Gates y otras marcas reconocidas.',
    },
    {
      q: '¿Cómo verificar compatibilidad de una pieza?',
      a: 'La forma recomendada es compartir por WhatsApp la marca, modelo, año y motorización del vehículo para confirmar número de parte y compatibilidad.',
    },
    {
      q: '¿Qué fuentes usan para recomendaciones de mantenimiento?',
      a: 'Se priorizan guías del fabricante y fuentes técnicas reconocidas como NHTSA y documentación de fabricantes de autopartes.',
    },
    {
      q: '¿Atienden búsquedas locales como “repuestos en Mérida ciudad” o “repuestos cerca en Libertador”?',
      a: 'Sí. El servicio está optimizado para Mérida ciudad y el Municipio Libertador, incluyendo asesoría por WhatsApp para búsquedas de disponibilidad inmediata.',
    },
  ]

  function openStoreRoute(producto) {
    const user = usersById?.[producto.userID] || null
    setRutaTienda({
      producto,
      user,
      mapUrl: buildSellerMapUrl(user || {}),
      routeImage: user?.rutaImg || user?.routeImage || '/ruta-tienda.jpg',
    })
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AutoPartsStore',
      '@id': `${homepageUrl}#autopartsstore`,
      name: 'Repuestos Mérida',
      url: homepageUrl,
      image: `${SITE_URL}/iconorm.png`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: LOCAL_SEO_SIGNALS.region.city,
        addressRegion: LOCAL_SEO_SIGNALS.region.state,
        addressCountry: 'VE',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 8.5897,
        longitude: -71.1561,
      },
      areaServed: [
        {
          '@type': 'City',
          name: `${LOCAL_SEO_SIGNALS.region.city}, ${LOCAL_SEO_SIGNALS.region.state}`,
        },
        {
          '@type': 'AdministrativeArea',
          name: `${LOCAL_SEO_SIGNALS.region.municipality}, ${LOCAL_SEO_SIGNALS.region.state}`,
        },
      ],
      telephone: WA_NUMBER,
      knowsAbout: LOCAL_SEO_SIGNALS.highValueKeywords,
      parentOrganization: {
        '@type': 'Organization',
        name: 'Gochos Group',
      },
      sameAs: CITAS_TECNICAS.map((cita) => cita.url),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${homepageUrl}#website`,
      name: 'Repuestos Mérida',
      url: homepageUrl,
      inLanguage: 'es-VE',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${homepageUrl}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${homepageUrl}#featured-products`,
      name: 'Repuestos Destacados',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: featuredProducts.length,
      itemListElement: featuredProducts.map((p, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Product',
          name: p.nombre,
          brand: p.marca,
          category: CATEGORIAS.find((c) => c.id === p.categoria)?.nombre,
          description: `Compatibilidad: ${p.compat}. Precio de referencia: ${p.precio}.`,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            availability: p.disponible
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            url: homepageUrl,
          },
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${homepageUrl}#faq`,
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    },
  ]

  // ──────────────────────────────────────────────
  // NAVBAR
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      {jsonLd.map((schema, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <nav className={`fixed top-0 left-0 right-0 z-50 bg-gray-900 transition-shadow duration-300 ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <a href="#inicio" className="flex items-center gap-3">
              <Image
                src="/iconorm.png"
                alt="Repuestos Mérida"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div>
                <span className="font-brand text-white text-lg leading-none">Repuestos</span>
                <span className="font-brand text-[#FFD700] text-lg leading-none ml-1">Mérida</span>
                <p className="text-gray-400 text-xs leading-none mt-0.5 hidden sm:block">Gochos Group</p>
              </div>
            </a>

            {/* Nav links – desktop */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#categorias" className="text-gray-300 hover:text-[#FFD700] text-sm font-medium transition-colors">Categorías</a>
              <a href="#catalogo"   className="text-gray-300 hover:text-[#FFD700] text-sm font-medium transition-colors">Catálogo</a>
              <a href="#nosotros"   className="text-gray-300 hover:text-[#FFD700] text-sm font-medium transition-colors">Nosotros</a>
              <a href="#servicios"  className="text-gray-300 hover:text-[#FFD700] text-sm font-medium transition-colors">Servicios</a>
              <Link href="/plaza"   className="text-sm font-bold px-3 py-1.5 rounded-lg bg-[#FFD700] text-gray-900 hover:bg-yellow-300 transition-colors">
                Plaza 🏪
              </Link>
            </div>

            {/* WhatsApp CTA – desktop */}
            <a
              href={waUrl('consulta general')}
              target="_blank" rel="noopener noreferrer"
              className="hidden md:inline-flex btn-whatsapp text-sm"
            >
              <IconWhatsApp />
              Consultar ahora
            </a>

            {/* Menú hamburger – móvil */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-gray-300 hover:text-white p-1"
              aria-label="Menú"
            >
              {menuOpen ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </div>

        {/* Menú móvil */}
        {menuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-gray-700 px-4 py-4 space-y-3">
            {['#categorias','#catalogo','#nosotros','#contacto','#servicios'].map((href, i) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="block text-gray-300 hover:text-[#FFD700] text-sm font-medium py-2 transition-colors"
              >
                {['Categorías','Catálogo','Nosotros','Contacto','Servicios'][i]}
              </a>
            ))}
            <div className="flex gap-2 pt-1">
              <Link
                href="/plaza"
                onClick={() => setMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-[#FFD700] text-gray-900 font-bold text-sm px-4 py-2.5 rounded-lg"
              >
                🏪 Plaza
              </Link>
              <Link
                href="/bingo"
                onClick={() => setMenuOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-white font-bold text-sm px-4 py-2.5 rounded-lg border border-gray-600"
              >
                🎱 Bingo
              </Link>
            </div>
            <a
              href={waUrl('consulta general')}
              target="_blank" rel="noopener noreferrer"
              className="btn-whatsapp w-full justify-center text-sm"
            >
              <IconWhatsApp />
              Consultar por WhatsApp
            </a>
          </div>
        )}
      </nav>

      {/* ──────────────────────────────────────────
          HERO
      ────────────────────────────────────────── */}
      <section id="inicio" className="bg-gray-900 bg-hero-pattern pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto text-center">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-gray-800 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-gray-700">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow inline-block"></span>
            Catálogo actualizado · Mérida, Venezuela
          </div>

          {/* Headline */}
          <h1 className="font-brand text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-4">
            Tu repuesto,{' '}
            <span className="text-gradient-brand">disponible ahora</span>
          </h1>

          {/* Sub */}
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            El catálogo de repuestos automotrices más completo de Mérida ciudad, Municipio Libertador y Los Andes venezolanos.
            Marcas líderes · Precios justos · Atención directa por WhatsApp · Entrega local bajo coordinación.
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto mb-8">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
              <IconSearch />
            </div>
            <input
              type="text"
              placeholder="Busca por repuesto, marca o vehículo…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setCatActiva('todos') }}
              className="search-input pl-12 text-sm"
            />
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#catalogo" className="btn-brand text-base px-8 py-3">
              Ver catálogo completo
            </a>
            <a
              href={waUrl('consulta general')}
              target="_blank" rel="noopener noreferrer"
              className="btn-whatsapp text-base px-8 py-3"
            >
              <IconWhatsApp />
              Hablar con un asesor
            </a>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          TENDENCIAS LOCALES (MÉRIDA)
      ────────────────────────────────────────── */}
      <section className="py-10 px-4 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <span className="text-xs uppercase tracking-widest font-bold text-yellow-500 block mb-2">Tendencias locales · Mérida, Venezuela</span>
            <p className="text-gray-700 text-sm">
              Patrones de búsqueda detectados para {LOCAL_SEO_SIGNALS.region.city} ({LOCAL_SEO_SIGNALS.region.municipality}) actualizados el {LOCAL_SEO_SIGNALS.detectedAt}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {topLocalTerms.map((term) => (
              <span
                key={term}
                className="inline-flex items-center rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700"
              >
                {term}
              </span>
            ))}
          </div>
          
        </div>
      </section>

      {/* ── Stats bar ── */}
      <div className="bg-[#FFD700]">
        <div className="max-w-5xl mx-auto px-4 py-4 grid grid-cols-3 gap-4 text-center">
          {[
            { valor: '39+',  label: 'Repuestos disponibles' },
            { valor: '15+',  label: 'Marcas de calidad'     },
            { valor: '100%', label: 'Atención directa'      },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-brand text-xl sm:text-2xl text-gray-900 leading-none">{s.valor}</p>
              <p className="text-gray-800 text-xs sm:text-sm mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ──────────────────────────────────────────
          CATEGORÍAS
      ────────────────────────────────────────── */}
      <section id="categorias" className="py-16 bg-gray-50 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-brand text-3xl sm:text-4xl text-gray-900 mb-2">
              Categorías de Repuestos
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              Selecciona una categoría para filtrar el catálogo o explora todo el inventario.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {CATEGORIAS.map((cat) => {
              const isActive = catActiva === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCat(cat.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 font-medium text-sm
                    ${isActive
                      ? 'border-gray-900 bg-gray-900 text-[#FFD700] shadow-lg scale-105'
                      : `border-transparent ${cat.bg} ${cat.text} hover:border-gray-300 hover:shadow-md`
                    }`}
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-center leading-tight text-xs">{cat.nombre}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          CATÁLOGO
      ────────────────────────────────────────── */}
      <section id="catalogo" className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">

          {/* Header del catálogo */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="font-brand text-2xl sm:text-3xl text-gray-900">
                {catActiva === 'todos'
                  ? 'Catálogo Completo'
                  : CATEGORIAS.find(c => c.id === catActiva)?.nombre}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {productosFiltrados.length} repuesto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
                {busqueda && ` para "${busqueda}"`}
              </p>
              {catalogoError && (
                <p className="text-amber-600 text-xs mt-2">{catalogoError}</p>
              )}
            </div>

            {/* Búsqueda inline */}
            <div className="relative max-w-xs w-full sm:w-auto">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <IconSearch />
              </div>
              <input
                type="text"
                placeholder="Buscar…"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCatActiva('todos') }}
                className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
              />
            </div>
          </div>

          {/* Grid de productos */}
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-500 text-lg font-medium">No encontramos resultados</p>
              <p className="text-gray-400 text-sm mt-1">Intenta con otro término o{' '}
                <a href={waUrl('consulta: ' + busqueda)} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:underline">
                  consulta por WhatsApp
                </a>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {productosFiltrados.map((p) => (
                <div key={p.id} className="product-card flex flex-col">

                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {p.imagen ? (
                      <Image
                        src={p.imagen}
                        alt={p.nombre}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-5xl">📦</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{p.nombre}</p>
                    </div>
                  </div>

                  {/* Card header */}
                  <div className="bg-gray-50 px-4 py-5 border-b border-gray-100 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 text-xs mt-1">{p.marca}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {p.destacado && <span className="badge-featured">Destacado</span>}
                      <span className={p.disponible ? 'badge-available' : 'badge-unavailable'}>
                        {p.disponible ? '✓ Disponible' : 'Agotado'}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-4 flex-1 flex flex-col gap-3">
                    {/* Precio */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Rango de precio</p>
                      <p className="font-brand text-xl text-gray-900 mt-0.5">{p.precio}</p>
                    </div>

                    {/* Compatibilidad */}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Compatible con</p>
                      <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{p.compat}</p>
                    </div>

                    {/* Categoría badge */}
                    <div>
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium
                        ${CATEGORIAS.find(c => c.id === p.categoria)?.bg}
                        ${CATEGORIAS.find(c => c.id === p.categoria)?.text}`}>
                        {CATEGORIAS.find(c => c.id === p.categoria)?.emoji}{' '}
                        {CATEGORIAS.find(c => c.id === p.categoria)?.nombre}
                      </span>
                    </div>
                  </div>

                  {/* Card footer - CTA */}
                  <div className="px-4 pb-4 space-y-2">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        openOsoForProduct(p)
                      }}
                      className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                        ${p.disponible
                          ? 'bg-[#25D366] text-white hover:bg-[#128C7E] hover:shadow-md'
                          : 'bg-gray-100 text-gray-500 cursor-default pointer-events-none'
                        }`}
                      {...(!p.disponible && { onClick: (e) => e.preventDefault() })}
                    >
                      <IconWhatsApp />
                      {p.disponible ? 'Consultar precio' : 'No disponible'}
                    </a>
                    <button
                      type="button"
                      onClick={() => openStoreRoute(p)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                    >
                      <IconStore />
                      Mostrar dirección de tienda
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ──────────────────────────────────────────
          WHATSAPP CTA BANNER
      ────────────────────────────────────────── */}
      <section id="contacto" className="bg-gradient-to-br from-gray-900 to-gray-800 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="font-brand text-3xl sm:text-4xl text-white mb-3">
            ¿No encuentras tu repuesto?
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
            Escríbenos por WhatsApp con el modelo de tu vehículo y el repuesto que necesitas.
            Nuestro equipo te responde de inmediato.
          </p>
          <a
            href={waUrl('Hola, necesito un repuesto y no lo encontré en el catálogo. ¿Pueden ayudarme?')}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-[#25D366] text-white font-bold text-lg px-10 py-4 rounded-xl hover:bg-[#128C7E] transition-all hover:shadow-2xl hover:-translate-y-1"
          >
            <IconWhatsApp />
            Escribir por WhatsApp
          </a>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center text-gray-500 text-sm">
            <span className="flex items-center gap-1.5"><IconClock />  Lun–Sáb · 8am–6pm</span>
            <span className="flex items-center gap-1.5"><IconMapPin /> Mérida, Venezuela</span>
            <span className="flex items-center gap-1.5"><IconShield /> Garantía en cada repuesto</span>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          SERVICIOS
      ────────────────────────────────────────── */}
      <section id="servicios" className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs uppercase tracking-widest font-bold text-yellow-500 mb-2 block">
              Plataforma
            </span>
            <h2 className="font-brand text-3xl sm:text-4xl text-gray-900 mb-3">
              Nuestros servicios online
            </h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              Más allá del catálogo, te ofrecemos herramientas digitales para la comunidad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* ── Plaza ── */}
            <Link
              href="/plaza"
              className="group relative flex flex-col gap-4 bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-[#FFD700]/60 hover:shadow-xl hover:shadow-yellow-500/10 transition-all duration-300 overflow-hidden"
            >
              {/* Fondo decorativo */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-4 relative">
                <div className="w-14 h-14 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  🏪
                </div>
                <div className="min-w-0">
                  <h3 className="font-brand text-xl font-bold text-white">Plaza</h3>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                    Marketplace de repuestos. Publica, compra y vende piezas directamente con la comunidad.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 relative">
                {['Publicar anuncio','Buscar repuestos','Contacto directo'].map(t => (
                  <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full border border-gray-700">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[#FFD700] text-sm font-semibold relative">
                Ir a Plaza
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {/* ── Bingo ── */}
            <Link
              href="/bingo"
              className="group relative flex flex-col gap-4 bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-[#22C55E]/60 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start gap-4 relative">
                <div className="w-14 h-14 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                  🎱
                </div>
                <div className="min-w-0">
                  <h3 className="font-brand text-xl font-bold text-white">Bingo</h3>
                  <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                    Juego de bingo multijugador en tiempo real. Crea o únete a una sala con un código.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 relative">
                {['Crear sala','Unirse con código','Tiempo real'].map(t => (
                  <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full border border-gray-700">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-[#22C55E] text-sm font-semibold relative">
                Jugar ahora
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          NOSOTROS / MARCAS
      ────────────────────────────────────────── */}
      <section id="nosotros" className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

            {/* Texto */}
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-yellow-500 mb-2 block">Sobre Nosotros</span>
              <h2 className="font-brand text-3xl sm:text-4xl text-gray-900 mb-4">
                La ferretería automotriz de Los Andes
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Somos <strong>Repuestos Mérida</strong>, parte del ecosistema de <strong>Gochos Group</strong>,
                comprometidos con llevar los mejores repuestos automotrices a cada rincón del estado Mérida
                y la región andina venezolana.
              </p>
            

              {/* Trust icons */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '🏆', t: 'Marcas líderes',    d: 'Bosch, NGK, Gates y más' },
                  { icon: '🛡️', t: 'Repuestos originales', d: 'Calidad garantizada'    },
                  { icon: '📱', t: 'Atención digital',  d: 'WhatsApp y app móvil'     },
                  { icon: '🏔️', t: 'Local andino',      d: 'Mérida, Venezuela'        },
                ].map((item) => (
                  <div key={item.t} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-gray-100">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.t}</p>
                      <p className="text-xs text-gray-500">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logos */}
            <div className="flex flex-col items-center gap-8">
              <a
                href="https://play.google.com/store/apps/details?id=com.btmstudio.rep_merida"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Descargar Repuestos Mérida en Google Play"
                className="bg-white rounded-2xl shadow-card p-8 flex flex-col items-center gap-2 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                <Image src="/iconorm.png" alt="Repuestos Mérida" width={120} height={120} className="rounded-xl" />
                <p className="font-brand text-gray-900 mt-2 text-lg">Repuestos Mérida</p>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <IconStar key={i} />)}
                  <span className="text-xs text-gray-500 ml-1">App disponible</span>
                </div>
              </a>
              <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-2 w-full max-w-xs">
                <Image src="/gochosgroup.png" alt="Gochos Group" width={80} height={80} className="rounded-full" />
                <p className="font-medium text-gray-700 text-sm">Parte de Gochos Group</p>
                <p className="text-xs text-gray-400 text-center">Grupo empresarial merideño con presencia digital</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          FAQ + CITAS PARA IA
      ────────────────────────────────────────── */}
      <section id="faq" className="py-16 px-4 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <span className="text-xs uppercase tracking-widest font-bold text-yellow-500 mb-2 block">Resumen para IA y búsqueda semántica</span>
            <h2 className="font-brand text-3xl sm:text-4xl text-gray-900 mb-3">
              Respuestas claras sobre Repuestos Mérida
            </h2>
            <p className="text-gray-600 max-w-3xl">
              Esta sección está redactada en lenguaje natural para facilitar respuestas precisas en motores de búsqueda y asistentes de IA.
              Incluye hechos verificables sobre cobertura, catálogo y método de atención.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-gray-800">
              Intención local detectada con mayor frecuencia: compra inmediata, consulta por marca/modelo, validación de precio y disponibilidad,
              y contacto directo por WhatsApp en Mérida ciudad.
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Términos de intención observados: {flattenedTrendPatterns.slice(0, 5).join(' · ')}.
            </p>
          </div>

          <div className="grid gap-4 mb-10">
            {faq.map((item) => (
              <article key={item.q} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="text-gray-900 font-semibold mb-2">{item.q}</h3>
                <p className="text-gray-700 text-sm leading-relaxed">{item.a}</p>
              </article>
            ))}
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-gray-200">
            <h3 className="font-brand text-2xl text-white mb-2">Fuentes técnicas recomendadas</h3>
            <p className="text-gray-400 text-sm mb-4">
              Para diagnóstico y mantenimiento, priorizamos manuales de fabricante y estas referencias externas de alta calidad.
            </p>
            <ul className="space-y-2 text-sm">
              {CITAS_TECNICAS.map((cita) => (
                <li key={cita.url}>
                  <a
                    href={cita.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#FFD700] hover:text-yellow-300 transition-colors"
                  >
                    {cita.nombre}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────
          FOOTER
      ────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">

            {/* Marca */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Image src="/iconorm.png" alt="Repuestos Mérida" width={36} height={36} className="rounded-lg" />
                <div>
                  <p className="font-brand text-white text-base leading-none">Repuestos <span className="text-[#FFD700]">Mérida</span></p>
                  <p className="text-gray-500 text-xs">Gochos Group</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-500">
                Repuestos automotrices de calidad para Mérida y Los Andes venezolanos.
              </p>
            </div>

            {/* Navegación */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Navegación</p>
              <ul className="space-y-2 text-sm">
                <li><a href="#categorias" className="hover:text-[#FFD700] transition-colors">Categorías</a></li>
                <li><a href="#catalogo"   className="hover:text-[#FFD700] transition-colors">Catálogo</a></li>
                <li><a href="#nosotros"   className="hover:text-[#FFD700] transition-colors">Nosotros</a></li>
                <li><a href="#contacto"   className="hover:text-[#FFD700] transition-colors">Contacto</a></li>
                <li><a href="#servicios"  className="hover:text-[#FFD700] transition-colors">Servicios</a></li>
              </ul>
              <p className="text-white font-semibold text-sm mt-5 mb-3">Servicios</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/plaza" className="hover:text-[#FFD700] transition-colors flex items-center gap-1.5">
                    🏪 Plaza
                  </Link>
                </li>
                <li>
                  <Link href="/bingo" className="hover:text-[#22C55E] transition-colors flex items-center gap-1.5">
                    🎱 Bingo
                  </Link>
                </li>
              </ul>
            </div>

            {/* Categorías rápidas */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Categorías</p>
              <ul className="space-y-2 text-sm">
                {CATEGORIAS.filter(c => c.id !== 'todos').map(c => (
                  <li key={c.id}>
                    <button onClick={() => { handleCat(c.id); document.getElementById('catalogo')?.scrollIntoView({behavior:'smooth'}) }}
                      className="hover:text-[#FFD700] transition-colors text-left">
                      {c.emoji} {c.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-white font-semibold text-sm mb-4">Legal</p>
              <ul className="space-y-2 text-sm">
                <li><Link href="/politica-privacidad"  className="hover:text-[#FFD700] transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/terminos-condiciones" className="hover:text-[#FFD700] transition-colors">Términos y Condiciones</Link></li>
                <li><Link href="/eliminar-datos"       className="hover:text-[#FFD700] transition-colors">Eliminar mis datos</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Repuestos Mérida · Gochos Group · Mérida, Venezuela</p>
            <div className="flex items-center gap-4">
              <a href={waUrl('Hola!')} target="_blank" rel="noopener noreferrer"
                className="text-green-500 hover:text-green-400 transition-colors font-medium">
                WhatsApp
              </a>
              <span>·</span>
              <span>App disponible en móvil</span>
            </div>
          </div>
        </div>
      </footer>

      {rutaTienda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Ubicación</p>
                <h3 className="mt-1 text-xl font-bold text-gray-900">Dirección de la tienda</h3>
              </div>
              <button
                type="button"
                onClick={() => setRutaTienda(null)}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar"
              >
                <IconX />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                <Image
                  src={rutaTienda.routeImage}
                  alt="Ruta hacia la tienda"
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-auto w-full object-cover"
                />
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">
                  {rutaTienda.user?.google_nombre || rutaTienda.user?.nombre || 'Tienda'}
                </p>
                {rutaTienda.user?.tipovender && (
                  <p className="mt-1 text-gray-500">Tipo: {rutaTienda.user.tipovender}</p>
                )}
                <p className="mt-2">
                  {[
                    rutaTienda.user?.ubicacion,
                    rutaTienda.user?.zona,
                    rutaTienda.user?.ciudad,
                  ].filter(Boolean).join(', ') || 'Dirección no disponible'}
                </p>
              </div>

              <p className="text-sm leading-relaxed text-gray-600">
                Aquí puedes ver la referencia visual de la ruta. También puedes abrir la ubicación exacta en Google Maps.
              </p>

              <a
                href={rutaTienda.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-gray-800"
              >
                <IconMapPin />
                Ver ruta a la tienda
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Plaza AI Chat Widget ── */}
      <PlazaChat />

    </div>
  )
}
