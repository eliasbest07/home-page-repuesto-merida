export const metadata = {
  title: 'Configurador de Vehículo | Repuestos Mérida',
  description: 'Selecciona tu marca, año, modelo y versión para encontrar los repuestos exactos para tu carro.',
}

export default function ConfiguradorLayout({ children }) {
  return (
    <div style={{ background: '#111827', minHeight: '100vh', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      {children}
    </div>
  )
}
