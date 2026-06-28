import Link from 'next/link'
import Image from 'next/image'
import MapaClient from './MapaClient'
import { POSTS } from '@/app/blog/posts'

export const metadata = {
  title: 'Mapa de comercios de repuestos en Mérida | Repuestos Mérida',
  description: 'Encuentra comercios de repuestos con ubicación registrada en Mérida y consulta sus productos.',
  alternates: { canonical: '/mapa' },
}

export default function MapaPage() {
  const recommendedPosts = POSTS.filter((post) => !post.noindex).slice(0, 4)

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-3 py-4 text-slate-950 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#8A5A39]">Repuestos Mérida</p>
            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Mapa de comercios</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
              Selecciona un comercio en el mapa o en las tarjetas para ver su ubicación y sus repuestos.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-extrabold text-white transition hover:bg-slate-800"
          >
            Volver al inicio
          </Link>
        </header>

        <MapaClient />

        {recommendedPosts.length > 0 && (
          <section className="mt-10 border-t border-[#e3d8c7] pt-8" aria-labelledby="map-reading-title">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#8A5A39]">Guías y consejos</p>
                <h2 id="map-reading-title" className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                  También puedes leer
                </h2>
              </div>
              <Link href="/blog" className="text-sm font-extrabold text-[#8A5A39] hover:underline">
                Ver todos los artículos →
              </Link>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {recommendedPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                    <Image
                      src={post.hero.src}
                      alt={post.hero.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#8A5A39]">
                      {post.category} · {post.readingMinutes} min
                    </span>
                    <h3 className="mt-2 line-clamp-2 text-lg font-extrabold leading-snug text-slate-950">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                    <span className="mt-4 text-sm font-extrabold text-[#8A5A39]">Leer artículo →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
