import 'server-only'
import crypto from 'node:crypto'

export const DATA_SCHEMA_VERSION = 2

export function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

export function canonicalPhone(value) {
  let phone = cleanPhone(value)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

export function phoneVariants(value) {
  const phone = canonicalPhone(value)
  return Array.from(new Set([
    cleanPhone(value),
    phone,
    phone ? `0${phone}` : '',
    phone ? `58${phone}` : '',
    phone ? `+58${phone}` : '',
  ].filter(Boolean)))
}

// Identificador seudónimo estable. No sustituye el teléfono como credencial ni
// debe exponerse como dato anónimo: un número conocido permite recalcularlo.
export function identityIdForPhone(value) {
  const phone = canonicalPhone(value)
  if (phone.length < 10) return ''
  return crypto
    .createHash('sha256')
    .update(`repuestos-merida:identity:v2:${phone}`)
    .digest('hex')
    .slice(0, 32)
}

function profilePhones(uid, profile = {}) {
  return [uid, profile.whatsapp, profile.telefono, profile.phone, profile.id]
    .map(canonicalPhone)
    .filter((phone) => phone.length >= 10)
}

function identityScore(uid, profile = {}) {
  let score = cleanPhone(uid).length >= 10 ? 0 : 20
  if (profile.google_uid || profile.firebase_uid || profile.auth_uid) score += 30
  if (profile.comercio_autorizado && typeof profile.comercio_autorizado === 'object') score += 15
  if (profile.comercios_por_dia && typeof profile.comercios_por_dia === 'object') score += 10
  if (profile.nombre || profile.google_nombre) score += 2
  return score
}

export async function resolveRealtimeIdentities(rtdb, value) {
  const target = canonicalPhone(value)
  if (target.length < 10) return []
  const identityId = identityIdForPhone(target)
  const [snapshot, indexSnapshot] = await Promise.all([
    rtdb.ref('users').get(),
    rtdb.ref(`identity_index/${identityId}`).get(),
  ])
  if (!snapshot.exists()) return []

  const indexedUids = indexSnapshot.exists()
    ? Object.keys(indexSnapshot.val()?.realtime_uids || {})
    : []
  const indexedRank = new Map(indexedUids.map((uid, index) => [uid, indexedUids.length - index]))
  const primaryUid = indexSnapshot.val()?.primary_realtime_uid || ''

  return Object.entries(snapshot.val() || {})
    .filter(([uid, profile]) => profile && typeof profile === 'object' && profilePhones(uid, profile).includes(target))
    .map(([uid, profile]) => ({
      uid,
      profile,
      score: identityScore(uid, profile)
        + (indexedRank.get(uid) || 0) * 100
        + (uid === primaryUid ? 10000 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid))
}
