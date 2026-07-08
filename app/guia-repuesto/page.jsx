import Link from 'next/link'
import RequestChecklist from './RequestChecklist'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'

export const metadata = {
  title: 'Guia para solicitar repuestos en Merida | Repuestos Merida',
  description:
    'Checklist practico para pedir repuestos automotrices en Merida: datos del vehiculo, fotos utiles, referencias, compatibilidad y mensaje listo para WhatsApp.',
  alternates: { canonical: '/guia-repuesto' },
  openGraph: {
    title: 'Guia para solicitar repuestos en Merida',
    description:
      'Aprende que datos enviar para cotizar una pieza correcta y evitar compras equivocadas.',
    url: `${SITE_URL}/guia-repuesto`,
    siteName: 'Repuestos Merida',
    type: 'article',
    locale: 'es_VE',
  },
}

const essentials = [
  {
    title: 'Identificacion del vehiculo',
    body: 'Marca, modelo, ano y version reducen las respuestas ambiguas. En un mismo modelo puede cambiar el motor, la caja, el sistema electrico o el tipo de freno.',
  },
  {
    title: 'Nombre exacto del repuesto',
    body: 'Una descripcion corta ayuda mas que una frase general. No es lo mismo pedir sensor, sensor MAF, sensor MAP, valvula IAC o conector del sensor.',
  },
  {
    title: 'Numero de parte o referencia',
    body: 'Cuando el repuesto viejo tiene codigo grabado, etiqueta o marca visible, ese dato sirve para comparar compatibilidad antes de pagar.',
  },
  {
    title: 'Foto clara y contexto',
    body: 'La foto del repuesto desmontado, del sitio donde va montado o del tablero evita confusiones, sobre todo en piezas electricas, empaques y soportes.',
  },
]

const examples = [
  {
    weak: 'Necesito una bomba para una camioneta.',
    strong:
      'Busco bomba de aceite para Ford Explorer 1998 motor 4.0. Acepto nueva o usada probada. Puedo enviar foto de la pieza.',
  },
  {
    weak: 'Tienes sensores?',
    strong:
      'Busco sensor MAF para Hyundai Tucson 2008. Necesito confirmar marca, conector y precio antes de ir al comercio.',
  },
  {
    weak: 'Cuanto sale el kit?',
    strong:
      'Busco kit de cadena de tiempo para Daihatsu Terios 2005 automatica. Quiero saber si incluye tensor, guias y empacadura.',
  },
]

const faqs = [
  {
    q: 'Que hago si no se el ano exacto del carro?',
    a: 'Revisa el carnet, documento de compra o placa identificadora. Si no tienes el dato, envia fotos del vehiculo y explica que el ano esta por confirmar.',
  },
  {
    q: 'Conviene enviar foto del documento del vehiculo?',
    a: 'Solo si es necesario para confirmar datos tecnicos. Oculta informacion sensible que no ayude a ubicar el repuesto.',
  },
  {
    q: 'Por que preguntan por motor o version?',
    a: 'Porque dos carros con la misma carroceria pueden usar piezas diferentes segun cilindrada, transmision, ano de fabricacion o mercado de origen.',
  },
  {
    q: 'Como comparo dos cotizaciones?',
    a: 'Compara disponibilidad real, marca, garantia, condicion, si incluye accesorios y costo de traslado. El precio mas bajo no siempre es la compra mas segura.',
  },
]

export default function GuiaRepuestoPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Guia para solicitar repuestos en Merida',
    description: metadata.description,
    author: { '@type': 'Organization', name: 'Repuestos Merida' },
    publisher: {
      '@type': 'Organization',
      name: 'Repuestos Merida',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/iconorm.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/guia-repuesto` },
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <section className="border-b border-slate-200 bg-slate-50 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <nav className="mb-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-600" aria-label="Navegacion">
            <Link href="/" className="hover:text-slate-950">Inicio</Link>
            <Link href="/blog" className="hover:text-slate-950">Blog</Link>
            <Link href="/solicitados" className="hover:text-slate-950">Solicitados</Link>
          </nav>

          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-widest text-yellow-600">
              Guia practica local
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-6xl">
              Como pedir un repuesto en Merida sin comprar la pieza equivocada
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-700">
              Una solicitud clara ahorra llamadas, traslados y compras fallidas. Antes de escribir a
              un comercio, ordena los datos del vehiculo, confirma como se llama la pieza y prepara
              fotos utiles para validar compatibilidad.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#checklist-title"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Preparar mensaje
              </a>
              <Link
                href="/solicitados"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-5 text-sm font-black text-slate-900 transition hover:bg-white"
              >
                Ver solicitudes reales
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6" aria-labelledby="datos-title">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <h2 id="datos-title" className="text-3xl font-black tracking-tight text-slate-950">
              Datos que cambian una cotizacion
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Muchos repuestos automotrices no se compran solo por nombre. En Merida es comun
              comparar disponibilidad entre comercios de la Av. 16 de Septiembre, centro y zonas
              cercanas; mientras mas precisa sea la solicitud, mas facil es confirmar precio y
              existencia antes de moverse.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {essentials.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-12 sm:px-6" aria-labelledby="ejemplos-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="ejemplos-title" className="text-3xl font-black tracking-tight text-slate-950">
            Ejemplos de mensajes que si ayudan
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {examples.map((example) => (
              <article key={example.weak} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-red-600">Muy general</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{example.weak}</p>
                <div className="my-4 h-px bg-slate-200" />
                <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Mejor</p>
                <p className="mt-2 text-sm leading-6 text-slate-800">{example.strong}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <RequestChecklist />

      <section className="px-4 py-12 sm:px-6" aria-labelledby="seguridad-title">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 id="seguridad-title" className="text-3xl font-black tracking-tight text-slate-950">
              Antes de pagar o trasladarte
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              La confirmacion final protege al comprador y al comercio. Guarda capturas de la
              cotizacion, pregunta por condiciones y verifica que el repuesto corresponda al
              vehiculo antes de cerrar la compra.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              'Confirma si el precio incluye accesorios, empacaduras, tornillos o conectores.',
              'Pregunta si la pieza tiene garantia, prueba o cambio por incompatibilidad.',
              'Verifica direccion, horario y disponibilidad el mismo dia.',
              'Compara marca, procedencia y estado, no solo el monto en dolares.',
            ].map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 sm:px-6" aria-labelledby="faq-title">
        <div className="mx-auto max-w-4xl">
          <h2 id="faq-title" className="text-3xl font-black tracking-tight text-slate-950">
            Preguntas frecuentes
          </h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {faqs.map((faq) => (
              <details key={faq.q} className="group p-5">
                <summary className="cursor-pointer list-none font-black text-slate-950 marker:hidden">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-7 text-slate-700">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
