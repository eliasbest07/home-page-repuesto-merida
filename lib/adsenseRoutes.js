// Rutas donde SÍ se permiten anuncios de AdSense: páginas con contenido del
// editor (home, blog, catálogo, fichas, directorio, feeds). Cualquier otra ruta
// (login, formularios, juegos, paneles, verificación) NO debe cargar AdSense,
// para cumplir la política "anuncios en pantallas sin contenido del editor".

// Coincidencia exacta de ruta.
const AD_EXACT = new Set(['/', '/plaza', '/solicitados', '/directorio'])

// Coincidencia por prefijo (incluye sus subrutas, p. ej. /repuesto/123).
const AD_PREFIX = ['/blog', '/repuesto/', '/anuncio/']

export function isAdRoute(pathname) {
  if (!pathname) return false
  if (AD_EXACT.has(pathname)) return true
  return AD_PREFIX.some((prefix) => pathname.startsWith(prefix))
}
