import 'server-only'

import { getAdminAuth, getAdminRealtimeDb } from '@/lib/firebaseAdmin'
import {
  canonicalPhone,
  cleanPhone,
  identityIdForPhone,
  resolveRealtimeIdentities,
} from '@/lib/dataContractV2'
import { syncPublicProfileFromUser } from '@/lib/publicProfileAdmin'

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function authScore(user) {
  if (!user) return -1
  const providers = user.providerData.map((provider) => provider.providerId)
  let score = 10
  if (providers.includes('google.com')) score += 100
  else if (providers.includes('phone')) score += 80
  else if (providers.length > 0) score += 50
  if (user.emailVerified) score += 5
  if (!user.disabled) score += 2
  return score
}

function authActivity(user) {
  if (!user) return 0
  return Math.max(
    Date.parse(user.metadata.lastRefreshTime || '') || 0,
    Date.parse(user.metadata.lastSignInTime || '') || 0,
  )
}

async function getAuthUserOrNull(auth, uid) {
  if (!uid) return null
  try {
    return await auth.getUser(uid)
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null
    throw error
  }
}

async function ensureAuthUser(auth, uid) {
  const existing = await getAuthUserOrNull(auth, uid)
  if (existing) return existing
  try {
    return await auth.createUser({ uid })
  } catch (error) {
    if (error?.code === 'auth/uid-already-exists') return auth.getUser(uid)
    throw error
  }
}

function mergeNested(left, right) {
  if (!isObject(left)) return isObject(right) ? { ...right } : right
  if (!isObject(right)) return right === undefined ? { ...left } : right
  const result = { ...left }
  for (const [key, value] of Object.entries(right)) {
    result[key] = isObject(result[key]) && isObject(value)
      ? mergeNested(result[key], value)
      : value
  }
  return result
}

function mergeProfiles(records, current, {
  canonicalUid,
  identityId,
  telefono,
  profilePatch,
}) {
  const ordered = [...records].sort((a, b) => a.score - b.score || b.uid.localeCompare(a.uid))
  let merged = {}
  for (const record of ordered) merged = mergeNested(merged, record.profile)
  // Lo que ya exista en el nodo canónico siempre gana ante una copia legacy.
  merged = mergeNested(merged, isObject(current) ? current : {})
  merged = mergeNested(merged, isObject(profilePatch) ? profilePatch : {})

  return {
    ...merged,
    id: canonicalUid,
    uid: canonicalUid,
    whatsapp: telefono,
    telefono,
    identity_id: identityId,
    canonical_uid: canonicalUid,
    identity_schema_version: 2,
    identity_updated_at: Date.now(),
  }
}

/**
 * Convierte un WhatsApp ya verificado por el bot en una identidad Firebase
 * estable. Es aditivo: crea/actualiza el nodo canónico y el índice privado,
 * pero nunca elimina los UID heredados mientras existan referencias antiguas.
 */
export async function issueCanonicalFirebaseSession({
  telefono,
  preferredAuthUid = '',
  profilePatch = null,
  source = 'whatsapp',
}) {
  const canonicalPhoneValue = canonicalPhone(telefono)
  const identityId = identityIdForPhone(canonicalPhoneValue)
  if (!identityId) throw new Error('Número de WhatsApp inválido.')

  const adminRtdb = getAdminRealtimeDb()
  const auth = await getAdminAuth()
  const records = await resolveRealtimeIdentities(adminRtdb, canonicalPhoneValue)
  const indexRef = adminRtdb.ref(`identity_index/${identityId}`)
  const indexBeforeSnap = await indexRef.get()
  const indexBefore = indexBeforeSnap.exists() ? indexBeforeSnap.val() || {} : {}

  const possibleAuthUids = Array.from(new Set([
    preferredAuthUid,
    indexBefore.primary_auth_uid,
    ...records.map((record) => record.uid),
  ].filter(Boolean)))
  const authUsers = (await Promise.all(
    possibleAuthUids.map(async (uid) => [uid, await getAuthUserOrNull(auth, uid)]),
  )).filter(([, user]) => user)

  authUsers.sort(([, left], [, right]) => (
    authScore(right) - authScore(left)
    || authActivity(right) - authActivity(left)
    || left.uid.localeCompare(right.uid)
  ))

  // El UID derivado no revela el número y permanece estable incluso si dos
  // solicitudes nuevas llegan a servidores distintos al mismo tiempo.
  const generatedUid = `wa_${identityId.slice(0, 28)}`
  const selectedUid =
    preferredAuthUid
    || indexBefore.primary_auth_uid
    || authUsers[0]?.[0]
    || generatedUid

  const realtimeUids = {
    ...(isObject(indexBefore.realtime_uids) ? indexBefore.realtime_uids : {}),
    ...Object.fromEntries(records.map((record) => [record.uid, true])),
    [selectedUid]: true,
  }
  const authUids = {
    ...(isObject(indexBefore.auth_uids) ? indexBefore.auth_uids : {}),
    ...Object.fromEntries(authUsers.map(([uid]) => [uid, true])),
    [selectedUid]: true,
  }

  const transaction = await indexRef.transaction((currentValue) => {
    const current = isObject(currentValue) ? currentValue : {}
    const canonicalUid =
      preferredAuthUid
      || current.primary_auth_uid
      || selectedUid
    return {
      ...current,
      schema_version: 2,
      primary_auth_uid: canonicalUid,
      primary_realtime_uid: canonicalUid,
      primary_commerce_uid: current.primary_commerce_uid || '',
      primary_selection_reason: preferredAuthUid
        ? 'verified_provider'
        : current.primary_auth_uid
          ? 'existing_identity_index'
          : authUsers.length > 0
            ? 'existing_firebase_auth'
            : 'stable_whatsapp_uid',
      realtime_uids: {
        ...(isObject(current.realtime_uids) ? current.realtime_uids : {}),
        ...realtimeUids,
        [canonicalUid]: true,
      },
      auth_uids: {
        ...(isObject(current.auth_uids) ? current.auth_uids : {}),
        ...authUids,
        [canonicalUid]: true,
      },
      duplicate: Object.keys({
        ...(isObject(current.realtime_uids) ? current.realtime_uids : {}),
        ...realtimeUids,
        [canonicalUid]: true,
      }).length > 1,
      updated_at: Date.now(),
      source,
    }
  })

  if (!transaction.committed) throw new Error('No se pudo reservar la identidad del usuario.')
  const identity = transaction.snapshot.val() || {}
  const canonicalUid = identity.primary_auth_uid
  await ensureAuthUser(auth, canonicalUid)

  const canonicalRef = adminRtdb.ref(`users/${canonicalUid}`)
  const profileTransaction = await canonicalRef.transaction((current) => (
    mergeProfiles(records, current, {
      canonicalUid,
      identityId,
      telefono,
      profilePatch,
    })
  ))
  if (!profileTransaction.committed) throw new Error('No se pudo preparar el perfil del usuario.')
  await syncPublicProfileFromUser(canonicalUid, { rtdb: adminRtdb })

  const firebaseCustomToken = await auth.createCustomToken(canonicalUid, {
    identity_id: identityId,
    phone_key: cleanPhone(telefono),
    login_provider: source,
  })

  return {
    canonicalUid,
    identityId,
    firebaseCustomToken,
    canonicalProfile: profileTransaction.snapshot.val() || null,
    legacyUids: Object.keys(identity.realtime_uids || {}).filter((uid) => uid !== canonicalUid),
  }
}
