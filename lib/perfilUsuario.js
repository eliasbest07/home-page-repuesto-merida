import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'

// Información oficial del usuario:
//   /users/{uidGoogle}  →  app Android (NO se modifica, solo lectura)
//   El teléfono vive en el campo `whatsapp` en formatos sucios:
//   "+5804166029081", "04147438797", 5804247295257, "+584123375417"...
//
// El login web solo conoce el número (del magic_link / OTP). Para recuperar
// la info ya guardada hay que emparejar ese número contra users.whatsapp
// normalizando ambos a la misma forma canónica.

/**
 * Número venezolano → suscriptor de 10 dígitos (4XXXXXXXXX).
 * Quita el código de país 58 y los ceros iniciales.
 *   "584166759640"    → "4166759640"
 *   "+5804166029081"  → "4166029081"
 *   "04147438797"     → "4147438797"
 */
export function canonPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  d = d.replace(/^0+/, '')
  return d
}

/**
 * Extrae lat/lng de un campo `ubicacion` ("8.594993,-71.143937").
 * Devuelve null si no parece una coordenada real de Venezuela
 * (muchos registros traen basura: "18 Mar 2024", "10-10", "35353,35353").
 */
export function parseUbicacion(raw) {
  if (raw == null) return null
  const m = String(raw).match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < 0 || lat > 16 || lng < -74 || lng > -59) return null // bounds Venezuela
  return { lat, lng }
}

/**
 * Busca en /users el registro oficial cuyo `whatsapp` coincide con el número.
 * Devuelve { uid, ...datos } o null. Escaneo lineal (hoy ~30 usuarios);
 * si crece conviene un índice telefono→uid.
 */
export async function buscarUsuarioOficial(telefono) {
  const target = canonPhone(telefono)
  if (!target) return null
  const snap = await get(ref(rtdb, 'users'))
  if (!snap.exists()) return null
  const all = snap.val() || {}
  for (const [uid, u] of Object.entries(all)) {
    if (u && canonPhone(u.whatsapp) === target) return { uid, ...u }
  }
  return null
}

/**
 * Une el perfil ya guardado en rifas_usuarios con el oficial de /users.
 * Devuelve { perfil, completo }. `perfil` siempre lleva whatsapp y, si hubo
 * match oficial, el uid que enlaza con /users.
 */
export function construirPerfil({ telefono, rifas, oficial }) {
  const ubic = parseUbicacion(oficial?.ubicacion)
  const lat = rifas?.lat ?? ubic?.lat ?? null
  const lng = rifas?.lng ?? ubic?.lng ?? null
  const nombre = String(rifas?.nombre || oficial?.nombre || oficial?.google_nombre || '').trim()
  const foto_url = rifas?.foto_url || oficial?.foto || null

  const perfil = {
    telefono,
    whatsapp: telefono,
    nombre,
    foto_url,
    lat,
    lng,
    ...(oficial?.id || oficial?.uid ? { uid: oficial.id || oficial.uid } : {}),
    ...(oficial && {
      ciudad: oficial.ciudad ?? null,
      zona: oficial.zona ?? null,
      marca: oficial.marca ?? null,
      tipovender: oficial.tipovender ?? null,
    }),
    ...(rifas?.creado_en ? { creado_en: rifas.creado_en } : {}),
  }

  const completo = Boolean(nombre && lat != null && lng != null)
  return { perfil, completo }
}

/**
 * Resolución central de perfil para las rutas de auth.
 * - Sin info en ningún lado → { perfil: null, prefill: null } (registro vacío).
 * - Info completa (nombre + ubicación válida) → { perfil, prefill: null } (entra directo).
 * - Info parcial (p.ej. oficial sin coordenadas) → { perfil: null, prefill } (registro prellenado).
 */
export async function resolverPerfil({ telefono, key }) {
  const [rifasSnap, oficial] = await Promise.all([
    get(ref(rtdb, `rifas_usuarios/${key}`)),
    buscarUsuarioOficial(telefono || key),
  ])
  const rifas = rifasSnap.exists() ? rifasSnap.val() : null
  if (!rifas && !oficial) return { perfil: null, prefill: null }

  const { perfil, completo } = construirPerfil({ telefono: telefono || key, rifas, oficial })
  return completo ? { perfil, prefill: null } : { perfil: null, prefill: perfil }
}
