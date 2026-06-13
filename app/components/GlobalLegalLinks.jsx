'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function GlobalLegalLinks() {
  const pathname = usePathname()

  if (pathname === '/') return null

  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-600">
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Información legal">
        <Link href="/politica-privacidad" className="hover:text-gray-950 hover:underline">
          Política de Privacidad
        </Link>
        <Link href="/aviso-legal" className="hover:text-gray-950 hover:underline">
          Aviso Legal
        </Link>
        <Link href="/politica-cookies" className="hover:text-gray-950 hover:underline">
          Política de Cookies
        </Link>
        <Link href="/terminos-condiciones" className="hover:text-gray-950 hover:underline">
          Términos y Condiciones
        </Link>
      </nav>
    </footer>
  )
}
