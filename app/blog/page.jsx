import Link from 'next/link'

const POSTS = [
  {
    title: 'Como elegir pastillas de freno sin comprar la pieza equivocada',
    category: 'Frenos',
    summary:
      'Antes de cotizar, conviene revisar modelo, ano, tipo de sistema de freno, desgaste del disco y si la pieza lleva sensor. Una foto de la pastilla usada ayuda a confirmar forma y medidas.',
    points: [
      'Compara la forma de la pastilla y posicion de seguros o sensores.',
      'Pregunta si el compuesto es ceramico, semimetalico u organico.',
      'Verifica el estado del disco para evitar ruido o vibracion despues del cambio.',
    ],
  },
  {
    title: 'Que datos enviar para ubicar repuestos Toyota en Merida',
    category: 'Compatibilidad',
    summary:
      'En Toyota, una misma linea puede cambiar piezas segun motor, transmision, version y pais de origen. Enviar datos completos reduce errores y acelera la respuesta.',
    points: [
      'Marca, modelo, ano y cilindrada del motor.',
      'Foto de la pieza, serial o muestra cuando exista.',
      'Indica si buscas original, alternativo o usado en buen estado.',
    ],
  },
  {
    title: 'Alternador, arranque o bateria: como describir una falla electrica',
    category: 'Sistema electrico',
    summary:
      'Muchas fallas electricas se parecen entre si. Describir sintomas, luces del tablero y pruebas realizadas ayuda a orientar la busqueda del repuesto correcto.',
    points: [
      'Cuenta si el vehiculo enciende lento, no carga o se apaga en marcha.',
      'Envia voltaje medido, si lo tienes, y foto del conector.',
      'Pregunta por garantia, prueba en banco y condiciones de cambio.',
    ],
  },
  {
    title: 'Filtros y aceite: datos minimos para una compra de mantenimiento',
    category: 'Mantenimiento',
    summary:
      'Para mantenimiento preventivo, el kilometraje, tipo de motor y uso del vehiculo ayudan a elegir filtros, aceite y refrigerante adecuados.',
    points: [
      'Indica si el motor es gasolina o diesel y su cilindrada.',
      'Confirma viscosidad recomendada y marca preferida.',
      'Revisa filtro de aire, aceite, combustible y cabina en cada servicio.',
    ],
  },
]

export const metadata = {
  title: 'Blog de Repuestos en Merida | Repuestos Merida',
  description:
    'Guias practicas para comprar repuestos automotrices en Merida: frenos, filtros, compatibilidad, sistema electrico y mantenimiento.',
  alternates: {
    canonical: '/blog',
  },
}

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <section className="border-b border-gray-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-semibold text-yellow-600 hover:text-yellow-700">
            Repuestos Merida
          </Link>
          <h1 className="mt-4 font-brand text-4xl text-gray-950">
            Guias para comprar repuestos en Merida
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
            Estas entradas resumen criterios practicos para pedir cotizaciones con datos claros,
            comparar compatibilidad y evitar compras equivocadas. Son ideas iniciales que luego se
            pueden enriquecer con casos reales, fotos y recomendaciones de comercios locales.
          </p>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {POSTS.map((post) => (
            <article key={post.title} className="rounded-lg border border-gray-200 bg-white p-6">
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600">
                {post.category}
              </span>
              <h2 className="mt-3 font-brand text-2xl text-gray-950">{post.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{post.summary}</p>
              <ul className="mt-5 space-y-2 text-sm text-gray-700">
                {post.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
