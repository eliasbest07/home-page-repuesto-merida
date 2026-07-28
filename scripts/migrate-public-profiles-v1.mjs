#!/usr/bin/env node

/**
 * Crea /public_profiles con una copia estrictamente sanitizada de /users.
 * No modifica ni elimina /users.
 *
 * Dry-run:
 *   npm run migrate:public-profiles
 *
 * Aplicación:
 *   FIREBASE_PUBLIC_PROFILE_MIGRATION_CONFIRM=WRITE_PUBLIC_PROFILES_V1 \
 *     npm run migrate:public-profiles -- --apply
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import {
  publicProfileAllowedKeys,
  sanitizePublicProfile,
} from '../lib/publicProfileContract.js'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL
  || process.env.FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
const APPLY = process.argv.includes('--apply')
const CONFIRM = 'WRITE_PUBLIC_PROFILES_V1'
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputPath = path.resolve(
  outArg?.slice('--out='.length) || `output/audits/public-profiles-v1-${stamp}.json`,
)

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

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function object(value) {
  return isObject(value) ? value : {}
}

function digits(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonicalPhone(value) {
  let phone = digits(value)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  phone = phone.replace(/^0+/, '')
  return phone.length >= 10 && phone.length <= 13 ? phone : ''
}

function uidPhone(value) {
  const uid = String(value || '').trim()
  return /^[+\d\s().-]+$/.test(uid) ? canonicalPhone(uid) : ''
}

function profilePhone(uid, profile) {
  for (const value of [profile.whatsapp, profile.telefono, profile.phone]) {
    const phone = canonicalPhone(value)
    if (phone) return phone
  }
  return uidPhone(profile.id) || uidPhone(uid)
}

function identityId(phone) {
  return crypto
    .createHash('sha256')
    .update(`repuestos-merida:identity:v2:${phone}`)
    .digest('hex')
    .slice(0, 32)
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(`repuestos-merida:public-profile-audit:${value}`)
    .digest('hex')
    .slice(0, 12)
}

function mergeDeep(left, right) {
  const result = { ...object(left) }
  for (const [key, value] of Object.entries(object(right))) {
    result[key] = isObject(result[key]) && isObject(value)
      ? mergeDeep(result[key], value)
      : value
  }
  return result
}

function profileScore(uid, profile) {
  let score = uidPhone(uid) ? 0 : 20
  if (profile.google_uid || profile.canonical_uid) score += 40
  if (profile.nombre || profile.google_nombre) score += 5
  if (profile.foto || profile.foto_url) score += 4
  if (profile.vender === true || profile.comercio_autorizado) score += 50
  if (profile.comercios_por_dia) score += 30
  return score
}

function mergeMembers(members) {
  return [...members]
    .sort((left, right) => left.score - right.score || right.uid.localeCompare(left.uid))
    .reduce((merged, member) => mergeDeep(merged, member.profile), {})
}

function hasUsefulPublicData(profile) {
  return Boolean(
    profile.nombre
    || profile.google_nombre
    || profile.foto
    || profile.foto_url
    || profile.nombre_comercio
    || profile.comercio_autorizado
    || profile.comercios_por_dia,
  )
}

async function main() {
  if (APPLY && process.env.FIREBASE_PUBLIC_PROFILE_MIGRATION_CONFIRM !== CONFIRM) {
    throw new Error(`Escritura bloqueada: define FIREBASE_PUBLIC_PROFILE_MIGRATION_CONFIRM=${CONFIRM}.`)
  }

  const serviceAccount = serviceAccountFromEnv()
  const app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL,
  }, `public-profile-v1-${Date.now()}`)

  try {
    const rtdb = getDatabase(app)
    const [usersSnap, identitySnap, existingSnap] = await Promise.all([
      rtdb.ref('users').get(),
      rtdb.ref('identity_index').get(),
      rtdb.ref('public_profiles').get(),
    ])
    const users = object(usersSnap.val())
    const identities = object(identitySnap.val())
    const existing = object(existingSnap.val())
    const phoneGroups = new Map()
    const withoutPhone = []

    for (const [uid, rawProfile] of Object.entries(users)) {
      const profile = object(rawProfile)
      const phone = profilePhone(uid, profile)
      const member = { uid, profile, score: profileScore(uid, profile) }
      if (!phone) {
        withoutPhone.push(member)
        continue
      }
      const id = identityId(phone)
      const group = phoneGroups.get(id) || { id, members: [] }
      group.members.push(member)
      phoneGroups.set(id, group)
    }

    const writes = {}
    const diagnostics = []
    for (const group of phoneGroups.values()) {
      const identity = object(identities[group.id])
      const merged = mergeMembers(group.members)
      const canonicalCandidates = [
        merged.canonical_uid,
        identity.primary_auth_uid,
        identity.primary_realtime_uid,
        group.members.find((member) => !uidPhone(member.uid))?.uid,
      ].map((value) => String(value || '').trim()).filter(Boolean)
      const canonicalUid =
        canonicalCandidates.find((uid) => !uidPhone(uid))
        || `wa_${group.id.slice(0, 28)}`
      const profile = sanitizePublicProfile(canonicalUid, merged, { canonicalUid })
      writes[canonicalUid] = profile

      // Alias sanitizados para referencias públicas antiguas. Las claves que
      // son teléfonos no se replican en el árbol público.
      const aliases = []
      for (const member of group.members) {
        if (member.uid === canonicalUid || uidPhone(member.uid)) continue
        writes[member.uid] = sanitizePublicProfile(member.uid, merged, { canonicalUid })
        aliases.push(member.uid)
      }
      diagnostics.push({
        identity_fingerprint: fingerprint(group.id),
        canonical_uid_fingerprint: fingerprint(canonicalUid),
        member_count: group.members.length,
        public_alias_count: aliases.length,
      })
    }

    for (const member of withoutPhone) {
      if (!hasUsefulPublicData(member.profile)) continue
      const canonicalUid = String(member.profile.canonical_uid || member.uid)
      if (uidPhone(member.uid) || uidPhone(canonicalUid)) continue
      writes[member.uid] = sanitizePublicProfile(member.uid, member.profile, { canonicalUid })
    }

    const allowedKeys = new Set(publicProfileAllowedKeys())
    for (const [uid, profile] of Object.entries(writes)) {
      if (uidPhone(uid)) throw new Error('La migración intentó usar un teléfono como clave pública.')
      const unexpected = Object.keys(profile).filter((key) => !allowedKeys.has(key))
      if (unexpected.length > 0) {
        throw new Error(`Contrato público inválido: campos inesperados ${unexpected.join(', ')}.`)
      }
      if (!profile.vender && (profile.whatsapp_public || profile.public_contact_enabled)) {
        throw new Error('Un perfil personal intentó publicar información de contacto.')
      }
    }

    if (APPLY) {
      const updates = Object.fromEntries(
        Object.entries(writes).map(([uid, profile]) => [`public_profiles/${uid}`, profile]),
      )
      if (Object.keys(updates).length > 0) await rtdb.ref().update(updates)
    }

    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        project_id: PROJECT_ID,
        mode: APPLY ? 'apply' : 'dry-run',
        contains_raw_phone: false,
        destructive_operations: 0,
      },
      source_user_nodes: Object.keys(users).length,
      identity_groups: phoneGroups.size,
      users_without_phone: withoutPhone.length,
      existing_public_profiles: Object.keys(existing).length,
      public_profiles_prepared: Object.keys(writes).length,
      public_business_profiles: Object.values(writes).filter((profile) => profile.vender).length,
      public_personal_profiles: Object.values(writes).filter((profile) => !profile.vender).length,
      profiles_with_public_contact: Object.values(writes).filter((profile) => profile.public_contact_enabled).length,
      phone_key_profiles: Object.keys(writes).filter(uidPhone).length,
      groups: diagnostics.sort((a, b) => b.member_count - a.member_count),
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 })
    console.log(JSON.stringify({
      ok: true,
      mode: report.metadata.mode,
      output: outputPath,
      source_user_nodes: report.source_user_nodes,
      public_profiles_prepared: report.public_profiles_prepared,
      public_business_profiles: report.public_business_profiles,
      profiles_with_public_contact: report.profiles_with_public_contact,
      phone_key_profiles: report.phone_key_profiles,
      destructive_operations: 0,
    }, null, 2))
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
