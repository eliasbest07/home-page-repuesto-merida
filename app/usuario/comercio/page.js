'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { ensureSession } from '@/lib/rifaSession'

function imgUrl(ref) {
  const url = Array.isArray(ref) ? ref[0] : ref
  if (!url || !String(url).startsWith('http')) return null
  return url
}

function uniqueById(rows) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
}

export default function UsuarioComercioPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureSession().then((current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent('/usuario/comercio')}`)
        return
      }
      setSession(current)
    })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!session?.telefono) return
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([
      getDocs(query(collection(firestore, 'anuncios'), where('telefono', '==', session.telefono))),
      getDocs(query(collection(firestore, 'anuncios'), where('whatsapp', '==', session.telefono))),
    ])
      .then((snaps) => {
        if (cancelled) return
        const rows = uniqueById(snaps.flatMap((snap) => snap.docs)
          .map((d) => ({ id: d.id, ...d.data() }))
        )
          .sort((a, b) => (b.creado_en?.seconds ?? 0) - (a.creado_en?.seconds ?? 0))
        setItems(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'No se pudieron cargar tus publicaciones.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [session?.telefono])

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950">
      <nav className="sticky top-0 z-20 flex h-14 items-center justify-between bg-gray-950 px-4 text-white shadow-lg">
        <Link href="/usuario/opciones" className="text-sm font-semibold text-gray-300 hover:text-white">Opciones</Link>
        <span className="text-sm font-bold">Mi comercio</span>
        <Link href="/plaza/publicar" className="text-sm font-semibold text-yellow-400 hover:text-yellow-300">Publicar</Link>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">Publicaciones</p>
          <h1 className="mt-2 text-2xl font-extrabold">Repuestos publicados</h1>
          <p className="mt-1 text-sm text-gray-500">Lista de anuncios asociados a tu WhatsApp.</p>
        </section>

        {loading && (
          <div className="mt-5 flex justify-center rounded-2xl bg-white p-8">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="mt-5 rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-gray-900">No tienes repuestos publicados</p>
            <p className="mt-1 text-sm text-gray-500">Cuando publiques en Plaza aparecerán aquí.</p>
            <Link href="/plaza/publicar" className="mt-5 inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-extrabold text-gray-950 hover:bg-yellow-300">
              Publicar repuesto
            </Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-5 grid gap-3">
            {items.map((item) => {
              const image = imgUrl(item.imagen_url || item.imagen_ref)
              return (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex gap-3 p-3">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 text-3xl">
                      {image ? (
                        <Image src={image} alt="" fill unoptimized sizes="96px" className="object-cover" />
                      ) : (
                        <span>{item.emoji || '📦'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="line-clamp-2 text-sm font-extrabold text-gray-950">{item.titulo || 'Sin título'}</h2>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${item.disponible === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                          {item.disponible === false ? 'Pausado' : 'Activo'}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-extrabold text-gray-950">
                        {item.precio != null ? `$${item.precio}` : 'Consultar precio'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/anuncio/${encodeURIComponent(item.id)}`} className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-bold text-yellow-400">
                          Ver detalle
                        </Link>
                        <Link href="/plaza/mis-anuncios" className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700">
                          Administrar
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
