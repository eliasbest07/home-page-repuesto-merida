#!/usr/bin/env node

/**
 * Informe agregado y anónimo del ecosistema Repuestos Mérida.
 *
 * Solo ejecuta lecturas sobre Firestore y Realtime Database. No exporta textos,
 * nombres, teléfonos, cédulas, correos, UID ni identificadores de documentos.
 *
 * Uso:
 *   npm run report:firebase-ecosystem
 *   npm run report:firebase-ecosystem -- --out=output/audits/ecosystem-report.json
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
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const runStamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const outputPath = path.resolve(outArg ? outArg.slice('--out='.length) : `output/audits/ecosystem-report-${runStamp}.json`)

const FIRESTORE_COLLECTIONS = [
  'merida',
  'anuncios',
  'preguntas_repuestos',
  'solicitudes_repuestos',
  'solicitudes_comentarios',
  'solicitudes_contactos',
  'comercio_repuestos',
  'comercios_autorizados',
  'modelos_vehiculos',
  'analytics_pagina_principal_diario',
  'analytics_pagina_principal_sesiones',
  'magic_links',
  'otps_login',
  'verificaciones_cedula',
  'verificaciones_edad',
  'usuarios_plaza',
]

const RTDB_PATHS = [
  'users',
  'aprobarPublicacion',
  'rifas_usuarios',
  'rifas',
  'vendedor_index',
  'creador_index',
  'bingoRooms',
  'bingoRoomCodes',
  'bingoRoomMemberships',
  'verificarWhastapp',
  'verificarWhastappRegistro',
  'verificarCedula',
  'anuncios',
  'cardads',
  'mensajes',
  'encontrar',
  'viaje',
  'aceptar',
  'mototaxi',
  'caliente',
]

const STOPWORDS = new Set([
  'para', 'como', 'con', 'sin', 'por', 'una', 'uno', 'unos', 'unas', 'del', 'las', 'los', 'que',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'muy', 'mas', 'menos', 'hay', 'tiene', 'tengo',
  'necesito', 'busco', 'busca', 'solicito', 'solicitado', 'repuesto', 'repuestos', 'carro', 'moto',
  'vehiculo', 'vehículo', 'marca', 'modelo', 'año', 'anio', 'original', 'nuevo', 'nueva', 'usado',
  'favor', 'whatsapp', 'telefono', 'contacto', 'merida', 'venezuela', 'todos', 'todo', 'todas', 'cada',
])

const SIGNALS = {
  urgencia: ['urgente', 'cuanto antes', 'lo antes posible', 'para hoy', 'rapido', 'rápido', 'ya mismo'],
  frustracion: ['no consigo', 'no encuentro', 'imposible', 'nadie tiene', 'problema', 'demora', 'fallo', 'dañado'],
  incertidumbre: ['no se', 'no sé', 'creo que', 'quizas', 'quizás', 'sera compatible', 'será compatible', 'alguien sabe', '?'],
  agradecimiento_positivo: ['gracias', 'excelente', 'resuelto', 'consegui', 'conseguí', 'muy bueno', 'perfecto'],
  intencion_transaccional: ['precio', 'cotizacion', 'cotización', 'disponible', 'vendo', 'compro', 'cuanto cuesta', 'cuánto cuesta'],
}

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

function text(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max)
}

function normalize(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\+?\d[\d\s().-]{8,}\d\b/g, ' ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function digits(value) {
  return text(value).replace(/\D/g, '')
}

function canonPhone(value) {
  let phone = digits(value)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

function objectEntries(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : []
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean)
  return value ? [value] : []
}

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis()
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000
  if (Number.isFinite(Number(value?._seconds))) return Number(value._seconds) * 1000
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return number > 0 && number < 10_000_000_000 ? number * 1000 : number
}

function dayKey(value) {
  const ms = timestampMs(value)
  return ms ? new Date(ms).toISOString().slice(0, 10) : 'sin_fecha'
}

function increment(target, key, amount = 1) {
  const cleanKey = text(key, 160) || 'sin_dato'
  target[cleanKey] = (target[cleanKey] || 0) + amount
}

function sortedCounts(counts, limit = 20) {
  return Object.fromEntries(Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, limit))
}

function distribution(items, selector, limit = 30) {
  const counts = {}
  for (const item of items) increment(counts, normalize(selector(item)) || 'sin_dato')
  return sortedCounts(counts, limit)
}

function distributionMany(items, selector, limit = 30) {
  const counts = {}
  for (const item of items) {
    const values = asArray(selector(item))
    if (!values.length) increment(counts, 'sin_dato')
    for (const value of values) increment(counts, normalize(value) || 'sin_dato')
  }
  return sortedCounts(counts, limit)
}

function activityByDay(items, selector) {
  const counts = {}
  for (const item of items) increment(counts, dayKey(selector(item)))
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function phrases(items, selector, limit = 30) {
  const counts = {}
  for (const item of items) {
    const phrase = normalize(selector(item))
      .split(' ')
      .filter((token) => token.length > 2 && !STOPWORDS.has(token) && !/^\d+$/.test(token))
      .slice(0, 8)
      .join(' ')
    if (phrase) increment(counts, phrase)
  }
  return sortedCounts(counts, limit)
}

function sourceOfRequest(item = {}) {
  const origin = normalize(item.origen || item.fuente)
  if (origin.includes('whatsapp') || origin.includes('bot')) return 'bot_whatsapp'
  if (item.numero && !item.id && !item.contacto_id) return 'bot_probable'
  if (item.contacto_id || item.title) return 'app_o_web_legacy'
  return origin || 'sin_origen'
}

function sourceOfCatalog(item = {}) {
  const source = normalize(item.fuente || item.origen)
  if (source) return source
  if (item.codigo && normalize(item.codigo).startsWith('comercio')) return 'comercio_aprobado_probable'
  return 'legacy_sin_origen'
}

function sourceOfPending(item = {}) {
  const source = normalize(item.fuente || item.origen)
  if (source.includes('bot') || item.realtime_user_uid) return 'bot_whatsapp'
  if (source.includes('app')) return 'app_movil'
  return source || 'web_o_legacy'
}

function phoneLike(value) {
  const d = digits(value)
  return d.length >= 10 && d.length <= 15
}

function sentimentSignals(items, selector) {
  const counts = Object.fromEntries(Object.keys(SIGNALS).map((key) => [key, 0]))
  let withoutSignal = 0
  let analyzed = 0
  for (const item of items) {
    const value = normalize(selector(item))
    if (!value) continue
    analyzed += 1
    let matched = false
    for (const [label, words] of Object.entries(SIGNALS)) {
      if (words.some((word) => {
        const signal = normalize(word)
        return signal && value.includes(signal)
      })) {
        counts[label] += 1
        matched = true
      }
    }
    if (!matched) withoutSignal += 1
  }
  return { analyzed, ...counts, sin_senal: withoutSignal, multi_etiqueta: true }
}

function fieldPresence(items, limit = 80) {
  const counts = {}
  for (const item of items) {
    for (const field of Object.keys(item)) {
      if (field === '__id' || field === '__ownerKey') continue
      increment(counts, field)
    }
  }
  return sortedCounts(counts, limit)
}

function dateCoverage(items, selector) {
  const values = items.map(selector).map(timestampMs).filter(Boolean).sort((a, b) => a - b)
  return {
    con_fecha_valida: values.length,
    sin_fecha_valida: items.length - values.length,
    primera_fecha: values.length ? new Date(values[0]).toISOString() : null,
    ultima_fecha: values.length ? new Date(values.at(-1)).toISOString() : null,
  }
}

function missingness(items, fields) {
  return Object.fromEntries(fields.map((field) => [field, items.filter((item) => {
    const value = item[field]
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
  }).length]))
}

function duplicateCount(items, signature) {
  const seen = new Map()
  for (const item of items) {
    const key = signature(item)
    if (!key || !key.replaceAll('|', '')) continue
    seen.set(key, (seen.get(key) || 0) + 1)
  }
  const groups = [...seen.values()].filter((count) => count > 1)
  return {
    grupos: groups.length,
    registros_involucrados: groups.reduce((sum, count) => sum + count, 0),
    excedentes_probables: groups.reduce((sum, count) => sum + count - 1, 0),
  }
}

function requestId(item) {
  return text(item.__id || item.id, 160)
}

function requestRefId(item) {
  return text(item.solicitud_id, 160)
}

function commerceRecords(user = {}) {
  const found = []
  for (const [day, value] of objectEntries(user.comercios_por_dia)) {
    if (value?.comercios && typeof value.comercios === 'object') {
      for (const [, commerce] of objectEntries(value.comercios)) found.push({ day, ...(commerce || {}) })
    } else if (value && typeof value === 'object') {
      found.push({ day, ...value })
    }
  }
  if (user.comercio_autorizado && typeof user.comercio_autorizado === 'object') {
    found.push({ day: user.comercio_dia_actual || user.comercio_autorizado.dia, ...user.comercio_autorizado })
  }
  return found
}

const account = serviceAccountFromEnv()
const app = initializeApp({
  credential: account ? cert(account) : applicationDefault(),
  projectId: PROJECT_ID,
  databaseURL: DATABASE_URL,
}, `firebase-ecosystem-report-${Date.now()}`)
const firestore = getFirestore(app)
const rtdb = getDatabase(app)

console.log(`[report] proyecto=${PROJECT_ID} modo=solo-lectura privacidad=agregada`)

const firestoreResults = await Promise.all(FIRESTORE_COLLECTIONS.map(async (collectionName) => {
  try {
    const snapshot = await firestore.collection(collectionName).get()
    return [collectionName, snapshot.docs.map((doc) => ({ __id: doc.id, ...doc.data() })), null]
  } catch (error) {
    return [collectionName, [], error.message]
  }
}))
const rtdbResults = await Promise.all(RTDB_PATHS.map(async (rtdbPath) => {
  try {
    const snapshot = await rtdb.ref(rtdbPath).get()
    return [rtdbPath, snapshot.exists() ? snapshot.val() : null, null]
  } catch (error) {
    return [rtdbPath, null, error.message]
  }
}))

const fsData = Object.fromEntries(firestoreResults.map(([name, rows]) => [name, rows]))
const rtData = Object.fromEntries(rtdbResults.map(([name, value]) => [name, value]))
const readErrors = [
  ...firestoreResults.filter(([, , error]) => error).map(([name, , error]) => ({ source: `firestore/${name}`, error })),
  ...rtdbResults.filter(([, , error]) => error).map(([name, , error]) => ({ source: `rtdb/${name}`, error })),
]

const catalog = fsData.merida
const requests = fsData.solicitudes_repuestos
const comments = fsData.solicitudes_comentarios
const contacts = fsData.solicitudes_contactos
const questions = fsData.preguntas_repuestos
const ads = fsData.anuncios
const pending = fsData.comercio_repuestos
const authorized = fsData.comercios_autorizados
const users = Object.fromEntries(objectEntries(rtData.users))
const approvalRoot = Object.fromEntries(objectEntries(rtData.aprobarPublicacion))

const requestIds = new Set(requests.flatMap((item) => [requestId(item), text(item.id, 160)].filter(Boolean)))
const commentsPerRequest = {}
for (const comment of comments) increment(commentsPerRequest, requestRefId(comment))
const requestsWithComments = requests.filter((item) => (
  commentsPerRequest[requestId(item)] || commentsPerRequest[text(item.id, 160)]
))
const commentsWithPhone = comments.filter((item) => /(?:^|\D)(?:58)?(?:412|414|416|424|426)\d{7}(?:\D|$)/.test(digits(item.texto)))

const demandBrands = distribution(requests, (item) => item.marca, 1000)
const supplyBrands = distribution(catalog, (item) => item.marca, 1000)
const gaps = Object.keys(demandBrands)
  .filter((brand) => brand !== 'sin_dato')
  .map((brand) => ({
    marca: brand,
    solicitudes: demandBrands[brand] || 0,
    publicaciones: supplyBrands[brand] || 0,
    solicitudes_por_publicacion: supplyBrands[brand] ? Number(((demandBrands[brand] || 0) / supplyBrands[brand]).toFixed(2)) : null,
  }))
  .sort((a, b) => (b.solicitudes_por_publicacion ?? Number.MAX_SAFE_INTEGER) - (a.solicitudes_por_publicacion ?? Number.MAX_SAFE_INTEGER)
    || b.solicitudes - a.solicitudes)
  .slice(0, 25)

const approvalItems = []
for (const [uid, records] of objectEntries(approvalRoot)) {
  for (const [, item] of objectEntries(records)) approvalItems.push({ __ownerKey: uid, ...(item || {}) })
}

const userRows = objectEntries(users).map(([key, value]) => ({ key, ...(value || {}) }))
const phoneGroups = {}
for (const user of userRows) {
  const phone = canonPhone(user.whatsapp || user.telefono || user.phone || (phoneLike(user.key) ? user.key : ''))
  if (phone) increment(phoneGroups, phone)
}
const duplicatePhoneGroups = Object.values(phoneGroups).filter((count) => count > 1)
const identityFields = ['whatsapp', 'telefono', 'phone', 'email', 'google_email', 'google_uid', 'nombre', 'cedula']
const syntheticUsers = userRows.filter((user) => !identityFields.some((field) => text(user[field])))
const commerceRows = userRows.flatMap((user) => commerceRecords(user))

const report = {
  metadata: {
    generated_at: new Date().toISOString(),
    project_id: PROJECT_ID,
    mode: 'read_only',
    privacy: 'Solo agregados. No contiene PII, UID, IDs de documentos ni textos originales.',
    interpretation_limit: 'El sentimiento se infiere mediante palabras clave multi-etiqueta; no equivale a una encuesta ni a análisis clínico.',
    read_errors: readErrors,
  },
  inventory: {
    firestore_counts: Object.fromEntries(FIRESTORE_COLLECTIONS.map((name) => [name, fsData[name].length])),
    rtdb_top_level_child_counts: Object.fromEntries(RTDB_PATHS.map((name) => [name, objectEntries(rtData[name]).length])),
  },
  market: {
    demand: {
      total_requests: requests.length,
      sources: distribution(requests, sourceOfRequest),
      states: distribution(requests, (item) => item.estado),
      vehicle_types: distribution(requests, (item) => item.tipo_vehiculo),
      brands: sortedCounts(demandBrands, 25),
      models: distribution(requests, (item) => item.modelo, 25),
      requested_parts: phrases(requests, (item) => item.repuesto, 35),
      activity_by_day: activityByDay(requests, (item) => item.creado_en),
      date_coverage: dateCoverage(requests, (item) => item.creado_en),
      missing_fields: missingness(requests, ['repuesto', 'tipo_vehiculo', 'marca', 'modelo', 'anio', 'estado', 'creado_en']),
      confidence: {
        without_value: requests.filter((item) => !Number.isFinite(Number(item.confianza))).length,
        below_0_6: requests.filter((item) => Number.isFinite(Number(item.confianza)) && Number(item.confianza) < 0.6).length,
        from_0_6_to_0_79: requests.filter((item) => Number(item.confianza) >= 0.6 && Number(item.confianza) < 0.8).length,
        at_least_0_8: requests.filter((item) => Number(item.confianza) >= 0.8).length,
      },
    },
    supply: {
      total_catalog_items: catalog.length,
      sources: distribution(catalog, sourceOfCatalog),
      vehicle_types: distribution(catalog, (item) => item.vehiculo || item.tipo_vehiculo),
      brands: sortedCounts(supplyBrands, 25),
      models_or_compatibilities: distributionMany(catalog, (item) => item.modelos || item.modelo || item.compatibilidad, 25),
      parts: phrases(catalog, (item) => item.nombre || item.descripcion, 35),
      with_price: catalog.filter((item) => text(item.precio)).length,
      with_photo: catalog.filter((item) => asArray(item.img || item.fotos || item.imagen_url).length > 0).length,
      unavailable: catalog.filter((item) => item.disponible === false || item.archivado === true).length,
      missing_canonical_fields: {
        part_name_or_description: catalog.filter((item) => !text(item.nombre || item.descripcion)).length,
        brand: catalog.filter((item) => !text(item.marca)).length,
        model_or_compatibility: catalog.filter((item) => !text(item.modelos || item.modelo || item.compatibilidad || item.nota)).length,
        price: catalog.filter((item) => !text(item.precio)).length,
      },
    },
    demand_supply_gaps_by_brand: gaps,
    engagement: {
      comments: comments.length,
      requests_with_comments: requestsWithComments.length,
      requests_without_comments: requests.length - requestsWithComments.length,
      comments_with_images: comments.filter((item) => asArray(item.imagenes_urls || item.imagen_url).length > 0).length,
      comments_with_location: comments.filter((item) => item.ubicacion && typeof item.ubicacion === 'object').length,
      comments_marked_deleted: comments.filter((item) => item.eliminado === true).length,
      comments_containing_venezuelan_phone_pattern: commentsWithPhone.length,
      contact_permissions: contacts.length,
      contact_permission_states: distribution(contacts, (item) => item.estado),
      orphan_comments: comments.filter((item) => !requestIds.has(requestRefId(item))).length,
      orphan_contact_permissions: contacts.filter((item) => !requestIds.has(requestRefId(item))).length,
    },
    intent_and_sentiment_heuristic: {
      requests: sentimentSignals(requests, (item) => `${item.repuesto || ''} ${item.notas || ''}`),
      comments: sentimentSignals(comments.filter((item) => item.eliminado !== true), (item) => item.texto),
      questions: sentimentSignals(questions, (item) => `${item.pregunta || item.texto || ''} ${item.respuesta || ''}`),
    },
    plaza: {
      total_ads: ads.length,
      types: distribution(ads, (item) => item.tipo),
      categories: distribution(ads, (item) => item.categoria),
      sources: distribution(ads, (item) => item.fuente || 'legacy_sin_fuente'),
      available: ads.filter((item) => item.disponible !== false).length,
      with_image: ads.filter((item) => asArray(item.imagen_url).length > 0).length,
      with_price: ads.filter((item) => text(item.precio)).length,
    },
  },
  operations: {
    commerce: {
      authorized_documents: authorized.length,
      commerce_records_inside_users: commerceRows.length,
      pending_firestore_total: pending.length,
      pending_firestore_states: {
        pendiente: pending.filter((item) => item.aprobado !== true && item.archivado !== true).length,
        aprobado: pending.filter((item) => item.aprobado === true).length,
        archivado: pending.filter((item) => item.archivado === true).length,
      },
      pending_firestore_sources: distribution(pending, sourceOfPending),
      pending_rtdb_total: approvalItems.length,
      pending_rtdb_states: distribution(approvalItems, (item) => item.publicado || item.estado),
      pending_rtdb_missing_owner_profile: approvalItems.filter((item) => {
        const direct = users[item.__ownerKey]
        if (direct) return false
        return !userRows.some((user) => text(user.google_uid) === item.__ownerKey || text(user.auth_uid) === item.__ownerKey)
      }).length,
    },
    user_identity: {
      user_nodes: userRows.length,
      key_shape_phone_like: userRows.filter((user) => phoneLike(user.key)).length,
      key_shape_auth_uid_like: userRows.filter((user) => !phoneLike(user.key)).length,
      nodes_without_identity_fields: syntheticUsers.length,
      normalized_phone_duplicate_groups: duplicatePhoneGroups.length,
      nodes_in_normalized_phone_duplicate_groups: duplicatePhoneGroups.reduce((sum, count) => sum + count, 0),
    },
  },
  data_quality: {
    probable_duplicates: {
      catalog: duplicateCount(catalog, (item) => [normalize(item.nombre), normalize(item.marca), normalize(item.modelo), normalize(item.precio), canonPhone(item.numero || item.whatsapp)].join('|')),
      requests: duplicateCount(requests, (item) => [normalize(item.repuesto), normalize(item.marca), normalize(item.modelo), normalize(item.anio), canonPhone(item.numero)].join('|')),
      commerce_pending: duplicateCount(pending, (item) => [normalize(item.nombre), normalize(item.marca), normalize(item.modelo), normalize(item.precio), canonPhone(item.comercio_whatsapp || item.telefono)].join('|')),
      ads: duplicateCount(ads, (item) => [normalize(item.titulo), normalize(item.descripcion), canonPhone(item.whatsapp || item.telefono)].join('|')),
    },
    timestamp_coverage: {
      catalog_with_date: catalog.filter((item) => timestampMs(item.creado_en || item.fecha || item.timestamp)).length,
      requests_with_date: requests.filter((item) => timestampMs(item.creado_en)).length,
      comments_with_date: comments.filter((item) => timestampMs(item.creado_en)).length,
      ads_with_date: ads.filter((item) => timestampMs(item.creado_en)).length,
      commerce_pending_with_date: pending.filter((item) => timestampMs(item.creado_en)).length,
    },
    schema_signals: {
      catalog_photo_not_array: catalog.filter((item) => {
        const value = item.img ?? item.fotos
        return value !== undefined && !Array.isArray(value)
      }).length,
      pending_photo_not_array: pending.filter((item) => item.fotos !== undefined && !Array.isArray(item.fotos)).length,
      request_id_mixed_types: [...new Set(requests.map((item) => typeof item.id))].sort(),
      comment_request_id_mixed_types: [...new Set(comments.map((item) => typeof item.solicitud_id))].sort(),
      field_presence: {
        merida: fieldPresence(catalog),
        solicitudes_repuestos: fieldPresence(requests),
        solicitudes_comentarios: fieldPresence(comments),
        preguntas_repuestos: fieldPresence(questions),
        comercio_repuestos: fieldPresence(pending),
        comercios_autorizados: fieldPresence(authorized),
        anuncios: fieldPresence(ads),
      },
    },
  },
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`[report] escrito=${outputPath}`)
console.log(`[report] solicitudes=${requests.length} catalogo=${catalog.length} comentarios=${comments.length} usuarios=${userRows.length}`)

await deleteApp(app)
