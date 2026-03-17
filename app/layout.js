import './globals.css'
import { LOCAL_SEO_SIGNALS } from '@/lib/localSeoSignals'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'
const localKeywordText = LOCAL_SEO_SIGNALS.highValueKeywords.join(', ')

export const metadata = {
  title: 'Repuestos Mérida Ciudad | Catálogo de Repuestos Automotrices en Mérida, Venezuela',
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
    title: 'Repuestos Mérida Ciudad | Tu Repuesto Automotriz en Los Andes',
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
    title: 'Repuestos Mérida Ciudad | Catálogo de Repuestos Automotrices',
    description: 'Inventario automotriz para Mérida ciudad y estado Mérida. Respuesta rápida por WhatsApp.',
    images: ['/iconorm.png'],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/iconorm.png" type="image/png" />
        <meta name="theme-color" content="#111827" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
