function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let phone = cleanPhone(raw)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

function isAuthorized(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function userMatchesPhone(user, uid, targets) {
  const profilePhones = [user.whatsapp, user.telefono, user.phone, user.id]
    .map(canonPhone)
    .filter((phone) => phone.length >= 10)

  if (profilePhones.some((phone) => targets.has(phone))) return true

  // Los usuarios web antiguos pueden estar indexados directamente por el
  // telefono y no tener ningun campo de telefono dentro del perfil.
  return profilePhones.length === 0 && targets.has(canonPhone(uid))
}

/**
 * Comprueba el permiso de administracion usando todos los perfiles que
 * pertenecen al telefono de la sesion. Una misma persona puede tener mas de
 * un nodo en /users (por ejemplo, uno por cada cuenta de Google vinculada),
 * por lo que no se puede decidir con el primer resultado encontrado.
 */
export async function canManageCommerces(rtdb, session = {}) {
  const rawPhones = [session.telefono, session.tel].filter(Boolean)
  const targets = new Set(rawPhones.map(canonPhone).filter((phone) => phone.length >= 10))
  if (targets.size === 0) return false

  const legacyKeys = Array.from(new Set(rawPhones.map(cleanPhone).filter((phone) => phone.length >= 10)))
  const [usersSnap, ...legacySnaps] = await Promise.all([
    rtdb.ref('users').get(),
    ...legacyKeys.map((key) => rtdb.ref(`rifas_usuarios/${key}/autorizado`).get()),
  ])

  if (legacySnaps.some((snap) => isAuthorized(snap.val()))) return true
  if (!usersSnap.exists()) return false

  for (const [uid, user] of Object.entries(usersSnap.val() || {})) {
    if (!user || typeof user !== 'object' || !isAuthorized(user.autorizado)) continue
    if (userMatchesPhone(user, uid, targets)) return true
  }

  return false
}
