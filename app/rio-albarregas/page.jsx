const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export const metadata = {
  title: 'Recuperar el Río Albarregas | Proyecto estudiantil ULA',
  description:
    'Proyecto de estudiantes de la Universidad de Los Andes para conocer, cuidar y recuperar comunitariamente el Río Albarregas en Mérida.',
  alternates: {
    canonical: '/rio-albarregas',
  },
  openGraph: {
    title: 'El río que atraviesa Mérida también nos une',
    description:
      'Investigación, escucha comunitaria y decisiones transparentes para cuidar el Río Albarregas.',
    url: `${SITE_URL}/rio-albarregas`,
    siteName: 'Repuestos Mérida',
    images: [
      {
        url: '/proyectos/rio-albarregas/assets/las-americas.jpeg',
        width: 1458,
        height: 911,
        alt: 'Vista satelital del corredor urbano del Río Albarregas en Mérida',
      },
    ],
    locale: 'es_VE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Recuperar el Río Albarregas',
    description: 'Proyecto estudiantil ULA para cuidar comunitariamente el río de Mérida.',
    images: ['/proyectos/rio-albarregas/assets/las-americas.jpeg'],
  },
}

export default function RioAlbarregasPage() {
  return (
    <main style={{ minHeight: '100dvh', background: '#f8f6ee' }}>
      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Recuperar el Río Albarregas
      </h1>
      <iframe
        src="/proyectos/rio-albarregas/index.html"
        title="Proyecto comunitario para recuperar el Río Albarregas"
        loading="eager"
        style={{
          display: 'block',
          width: '100%',
          height: '100dvh',
          border: 0,
          background: '#f8f6ee',
        }}
      />
    </main>
  )
}
