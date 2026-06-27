import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { LOCAL_SEO_SIGNALS } from '@/lib/localSeoSignals'
import CookieConsent from '@/app/components/CookieConsent'
import GlobalLegalLinks from '@/app/components/GlobalLegalLinks'
import AdSenseLoader from '@/app/components/AdSenseLoader'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'
const ADSENSE_ENABLED = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
const localKeywordText = LOCAL_SEO_SIGNALS.highValueKeywords.join(', ')

export const metadata = {
  title: 'Repuestos Mérida App Ciudad | Catálogo de Repuestos Automotrices en Mérida, Venezuela',
  description: 'Repuestos automotrices en Mérida ciudad (Municipio Libertador), estado Mérida, Venezuela. Atención por WhatsApp, compatibilidad por modelo y disponibilidad rápida.',
  keywords: `repuestos Mérida ciudad, repuestos Municipio Libertador, repuestos estado Mérida, repuestos automotrices Venezuela, ${localKeywordText}`,
  other: ADSENSE_ENABLED
    ? {
        'google-adsense-account': 'ca-pub-7506182169131280',
      }
    : undefined,
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
    <html lang="es">
      <head>
        {/* Google Consent Mode v2 — debe ejecutarse ANTES de cargar AdSense.
            Estado por defecto: denegado (cumplimiento GDPR). En modo de consentimiento
            "avanzado" AdSense igual sirve anuncios no personalizados hasta que el
            usuario acepte cookies, momento en que CookieConsent hace gtag consent update. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('consent', 'default', {
                'ad_storage': 'denied',
                'ad_user_data': 'denied',
                'ad_personalization': 'denied',
                'analytics_storage': 'denied',
                'wait_for_update': 500
              });
            `,
          }}
        />
        {/* El script de AdSense se carga vía <AdSenseLoader/> solo en rutas con
            contenido del editor (ver lib/adsenseRoutes.js), no globalmente. */}
        <link rel="icon" href="/iconorm.png" type="image/png" />
        <meta name="theme-color" content="#111827" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
        <GlobalLegalLinks />
        <CookieConsent />
        <AdSenseLoader />
        <Analytics />
      </body>
    </html>
  )
}
