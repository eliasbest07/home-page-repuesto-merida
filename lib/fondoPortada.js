import 'server-only'

// Fondo de la portada de la landing: fotos de Mérida que vienen con la web y,
// cuando las hay, imágenes o videos que se ponen en Firebase sin publicar de nuevo.

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://repuestos-merida-default-rtdb.firebaseio.com'

// Se ven siempre al entrar y se quedan solas si Firebase no trae nada.
// Cada una existe en 1024 px (`id.webp`) y en 640 px para teléfono (`id-640.webp`).
export const FONDOS_MERIDA = [
  ['pico', 'Pico Bolívar'],
  ['culata', 'La Culata'],
  ['teleferico', 'Teleférico de Mérida'],
  ['capilla', 'Capilla de Piedra'],
  ['5agilas', 'Cinco Águilas Blancas'],
  ['heroinas', 'Plaza Las Heroínas'],
  ['bolivar', 'Simón Bolívar'],
  ['estadio', 'Estadio Metropolitano'],
  ['localuz', 'La Loca Luz Caraballo'],
].map(([id, nombre]) => ({ tipo: 'imagen', nombre, src: `/merida/${id}.webp`, srcMovil: `/merida/${id}-640.webp` }))

const TIPO_POR_EXTENSION = {
  gif: 'imagen',
  webp: 'imagen',
  avif: 'imagen',
  jpg: 'imagen',
  jpeg: 'imagen',
  png: 'imagen',
  mp4: 'video',
  webm: 'video',
}

// Las URLs de Storage llevan la ruta codificada (`landing%2Ffondo%2Fpico.mp4?alt=media…`).
function tipoPorUrl(url) {
  try {
    const ruta = decodeURIComponent(new URL(url).pathname)
    return TIPO_POR_EXTENSION[ruta.split('.').pop().toLowerCase()]
  } catch {
    return undefined
  }
}

// Cada hijo de `configuracion/landing_fondo` puede ser la URL sola o
// `{ url, urlMovil, nombre, tipo, activo }`. `urlMovil` es opcional: una versión
// vertical para teléfonos, donde la portada es alta y una foto horizontal se
// amplía mucho. Lo que no se entienda se ignora.
// http solo para probar en local con `FIREBASE_DATABASE_URL` apuntando a un servidor de prueba.
const esUrlValida = (url) => typeof url === 'string' && /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(url)

function normalizar(valor) {
  const dato = typeof valor === 'string' ? { url: valor } : valor
  if (!dato || !esUrlValida(dato.url) || dato.activo === false) return null
  const tipo = dato.tipo === 'imagen' || dato.tipo === 'video' ? dato.tipo : tipoPorUrl(dato.url)
  if (!tipo) return null
  return {
    tipo,
    src: dato.url,
    ...(esUrlValida(dato.urlMovil) ? { srcMovil: dato.urlMovil } : {}),
    nombre: typeof dato.nombre === 'string' ? dato.nombre.slice(0, 60) : '',
  }
}

// `configuracion` se lee sin sesión (así lee la app `admain`), de modo que basta
// el REST de Realtime Database. Se vuelve a pedir cada 10 minutos (ISR); si
// falla o tarda, la portada sigue con las fotos de Mérida.
export async function leerFondosFirebase() {
  try {
    const res = await fetch(`${DATABASE_URL}/configuracion/landing_fondo.json`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const valor = await res.json()
    if (!valor || typeof valor !== 'object') return []
    return Object.values(valor).map(normalizar).filter(Boolean).slice(0, 12)
  } catch {
    return []
  }
}
