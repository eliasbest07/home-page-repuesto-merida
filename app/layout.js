import './globals.css'
import { Montserrat } from 'next/font/google'
import { LOCAL_SEO_SIGNALS } from '@/lib/localSeoSignals'
import CookieConsent from '@/app/components/CookieConsent'
import GlobalLegalLinks from '@/app/components/GlobalLegalLinks'
import ConsentAwareAnalytics from '@/app/components/ConsentAwareAnalytics'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'
const localKeywordText = LOCAL_SEO_SIGNALS.highValueKeywords.join(', ')

// Solo la letra de los títulos se descarga, servida desde el propio dominio.
// El texto corrido usa la del sistema (Roboto en Android), que no pesa nada.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: '800',
  display: 'swap',
  variable: '--font-brand',
})

export const metadata = {
  title: 'Repuestos Mérida App Ciudad | Catálogo de Repuestos Automotrices en Mérida, Venezuela',
  description: 'Repuestos automotrices en Mérida ciudad (Municipio Libertador), estado Mérida, Venezuela. Atención por WhatsApp, compatibilidad por modelo y disponibilidad rápida.',
  keywords: `repuestos Mérida ciudad, repuestos Municipio Libertador, repuestos estado Mérida, repuestos automotrices Venezuela, ${localKeywordText}`,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Repuestos Mérida App Ciudad | Tu Repuesto Automotriz en Los Andes',
    description: 'Catálogo de repuestos automotrices en Mérida ciudad y zona metropolitana. Consulta por WhatsApp, precio y compatibilidad.',
    url: SITE_URL,
    siteName: 'Repuestos Mérida',
    images: [
      {
        url: '/iconorm.png',
        width: 1200,
        height: 1200,
        alt: 'Repuestos Mérida',
      },
    ],
    locale: 'es_VE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Repuestos Mérida App Ciudad | Catálogo de Repuestos Automotrices',
    description: 'Inventario automotriz para Mérida ciudad y estado Mérida. Respuesta rápida por WhatsApp.',
    images: ['/iconorm.png'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <head>
        <link rel="icon" href="/icono-48.png" type="image/png" sizes="48x48" />
        <meta name="theme-color" content="#FFD700" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
        <GlobalLegalLinks />
        <CookieConsent />
        <ConsentAwareAnalytics />
      </body>
    </html>
  )
}
