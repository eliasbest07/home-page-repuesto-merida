import './globals.css'

export const metadata = {
  title: 'Repuestos Mérida | Catálogo de Repuestos Automotrices en Mérida, Venezuela',
  description: 'Encuentra los repuestos automotrices que necesitas en Mérida, Venezuela. Motor, frenos, eléctrico, carrocería, filtros y más. Marcas líderes, precios competitivos. Gochos Group.',
  keywords: 'repuestos Mérida, repuestos automotrices Venezuela, repuestos Toyota, repuestos Ford, repuestos Chevrolet, repuestos Mérida Venezuela',
  openGraph: {
    title: 'Repuestos Mérida | Tu Repuesto Automotriz en Los Andes',
    description: 'Catálogo de repuestos automotrices en Mérida, Venezuela. Motor, frenos, eléctrico y más.',
    locale: 'es_VE',
    type: 'website',
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
