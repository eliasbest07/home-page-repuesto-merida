import SolicitudesClient from './SolicitudesClient'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export const metadata = {
  title: 'Repuestos solicitados en Mérida | Repuestos Mérida',
  description: 'Lista pública de repuestos que compradores están buscando en Mérida. Revisa cada solicitud y participa en el debate.',
  alternates: {
    canonical: '/solicitados',
  },
  openGraph: {
    title: 'Repuestos solicitados en Mérida',
    description: 'Compradores de Mérida están buscando estas piezas. Revisa las solicitudes y participa en el debate.',
    url: `${SITE_URL}/solicitados`,
    siteName: 'Repuestos Mérida',
    type: 'website',
  },
}

export default function SolicitadosPage() {
  return <SolicitudesClient />
}
