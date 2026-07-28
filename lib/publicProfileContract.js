export const PUBLIC_PROFILE_SCHEMA_VERSION = 1

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function text(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function finiteNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function publicPhone(value) {
  let phone = cleanPhone(value)
  if (phone.startsWith('0') && phone.length === 11) phone = `58${phone.slice(1)}`
  if (!phone.startsWith('58') || phone.length < 12 || phone.length > 15) return ''
  return `+${phone}`
}

function firstCommerce(profile) {
  const current = object(profile.comercio_autorizado)
  if (Object.keys(current).length > 0) return current

  const currentDay = text(profile.comercio_dia_actual, 20).toLowerCase()
  const byDay = object(profile.comercios_por_dia)
  const orderedDays = currentDay
    ? [currentDay, ...Object.keys(byDay).filter((day) => day !== currentDay)]
    : Object.keys(byDay)
  for (const day of orderedDays) {
    const commerces = object(object(byDay[day]).comercios)
    for (const [commerceId, rawCommerce] of Object.entries(commerces)) {
      const commerce = object(rawCommerce)
      if (Object.keys(commerce).length > 0) {
        return { ...commerce, comercio_id: commerce.comercio_id || commerceId, dia: day }
      }
    }
  }
  return {}
}

function hasPublicBusiness(profile, commerce) {
  const sellerType = text(profile.tipovender, 30).toLowerCase()
  return Boolean(
    profile.vender === true
    || profile.autorizado === true
    || commerce.autorizado === true
    || ['tienda', 'comercio', 'vendedor'].includes(sellerType)
    || text(commerce.comercio_id, 100)
    || text(profile.nombre_comercio, 120),
  )
}

/**
 * Única lista de campos permitidos en /public_profiles.
 * Nunca devuelve cédula, correo, teléfono personal, token de notificaciones,
 * consentimientos, mensajes, créditos ni coordenadas personales.
 */
export function sanitizePublicProfile(uid, rawProfile, {
  canonicalUid = uid,
  updatedAt = Date.now(),
} = {}) {
  const profile = object(rawProfile)
  const commerce = firstCommerce(profile)
  const business = hasPublicBusiness(profile, commerce)
  const displayName = text(
    commerce.nombre_comercio
      || profile.nombre_comercio
      || profile.nombre
      || profile.google_nombre,
    120,
  )
  const photoUrl = text(
    commerce.comercio_foto_url
      || profile.comercio_foto_url
      || profile.foto
      || profile.foto_url,
    1000,
  )
  const city = text(profile.ciudad, 80)
  const sellerType = business ? 'tienda' : 'individuo'

  const result = {
    schema_version: PUBLIC_PROFILE_SCHEMA_VERSION,
    record_type: 'public_profile',
    uid: text(uid, 128),
    canonical_uid: text(canonicalUid, 128),
    nombre: displayName || 'Usuario',
    foto: photoUrl,
    foto_url: photoUrl,
    ciudad: city,
    tipovender: sellerType,
    vender: business,
    actualizado_en: updatedAt,
  }

  if (!business) return result

  const commerceId = text(
    commerce.comercio_id || profile.comercio_id || canonicalUid,
    100,
  )
  const address = text(
    commerce.comercio_direccion
      || profile.comercio_direccion
      || profile.ubicacion_texto,
    240,
  )
  const lat = finiteNumber(commerce.comercio_lat ?? profile.comercio_lat)
  const lng = finiteNumber(commerce.comercio_lng ?? profile.comercio_lng)
  const whatsapp = publicPhone(
    commerce.whatsapp_normalizado
      || commerce.whatsapp
      || profile.whatsapp_public
      || profile.whatsapp,
  )

  return {
    ...result,
    comercio_id: commerceId,
    nombre_comercio: displayName,
    comercio_foto_url: photoUrl,
    comercio_direccion: address,
    comercio_lat: lat,
    comercio_lng: lng,
    tipo_vehiculo: commerce.tipo_vehiculo === 'moto' ? 'moto' : 'carro',
    whatsapp_public: whatsapp,
    public_contact_enabled: Boolean(whatsapp),
  }
}

export function publicProfileAllowedKeys() {
  return [
    'schema_version',
    'record_type',
    'uid',
    'canonical_uid',
    'nombre',
    'foto',
    'foto_url',
    'ciudad',
    'tipovender',
    'vender',
    'actualizado_en',
    'comercio_id',
    'nombre_comercio',
    'comercio_foto_url',
    'comercio_direccion',
    'comercio_lat',
    'comercio_lng',
    'tipo_vehiculo',
    'whatsapp_public',
    'public_contact_enabled',
  ]
}
