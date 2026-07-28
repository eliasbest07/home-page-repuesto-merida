#!/usr/bin/env node

/**
 * Diagnóstico y creación segura del índice de identidad v2.
 *
 * Por defecto SOLO LEE y genera un JSON sin teléfonos ni UID crudos:
 *   npm run migrate:firebase-identity-v2
 *
 * Para crear /identity_index (nunca fusiona ni elimina usuarios):
 *   FIREBASE_IDENTITY_MIGRATION_CONFIRM=WRITE_IDENTITY_INDEX_V2 \
 *     npm run migrate:firebase-identity-v2 -- --apply-index
 *
 * El modo de escritura debe ejecutarse únicamente después de confirmar un
 * backup restaurable. Es aditivo e idempotente, pero modifica RTDB.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL
  || process.env.FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
const APPLY = process.argv.includes('--apply-index')
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const runStamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const outputPath = path.resolve(outArg ? outArg.slice(6) : `output/audits/identity-v2-${runStamp}.json`)
const CONFIRM_VALUE = 'WRITE_IDENTITY_INDEX_V2'

function serviceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
  }
  return null
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(value) {
  let phone = digits(value)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  phone = phone.replace(/^0+/, '')
  return phone.length >= 10 && phone.length <= 13 ? phone : ''
}

function sha(value, size = 16) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, size)
}

function identityId(phone) {
  return sha(`repuestos-merida:identity:v2:${phone}`, 32)
}

function uidFingerprint(uid) {
  return sha(`repuestos-merida:uid-diagnostic:${uid}`, 12)
}

function uidKind(uid) {
  if (canonPhone(uid)) return 'telefono'
  if (/^com_[a-z0-9_-]+$/i.test(uid)) return 'comercio_legacy'
  return 'auth_o_legacy'
}

function profilePhone(uid, profile = {}) {
  for (const value of [profile.whatsapp, profile.telefono, profile.phone, profile.id, uid]) {
    const phone = canonPhone(value)
    if (phone) return phone
  }
  return ''
}

function score(uid, profile = {}) {
  let value = uidKind(uid) === 'auth_o_legacy' ? 25 : 0
  if (profile.google_uid || profile.firebase_uid || profile.auth_uid) value += 30
  if (profile.comercio_autorizado && typeof profile.comercio_autorizado === 'object') value += 20
  if (profile.comercios_por_dia && typeof profile.comercios_por_dia === 'object') value += 15
  if (profile.whatsapp || profile.telefono) value += 5
  if (profile.nombre || profile.google_nombre) value += 2
  return value
}

function hasCommerce(profile = {}) {
  return Boolean(profile.comercio_autorizado || profile.comercios_por_dia)
}

function authScore(user) {
  if (!user) return -1
  const providers = user.providerData.map((provider) => provider.providerId)
  let value = 10
  if (providers.includes('google.com')) value += 100
  else if (providers.includes('phone')) value += 80
  else if (providers.length) value += 50
  if (user.emailVerified) value += 5
  if (!user.disabled) value += 2
  return value
}

function authActivityMs(user) {
  if (!user) return 0
  return Math.max(
    Date.parse(user.metadata.lastRefreshTime || '') || 0,
    Date.parse(user.metadata.lastSignInTime || '') || 0,
  )
}

async function listAuthUsers(auth) {
  const users = new Map()
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) users.set(user.uid, user)
    pageToken = page.pageToken
  } while (pageToken)
  return users
}

function selectPrimaries(group) {
  const profileRanked = [...group.members]
    .sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid))
  const commerceRanked = profileRanked.filter((member) => hasCommerce(member.profile))
  const authRanked = group.members
    .filter((member) => member.authUser)
    .sort((a, b) => (
      authScore(b.authUser) - authScore(a.authUser)
      || authActivityMs(b.authUser) - authActivityMs(a.authUser)
      || a.uid.localeCompare(b.uid)
    ))
  const commercePrimary = commerceRanked[0] || null
  const authPrimary = authRanked[0] || null
  const primary = commercePrimary || authPrimary || profileRanked[0]
  return {
    primary,
    commercePrimary,
    authPrimary,
    profileRanked,
    authRanked,
    reason: commercePrimary ? 'commerce_profile' : authPrimary ? 'firebase_auth' : 'profile_fallback',
  }
}

function originOf(data = {}) {
  return String(data.origen || data.fuente || '').trim().toLowerCase() || 'legacy_sin_origen'
}

function contractDiagnostic(docs) {
  const result = {
    total: docs.length,
    schema_v2: 0,
    legacy: 0,
    sin_operation_id: 0,
    sin_owner_uid: 0,
    origenes: {},
  }
  for (const data of docs) {
    if (Number(data.schema_version) === 2) result.schema_v2 += 1
    else result.legacy += 1
    if (!data.operation_id) result.sin_operation_id += 1
    if (!data.owner_uid && !data.uid && !data.realtime_user_uid) result.sin_owner_uid += 1
    const origin = originOf(data)
    result.origenes[origin] = (result.origenes[origin] || 0) + 1
  }
  return result
}

async function main() {
  if (APPLY && process.env.FIREBASE_IDENTITY_MIGRATION_CONFIRM !== CONFIRM_VALUE) {
    throw new Error(`Escritura bloqueada: define FIREBASE_IDENTITY_MIGRATION_CONFIRM=${CONFIRM_VALUE} después de verificar el backup.`)
  }

  const account = serviceAccountFromEnv()
  const app = initializeApp({
    credential: account ? cert(account) : applicationDefault(),
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL,
  }, `identity-v2-${Date.now()}`)

  try {
    const rtdb = getDatabase(app)
    const firestore = getFirestore(app)
    const [usersSnap, pendingSnap, requestsSnap, questionsSnap, commerceSnap, catalogSnap, authUsers] = await Promise.all([
      rtdb.ref('users').get(),
      rtdb.ref('aprobarPublicacion').get(),
      firestore.collection('solicitudes_repuestos').get(),
      firestore.collection('preguntas_repuestos').get(),
      firestore.collection('comercio_repuestos').get(),
      firestore.collection('merida').get(),
      listAuthUsers(getAuth(app)),
    ])

    const users = usersSnap.val() || {}
    const groups = new Map()
    let usersWithoutPhone = 0
    for (const [uid, profileValue] of Object.entries(users)) {
      const profile = profileValue && typeof profileValue === 'object' ? profileValue : {}
      const phone = profilePhone(uid, profile)
      if (!phone) {
        usersWithoutPhone += 1
        continue
      }
      const id = identityId(phone)
      const group = groups.get(id) || { id, members: [] }
      group.members.push({ uid, profile, score: score(uid, profile), authUser: authUsers.get(uid) || null })
      groups.set(id, group)
    }

    const pending = pendingSnap.val() || {}
    const pendingBranches = Object.keys(pending)
    const pendingOrphanBranches = pendingBranches.filter((uid) => !users[uid])
    let pendingItems = 0
    for (const value of Object.values(pending)) {
      if (value && typeof value === 'object') pendingItems += Object.keys(value).length
    }

    const duplicateGroups = [...groups.values()].filter((group) => group.members.length > 1)
    const diagnostics = [...groups.values()]
      .sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id))
      .map((group) => {
        const selected = selectPrimaries(group)
        const ranked = selected.profileRanked
        return {
          identity_id: group.id,
          node_count: ranked.length,
          duplicate: ranked.length > 1,
          primary_uid_fingerprint: uidFingerprint(selected.primary.uid),
          primary_auth_uid_fingerprint: selected.authPrimary ? uidFingerprint(selected.authPrimary.uid) : null,
          primary_commerce_uid_fingerprint: selected.commercePrimary ? uidFingerprint(selected.commercePrimary.uid) : null,
          primary_selection_reason: selected.reason,
          members: ranked.map((member) => ({
            uid_fingerprint: uidFingerprint(member.uid),
            uid_kind: uidKind(member.uid),
            primary_candidate_score: member.score,
            has_commerce: hasCommerce(member.profile),
            in_firebase_auth: Boolean(member.authUser),
            auth_provider: member.authUser?.providerData?.map((provider) => provider.providerId).sort() || [],
            auth_activity_ms: authActivityMs(member.authUser) || null,
          })),
        }
      })

    let writtenGroups = 0
    if (APPLY) {
      const updates = {}
      for (const group of groups.values()) {
        const selected = selectPrimaries(group)
        const ranked = selected.profileRanked
        updates[`identity_index/${group.id}`] = {
          schema_version: 2,
          primary_realtime_uid: selected.primary.uid,
          primary_auth_uid: selected.authPrimary?.uid || '',
          primary_commerce_uid: selected.commercePrimary?.uid || '',
          primary_selection_reason: selected.reason,
          realtime_uids: Object.fromEntries(ranked.map((member) => [member.uid, true])),
          auth_uids: Object.fromEntries(selected.authRanked.map((member) => [member.uid, true])),
          duplicate: ranked.length > 1,
          updated_at: Date.now(),
          migration: 'identity-index-v2',
        }
        writtenGroups += 1
      }
      await rtdb.ref().update(updates)
    }

    const docs = (snap) => snap.docs.map((doc) => doc.data() || {})
    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        project_id: PROJECT_ID,
        mode: APPLY ? 'apply-index' : 'dry-run',
        contains_raw_phone_or_uid: false,
        destructive_operations: 0,
      },
      identities: {
        user_nodes: Object.keys(users).length,
        nodes_without_phone: usersWithoutPhone,
        identity_groups: groups.size,
        duplicate_groups: duplicateGroups.length,
        nodes_in_duplicate_groups: duplicateGroups.reduce((sum, group) => sum + group.members.length, 0),
        index_groups_written: writtenGroups,
        groups: diagnostics,
      },
      pending_publications: {
        branches: pendingBranches.length,
        items: pendingItems,
        orphan_branches: pendingOrphanBranches.length,
        orphan_branch_fingerprints: pendingOrphanBranches.map(uidFingerprint),
      },
      contracts: {
        solicitudes_repuestos: contractDiagnostic(docs(requestsSnap)),
        preguntas_repuestos: contractDiagnostic(docs(questionsSnap)),
        comercio_repuestos: contractDiagnostic(docs(commerceSnap)),
        merida: contractDiagnostic(docs(catalogSnap)),
      },
      next_action: APPLY
        ? 'Configurar los servicios para consultar identity_index; no eliminar nodos duplicados hasta verificar referencias y restauración.'
        : `Revisar el JSON y el backup. Para crear solo el índice: ${CONFIRM_VALUE} + --apply-index.`,
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({
      ok: true,
      mode: report.metadata.mode,
      output: outputPath,
      user_nodes: report.identities.user_nodes,
      duplicate_groups: report.identities.duplicate_groups,
      pending_orphan_branches: report.pending_publications.orphan_branches,
      index_groups_written: writtenGroups,
    }, null, 2))
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(`[identity-v2] ${error.message}`)
  process.exitCode = 1
})
