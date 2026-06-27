import Link from 'next/link'
import Image from 'next/image'
import { POSTS } from './posts'

export const metadata = {
  title: 'Blog de Repuestos en Mérida | Guías y consejos | Repuestos Mérida',
  description:
    'Guías prácticas para comprar repuestos automotrices en Mérida: frenos, compatibilidad por modelo, sistema eléctrico y mantenimiento. Pide la pieza correcta a la primera.',
  alternates: { canonical: '/blog' },
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function BlogPage() {
  const [featured, ...rest] = POSTS

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <section className="border-b border-gray-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-semibold text-yellow-600 hover:text-yellow-700">
            ← Repuestos Mérida
          </Link>
          <h1 className="mt-4 font-brand text-4xl text-gray-950">
            Guías para comprar repuestos en Mérida
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
            Consejos prácticos para pedir cotizaciones con datos claros, comparar compatibilidad y
            evitar compras equivocadas. Escritos pensando en quienes mantienen su carro en Mérida y
            sus alrededores.
          </p>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="mx-auto max-w-5xl">
          {/* Artículo destacado */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md md:grid-cols-2"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100 md:aspect-auto">
                <Image
                  src={featured.hero.src}
                  alt={featured.hero.alt}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col justify-center p-6">
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">
                  {featured.category}
                </span>
                <h2 className="mt-2 font-brand text-2xl leading-tight text-gray-950 sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">{featured.excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
                  <time dateTime={featured.date}>{formatDate(featured.date)}</time>
                  <span aria-hidden>·</span>
                  <span>{featured.readingMinutes} min</span>
                </div>
              </div>
            </Link>
          )}

          {/* Resto de artículos */}
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                  <Image
                    src={post.hero.src}
                    alt={post.hero.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 384px"
                    className="object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">
                    {post.category}
                  </span>
                  <h2 className="mt-2 font-brand text-xl leading-snug text-gray-950">{post.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{post.excerpt}</p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span aria-hidden>·</span>
                    <span>{post.readingMinutes} min</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
