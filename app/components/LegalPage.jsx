import Link from 'next/link'

export default function LegalPage({ title, updated, children }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 text-gray-800">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-yellow-700 hover:underline">
          Volver a Repuestos Mérida
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-gray-950">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Última actualización: {updated}</p>
        <div className="mt-8 space-y-7 leading-7 [&_a]:text-blue-700 [&_a]:underline [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
        <nav className="mt-10 border-t border-gray-200 pt-6 text-sm" aria-label="Páginas legales">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/politica-privacidad" className="hover:underline">
              Política de Privacidad
            </Link>
            <Link href="/aviso-legal" className="hover:underline">
              Aviso Legal
            </Link>
            <Link href="/politica-cookies" className="hover:underline">
              Política de Cookies
            </Link>
            <Link href="/terminos-condiciones" className="hover:underline">
              Términos y Condiciones
            </Link>
          </div>
        </nav>
      </article>
    </main>
  )
}
