// Comercios que YA publican en el catálogo `merida`.
//
// Nada llega a `merida` sin pasar por la aprobación, así que tener al menos
// una pieza publicada ES la prueba de que el comercio está registrado y
// autorizado. Esta es la lista real de comercios; `comercios_autorizados`
// (Firestore) y `comercios_por_dia` (Realtime) solo describen las fichas que se
// cargaron desde el panel y dejan fuera a más de la mitad de quienes publican.
//
// La cédula verificada se sigue exigiendo aparte: publicar en `merida` no la
// sustituye.

export const CATALOG_COLLECTION = 'merida'

// Solo los campos que hacen falta para agrupar: la colección tiene miles de
// documentos y cada uno trae fotos, compatibilidades y textos largos.
const CATALOG_FIELDS = [
  'userID',
  'comercio',
  'comercio_nombre',
  'whatsapp',
  'comercio_id',
  'comercio_direccion',
  'comercio_lat',
  'comercio_lng',
  'vehiculo',
]

function canonicalPhone(value) {
  let phone = String(value || '').replace(/\D/g, '')
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function mostFrequent(counts) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

function bump(counts, value) {
  if (value) counts[value] = (counts[value] || 0) + 1
}

function num(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Agrupa las piezas del catálogo por `userID` (la cuenta con la que publica el
 * comercio). El nombre sale de las propias piezas; si no lo traen, del perfil
 * público de la cuenta. El WhatsApp igual, con respaldo en `/users`.
 *
 * @param {Array<object>} items          datos de cada documento de `merida`
 * @param {object} options.publicProfiles `public_profiles` de Realtime
 * @param {object} options.users          `users` de Realtime
 */
export function groupCatalogPublishers(items = [], { publicProfiles = {}, users = {} } = {}) {
  const byUser = new Map()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const userId = cleanText(item.userID, 128)
    if (!userId) continue
    const group = byUser.get(userId) || {
      user_id: userId,
      piezas: 0,
      nombres: {},
      telefonos: {},
      comercio_ids: new Set(),
      direcciones: {},
      vehiculos: {},
      lat: null,
      lng: null,
    }
    group.piezas += 1
    bump(group.nombres, cleanText(item.comercio, 120) || cleanText(item.comercio_nombre, 120))
    const phone = canonicalPhone(item.whatsapp)
    if (phone.length >= 10) bump(group.telefonos, phone)
    const commerceId = cleanText(item.comercio_id, 80)
    if (commerceId) group.comercio_ids.add(commerceId)
    bump(group.direcciones, cleanText(item.comercio_direccion, 220))
    bump(group.vehiculos, item.vehiculo === 'moto' ? 'moto' : 'carro')
    const lat = num(item.comercio_lat)
    const lng = num(item.comercio_lng)
    if (group.lat === null && lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
      group.lat = lat
      group.lng = lng
    }
    byUser.set(userId, group)
  }

  return Array.from(byUser.values())
    .map((group) => {
      const profile = publicProfiles?.[group.user_id] || {}
      const user = users?.[group.user_id] || {}
      const profilePhone = [user.whatsapp, user.telefono, profile.whatsapp]
        .map(canonicalPhone)
        .find((phone) => phone.length >= 10) || ''
      const phone = mostFrequent(group.telefonos) || profilePhone
      return {
        user_id: group.user_id,
        nombre: mostFrequent(group.nombres)
          || cleanText(profile.nombre, 120)
          || cleanText(user.nombre_comercio, 120)
          || cleanText(user.nombre, 120),
        whatsapp: phone ? `+58${phone}` : '',
        telefonos: Array.from(new Set([phone, ...Object.keys(group.telefonos), profilePhone].filter(Boolean))),
        piezas: group.piezas,
        comercio_ids: Array.from(group.comercio_ids),
        comercio_direccion: mostFrequent(group.direcciones),
        tipo_vehiculo: mostFrequent(group.vehiculos) || 'carro',
        comercio_lat: group.lat,
        comercio_lng: group.lng,
      }
    })
    .sort((a, b) => b.piezas - a.piezas)
}

/** Lee `merida` (solo los campos de agrupación) y devuelve los publicadores. */
export async function loadCatalogPublishers(db, { publicProfiles = {}, users = {} } = {}) {
  const snap = await db.collection(CATALOG_COLLECTION).select(...CATALOG_FIELDS).get()
  return groupCatalogPublishers(snap.docs.map((doc) => doc.data() || {}), { publicProfiles, users })
}

/**
 * El publicador que corresponde a un comercio: por cuenta (`userID`), por
 * `comercio_id` o por teléfono, en ese orden.
 */
export function findCatalogPublisher(publishers = [], { phone = '', uids = [], commerceId = '' } = {}) {
  const list = Array.isArray(publishers) ? publishers : []
  const uidSet = new Set((Array.isArray(uids) ? uids : [uids]).map((uid) => cleanText(uid, 128)).filter(Boolean))
  const targetId = cleanText(commerceId, 80)
  const target = canonicalPhone(phone)

  return list.find((publisher) => uidSet.has(publisher.user_id))
    || (targetId ? list.find((publisher) => publisher.comercio_ids.includes(targetId)) : null)
    || (target.length >= 10 ? list.find((publisher) => publisher.telefonos.includes(target)) : null)
    || null
}

/**
 * Busca el publicador de un teléfono o cuenta sin leer el catálogo entero:
 * basta con saber que existe al menos una pieza.
 */
export async function findCatalogPublisherByQuery(db, { phoneVariants = [], uids = [] } = {}) {
  const queries = []
  for (const uid of uids.filter(Boolean).slice(0, 10)) {
    queries.push(db.collection(CATALOG_COLLECTION).where('userID', '==', uid).limit(1).get())
  }
  const variants = phoneVariants.filter(Boolean).slice(0, 10)
  if (variants.length) {
    queries.push(db.collection(CATALOG_COLLECTION).where('whatsapp', 'in', variants).limit(1).get())
  }
  const snaps = await Promise.all(queries.map((query) => query.catch(() => ({ docs: [] }))))
  const doc = snaps.flatMap((snap) => snap.docs)[0]
  if (!doc) return null
  const data = doc.data() || {}
  const [publisher] = groupCatalogPublishers([data])
  return publisher || null
}
