import Image from 'next/image'
import Link from 'next/link'

export const metadata = {
  title: 'Ayuda de Plaza | Repuestos Mérida',
  description: 'Conoce cómo funciona Plaza, cómo publicar ofertas o solicitudes y qué precauciones tomar al contactar a un anunciante.',
  alternates: { canonical: '/plaza/ayuda' },
}

const COMPARACION = [
  {
    real: 'Personas que van y vienen',
    realText: 'En una plaza pública siempre hay movimiento: llegan personas nuevas y otras continúan su camino.',
    digital: 'Anuncios que aparecen y cambian',
    digitalText: 'Las publicaciones se agregan, se actualizan, se retiran o dejan de estar disponibles con el tiempo.',
    icon: '🚶',
  },
  {
    real: 'Alguien dice “vendo” u “ofrezco”',
    realText: 'Una persona cuenta que vende un objeto, ofrece un servicio o busca personal.',
    digital: 'Una oferta publicada',
    digitalText: 'Esa información se convierte en una ficha que otras personas pueden encontrar en Plaza.',
    icon: '📣',
  },
  {
    real: 'Alguien pregunta “¿quién tiene?”',
    realText: 'Otra persona busca un producto, un servicio, una vivienda, trabajo o alguna ayuda específica.',
    digital: 'Una solicitud visible',
    digitalText: 'La necesidad se publica para que quien pueda responder se comunique directamente.',
    icon: '🔎',
  },
  {
    real: 'Un aviso pegado en un gran muro',
    realText: 'El muro reúne mensajes de muchas personas, pero no convierte al dueño del muro en parte del trato.',
    digital: 'El muro comunitario de Plaza',
    digitalText: 'Repuestos Mérida organiza y muestra los avisos; el acuerdo ocurre entre quien publica y quien responde.',
    icon: '🧱',
  },
  {
    real: 'Las personas conversan cara a cara',
    realText: 'Cada interesado pregunta, verifica y decide si desea continuar la conversación.',
    digital: 'Contacto directo por WhatsApp',
    digitalText: 'Cada anuncio muestra el WhatsApp del anunciante para que le escribas sin intermediarios.',
    icon: '💬',
  },
]

const FAQS = [
  {
    question: '¿Qué es Plaza?',
    answer: 'Plaza es un muro comunitario digital de anuncios para Mérida y la región andina. Allí las personas pueden ofrecer o solicitar productos, servicios, empleos y otras oportunidades locales.',
  },
  {
    question: '¿De dónde vienen los anuncios?',
    answer: 'Pueden ser publicados directamente por usuarios de la página o elaborados a partir de mensajes compartidos en grupos de WhatsApp. En ambos casos, el contacto pertenece a la persona que ofrece o solicita.',
  },
  {
    question: '¿Cómo publico algo que vendo u ofrezco?',
    answer: 'En Plaza toca “Vender”, inicia sesión, completa los datos del anuncio, agrega fotos cuando corresponda e indica tu WhatsApp. Después de los controles de publicación, el aviso podrá aparecer en Plaza.',
  },
  {
    question: '¿Cómo publico una solicitud?',
    answer: 'Usa “Crear solicitud”, explica con claridad qué buscas y deja un WhatsApp válido. Las personas que puedan ayudarte podrán contactarte directamente.',
  },
  {
    question: '¿Cómo contacto a quien publicó?',
    answer: 'Abre el anuncio y utiliza el botón de WhatsApp. Pregunta directamente por disponibilidad, condiciones, ubicación, precio y cualquier dato que necesites confirmar.',
  },
  {
    question: '¿Cómo modifico o elimino uno de mis anuncios?',
    answer: 'El número de WhatsApp mostrado en el anuncio determina quién es su propietario. Inicia sesión con ese mismo número, entra en “Mis anuncios” y elige “Editar” o “Retirar anuncio”. Los cambios se envían nuevamente a revisión; al retirar un anuncio, deja de mostrarse en Plaza. Un número diferente no puede administrarlo.',
  },
  {
    question: '¿Repuestos Mérida vende o garantiza lo publicado?',
    answer: 'No. Salvo que una publicación lo indique expresamente, Repuestos Mérida no es vendedor, comprador, empleador, representante, intermediario de pago ni garante de los anuncios de terceros.',
  },
  {
    question: '¿Toda la información está verificada?',
    answer: 'Aplicamos controles para ordenar y moderar publicaciones, pero no podemos garantizar que toda información aportada por terceros sea verdadera, exacta, legal, completa o permanezca actualizada.',
  },
  {
    question: '¿Qué hago si algo parece sospechoso?',
    answer: 'No envíes dinero ni datos sensibles, interrumpe la conversación y repórtalo a soporte. Conserva capturas y datos del anuncio para que podamos revisarlo o retirarlo cuando corresponda.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
}

function Step({ number, title, children, dark = false }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 font-black text-gray-950">
        {number}
      </span>
      <div>
        <h3 className={`font-bold ${dark ? 'text-white' : 'text-gray-950'}`}>{title}</h3>
        <p className={`mt-1 text-sm leading-6 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{children}</p>
      </div>
    </li>
  )
}

export default function PlazaAyudaPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900 shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/plaza" className="flex min-w-0 items-center gap-2">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={36} height={36} className="rounded-xl" />
            <div className="min-w-0 leading-tight">
              <span className="block font-black text-yellow-400">Plaza</span>
              <span className="hidden text-xs text-gray-400 sm:block">Centro de ayuda</span>
            </div>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Navegación de Plaza">
            <Link href="/plaza" className="rounded-xl px-3 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-white sm:text-sm">
              Ver Plaza
            </Link>
            <Link href="/plaza/publicar" className="rounded-xl bg-yellow-400 px-3 py-2 text-xs font-black text-gray-950 hover:bg-yellow-300 sm:text-sm">
              Vender
            </Link>
          </nav>
        </div>
      </header>

      <section className="overflow-hidden bg-gray-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.25fr_.75fr] md:items-center md:py-20">
          <div>
            <span className="inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
              Ayuda de Plaza
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
              Una plaza real, convertida en un gran muro digital
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
              En una plaza las personas llegan, conversan, ofrecen algo, preguntan por lo que necesitan y siguen su camino. Plaza funciona igual: reúne esos mensajes para que la comunidad pueda encontrarlos y hablar directamente con quien los publicó.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/plaza" className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-gray-950 hover:bg-yellow-300">
                Explorar Plaza
              </Link>
              <Link href="/plaza/solicitar" className="rounded-xl border border-gray-600 px-5 py-3 text-sm font-bold text-white hover:border-yellow-400 hover:text-yellow-300">
                Crear una solicitud
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm rounded-[2rem] border border-gray-700 bg-gray-900 p-6 shadow-2xl">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['📣', 'Ofertas'],
                ['🔎', 'Solicitudes'],
                ['💼', 'Empleos'],
                ['🏷️', 'Ventas'],
                ['🔧', 'Servicios'],
                ['💬', 'Contacto'],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-2xl bg-gray-800 px-2 py-4">
                  <span className="block text-3xl">{icon}</span>
                  <span className="mt-2 block text-xs font-bold text-gray-300">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm font-semibold text-yellow-300">
              La conversación continúa por WhatsApp
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:py-16">
        <section aria-labelledby="comparacion-plaza">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-yellow-700">La comparación</p>
            <h2 id="comparacion-plaza" className="mt-2 text-3xl font-black text-gray-950">De la plaza de la ciudad a Plaza digital</h2>
            <p className="mt-3 leading-7 text-gray-600">
              La tecnología cambia el lugar, pero no la idea: personas reales compartiendo lo que ofrecen o necesitan con otras personas de la comunidad.
            </p>
          </div>

          <div className="mt-7 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[70px_1fr_1fr] bg-gray-900 px-6 py-4 text-sm font-black text-white sm:grid">
              <span />
              <span>En una plaza real</span>
              <span>En Plaza digital</span>
            </div>
            {COMPARACION.map((item) => (
              <div key={item.real} className="grid gap-4 border-b border-gray-100 p-5 last:border-0 sm:grid-cols-[70px_1fr_1fr] sm:gap-6 sm:px-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-2xl" aria-hidden="true">{item.icon}</span>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 sm:hidden">Plaza real</span>
                  <h3 className="mt-1 font-bold text-gray-950">{item.real}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.realText}</p>
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-yellow-700 sm:hidden">Plaza digital</span>
                  <h3 className="mt-1 font-bold text-gray-950">{item.digital}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.digitalText}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2" aria-labelledby="como-publicar">
          <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <span className="text-4xl" aria-hidden="true">🏷️</span>
            <h2 id="como-publicar" className="mt-4 text-2xl font-black text-gray-950">Publicar una venta u oferta</h2>
            <ol className="mt-6 space-y-5">
              <Step number="1" title="Toca Vender">Usa el botón de la parte superior de Plaza para comenzar.</Step>
              <Step number="2" title="Identifícate">Inicia sesión y completa la verificación solicitada para asociar el anuncio contigo.</Step>
              <Step number="3" title="Describe lo que ofreces">Escribe un título claro, condiciones, precio, ubicación y agrega fotos reales cuando corresponda.</Step>
              <Step number="4" title="Deja tu WhatsApp">El interesado te escribirá directamente a ese número; mantenlo correcto y disponible.</Step>
            </ol>
            <Link href="/plaza/publicar" className="mt-7 inline-flex rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-gray-950 hover:bg-yellow-300">
              Vender o publicar
            </Link>
          </div>

          <div className="rounded-3xl bg-gray-900 p-6 text-white shadow-sm sm:p-8">
            <span className="text-4xl" aria-hidden="true">🔎</span>
            <h2 className="mt-4 text-2xl font-black">Publicar una solicitud</h2>
            <ol className="mt-6 space-y-5">
              <Step dark number="1" title="Explica qué buscas">Puede ser un producto, servicio, empleo, vivienda u otra necesidad permitida.</Step>
              <Step dark number="2" title="Aporta datos útiles">Indica ubicación, características, presupuesto o condiciones que ayuden a responderte.</Step>
              <Step dark number="3" title="Publica un contacto válido">Quien tenga una opción podrá escribirte directamente por WhatsApp.</Step>
              <Step dark number="4" title="Verifica cada respuesta">Compara la información y decide por tu cuenta con quién continuar.</Step>
            </ol>
            <Link href="/plaza/solicitar" className="mt-7 inline-flex rounded-xl border border-yellow-400 px-5 py-3 text-sm font-black text-yellow-300 hover:bg-yellow-400 hover:text-gray-950">
              Crear solicitud
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm" aria-labelledby="administrar-anuncios">
          <div className="grid lg:grid-cols-[.75fr_1.25fr]">
            <div className="bg-blue-700 p-7 text-white sm:p-8">
              <span className="text-4xl" aria-hidden="true">📱</span>
              <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-blue-100">Propiedad del anuncio</p>
              <h2 id="administrar-anuncios" className="mt-2 text-2xl font-black sm:text-3xl">Modificar o eliminar mis anuncios</h2>
              <p className="mt-4 leading-7 text-blue-50">
                El número de WhatsApp que aparece en cada anuncio identifica a su propietario. Para administrarlo debes ingresar a Plaza con ese mismo número.
              </p>
              <p className="mt-4 rounded-2xl bg-blue-950/60 p-4 text-sm font-bold leading-6 text-white">
                Ningún otro número de WhatsApp puede modificar o retirar ese anuncio.
              </p>
            </div>

            <div className="p-7 sm:p-8">
              <ol className="space-y-5">
                <Step number="1" title="Ingresa con el WhatsApp del anuncio">
                  Inicia sesión usando exactamente el mismo número que se muestra como contacto público en la publicación.
                </Step>
                <Step number="2" title="Abre Mis anuncios">
                  Allí aparecerán las publicaciones vinculadas a tu número de WhatsApp.
                </Step>
                <Step number="3" title="Edita o retira la publicación">
                  “Editar” permite cambiar sus datos y enviarlos nuevamente a revisión. “Retirar anuncio” hace que deje de mostrarse en Plaza.
                </Step>
              </ol>
              <Link href="/plaza/mis-anuncios" className="mt-7 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-600">
                Administrar mis anuncios
              </Link>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                Si ya no tienes acceso al número propietario, comunícate con soporte para explicar el caso.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border-4 border-amber-400 bg-amber-50 p-6 shadow-lg sm:p-8" aria-labelledby="responsabilidad-plaza">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-3xl" aria-hidden="true">⚠️</span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-900">Lectura importante y obligatoria</p>
              <h2 id="responsabilidad-plaza" className="mt-2 text-2xl font-black uppercase text-gray-950 sm:text-3xl">Descargo de responsabilidad</h2>
              <p className="mt-3 rounded-2xl bg-gray-950 px-4 py-3 font-black leading-6 text-white">
                Plaza es únicamente un muro de anuncios de terceros. Repuestos Mérida no es parte de las ofertas, solicitudes, conversaciones ni acuerdos publicados aquí.
              </p>
              <div className="mt-4 space-y-3 leading-7 text-gray-700">
                <p>
                  Los anuncios pueden ser publicados directamente por usuarios o tomados de mensajes compartidos en grupos de WhatsApp. Corresponden a personas que ofrecen o solicitan productos, servicios, empleos u otras oportunidades. Para consultar o negociar debes escribir directamente al número de WhatsApp mostrado en cada anuncio.
                </p>
                <p>
                  Debido al volumen y a la naturaleza comunitaria de Plaza, no podemos detectar, comprobar ni filtrar toda información falsa, engañosa, inexacta, ilegal, incompleta, insegura o desactualizada. La publicación de un anuncio no significa que Repuestos Mérida lo verifique, recomiende, certifique o respalde, ni que garantice la identidad o las intenciones de quien lo publicó.
                </p>
                <p className="border-l-4 border-amber-500 pl-4 font-black text-gray-950">
                  Toda acción emprendida a partir de la información mostrada —incluidas conversaciones, entrevistas, compras, ventas, contrataciones, pagos, reservas, encuentros o entregas— es una decisión voluntaria y queda bajo la exclusiva responsabilidad de las personas que participan.
                </p>
                <p>
                  Repuestos Mérida y su operador no son vendedores, compradores, empleadores, representantes, intermediarios ni garantes en los acuerdos entre anunciantes e interesados. En la medida permitida por la ley aplicable, no asumen responsabilidad por identidades falsas, fraude, pérdidas, pagos, incumplimientos, calidad, disponibilidad, garantías, daños o conflictos derivados del uso de los anuncios o del contacto entre terceros.
                </p>
                <p className="font-bold text-amber-950">
                  Antes de continuar, verifica por tu cuenta la identidad de la persona, la autenticidad de la oferta o solicitud y todas sus condiciones.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[.8fr_1.2fr]" aria-labelledby="consejos-seguridad">
          <div className="rounded-3xl bg-green-700 p-7 text-white">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-green-100">Cuida tu seguridad</p>
            <h2 id="consejos-seguridad" className="mt-2 text-2xl font-black">Antes de avanzar con un anuncio</h2>
            <p className="mt-3 text-sm leading-6 text-green-50">
              Preguntar y verificar no es desconfiar: es la forma responsable de usar cualquier plaza, física o digital.
            </p>
          </div>
          <ul className="grid gap-3 rounded-3xl bg-white p-6 text-sm leading-6 text-gray-700 shadow-sm sm:grid-cols-2 sm:p-7">
            {[
              'Confirma identidad, ubicación, disponibilidad y condiciones.',
              'Pide fotos o evidencia actual cuando sea necesario.',
              'No compartas contraseñas, códigos ni datos bancarios sensibles.',
              'Evita pagos anticipados a personas que no hayas verificado.',
              'Para encuentros, elige un lugar público y avisa a alguien.',
              'Desconfía de urgencias, amenazas o precios demasiado buenos.',
            ].map((tip) => (
              <li key={tip} className="flex gap-3 rounded-2xl bg-gray-50 p-3">
                <span className="font-black text-green-600">✓</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="preguntas-plaza">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-yellow-700">Preguntas comunes</p>
            <h2 id="preguntas-plaza" className="mt-2 text-3xl font-black text-gray-950">Lo esencial para usar Plaza</h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2">
            {FAQS.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm open:border-yellow-300">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-bold text-gray-950">
                  <span>{item.question}</span>
                  <span className="text-xl leading-none text-yellow-600 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-4 border-t border-gray-100 pt-4 text-sm leading-6 text-gray-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-gray-950 px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-3xl font-black">Usa Plaza con criterio y habla directamente</h2>
          <p className="mx-auto mt-3 max-w-2xl leading-7 text-gray-300">
            Explora las publicaciones, confirma la información con el anunciante y toma cada decisión con la precaución que usarías al tratar con una persona desconocida en una plaza real.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/plaza" className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-gray-950 hover:bg-yellow-300">Ir a Plaza</Link>
            <Link href="/soporte" className="rounded-xl border border-gray-600 px-5 py-3 text-sm font-bold text-white hover:border-yellow-400 hover:text-yellow-300">Reportar o pedir soporte</Link>
          </div>
          <p className="mt-7 text-xs text-gray-500">
            Consulta también el <Link href="/aviso-legal" className="underline hover:text-gray-300">Aviso Legal</Link> y los <Link href="/terminos-condiciones" className="underline hover:text-gray-300">Términos y Condiciones</Link>.
          </p>
        </section>
      </div>
    </main>
  )
}
