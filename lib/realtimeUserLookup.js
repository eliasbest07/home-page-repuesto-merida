// Un mismo comercio puede quedar guardado en varios nodos de /users: la cuenta
// real del dueño (wa_… creada por la web, uid de Firebase Auth creado por la
// app Android) y copias sintéticas que el panel escribió cuando no encontró
// dueño (com_…, phone_…) o nodos viejos cuya clave es el propio teléfono.
// Todas coinciden por WhatsApp, así que quedarse con "la primera que aparece"
// elegía casi siempre la clave numérica —RTDB devuelve las claves ordenadas y
// los dígitos van antes que las letras—, y el catálogo terminaba guardando el
// teléfono en userID en vez del uid del dueño. Los repuestos del comercio
// quedaban repartidos entre dos identidades y la ruta no los veía juntos.

const TIER_REAL_ACCOUNT = 0
const TIER_SYNTHETIC = 1
const TIER_PHONE_KEY = 2

// wa_… (web) y los uid de Firebase Auth (app) son cuentas reales; com_… y
// phone_… los inventa el panel; una clave puramente numérica es un nodo viejo
// indexado por teléfono y nunca debe ganar.
export function realtimeUidTier(uid = '') {
  const key = String(uid || '')
  if (!key || /^\d+$/.test(key)) return TIER_PHONE_KEY
  if (/^(com_|phone_)/.test(key)) return TIER_SYNTHETIC
  return TIER_REAL_ACCOUNT
}

// Campos que sólo escribe el registro real de un usuario: un nodo sintético
// creado por el panel se queda en los datos del comercio y no los tiene.
const ACCOUNT_FIELDS = [
  'canonical_uid',
  'uid',
  'identity_id',
  'creado_en',
  'consentimientos',
  'cedula_estado',
  'google_uid',
  'nombre',
  'foto_url',
  'correo',
  'email',
]

export function realtimeAccountSignals(user) {
  if (!user || typeof user !== 'object') return 0
  return ACCOUNT_FIELDS.reduce((total, field) => (user[field] ? total + 1 : total), 0)
}

function lastWrite(user) {
  if (!user || typeof user !== 'object') return 0
  return Number(
    user.comercio_autorizado_actualizado_en || user.identity_updated_at || user.creado_en || 0,
  ) || 0
}

// Orden: primero la cuenta real, luego la que tenga más datos de registro y,
// a igualdad, la escrita más recientemente.
export function compareRealtimeUsers(a, b) {
  const tier = realtimeUidTier(a?.uid) - realtimeUidTier(b?.uid)
  if (tier !== 0) return tier
  const signals = realtimeAccountSignals(b?.user) - realtimeAccountSignals(a?.user)
  if (signals !== 0) return signals
  return lastWrite(b?.user) - lastWrite(a?.user)
}

export function pickCanonicalRealtimeUser(matches = []) {
  const valid = (Array.isArray(matches) ? matches : []).filter((match) => match && match.uid)
  if (valid.length === 0) return null
  return valid.slice().sort(compareRealtimeUsers)[0]
}
