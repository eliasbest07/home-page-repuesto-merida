import 'server-only'

import { getAdminRealtimeDb } from '@/lib/firebaseAdmin'
import { sanitizePublicProfile } from '@/lib/publicProfileContract'

function safeUid(value) {
  const uid = String(value || '').trim()
  if (!uid || uid.length > 128 || /[.#$\[\]/]/.test(uid)) return ''
  if (/^[+\d\s().-]+$/.test(uid)) return ''
  return uid
}

export async function syncPublicProfileFromUser(uid, { rtdb = null } = {}) {
  const userUid = safeUid(uid)
  if (!userUid) return null
  const database = rtdb || getAdminRealtimeDb()
  const userSnap = await database.ref(`users/${userUid}`).get()
  if (!userSnap.exists()) return null
  const profile = userSnap.val() || {}
  const canonicalUid = safeUid(profile.canonical_uid) || userUid
  const publicProfile = sanitizePublicProfile(userUid, profile, { canonicalUid })
  await database.ref(`public_profiles/${userUid}`).set(publicProfile)
  if (canonicalUid !== userUid) {
    await database
      .ref(`public_profiles/${canonicalUid}`)
      .set(sanitizePublicProfile(canonicalUid, profile, { canonicalUid }))
  }
  return publicProfile
}

export async function syncPublicProfilesFromUsers(uids, { rtdb = null } = {}) {
  const database = rtdb || getAdminRealtimeDb()
  const unique = [...new Set((uids || []).map(safeUid).filter(Boolean))]
  return Promise.all(unique.map((uid) => syncPublicProfileFromUser(uid, { rtdb: database })))
}
