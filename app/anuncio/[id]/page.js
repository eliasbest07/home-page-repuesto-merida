'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'

const WA_NUMBER = '+584123375417'

function normalizeRow(row) {
  return {
    ...row,
    redes: Array.isArray(row.redes)
      ? row.redes
      : (() => { try { return JSON.parse(row.redes || '[]') } catch { return [] } })(),
    pagos: Array.isArray(row.pagos)
      ? row.pagos
      : (row.pagos ? String(row.pagos).split(',').map((s) => s.trim()).filter(Boolean) : []),
    disponible: row.disponible !== false,
  }
}

function imgUrl(fuente) {
  const url = Array.isArray(fuente) ? fuente[0] : fuente
  if (!url || !String(url).startsWith('http')) return null
  try {
    const host = new URL(url).hostname
    if (
      host === 'storage.googleapis.com' ||
      host === 'firebasestorage.googleapis.com' ||
      host.endsWith('.firebasestorage.googleapis.com')
    ) return url
  } catch {}
  return `/api/img?url=${encodeURIComponent(url)}`
}

function waUrl(item) {
  const num = String(item.whatsapp || WA_NUMBER).replace(/\s/g, '')
  const texto = item.titulo
    ? `Hola, vi el anuncio: *${item.titulo}* en Plaza - Repuestos Merida. Esta disponible?`
    : 'Hola, vi tu anuncio en Plaza - Repuestos Merida. Esta disponible?'
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

function formatDate(value) {
  const seconds = value?.seconds
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AnuncioDetallePage() {
  const params = useParams()
  const id = decodeURIComponent(String(params?.id || ''))
  const [anuncio, setAnuncio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!id) return undefined

    setLoading(true)
    setError('')
    getDoc(doc(firestore, 'anuncios', id))
      .then((snap) => {
        if (cancelled) return
        if (!snap.exists()) {
          setError('Anuncio no encontrado.')
          return
        }
        setAnuncio(normalizeRow({ id: snap.id, ...snap.data() }))
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'No se pudo cargar el anuncio.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
      </div>
    )
  }

  if (error || !anuncio) {
    return (
      <div className="min-h-screen bg-gray-100 px-4 py-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-bold text-gray-900">{error || 'Anuncio no encontrado.'}</p>
          <Link href="/plaza" className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950">
            Volver a Plaza
          </Link>
        </div>
      </div>
    )
  }

  const rawImage = Array.isArray(anuncio.imagen_url) ? anuncio.imagen_url[0] : (anuncio.imagen_url || anuncio.imagen_ref)
  const image = imgUrl(rawImage)
  const disponible = anuncio.disponible !== false
  const meta = [anuncio.ubicacion, formatDate(anuncio.creado_en)].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950">
      <header className="sticky top-0 z-20 bg-gray-950 px-4 py-3 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link href="/plaza" className="text-sm font-semibold text-gray-300 hover:text-white">
            Plaza
          </Link>
          <span className="truncate text-sm font-bold">Detalle del anuncio</span>
          <Link href="/" className="text-sm font-semibold text-gray-300 hover:text-white">
            Inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="relative flex aspect-[4/3] items-center justify-center bg-gray-100 sm:aspect-[16/9]">
            {image ? (
              <Image src={image} alt={anuncio.titulo || 'Anuncio'} fill unoptimized sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            ) : (
              <span className="text-7xl">{anuncio.emoji || '📦'}</span>
            )}
            {!disponible && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm">No disponible</span>
              </div>
            )}
          </div>

          <div className="space-y-4 p-5">
            <div>
              {anuncio.categoria && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                  {anuncio.categoria}
                </span>
              )}
              <h1 className="mt-3 text-2xl font-extrabold leading-tight text-gray-950">{anuncio.titulo || 'Anuncio'}</h1>
              {meta && <p className="mt-1 text-sm text-gray-500">{meta}</p>}
            </div>

            {anuncio.precio != null ? (
              <p className="text-3xl font-extrabold text-gray-950">
                ${anuncio.precio} <span className="text-base font-semibold text-gray-400">USD</span>
              </p>
            ) : (
              <p className="text-lg font-bold text-gray-400">Consultar precio</p>
            )}

            {anuncio.descripcion && (
              <section className="rounded-2xl bg-gray-50 p-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Descripción</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{anuncio.descripcion}</p>
              </section>
            )}

            <div className="rounded-2xl border border-gray-100 p-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Vendedor</h2>
              <p className="mt-2 text-sm font-bold text-gray-900">{anuncio.vendedor || 'Contactar por WhatsApp'}</p>
              {anuncio.ubicacion && <p className="mt-1 text-sm text-gray-500">{anuncio.ubicacion}</p>}
            </div>

            <a
              href={disponible ? waUrl(anuncio) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-12 items-center justify-center rounded-xl text-sm font-extrabold ${disponible ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d]' : 'pointer-events-none bg-gray-100 text-gray-400'}`}
            >
              {disponible ? 'Escribir por WhatsApp' : 'No disponible'}
            </a>
          </div>
        </article>

        {/* Consejos de compra segura (útil para cualquier anuncio de Plaza) */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
              Compra con confianza en Plaza
            </h2>
            <ul className="mt-3 space-y-2">
              {[
                'Confirma por WhatsApp que el artículo o servicio sigue disponible antes de trasladarte.',
                'Pide fotos o detalles adicionales y, si es un repuesto, verifica la compatibilidad con tu vehículo.',
                'Acuerda un punto de encuentro seguro y revisa el producto antes de pagar.',
                'Recuerda que el trato es directo entre las partes: Repuestos Mérida no interviene en la negociación.',
              ].map((tip) => (
                <li key={tip} className="flex gap-2 text-sm leading-6 text-gray-600">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/blog/como-usar-plaza-repuestos-merida"
            className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 text-sm font-bold text-gray-800 hover:bg-gray-50"
          >
            <span>
              <span className="text-gray-400">Guía: </span>
              Cómo usar Plaza paso a paso
            </span>
            <span aria-hidden className="shrink-0 text-yellow-600">→</span>
          </Link>
        </section>
      </main>
    </div>
  )
}
