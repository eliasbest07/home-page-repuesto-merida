#!/usr/bin/env node

/**
 * Auditor de solo lectura para comercios y repuestos de Repuestos Merida.
 *
 * Cruza:
 *   RTDB: users, aprobarPublicacion y, opcionalmente, toda la raiz.
 *   Firestore: comercio_repuestos, comercios_autorizados y merida.
 *
 * Este script NO contiene operaciones update/delete/set.
 * Uso:
 *   npm run audit:firebase-commerce
 *   npm run audit:firebase-commerce -- --scan-rtdb-root
 *   npm run audit:firebase-commerce -- --out=output/audits/mi-auditoria
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL
  || process.env.FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
const SCAN_ROOT = process.argv.includes('--scan-rtdb-root')
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const runStamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const outputBase = path.resolve(outArg ? outArg.slice('--out='.length) : `output/audits/firebase-commerce-${runStamp}`)

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

function clean(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max)
}

function digits(value) {
  return clean(value).replace(/\D/g, '')
}

function canonPhone(value) {
  let phone = digits(value)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

function validPhone(value) {
  return canonPhone(value).length >= 10
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis()
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parsePhotos(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean).map(String)
  const text = clean(value, 20000)
  if (!text) return []
  try {
    return parsePhotos(JSON.parse(text))
  } catch {
    return /^https?:\/\//i.test(text) ? [text] : []
  }
}

function issue(code, severity, detail) {
  return { code, severity, detail }
}

function maxSeverity(issues) {
  if (issues.some((item) => item.severity === 'alta')) return 'alta'
  if (issues.some((item) => item.severity === 'media')) return 'media'
  if (issues.some((item) => item.severity === 'baja')) return 'baja'
  return 'ok'
}

function commercePhone(value = {}) {
  return value.whatsapp || value.whatsapp_normalizado || value.telefono_usuario || value.telefono || ''
}

function extractUserCommerces(uid, user = {}) {
  const records = []
  const seen = new Set()
  const add = (commerceId, day, commerce, source) => {
    if (!commerce || typeof commerce !== 'object') return
    const id = clean(commerce.comercio_id || commerceId, 120)
    const dia = clean(commerce.dia || day, 30).toLowerCase()
    if (!id) return
    const key = `${dia}:${id}`
    if (seen.has(key)) return
    seen.add(key)
    records.push({
      uid,
      user_path: `users/${uid}`,
      commerce_id: id,
      day: dia,
      source,
      name: clean(commerce.nombre_comercio || user.nombre_comercio || user.nombre, 160),
      phone: commercePhone(commerce) || commercePhone(user),
      address: clean(commerce.comercio_direccion || user.comercio_direccion, 300),
      photo: clean(commerce.comercio_foto_url || user.comercio_foto_url, 1000),
      lat: commerce.comercio_lat ?? user.comercio_lat ?? null,
      lng: commerce.comercio_lng ?? user.comercio_lng ?? null,
      updated_at: Number(commerce.actualizado_en || user.comercio_autorizado_actualizado_en || 0) || 0,
    })
  }

  for (const [day, value] of Object.entries(user.comercios_por_dia || {})) {
    if (!value || typeof value !== 'object') continue
    if (value.comercios && typeof value.comercios === 'object') {
      for (const [commerceId, commerce] of Object.entries(value.comercios)) add(commerceId, day, commerce, 'comercios_por_dia')
    } else if (value.nombre_comercio || value.whatsapp || value.comercio_foto_url || value.comercio_direccion) {
      add(value.comercio_id || 'principal', day, value, 'comercios_por_dia_legacy')
    }
  }
  if (user.comercio_autorizado && typeof user.comercio_autorizado === 'object') {
    add(user.comercio_autorizado.comercio_id || uid, user.comercio_dia_actual || user.comercio_autorizado.dia, user.comercio_autorizado, 'comercio_autorizado')
  }
  return records
}

function addMapList(map, key, value) {
  if (!key) return
  const list = map.get(key) || []
  list.push(value)
  map.set(key, list)
}

function commerceFingerprint(record) {
  return [
    record.commerce_id,
    record.day,
    normalize(record.name),
    canonPhone(record.phone),
    normalize(record.address),
    clean(record.photo),
    String(record.lat ?? ''),
    String(record.lng ?? ''),
  ].join('|')
}

function scanRtdbReferences(root, targets) {
  const found = Object.fromEntries([...targets].map((target) => [target, []]))
  const visit = (value, currentPath) => {
    if (value === null || value === undefined) return
    if (typeof value !== 'object') {
      const scalar = String(value)
      if (targets.has(scalar)) found[scalar].push({ path: currentPath, kind: 'value' })
      return
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = currentPath ? `${currentPath}/${key}` : key
      if (targets.has(key)) found[key].push({ path: childPath, kind: 'key' })
      visit(child, childPath)
    }
  }
  visit(root, '')
  for (const target of targets) {
    found[target] = found[target].filter((ref) => !ref.path.startsWith(`users/${target}`))
  }
  return found
}

function sourceOfRepuesto(data = {}) {
  if (data.fuente === 'bot_whatsapp' || data.realtime_user_uid) return 'bot_whatsapp'
  return clean(data.fuente, 80) || 'web_o_legacy'
}

function identitySignals(user = {}) {
  return [
    'whatsapp', 'telefono', 'phone', 'numero', 'google_uid', 'google_email',
    'email', 'nombre', 'google_nombre', 'cedula', 'foto', 'foto_url',
  ].filter((key) => clean(user[key]))
}

function markdownEscape(value) {
  return clean(value, 500).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function countBy(items, keyFn) {
  const counts = {}
  for (const item of items) {
    const key = keyFn(item)
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
}

const account = serviceAccountFromEnv()
const app = initializeApp({
  credential: account ? cert(account) : applicationDefault(),
  projectId: PROJECT_ID,
  databaseURL: DATABASE_URL,
}, `firebase-commerce-audit-${Date.now()}`)
const rtdb = getDatabase(app)
const firestore = getFirestore(app)

console.log(`[audit] proyecto=${PROJECT_ID} modo=solo-lectura rtdb_root=${SCAN_ROOT ? 'si' : 'no'}`)

const [usersSnap, appQueueSnap, repuestosSnap, authorizedSnap, catalogSnap, rootSnap] = await Promise.all([
  rtdb.ref('users').get(),
  rtdb.ref('aprobarPublicacion').get(),
  firestore.collection('comercio_repuestos').get(),
  firestore.collection('comercios_autorizados').get(),
  firestore.collection('merida').get(),
  SCAN_ROOT ? rtdb.ref().get() : Promise.resolve(null),
])

const users = usersSnap.exists() ? usersSnap.val() || {} : {}
const appQueue = appQueueSnap.exists() ? appQueueSnap.val() || {} : {}
const repuestos = repuestosSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
const authorized = authorizedSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
const catalog = catalogSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id }))
const catalogById = new Map(catalog.map((item) => [item.id, item]))

const commerceLocations = Object.entries(users).flatMap(([uid, user]) => (
  user && typeof user === 'object' ? extractUserCommerces(uid, user) : []
))
const commerceById = new Map()
const commerceByPhone = new Map()
for (const record of commerceLocations) {
  addMapList(commerceById, record.commerce_id, record)
  addMapList(commerceByPhone, canonPhone(record.phone), record)
}

const repuestoAudits = repuestos.map((item) => {
  const issues = []
  const ownerPhone = [item.comercio_whatsapp, item.telefono, item.telefono_normalizado, item.creado_por]
    .find((value) => validPhone(value)) || ''
  const byId = commerceById.get(clean(item.comercio_id, 120)) || []
  const itemDay = normalize(item.dia)
  const byIdSameDay = itemDay
    ? byId.filter((entry) => normalize(entry.day) === itemDay)
    : byId
  const relevantById = byIdSameDay.length ? byIdSameDay : byId
  const byPhone = commerceByPhone.get(canonPhone(ownerPhone)) || []
  const approved = item.aprobado === true
  const archived = item.archivado === true
  const catalogId = clean(item.catalogo_id, 160)

  if (!validPhone(ownerPhone)) issues.push(issue('telefono_invalido', 'alta', 'No hay un WhatsApp válido para asociar el repuesto.'))
  if (!clean(item.nombre, 120)) issues.push(issue('sin_nombre', 'alta', 'Falta el nombre del repuesto.'))
  if (!clean(item.marca, 80)) issues.push(issue('sin_marca', 'media', 'Falta la marca.'))
  if (!clean(item.modelo, 120)) issues.push(issue('sin_modelo', 'media', 'Falta el modelo.'))
  if (!Array.isArray(item.fotos)) issues.push(issue('fotos_no_es_array', 'media', 'El campo fotos no es un arreglo.'))
  if (parsePhotos(item.fotos).length === 0) issues.push(issue('sin_fotos', 'media', 'No tiene fotos utilizables.'))
  if (approved && !catalogId) issues.push(issue('aprobado_sin_catalogo_id', 'alta', 'Está aprobado pero no apunta al catálogo merida.'))
  if (!approved && catalogId) issues.push(issue('pendiente_con_catalogo_id', 'alta', 'Está pendiente pero ya tiene catalogo_id.'))
  if (approved && archived) issues.push(issue('aprobado_y_archivado', 'alta', 'No debería estar aprobado y archivado a la vez.'))
  if (catalogId && !catalogById.has(catalogId)) issues.push(issue('catalogo_inexistente', 'alta', `No existe merida/${catalogId}.`))
  if (!byId.length && !byPhone.length) issues.push(issue('comercio_no_encontrado', 'alta', 'No coincide con ningún comercio de RTDB por id ni WhatsApp.'))
  if (relevantById.length && validPhone(ownerPhone)) {
    const idPhones = relevantById.map((entry) => canonPhone(entry.phone)).filter(Boolean)
    if (idPhones.length && !idPhones.includes(canonPhone(ownerPhone))) {
      issues.push(issue('id_y_whatsapp_discrepan', 'alta', 'El comercio_id apunta a un comercio con otro WhatsApp.'))
    }
  }
  const sameDayOwners = new Set(byIdSameDay.map((entry) => entry.uid))
  if (sameDayOwners.size > 1) {
    issues.push(issue(
      'comercio_id_duplicado_en_users',
      'media',
      `El comercio aparece para el mismo día bajo ${sameDayOwners.size} nodos de users.`,
    ))
  }

  return {
    id: item.id,
    source: sourceOfRepuesto(item),
    status: approved ? 'aprobado' : archived ? 'archivado' : 'pendiente',
    owner_phone: digits(ownerPhone),
    commerce_id: clean(item.comercio_id, 120),
    day: clean(item.dia, 30).toLowerCase(),
    catalog_id: catalogId,
    created_at: timestampMs(item.creado_en),
    name: clean(item.nombre, 160),
    brand: clean(item.marca, 100),
    model: clean(item.modelo, 160),
    photo_count: parsePhotos(item.fotos).length,
    matches_by_id: byId.map((entry) => entry.user_path),
    matches_by_phone: byPhone.map((entry) => entry.user_path),
    severity: maxSeverity(issues),
    issues,
  }
})

const duplicateGroups = new Map()
for (const item of repuestoAudits) {
  const original = repuestos.find((entry) => entry.id === item.id) || {}
  const signature = [
    canonPhone(item.owner_phone), normalize(item.name), normalize(item.brand), normalize(item.model),
    normalize(original.precio), clean(parsePhotos(original.fotos)[0]),
  ].join('|')
  if (!signature.replace(/\|/g, '')) continue
  addMapList(duplicateGroups, signature, item)
}
for (const group of duplicateGroups.values()) {
  if (group.length < 2) continue
  const ids = group.map((item) => item.id)
  for (const item of group) {
    item.issues.push(issue('posible_duplicado', 'media', `Coincide con: ${ids.filter((id) => id !== item.id).join(', ')}`))
    item.severity = maxSeverity(item.issues)
  }
}

const appPendingAudits = []
for (const [uid, records] of Object.entries(appQueue)) {
  if (!records || typeof records !== 'object') continue
  const user = users[uid] && typeof users[uid] === 'object' ? users[uid] : null
  for (const [pendingId, item] of Object.entries(records)) {
    if (!item || typeof item !== 'object') continue
    const issues = []
    const status = clean(item.publicado, 40).toLowerCase() || 'sin_estado'
    const phone = user ? commercePhone(user) : ''
    const matches = commerceByPhone.get(canonPhone(phone)) || []
    if (!user) issues.push(issue('usuario_uid_inexistente', 'alta', `No existe users/${uid}.`))
    if (!validPhone(phone)) issues.push(issue('usuario_sin_whatsapp', 'alta', 'El dueño de la cola no tiene WhatsApp válido.'))
    if (!matches.length) issues.push(issue('comercio_no_encontrado', 'alta', 'El WhatsApp no coincide con un comercio en users.'))
    if (!clean(item.categoria, 120)) issues.push(issue('sin_categoria', 'media', 'Falta la categoría/nombre del repuesto.'))
    if (!clean(item.marca, 80)) issues.push(issue('sin_marca', 'media', 'Falta la marca.'))
    if (!clean(item.modelos, 160)) issues.push(issue('sin_modelos', 'media', 'Faltan modelos compatibles.'))
    if (!clean(item.descripcion, 500)) issues.push(issue('sin_descripcion', 'media', 'Falta descripción.'))
    if (!parsePhotos(item.fotos).length) issues.push(issue('sin_fotos', 'media', 'No hay fotos utilizables.'))
    if (status === 'espera' && item.catalogo_id) issues.push(issue('espera_con_catalogo_id', 'alta', 'Sigue en espera aunque ya tiene catalogo_id.'))
    if (status === 'publicado' && item.catalogo_id && !catalogById.has(clean(item.catalogo_id, 160))) {
      issues.push(issue('catalogo_inexistente', 'alta', `No existe merida/${clean(item.catalogo_id, 160)}.`))
    }
    appPendingAudits.push({
      uid,
      pending_id: pendingId,
      status,
      owner_phone: digits(phone),
      name: clean(item.categoria, 160),
      brand: clean(item.marca, 100),
      model: clean(item.modelos, 160),
      photo_count: parsePhotos(item.fotos).length,
      commerce_matches: matches.map((entry) => entry.user_path),
      severity: maxSeverity(issues),
      issues,
    })
  }
}

const syntheticKeys = new Set(Object.entries(users)
  .filter(([uid, user]) => uid.startsWith('com_') || user?.sin_telefono === true)
  .map(([uid]) => uid))
const deepRefs = SCAN_ROOT
  ? scanRtdbReferences(rootSnap?.exists() ? rootSnap.val() || {} : {}, syntheticKeys)
  : Object.fromEntries([...syntheticKeys].map((key) => [key, []]))

const syntheticAudits = [...syntheticKeys].sort().map((uid) => {
  const user = users[uid] && typeof users[uid] === 'object' ? users[uid] : {}
  const commerces = extractUserCommerces(uid, user)
  const signals = identitySignals(user)
  const directAuthorized = authorized.filter((item) => (
    clean(item.realtime_user_uid, 160) === uid
    || clean(item.realtime_user_path, 300) === `users/${uid}`
  ))
  const directParts = repuestos.filter((item) => clean(item.realtime_user_uid, 160) === uid)
  const directCatalog = catalog.filter((item) => (
    clean(item.userID, 160) === uid || clean(item.propietario_id, 160) === uid
  ))
  const queueCount = appQueue[uid] && typeof appQueue[uid] === 'object' ? Object.keys(appQueue[uid]).length : 0
  const externalRtdbRefs = deepRefs[uid] || []

  const commerceDiagnostics = commerces.map((commerce) => {
    const duplicates = (commerceById.get(commerce.commerce_id) || []).filter((entry) => entry.uid !== uid && entry.day === commerce.day)
    const exactDuplicates = duplicates.filter((entry) => commerceFingerprint(entry) === commerceFingerprint(commerce))
    const authRefs = authorized.filter((item) => clean(item.comercio_id, 120) === commerce.commerce_id)
    const partRefs = repuestos.filter((item) => clean(item.comercio_id, 120) === commerce.commerce_id)
    const catalogRefs = catalog.filter((item) => clean(item.comercio_id, 120) === commerce.commerce_id)
    return {
      ...commerce,
      duplicate_locations: duplicates.map((entry) => entry.user_path),
      exact_duplicate_locations: exactDuplicates.map((entry) => entry.user_path),
      firestore_authorized_refs: authRefs.map((item) => item.id),
      repuesto_refs: partRefs.map((item) => item.id),
      catalog_refs: catalogRefs.map((item) => item.id),
    }
  })

  const everyCommerceDuplicated = commerceDiagnostics.length > 0
    && commerceDiagnostics.every((item) => item.duplicate_locations.length > 0)
  const hasDirectReferences = directAuthorized.length || directParts.length || directCatalog.length || queueCount || externalRtdbRefs.length
  let deletionAssessment
  let reason
  if (signals.length) {
    deletionAssessment = 'NO_ELIMINAR_POSIBLE_USUARIO'
    reason = `Tiene señales de identidad: ${signals.join(', ')}.`
  } else if (hasDirectReferences) {
    deletionAssessment = 'NO_ELIMINAR_REFERENCIADO'
    reason = 'Hay referencias directas al UID/ruta sintética.'
  } else if (commerceDiagnostics.length === 0) {
    deletionAssessment = 'CANDIDATO_SIN_CONTENIDO_NI_REFERENCIAS'
    reason = 'No contiene comercios ni se encontraron referencias conocidas.'
  } else if (everyCommerceDuplicated) {
    deletionAssessment = 'REVISAR_DUPLICADO_MIGRADO'
    reason = 'Todos sus comercios también existen en otro users/*, pero debe confirmarse cuál copia está vigente.'
  } else {
    deletionAssessment = 'NO_ELIMINAR_COMERCIO_ACTIVO'
    reason = 'Contiene al menos un comercio que no existe en otro nodo; la autorización web lo lee desde aquí.'
  }

  return {
    uid,
    path: `users/${uid}`,
    sin_telefono: user.sin_telefono === true,
    identity_signals: signals,
    commerce_count: commerceDiagnostics.length,
    commerces: commerceDiagnostics,
    direct_references: {
      comercios_autorizados: directAuthorized.map((item) => item.id),
      comercio_repuestos: directParts.map((item) => item.id),
      merida: directCatalog.map((item) => item.id),
      aprobarPublicacion_count: queueCount,
      rtdb_external: externalRtdbRefs,
      rtdb_root_scanned: SCAN_ROOT,
    },
    deletion_assessment: deletionAssessment,
    reason,
  }
})

const summary = {
  generated_at: new Date().toISOString(),
  project_id: PROJECT_ID,
  read_only: true,
  rtdb_root_scanned: SCAN_ROOT,
  totals: {
    users: Object.keys(users).length,
    synthetic_users: syntheticAudits.length,
    user_commerce_locations: commerceLocations.length,
    comercio_repuestos: repuestoAudits.length,
    app_queue_records: appPendingAudits.length,
    app_queue_waiting: appPendingAudits.filter((item) => item.status === 'espera').length,
    comercios_autorizados: authorized.length,
    catalog_merida: catalog.length,
  },
  repuesto_severity: countBy(repuestoAudits, (item) => item.severity),
  app_queue_severity: countBy(appPendingAudits, (item) => item.severity),
  synthetic_deletion_assessment: countBy(syntheticAudits, (item) => item.deletion_assessment),
}

const report = {
  summary,
  synthetic_users: syntheticAudits,
  comercio_repuestos: repuestoAudits,
  app_publication_queue: appPendingAudits,
  commerce_locations: commerceLocations,
  firestore_comercios_autorizados: authorized.map((item) => ({
    id: item.id,
    comercio_id: clean(item.comercio_id, 120),
    day: clean(item.dia, 30),
    phone: digits(commercePhone(item)),
    realtime_user_uid: clean(item.realtime_user_uid, 160),
    realtime_user_path: clean(item.realtime_user_path, 300),
  })),
}

const markdown = [
  '# Auditoría Firebase de comercios y repuestos',
  '',
  `Generada: ${summary.generated_at}`,
  `Proyecto: ${PROJECT_ID}`,
  `Modo: solo lectura`,
  `Escaneo completo de RTDB: ${SCAN_ROOT ? 'sí' : 'no'}`,
  '',
  '## Resumen',
  '',
  `- Usuarios RTDB: ${summary.totals.users}`,
  `- Nodos sintéticos users/com_* o sin_telefono: ${summary.totals.synthetic_users}`,
  `- Registros comercio_repuestos: ${summary.totals.comercio_repuestos}`,
  `- Registros de la cola de la app: ${summary.totals.app_queue_records} (${summary.totals.app_queue_waiting} en espera)`,
  `- Comercios autorizados Firestore: ${summary.totals.comercios_autorizados}`,
  `- Catálogo merida: ${summary.totals.catalog_merida}`,
  '',
  `Severidad comercio_repuestos: ${JSON.stringify(summary.repuesto_severity)}`,
  `Severidad cola app: ${JSON.stringify(summary.app_queue_severity)}`,
  '',
  '## Evaluación de users sintéticos',
  '',
  '| Nodo | Comercios | Evaluación | Motivo |',
  '|---|---:|---|---|',
  ...syntheticAudits.map((item) => (
    `| ${markdownEscape(item.path)} | ${item.commerce_count} | ${item.deletion_assessment} | ${markdownEscape(item.reason)} |`
  )),
  '',
  '## Repuestos con severidad alta',
  '',
  '| ID | Origen | Estado | Comercio | Diagnóstico |',
  '|---|---|---|---|---|',
  ...repuestoAudits.filter((item) => item.severity === 'alta').map((item) => (
    `| ${markdownEscape(item.id)} | ${markdownEscape(item.source)} | ${item.status} | ${markdownEscape(item.commerce_id || item.owner_phone)} | ${markdownEscape(item.issues.map((entry) => entry.code).join(', '))} |`
  )),
  '',
  '## Cola de la app con severidad alta',
  '',
  '| UID / pendiente | Estado | Diagnóstico |',
  '|---|---|---|',
  ...appPendingAudits.filter((item) => item.severity === 'alta').map((item) => (
    `| ${markdownEscape(`${item.uid}/${item.pending_id}`)} | ${item.status} | ${markdownEscape(item.issues.map((entry) => entry.code).join(', '))} |`
  )),
  '',
  'El archivo JSON contiene la evaluación individual completa de cada registro.',
  '',
].join('\n')

await fs.mkdir(path.dirname(outputBase), { recursive: true })
await Promise.all([
  fs.writeFile(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  fs.writeFile(`${outputBase}.md`, markdown, 'utf8'),
])

console.log(`[audit] users=${summary.totals.users} sinteticos=${summary.totals.synthetic_users} repuestos=${summary.totals.comercio_repuestos} app_espera=${summary.totals.app_queue_waiting}`)
console.log(`[audit] repuestos_severidad=${JSON.stringify(summary.repuesto_severity)}`)
console.log(`[audit] evaluacion_sinteticos=${JSON.stringify(summary.synthetic_deletion_assessment)}`)
console.log(`[audit] json=${outputBase}.json`)
console.log(`[audit] markdown=${outputBase}.md`)

await deleteApp(app)
