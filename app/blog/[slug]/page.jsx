import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import AdSenseBlock from '@/app/components/AdSenseBlock'
import { POSTS, getPost, getAllSlugs } from '../posts'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export function generateMetadata({ params }) {
  const post = getPost(params.slug)
  if (!post) return {}
  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    title: `${post.title} | Repuestos Mérida`,
    description: post.excerpt,
    keywords: post.keywords?.join(', '),
    alternates: { canonical: `/blog/${post.slug}` },
    robots: post.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: 'article',
      siteName: 'Repuestos Mérida',
      images: [{ url: post.hero.src, alt: post.hero.alt }],
      locale: 'es_VE',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.hero.src],
    },
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function ArticlePage({ params }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  // Relacionados: nunca enlazar a artículos noindex (p. ej. los del club/bingo).
  const related = POSTS.filter((p) => p.slug !== post.slug && !p.noindex).slice(0, 2)
  const url = `${SITE_URL}/blog/${post.slug}`

  // JSON-LD: Article + FAQ + Breadcrumb para resultados enriquecidos.
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: `${SITE_URL}${post.hero.src}`,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'Repuestos Mérida' },
    publisher: {
      '@type': 'Organization',
      name: 'Repuestos Mérida',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/iconorm.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }
  const faqLd = post.faq?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Cabecera */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <nav className="flex items-center gap-2 text-xs font-semibold text-gray-500">
            <Link href="/" className="hover:text-yellow-600">Inicio</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-yellow-600">Blog</Link>
          </nav>
          <span className="mt-4 inline-block text-xs font-bold uppercase tracking-wider text-yellow-600">
            {post.category}
          </span>
          <h1 className="mt-2 font-brand text-3xl leading-tight text-gray-950 sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-base leading-7 text-gray-600">{post.excerpt}</p>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} min de lectura</span>
          </div>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-8">
        {/* Imagen principal */}
        <figure className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <Image
            src={post.hero.src}
            alt={post.hero.alt}
            width={1400}
            height={788}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="h-auto w-full object-cover"
          />
        </figure>

        {/* Introducción */}
        <p className="mt-8 text-lg leading-8 text-gray-800">{post.intro}</p>

        {/* Secciones */}
        {post.sections.map((section, i) => (
          <section key={section.heading} className="mt-10">
            <h2 className="font-brand text-2xl text-gray-950">{section.heading}</h2>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="mt-4 text-base leading-7 text-gray-700">{p}</p>
            ))}
            {section.image && (
              <figure className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <Image
                  src={section.image.src}
                  alt={section.image.alt}
                  width={1200}
                  height={900}
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="h-auto w-full object-cover"
                />
                {section.image.caption && (
                  <figcaption className="px-4 py-2 text-center text-xs text-gray-500">
                    {section.image.caption}
                  </figcaption>
                )}
              </figure>
            )}

            {/* Un anuncio a mitad del artículo (salvo artículos marcados sin anuncios) */}
            {i === 1 && post.ads !== false && (
              <div className="mt-8">
                <AdSenseBlock slot="9388951189" label="Anuncio" />
              </div>
            )}
          </section>
        ))}

        {/* Preguntas frecuentes */}
        {post.faq?.length > 0 && (
          <section className="mt-12">
            <h2 className="font-brand text-2xl text-gray-950">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
              {post.faq.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-gray-900 marker:hidden">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Llamado a la acción */}
        <aside className="mt-12 rounded-2xl bg-gray-950 p-6 text-center text-white">
          <h2 className="font-brand text-2xl text-yellow-400">¿Buscas este repuesto en Mérida?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-300">
            Publica tu solicitud con los datos de tu vehículo y deja que los comercios de la ciudad
            te coticen. También puedes explorar el catálogo disponible.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/plaza/solicitar"
              className="inline-flex w-full items-center justify-center rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 hover:bg-yellow-300 sm:w-auto"
            >
              Publicar mi solicitud
            </Link>
            <Link
              href="/plaza"
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-700 px-5 py-3 text-sm font-bold text-white hover:bg-gray-800 sm:w-auto"
            >
              Explorar catálogo
            </Link>
          </div>
        </aside>

        {/* Artículos relacionados */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-brand text-2xl text-gray-950">Sigue leyendo</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    <Image
                      src={r.hero.src}
                      alt={r.hero.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 384px"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">{r.category}</span>
                    <h3 className="mt-1 font-brand text-lg leading-snug text-gray-950">{r.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10">
          <Link href="/blog" className="text-sm font-semibold text-yellow-600 hover:text-yellow-700">
            ← Volver al blog
          </Link>
        </div>
      </article>
    </main>
  )
}
