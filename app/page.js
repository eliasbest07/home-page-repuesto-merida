import Link from 'next/link'
import { preload } from 'react-dom'
import { LOCAL_SEO_SIGNALS } from '@/lib/localSeoSignals'
import { FONDOS_MERIDA, leerFondosFirebase } from '@/lib/fondoPortada'
import FondoPortada from '@/app/components/FondoPortada'

// Landing de la app: enseña a usar Repuestos Mérida App con capturas reales
// (tomadas en un Motorola con la app 1.1.3). Es un componente de servidor sin
// JavaScript propio, pensado para teléfonos de gama baja.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://repuestosmerida.com'
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.btmstudio.rep_merida'
const APP_STORE_URL = 'https://apps.apple.com/app/id6783600411'
const WA_SOPORTE = '584123375417'

const CAPTURAS = {
  inicio: { src: '/app-capturas/inicio.webp', w: 720, h: 1404 },
  buscarResultados: { src: '/app-capturas/buscar-resultados.webp', w: 720, h: 1404 },
  buscarPorModelo: { src: '/app-capturas/buscar-por-modelo.webp', w: 720, h: 1404 },
  detalle: { src: '/app-capturas/detalle-repuesto.webp', w: 720, h: 1315 },
  carroMarca: { src: '/app-capturas/carro-marca.webp', w: 720, h: 1486 },
  carroModelo: { src: '/app-capturas/carro-modelo.webp', w: 720, h: 1486 },
  miCarro: { src: '/app-capturas/repuestos-mi-carro.webp', w: 720, h: 1404 },
  osoMenu: { src: '/app-capturas/oso-menu.webp', w: 720, h: 1404 },
  osoFormulario: { src: '/app-capturas/oso-formulario.webp', w: 720, h: 1486 },
  solicitarAviso: { src: '/app-capturas/solicitar-aviso.webp', w: 720, h: 1404 },
  pideSesion: { src: '/app-capturas/pide-sesion.webp', w: 720, h: 1404 },
  mapa: { src: '/app-capturas/mapa-comercios.webp', w: 720, h: 1486 },
  catalogoComercio: { src: '/app-capturas/catalogo-comercio.webp', w: 720, h: 1486 },
  servicios: { src: '/app-capturas/servicios.webp', w: 720, h: 1486 },
  plaza: { src: '/app-capturas/plaza.webp', w: 720, h: 1486 },
  cuenta: { src: '/app-capturas/cuenta.webp', w: 720, h: 1486 },
  funciones: { src: '/app-capturas/menu-funciones.webp', w: 720, h: 1404 },
}

const GUIAS = [
  {
    id: 'buscar',
    indice: 'Buscar un repuesto',
    titulo: 'Busca un repuesto y háblale al vendedor',
    intro:
      'No necesitas cuenta para buscar, ver precios ni escribirle al vendedor. Escribe la pieza como la dirías en el taller.',
    pasos: [
      {
        captura: 'buscarResultados',
        titulo: 'Escribe lo que necesitas',
        texto:
          'Toca Buscar y escribe la pieza y el carro, por ejemplo «pastillas de freno corolla». Arriba salen las que coinciden y, debajo, las parecidas por si te sirven.',
        alt: 'Resultados de la búsqueda «pastillas de freno Corolla» en Repuestos Mérida App',
      },
      {
        captura: 'buscarPorModelo',
        titulo: 'Filtra por marca, modelo y año',
        texto:
          'Toca el logo de la marca. Abajo aparecen los modelos y los años: elige el tuyo y la lista se queda solo con lo de tu carro.',
        alt: 'Búsqueda de bomba de gasolina filtrada por Chevrolet Aveo con la barra de modelos y años',
      },
      {
        captura: 'detalle',
        titulo: 'Abre el repuesto y toca Escribir',
        texto:
          'Ves la foto, si es nuevo o usado, para qué modelos sirve, el precio y qué comercio lo vende. Escribir abre WhatsApp directo con el vendedor.',
        alt: 'Detalle de unas pastillas de freno para Toyota Corolla con precio, vendedor y botón Escribir por WhatsApp',
      },
    ],
    nota: {
      titulo: 'Entiende cómo hablamos en Mérida',
      texto:
        'Si escribes «pila», busca la bomba de gasolina. «Muñón» encuentra rótulas, «meseta» encuentra brazos de control y «estopera» encuentra retenes.',
    },
  },
  {
    id: 'mi-carro',
    indice: 'Ver solo lo que le sirve a mi carro',
    titulo: 'Guarda tu carro y ve solo lo que le sirve',
    intro:
      'En el inicio toca «Agregar mi carro». Son cuatro pasos y casi todo se elige tocando, sin escribir.',
    pasos: [
      {
        captura: 'carroMarca',
        titulo: 'Elige carro o moto y la marca',
        texto:
          'Primero dices si es carro o moto. Después tocas el logo de la marca o la escribes si no está.',
        alt: 'Paso de elegir la marca del vehículo con Toyota seleccionado',
      },
      {
        captura: 'carroModelo',
        titulo: 'Toca el modelo y el año',
        texto:
          'Salen los modelos de esa marca. El año es opcional, pero ayuda a que los resultados sean más exactos. Al final puedes ponerle un apodo y el color.',
        alt: 'Paso de elegir modelo y año con Corolla 2025 seleccionado',
      },
      {
        captura: 'miCarro',
        titulo: 'Mira los repuestos de tu carro',
        texto:
          'En «Mi carro» aparecen todos los repuestos publicados para tu modelo, separados por categoría, con un buscador solo para tu carro.',
        alt: 'Pantalla Mi carro con 170 repuestos para Toyota Corolla separados por categoría',
      },
    ],
  },
  {
    id: 'oso',
    indice: 'Que el oso me ayude a buscar',
    titulo: 'Pregúntale al oso',
    intro:
      'El oso de arriba a la derecha es el asistente de la app. Te hace preguntas sencillas y te lleva a lo que buscas.',
    pasos: [
      {
        captura: 'osoMenu',
        titulo: 'Dile qué necesitas',
        texto:
          'Elige una opción: buscar un repuesto, «mi carro tiene un problema», vender algo, ver los comercios cerca o registrar tu tienda.',
        alt: 'Menú del asistente el oso con las opciones busco un repuesto, mi carro tiene un problema, quiero vender algo, ver comercios y soy tienda física',
      },
      {
        captura: 'osoFormulario',
        titulo: 'Llena la pieza y tu carro',
        texto:
          'Escribe la pieza, toca la marca y escribe el modelo y el año. Toca «Buscar en el catálogo» y te muestra lo que hay.',
        alt: 'Formulario del oso con bomba de gasolina, Chevrolet Aveo 2008',
      },
    ],
  },
  {
    id: 'pedir',
    indice: 'Pedírselo a los comercios',
    titulo: '¿No aparece? Pídeselo a los comercios',
    intro:
      'Si nadie lo ha publicado todavía, mandas una solicitud y los vendedores de la ciudad reciben el aviso.',
    pasos: [
      {
        captura: 'solicitarAviso',
        titulo: 'Toca Solicitar',
        texto:
          'Es el botón azul debajo de las marcas, en el buscador. Si ya hay algo publicado, la app te lo enseña primero para que no esperes de balde.',
        alt: 'Aviso de la app: ya hay un repuesto publicado, con las opciones ver resultados o solicitarlo igual',
      },
      {
        captura: 'pideSesion',
        titulo: 'Inicia sesión una sola vez',
        texto:
          'Para pedir necesitas tu cuenta, así los vendedores saben a quién responderle. Cuando la envías, los comercios reciben la notificación.',
        alt: 'Aviso de la app pidiendo iniciar sesión para crear una solicitud',
      },
    ],
    nota: {
      titulo: 'Atajo si guardaste tu carro',
      texto:
        'En «Mi carro» el botón negro de abajo dice «Solicitar repuesto para» tu carro y ya lleva la marca, el modelo y el año.',
    },
  },
  {
    id: 'mapa',
    indice: 'Encontrar comercios cerca',
    titulo: 'Encuentra los comercios en el mapa',
    intro:
      'Toca Mapa en la barra de abajo o en el botón +. Están los comercios de repuestos de la ciudad con su ubicación.',
    pasos: [
      {
        captura: 'mapa',
        titulo: 'Ubica las tiendas',
        texto:
          'Cada punto es un comercio. «Estoy aquí» te centra el mapa donde estás y abajo deslizas las tarjetas de cada tienda.',
        alt: 'Mapa de Mérida con 127 comercios de repuestos marcados',
      },
      {
        captura: 'catalogoComercio',
        titulo: 'Mira todo lo que vende',
        texto:
          'Toca «Ver más repuestos» en la tarjeta y entras al catálogo de ese comercio, con foto y precio de cada pieza.',
        alt: 'Catálogo de un comercio de repuestos con parachoques, molduras, tapicería y alternador',
      },
    ],
  },
  {
    id: 'servicios',
    indice: 'Pedir un taller, caucho o grúa',
    titulo: 'Pide un taller, cauchos, grúa o batería',
    intro:
      'En el inicio, «Servicios disponibles» tiene taller general, cauchos, remolque, baterías y llaves.',
    pasos: [
      {
        captura: 'servicios',
        titulo: 'Escoge el servicio y escribe',
        texto:
          'Ves quién atiende en tu ciudad y le escribes por el chat de la app, que acepta fotos y notas de voz. Si todavía no hay nadie, toca «Pedir servicio» y los talleres que se vayan sumando verán lo que necesitas.',
        alt: 'Pantalla de servicios de taller general con el botón pedir servicio',
      },
    ],
  },
  {
    id: 'plaza',
    indice: 'Comprar o vender en Plaza',
    titulo: 'Compra, vende y consigue trabajo en Plaza',
    intro:
      'Plaza es el clasificado de la app: transporte, empleos y cosas de todo tipo publicadas por la gente de la ciudad.',
    pasos: [
      {
        captura: 'plaza',
        titulo: 'Busca o publica',
        texto:
          'Usa el buscador de arriba o recorre las publicaciones. Para publicar toca el botón amarillo; te pide sesión y verificar tu cédula y tu WhatsApp, así todos saben con quién tratan.',
        alt: 'Plaza con publicaciones de empleo, transporte y general y el botón Publicar',
      },
    ],
  },
  {
    id: 'cuenta',
    indice: 'Crear mi cuenta',
    titulo: 'Crea tu cuenta y ten todo a mano',
    intro:
      'Con la cuenta puedes pedir repuestos, publicar y guardar tu carro en cualquier teléfono.',
    pasos: [
      {
        captura: 'cuenta',
        titulo: 'Entra con WhatsApp o Google',
        texto:
          'Toca el muñequito de arriba a la izquierda en el inicio. Verificas tu WhatsApp, o entras con tu cuenta de Google o con correo y clave.',
        alt: 'Pantalla de inicio de sesión con verificar WhatsApp, cuenta de Google y correo',
      },
      {
        captura: 'funciones',
        titulo: 'El botón + lo tiene todo',
        texto:
          'Abre todas las funciones: carro, moto, Plaza, taller, remolque, llaves, cauchos, batería, mototaxi, mapa, noticias y Club Andino. Arriba guarda las últimas que usaste.',
        alt: 'Menú de funciones de la app con últimos usados y todas las funciones',
      },
    ],
  },
  {
    id: 'comercios',
    indice: 'Publicar mis repuestos (tiendas)',
    titulo: '¿Tienes una tienda de repuestos? Así publicas',
    intro:
      'Publicar es gratis. Para que quien compra sepa que detrás hay un negocio de verdad, antes de vender pedimos tres cosas.',
    requisitos: [
      {
        titulo: 'Ser una tienda física',
        texto: 'Un local de repuestos abierto al público, con dirección en la ciudad.',
      },
      {
        titulo: 'Compartir la ubicación del local por WhatsApp',
        texto: 'Se la mandas a nuestro equipo desde el chat que abre la app. Así comprobamos que el local existe.',
      },
      {
        titulo: 'Completar el registro, con la confirmación de edad',
        texto:
          'Tus datos, tu WhatsApp verificado y dos fotos (tú y tu cédula) que se revisan en privado para confirmar que eres mayor de edad. Esas fotos no se publican.',
      },
    ],
    pasos: [
      {
        captura: 'osoMenu',
        titulo: 'Toca el oso y elige «Soy tienda física»',
        texto:
          'Se abre WhatsApp con nuestro equipo y el mensaje ya escrito. Envíalo y te ayudamos a montar tu tienda.',
        alt: 'Opción Soy tienda física en el asistente el oso',
      },
      {
        titulo: 'Comparte la ubicación de tu tienda',
        texto:
          'En ese mismo chat toca el clip, luego «Ubicación» y envía tu ubicación actual estando dentro del local.',
      },
      {
        captura: 'cuenta',
        titulo: 'Completa tu registro y confirma tu edad',
        texto:
          'Toca el muñequito de arriba a la izquierda. Llena tus datos, verifica tu WhatsApp y envía las dos fotos de la verificación de edad. Sin el WhatsApp y la edad verificados la app no te deja publicar.',
        alt: 'Pantalla de cuenta con verificar WhatsApp',
      },
      {
        titulo: 'Publica tus repuestos',
        texto:
          'Toca el oso, «Quiero vender algo» y «Repuestos». Sube la foto, el precio y para qué carros sirve. Cada repuesto pasa por revisión antes de salir en el buscador.',
      },
    ],
    nota: {
      titulo: '¿Tienes un taller o das un servicio?',
      texto:
        'En Servicios toca «¿Tienes un taller? Verifícalo aquí», o en el oso elige «Quiero vender algo» y «Ofrezco un servicio».',
    },
  },
]

const PREGUNTAS = [
  {
    q: '¿Cuánto cuesta Repuestos Mérida App?',
    a: 'Nada. La app es gratis en Android (Google Play) y en iPhone (App Store). Tampoco cobra por buscar ni por escribirle a los vendedores.',
  },
  {
    q: '¿Necesito crear una cuenta para buscar repuestos?',
    a: 'No. Buscar, ver fotos y precios, ver el mapa de comercios y escribirle al vendedor por WhatsApp funcionan sin cuenta. Para pedirle un repuesto a los comercios o publicar en Plaza sí necesitas iniciar sesión.',
  },
  {
    q: '¿Cómo sé si un repuesto le sirve a mi carro?',
    a: 'Guarda tu carro en «Agregar mi carro» con la marca, el modelo y el año: la app te muestra solo los repuestos publicados para ese modelo. En cada repuesto también dice para qué modelos sirve, y puedes preguntarle al vendedor por WhatsApp antes de comprar.',
  },
  {
    q: '¿Dónde se consiguen repuestos en Mérida, Venezuela?',
    a: 'En Repuestos Mérida App están los repuestos que publican los comercios de Mérida ciudad (Municipio Libertador) y sus alrededores, con más de 120 comercios en el mapa. Buscas por pieza, marca, modelo y año, y hablas con la tienda por WhatsApp.',
  },
  {
    q: '¿Qué hago si no encuentro el repuesto?',
    a: 'Toca «Solicitar» en el buscador o en «Mi carro». La solicitud les llega a los comercios y el que lo tenga te responde.',
  },
  {
    q: '¿Funciona en otras ciudades?',
    a: 'La app arranca en Mérida, que es donde hay más comercios. En el inicio, arriba, puedes cambiar a otras ciudades del país como Valencia, Barinas, Maracaibo, Caracas o San Cristóbal.',
  },
  {
    q: 'Tengo una tienda de repuestos o un taller, ¿cómo aparezco?',
    a: 'Si tienes una tienda física, abre la app, toca el oso y elige «Soy tienda física»: se abre WhatsApp con nuestro equipo y ahí compartes la ubicación de tu local. Después completas tu registro en la app, con tu WhatsApp verificado y la confirmación de edad, y ya puedes publicar tus repuestos. Si tienes un taller, en Servicios toca «¿Tienes un taller? Verifícalo aquí».',
  },
]

function construirJsonLd() {
  const inicio = `${SITE_URL}/`
  const app = `${inicio}#app`
  const organizacion = `${inicio}#organizacion`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      '@id': app,
      name: 'Repuestos Mérida App',
      alternateName: 'Repuestos Mérida',
      description:
        'App gratuita para buscar y conseguir repuestos de carros y motos en Mérida, Venezuela: catálogo de los comercios de la ciudad, filtro por marca, modelo y año, mapa de tiendas, solicitudes a los comercios y contacto directo con el vendedor por WhatsApp.',
      operatingSystem: 'Android, iOS',
      applicationCategory: 'ShoppingApplication',
      inLanguage: 'es-VE',
      url: inicio,
      downloadUrl: [PLAY_URL, APP_STORE_URL],
      installUrl: PLAY_URL,
      sameAs: [PLAY_URL, APP_STORE_URL],
      image: `${SITE_URL}/iconorm.png`,
      screenshot: [CAPTURAS.inicio, CAPTURAS.buscarResultados, CAPTURAS.detalle, CAPTURAS.miCarro, CAPTURAS.mapa].map(
        (c) => `${SITE_URL}${c.src}`,
      ),
      featureList: [
        'Buscador de repuestos que entiende la jerga de Mérida',
        'Filtro por marca, modelo y año',
        'Repuestos compatibles con el carro guardado',
        'Contacto con el vendedor por WhatsApp',
        'Solicitudes de repuestos a los comercios',
        'Mapa de comercios de repuestos',
        'Servicios: taller, cauchos, remolque, baterías y llaves',
        'Clasificados en Plaza',
      ],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      areaServed: {
        '@type': 'City',
        name: `${LOCAL_SEO_SIGNALS.region.city}, ${LOCAL_SEO_SIGNALS.region.state}, Venezuela`,
      },
      publisher: { '@id': organizacion },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': organizacion,
      name: 'Repuestos Mérida',
      url: inicio,
      logo: `${SITE_URL}/iconorm.png`,
      parentOrganization: { '@type': 'Organization', name: 'Gochos Group' },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: `+${WA_SOPORTE}`,
        availableLanguage: 'es',
      },
      sameAs: [PLAY_URL, APP_STORE_URL],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${inicio}#website`,
      name: 'Repuestos Mérida',
      url: inicio,
      inLanguage: 'es-VE',
      publisher: { '@id': organizacion },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      '@id': `${inicio}#como-buscar`,
      name: 'Cómo buscar un repuesto en Mérida con Repuestos Mérida App',
      description: 'Pasos para encontrar un repuesto en los comercios de Mérida y hablar con el vendedor.',
      tool: [{ '@type': 'HowToTool', name: 'Repuestos Mérida App (Android o iPhone)' }],
      step: GUIAS.find((g) => g.id === 'buscar').pasos.map((paso, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: paso.titulo,
        text: paso.texto,
        image: `${SITE_URL}${CAPTURAS[paso.captura].src}`,
        url: `${inicio}#buscar`,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${inicio}#preguntas`,
      mainEntity: PREGUNTAS.map((p) => ({
        '@type': 'Question',
        name: p.q,
        acceptedAnswer: { '@type': 'Answer', text: p.a },
      })),
    },
  ]
}

// ── Piezas ───────────────────────────────────────────────────────────────

function IconoPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0" fill="currentColor">
      <path d="M4.2 2.6a1.3 1.3 0 0 0-.7 1.2v16.4c0 .5.3 1 .7 1.2l9.3-9.4-9.3-9.4Zm10.5 10.6 2.4 2.4-10.9 6.2 8.5-8.6Zm3.7-3.2 2.7 1.5c.9.5.9 1.8 0 2.4l-2.8 1.6-2.7-2.7 2.8-2.8ZM6.2 2.2l10.9 6.2-2.4 2.4-8.5-8.6Z" />
    </svg>
  )
}

function IconoApple() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0" fill="currentColor">
      <path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.9-1.1-2.9-4.2ZM13.9 5.3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5Z" />
    </svg>
  )
}

function BotonesTiendas({ oscuro = false }) {
  const principal = oscuro
    ? 'bg-brand-yellow text-gray-950 hover:bg-brand-yellow-h'
    : 'bg-gray-950 text-white hover:bg-gray-800'
  const secundario = oscuro
    ? 'border-white/70 text-white hover:bg-white/10'
    : 'border-gray-950 text-gray-950 hover:bg-gray-950/5'
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={PLAY_URL}
        className={`inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-5 font-semibold transition-colors ${principal}`}
      >
        <IconoPlay />
        Descargar en Google Play
      </a>
      <a
        href={APP_STORE_URL}
        className={`inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border-2 px-5 font-semibold transition-colors ${secundario}`}
      >
        <IconoApple />
        Descargar en App Store
      </a>
    </div>
  )
}

// Cada captura existe en 240, 400 y 720 px de ancho (`nombre-240.webp`,
// `nombre-400.webp` y `nombre.webp`). La web tiene `images.unoptimized`, así
// que el srcset va a mano: un teléfono de gama baja se baja la de 240 o 400.
function srcsetDe(src) {
  return [240, 400].map((w) => `${src.replace('.webp', `-${w}.webp`)} ${w}w`).concat(`${src} 720w`).join(', ')
}

function Telefono({ captura, alt, sizes, priority = false, sobreFoto = false }) {
  const c = CAPTURAS[captura]
  // El enlace abre la captura completa: en un teléfono pequeño se ve mejor así.
  return (
    <a
      href={c.src}
      className={`block overflow-hidden rounded-[1.4rem] border-[5px] border-gray-950 bg-gray-950 shadow-[0_14px_30px_-12px_rgba(17,24,39,0.45)] ${sobreFoto ? 'ring-1 ring-white/25' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- srcset propio, ver srcsetDe */}
      <img
        src={c.src}
        srcSet={srcsetDe(c.src)}
        sizes={sizes}
        width={c.w}
        height={c.h}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="block h-auto w-full"
      />
    </a>
  )
}

function Guia({ guia, numero }) {
  // El índice de arriba es blanco: las guías arrancan en crema y alternan.
  const fondo = numero % 2 === 0 ? 'bg-amber-50' : 'bg-white'
  return (
    <section id={guia.id} aria-labelledby={`${guia.id}-titulo`} className={`scroll-mt-4 ${fondo} py-14 sm:py-20`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 id={`${guia.id}-titulo`} className="font-brand text-2xl leading-tight text-gray-950 sm:text-4xl">
            {guia.titulo}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-gray-700 sm:text-lg">{guia.intro}</p>
        </div>

        {guia.requisitos && (
          <div className="mt-8 max-w-3xl rounded-2xl border-2 border-gray-950 bg-white p-5 sm:p-7">
            <h3 className="font-brand text-lg text-gray-950 sm:text-xl">Requisitos para publicar</h3>
            <ul className="mt-4 grid gap-4">
              {guia.requisitos.map((r) => (
                <li key={r.titulo} className="flex items-start gap-3">
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-gray-950" fill="currentColor">
                    <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.9 6.3-4.6 5a.8.8 0 0 1-1.1.1L6 10.8a.8.8 0 1 1 1.1-1.2l1.6 1.5 4-4.4a.8.8 0 0 1 1.2 1.1Z" />
                  </svg>
                  <div>
                    <p className="font-bold text-gray-950">{r.titulo}</p>
                    <p className="mt-1 leading-relaxed text-gray-700">{r.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className={`mt-10 grid gap-10 md:gap-8 ${guia.pasos.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
          {guia.pasos.map((paso, i) => (
            <li
              key={paso.titulo}
              className={
                paso.captura
                  ? 'grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] items-start gap-4 md:grid-cols-1 md:gap-5'
                  : 'self-start rounded-2xl border border-gray-300 bg-white p-5'
              }
            >
              {paso.captura && (
                <div className="md:max-w-[250px]">
                  <Telefono
                    captura={paso.captura}
                    alt={paso.alt}
                    sizes="(min-width: 768px) 250px, 42vw"
                  />
                </div>
              )}
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-950 font-brand text-sm text-brand-yellow">
                    {i + 1}
                  </span>
                  Paso {i + 1}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-gray-950">{paso.titulo}</h3>
                <p className="mt-2 leading-relaxed text-gray-700">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        {guia.nota && (
          <div className="mt-10 max-w-2xl rounded-2xl border-2 border-gray-950 bg-brand-yellow p-5 sm:p-6">
            <p className="font-bold text-gray-950">{guia.nota.titulo}</p>
            <p className="mt-1.5 leading-relaxed text-gray-900">{guia.nota.texto}</p>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Página ───────────────────────────────────────────────────────────────

const TAMANOS_PORTADA = '(min-width: 1024px) 340px, (min-width: 768px) 300px, 72vw'

// La lista de fondos de Firebase se vuelve a leer cada 10 minutos.
export const revalidate = 600

export default async function Home() {
  // La captura de la portada se pide desde el <head>, antes de que el navegador
  // llegue a ella en el HTML. La prioridad alta queda para la foto de fondo,
  // que es lo más grande que pinta la página.
  preload(CAPTURAS.inicio.src, {
    as: 'image',
    imageSrcSet: srcsetDe(CAPTURAS.inicio.src),
    imageSizes: TAMANOS_PORTADA,
  })
  const fondosFirebase = await leerFondosFirebase()
  const jsonLd = construirJsonLd()
  return (
    <>
      {jsonLd.map((schema) => (
        <script
          key={schema['@id']}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <header className="bg-brand-yellow">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- 3 KB, no necesita optimizador */}
            <img src="/app-capturas/logo-96.webp" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
            <span className="font-brand text-lg leading-none text-gray-950">Repuestos Mérida</span>
          </Link>
          <a
            href={PLAY_URL}
            className="inline-flex min-h-11 items-center rounded-xl bg-gray-950 px-4 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Descargar
          </a>
        </div>
      </header>

      <main>
        <section aria-labelledby="titulo-principal" className="relative isolate overflow-hidden bg-gray-950 pb-16 pt-8 sm:pb-24 sm:pt-14">
          <FondoPortada porDefecto={FONDOS_MERIDA} remotos={fondosFirebase} />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <h1 id="titulo-principal" className="font-brand text-[2.1rem] leading-[1.08] text-white sm:text-5xl lg:text-6xl">
                El repuesto de tu carro, <span className="text-brand-yellow">en Mérida</span>, desde tu teléfono
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-100">
                Repuestos Mérida App junta lo que publican los comercios de la ciudad. Buscas la pieza, ves la foto y el
                precio, y le escribes al vendedor por WhatsApp. Es gratis.
              </p>
              <div className="mt-7">
                <BotonesTiendas oscuro />
              </div>
              <ul className="mt-8 grid max-w-xl gap-2.5 text-white">
                {[
                  'Más de 120 comercios de Mérida en el mapa',
                  'Hablas directo con la tienda, sin intermediarios',
                  'Buscar y preguntar no cuesta nada, ni pide cuenta',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-yellow" fill="currentColor">
                      <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.9 6.3-4.6 5a.8.8 0 0 1-1.1.1L6 10.8a.8.8 0 1 1 1.1-1.2l1.6 1.5 4-4.4a.8.8 0 0 1 1.2 1.1Z" />
                    </svg>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mx-auto w-[min(72vw,300px)] md:w-full">
              <Telefono
                captura="inicio"
                alt="Pantalla de inicio de Repuestos Mérida App con el selector de ciudad, agrega tu carro y servicios disponibles"
                sizes={TAMANOS_PORTADA}
                priority
                sobreFoto
              />
            </div>
          </div>
        </section>

        <nav aria-labelledby="indice-titulo" className="border-b border-gray-200 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="indice-titulo" className="font-brand text-2xl text-gray-950 sm:text-3xl">
              ¿Qué quieres hacer?
            </h2>
            <p className="mt-2 text-gray-700">Toca lo que necesitas y te enseñamos cómo, con capturas reales de la app.</p>
            <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">
              {GUIAS.map((g) => (
                <li key={g.id} className="border-b border-gray-200">
                  <a
                    href={`#${g.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 py-3 font-semibold text-gray-950 hover:text-gray-600"
                  >
                    {g.indice}
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 shrink-0" fill="currentColor">
                      <path d="M10.6 4.2a.8.8 0 0 1 1.1 0l5.2 5.2a.8.8 0 0 1 0 1.2l-5.2 5.2a.8.8 0 1 1-1.1-1.2l3.8-3.8H3.8a.8.8 0 0 1 0-1.6h10.6l-3.8-3.8a.8.8 0 0 1 0-1.2Z" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {GUIAS.map((g, i) => (
          <Guia key={g.id} guia={g} numero={i} />
        ))}

        <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-4 bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 id="preguntas-titulo" className="font-brand text-2xl text-gray-950 sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 divide-y divide-gray-300 border-y border-gray-300">
              {PREGUNTAS.map((p) => (
                <details key={p.q} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-gray-950 [&::-webkit-details-marker]:hidden">
                    {p.q}
                    <span aria-hidden="true" className="text-2xl leading-none text-gray-500 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="pb-4 leading-relaxed text-gray-700">{p.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="descargar" aria-labelledby="descargar-titulo" className="scroll-mt-4 bg-gray-950 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="descargar-titulo" className="max-w-2xl font-brand text-3xl leading-tight text-brand-yellow sm:text-5xl">
              Descarga la app y busca tu repuesto hoy
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-300">
              Gratis en Android y en iPhone. La primera búsqueda no te pide cuenta.
            </p>
            <div className="mt-8">
              <BotonesTiendas oscuro />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-950 pb-10 text-sm text-gray-400">
        <div className="mx-auto max-w-6xl border-t border-gray-800 px-4 pt-8 sm:px-6">
          <nav aria-label="Información legal y soporte" className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/soporte" className="hover:text-white">Soporte</Link>
            <a href={`https://wa.me/${WA_SOPORTE}`} className="hover:text-white">WhatsApp de soporte</a>
            <Link href="/politica-privacidad" className="hover:text-white">Política de privacidad</Link>
            <Link href="/terminos-condiciones" className="hover:text-white">Términos y condiciones</Link>
            <Link href="/aviso-legal" className="hover:text-white">Aviso legal</Link>
            <Link href="/politica-cookies" className="hover:text-white">Cookies</Link>
            <Link href="/propiedad-intelectual" className="hover:text-white">Retiro de contenido</Link>
            <Link href="/eliminar-datos" className="hover:text-white">Eliminar mis datos</Link>
          </nav>
          <p className="mt-6">Repuestos Mérida es un proyecto de Gochos Group · Mérida, Venezuela.</p>
        </div>
      </footer>
    </>
  )
}
