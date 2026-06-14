'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { get, ref } from 'firebase/database'
import { firestore, rtdb } from '@/lib/firebase'

const OFFICIAL_WHATSAPP = '584123375417'
const DIRECTORY_KEY = 'repuestos-merida-directorio'

function firstImage(value) {
  if (Array.isArray(value)) return value.find((item) => typeof item === 'string') || ''
  return typeof value === 'string' ? value : ''
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Consultar precio'
  const raw = String(value).trim()
  if (!raw) return 'Consultar precio'
  if (raw.startsWith('$')) return raw
  const number = Number(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(number) && number > 0 ? `$${number}` : raw
}

function normalizeProduct(data, id) {
  return {
    id,
    name: data.marca || data.categoria || data.descripcion || data.vehiculo || 'Repuesto',
    image: firstImage(data.img),
    price: formatPrice(data.precio),
    category: data.categoria || 'Repuesto automotriz',
    description: data.descripcion || '',
    compatibility: data.modelos || data.vehiculo || 'Compatibilidad por confirmar con el vendedor',
    vehicle: data.vehiculo || '',
    year: data.anio || data.año || data.year || '',
    whatsapp: data.whatsapp || '',
    sellerId: data.userID || '',
    available: data.publicado !== 'agotado' && data.estado !== 'agotado',
  }
}

function whatsappUrl(number, product) {
  const phone = String(number || OFFICIAL_WHATSAPP).replace(/\D/g, '')
  const message = [
    `Hola, vi el repuesto "${product.name}" en Repuestos Mérida.`,
    `Referencia: ${product.id}`,
    '¿Sigue disponible y cuál es el precio final?',
  ].join('\n')
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

function sellerCoordinates(seller = {}) {
  const rawLat = seller.latitud ?? seller.latitude ?? seller.lat ?? seller.coords?.lat ?? seller.coordenadas?.lat
  const rawLng = seller.longitud ?? seller.longitude ?? seller.lng ?? seller.lon ??
    seller.coords?.lng ?? seller.coordenadas?.lng
  const lat = rawLat === '' || rawLat === null || rawLat === undefined ? NaN : Number(rawLat)
  const lng = rawLng === '' || rawLng === null || rawLng === undefined ? NaN : Number(rawLng)

  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng }
  }

  const locationText = [seller.ubicacion, seller.zona, seller.ciudad].filter(Boolean).join(', ')
  const match = locationText.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)/)
  if (!match) return null

  const parsedLat = Number(match[1])
  const parsedLng = Number(match[2])
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    && Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180
    ? { lat: parsedLat, lng: parsedLng }
    : null
}

function sellerMapUrl(seller = {}) {
  if (seller.googleMapsUrl) return seller.googleMapsUrl
  const coordinates = sellerCoordinates(seller)
  if (coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
  }
  const query = [seller.ubicacion, seller.zona, seller.ciudad].filter(Boolean).join(', ')
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : 'https://maps.google.com/'
}

function sellerMapEmbedUrl(seller = {}) {
  const coordinates = sellerCoordinates(seller)
  if (!coordinates) return ''
  return `https://maps.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=17&output=embed`
}

export default function RepuestoDetailPage({ params }) {
  const productId = decodeURIComponent(params.id)
  const [product, setProduct] = useState(null)
  const [seller, setSeller] = useState(null)
  const [status, setStatus] = useState('loading')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    getDoc(doc(firestore, 'merida', productId))
      .then(async (snapshot) => {
        if (cancelled) return
        if (!snapshot.exists()) {
          setStatus('not-found')
          return
        }

        const nextProduct = normalizeProduct(snapshot.data(), snapshot.id)
        setProduct(nextProduct)

        if (nextProduct.sellerId) {
          try {
            const sellerSnapshot = await get(ref(rtdb, `users/${nextProduct.sellerId}`))
            if (!cancelled && sellerSnapshot.exists()) setSeller(sellerSnapshot.val())
          } catch {}
        }

        if (!cancelled) setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [productId])

  const location = useMemo(() => (
    [seller?.ubicacion, seller?.zona, seller?.ciudad].filter(Boolean).join(', ')
  ), [seller])
  const mapEmbedUrl = useMemo(() => sellerMapEmbedUrl(seller || {}), [seller])

  useEffect(() => {
    if (!product) return
    try {
      const current = JSON.parse(window.localStorage.getItem(DIRECTORY_KEY) || '[]')
      setSaved(Array.isArray(current) && current.some((item) => String(item.id) === String(product.id)))
    } catch {
      setSaved(false)
    }
  }, [product])

  function saveToDirectory() {
    if (!product) return

    let current = []
    try {
      const parsed = JSON.parse(window.localStorage.getItem(DIRECTORY_KEY) || '[]')
      current = Array.isArray(parsed) ? parsed : []
    } catch {}

    const entry = {
      id: product.id,
      nombre: product.name,
      precio: product.price,
      marca: product.category,
      compat: product.compatibility,
      imagen: product.image,
      nota: '',
      preguntas: `Hola, me interesa ${product.name}. ¿Sigue disponible y cuál es el precio final?`,
      comercio: seller?.google_nombre || seller?.nombre || 'Comercio afiliado',
      ubicacion: location,
      savedAt: Date.now(),
    }

    const next = [
      entry,
      ...current.filter((item) => String(item.id) !== String(product.id)),
    ]
    window.localStorage.setItem(DIRECTORY_KEY, JSON.stringify(next))
    setSaved(true)
  }

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-yellow-400/30 border-t-yellow-400" />
      </main>
    )
  }

  if (status === 'not-found' || status === 'error' || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="text-5xl">🔍</div>
          <h1 className="mt-4 text-2xl font-extrabold text-gray-900">Repuesto no encontrado</h1>
          <p className="mt-2 text-sm text-gray-500">
            La publicación no existe, fue retirada o no está disponible temporalmente.
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-gray-900 px-5 py-3 font-bold text-yellow-400">
            Volver al catálogo
          </Link>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900">
      <header className="border-b border-gray-800 bg-gray-950 text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={38} height={38} className="rounded-lg" />
            <span className="font-brand text-base">Repuestos <span className="text-yellow-400">Mérida</span></span>
          </Link>
          <Link href="/#catalogo" className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800">
            Volver al catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <nav className="mb-5 text-xs text-gray-500" aria-label="Migas de pan">
          <Link href="/" className="hover:text-gray-900">Inicio</Link>
          <span className="mx-2">/</span>
          <Link href="/#catalogo" className="hover:text-gray-900">Catálogo</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{product.name}</span>
        </nav>

        <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
            <section className="relative min-h-[340px] bg-gray-100 sm:min-h-[520px]">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-contain p-4 sm:p-8"
                />
              ) : (
                <div className="flex min-h-[340px] items-center justify-center text-8xl text-gray-300 sm:min-h-[520px]">📦</div>
              )}
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-gray-800 shadow">
                {product.category}
              </span>
            </section>

            <section className="flex flex-col p-5 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  product.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {product.available ? 'Disponible' : 'Agotado'}
                </span>
                <span className="text-xs text-gray-400">Ref. {product.id}</span>
              </div>

              <h1 className="mt-5 font-brand text-3xl leading-tight text-gray-950 sm:text-4xl">{product.name}</h1>
              <p className="mt-3 font-brand text-3xl text-green-600">{product.price}</p>

              <dl className="mt-7 space-y-4 border-y border-gray-100 py-5">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Compatible con</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-gray-700">{product.compatibility}</dd>
                </div>
                {product.vehicle && (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Vehículo</dt>
                    <dd className="mt-1 text-sm text-gray-700">{product.vehicle}</dd>
                  </div>
                )}
                {product.year && (
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wide text-gray-400">Año</dt>
                    <dd className="mt-1 text-sm text-gray-700">{product.year}</dd>
                  </div>
                )}
              </dl>

              {product.description && (
                <div className="mt-6">
                  <h2 className="text-sm font-extrabold text-gray-900">Descripción</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{product.description}</p>
                </div>
              )}

              <div className="mt-auto pt-7">
                <button
                  type="button"
                  onClick={saveToDirectory}
                  className={`mb-3 flex w-full items-center justify-center rounded-xl border px-5 py-3 font-bold transition ${
                    saved
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-300 bg-white text-gray-800 hover:border-yellow-400 hover:bg-yellow-50'
                  }`}
                >
                  {saved ? 'Guardado en mi directorio' : 'Guardar en mi directorio'}
                </button>
                <a
                  href={whatsappUrl(product.whatsapp || seller?.whatsapp || seller?.telefono, product)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex w-full items-center justify-center rounded-xl px-5 py-3.5 font-bold text-white ${
                    product.available ? 'bg-[#25D366] hover:bg-[#1fbd5b]' : 'pointer-events-none bg-gray-400'
                  }`}
                >
                  Consultar por WhatsApp
                </a>
                {saved && (
                  <Link
                    href="/directorio"
                    className="mt-3 flex w-full items-center justify-center text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    Ver mi directorio
                  </Link>
                )}
              </div>
            </section>
          </div>
        </article>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Publicado por</p>
            <h2 className="mt-2 text-xl font-extrabold text-gray-900">
              {seller?.google_nombre || seller?.nombre || 'Comercio afiliado'}
            </h2>
            {seller?.tipovender && <p className="mt-1 text-sm text-gray-500">{seller.tipovender}</p>}
            <p className="mt-4 text-sm text-gray-600">{location || 'Ubicación por confirmar con el vendedor'}</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Ubicación</p>
            <h2 className="mt-2 text-xl font-extrabold text-gray-900">Cómo llegar</h2>
            <p className="mt-2 text-sm text-gray-600">Confirma disponibilidad y horario antes de trasladarte.</p>
            <a
              href={sellerMapUrl(seller || {})}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
            >
              Abrir en Google Maps
            </a>
          </div>
        </section>

        {mapEmbedUrl && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Ubicación exacta</p>
                <h2 className="mt-1 text-xl font-extrabold text-gray-900">Mapa del comercio</h2>
              </div>
              <a
                href={sellerMapUrl(seller || {})}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
              >
                Abrir mapa
              </a>
            </div>
            <iframe
              src={mapEmbedUrl}
              title={`Ubicación de ${seller?.google_nombre || seller?.nombre || 'la tienda'}`}
              className="h-[360px] w-full border-0 sm:h-[440px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </section>
        )}
      </main>
    </div>
  )
}
