// Rutas donde SÍ se permiten anuncios de AdSense: páginas con contenido del
// editor (home, blog, catálogo, fichas, directorio, feeds). Cualquier otra ruta
// (login, formularios, juegos, paneles, verificación) NO debe cargar AdSense,
// para cumplir la política "anuncios en pantallas sin contenido del editor".

// Coincidencia exacta de ruta.
const AD_EXACT = new Set(['/', '/plaza', '/solicitados'])

// Las fichas dinámicas de repuesto y anuncio habilitan AdSense desde la propia
// página únicamente después de verificar que el documento existe y tiene datos
// relevantes. No deben incluirse aquí porque también existen estados 404/vacíos.
const AD_PREFIX = ['/blog']

// Rutas de contenido SIN anuncios (apuestas/club): no cargar AdSense aunque
// caigan bajo /blog. Debe coincidir con los posts marcados `ads:false`.
const AD_BLOCKED = new Set([
  '/blog/bingo-confianza-club-andino',
  '/blog/beneficios-club-andino',
])

export function isAdRoute(pathname) {
  if (!pathname) return false
  if (AD_BLOCKED.has(pathname)) return false
  if (AD_EXACT.has(pathname)) return true
  return AD_PREFIX.some((prefix) => pathname.startsWith(prefix))
}
