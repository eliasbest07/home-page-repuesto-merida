import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { canManageCommerces } from '@/lib/comercioAuthorization'
import {
  DATA_SCHEMA_VERSION,
  identityIdForPhone,
  resolveRealtimeIdentities,
} from '@/lib/dataContractV2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPUESTOS_COLLECTION = 'comercio_repuestos'
const MODELOS_COLLECTION = 'modelos_vehiculos'
const CATALOGO_COLLECTION = 'merida'
const APP_PENDING_PATH = 'aprobarPublicacion'
const APP_PENDING_SOURCE = 'app_realtime'
const CATALOG_SOURCE = 'catalogo'
const FIREBASE_PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function internationalPhone(raw) {
  const canon = canonPhone(raw)
  return canon ? `+58${canon}` : ''
}

function localPhone(raw) {
  const canon = canonPhone(raw)
  return canon ? `0${canon}` : ''
}

function appPhone(raw) {
  const canon = canonPhone(raw)
  return canon ? `58${canon}` : ''
}

function phoneVariants(raw) {
  const clean = cleanPhone(raw)
  const canon = canonPhone(raw)
  return Array.from(new Set([
    clean,
    canon,
    canon ? `0${canon}` : '',
    canon ? `58${canon}` : '',
    canon ? `+58${canon}` : '',
  ].filter(Boolean)))
}

function repuestoPhone(data = {}) {
  const candidates = [
    data.comercio_whatsapp,
    data.telefono,
    data.telefono_normalizado,
    data.creado_por,
  ]
  for (const candidate of candidates) {
    const phone = canonPhone(candidate)
    if (phone.length >= 10) return phone
  }
  return ''
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function authPayload(request) {
  const payload = verifyRifaToken(bearerToken(request))
  const telefono = cleanPhone(payload?.telefono || payload?.tel)
  if (!payload || telefono.length < 10) return null
  return { ...payload, telefono }
}

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max)
}

function realtimeKey(value, max = 128) {
  const key = String(value || '').trim().slice(0, max)
  return key && !/[.#$/\[\]]/.test(key) ? key : ''
}

function parseFotos(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, 1000)).filter(Boolean).slice(0, 12)
  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => cleanText(item, 1000)).filter(Boolean).slice(0, 12)
  }
  const text = String(value || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    return parseFotos(parsed)
  } catch {
    return /^https?:\/\//i.test(text) ? [text.slice(0, 1000)] : []
  }
}

function pushTimestamp(key) {
  const value = String(key || '').slice(0, 8)
  if (value.length !== 8) return null
  let timestamp = 0
  for (const char of value) {
    const index = FIREBASE_PUSH_CHARS.indexOf(char)
    if (index < 0) return null
    timestamp = (timestamp * 64) + index
  }
  return Number.isSafeInteger(timestamp) ? timestamp : null
}

function searchTokens(...values) {
  return Array.from(new Set(
    values
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2),
  )).slice(0, 40)
}

function cleanYear(value) {
  const year = cleanPhone(value).slice(0, 4)
  if (!year) return ''
  const n = Number(year)
  return n >= 1900 && n <= 2100 ? year : ''
}

// Precio como texto libre (ej. "10", "10 verdes", "Consultar"). Para mostrarlo
// se antepone "$" solo si es puramente numérico.
function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'Consultar'
  const s = String(value).trim()
  if (!s) return 'Consultar'
  return /^\d+(\.\d+)?$/.test(s) ? `$${s}` : s
}

// Slug ASCII para deduplicar modelos: "Toyota" -> "toyota".
function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function serializeRepuesto(doc) {
  const data = doc.data() || {}
  const source = data.fuente === 'bot_whatsapp' || data.realtime_user_uid
    ? 'bot_whatsapp'
    : 'comercio_repuestos'
  const eliminado = Boolean(data.eliminado) || data.estado_aprobacion === 'eliminado'
  return {
    id: doc.id,
    source,
    schema_version: data.schema_version || 1,
    operation_id: data.operation_id || '',
    estado_aprobacion: data.estado_aprobacion || (data.aprobado ? 'aprobado' : data.archivado ? 'archivado' : 'pendiente'),
    owner_uid: data.owner_uid || data.realtime_user_uid || '',
    owner_uids: Array.isArray(data.owner_uids) ? data.owner_uids : [],
    identity_id: data.identity_id || '',
    telefono: data.telefono || '',
    telefono_normalizado: data.telefono_normalizado || '',
    comercio_whatsapp: data.comercio_whatsapp || '',
    comercio_nombre: data.comercio_nombre || '',
    creado_por: data.creado_por || '',
    realtime_user_uid: data.realtime_user_uid || '',
    comercio_id: data.comercio_id || '',
    dia: data.dia || '',
    venta: data.venta || '',
    tipo_vehiculo: data.tipo_vehiculo || 'carro',
    marca: data.marca || '',
    modelo: data.modelo || '',
    anio: data.anio || '',
    nombre: data.nombre || '',
    nota: data.nota || '',
    precio: data.precio ?? '',
    fotos: Array.isArray(data.fotos) ? data.fotos : [],
    aprobado: Boolean(data.aprobado),
    archivado: Boolean(data.archivado),
    eliminado,
    catalogo_id: data.catalogo_id || '',
    catalogo_oculto: Boolean(data.catalogo_oculto),
    creado_en: data.creado_en?.toMillis ? data.creado_en.toMillis() : null,
  }
}

function serializeCatalogRepuesto(doc) {
  const data = doc.data() || {}
  const modelos = cleanText(data.gestion_modelo || data.modelos, 160)
  const nombre = cleanText(data.gestion_nombre || data.marca || data.categoria, 120) || 'Repuesto'
  const marcaVehiculo = cleanText(data.gestion_marca_vehiculo, 60)
  const fotos = parseFotos(data.img)
  const publicado = cleanText(data.publicado, 30).toLowerCase()

  return {
    id: `catalog:${doc.id}`,
    source: CATALOG_SOURCE,
    schema_version: data.schema_version || 1,
    operation_id: data.operation_id || `catalog:${doc.id}`,
    estado_aprobacion: 'aprobado',
    owner_uid: data.owner_uid || data.userID || data.propietario_id || '',
    owner_uids: Array.isArray(data.owner_uids) ? data.owner_uids : [],
    identity_id: data.identity_id || '',
    telefono: data.whatsapp || '',
    telefono_normalizado: internationalPhone(data.whatsapp),
    comercio_whatsapp: data.whatsapp || '',
    comercio_nombre: data.comercio || '',
    creado_por: data.aprobado_por || '',
    realtime_user_uid: data.owner_uid || data.userID || '',
    comercio_id: data.comercio_id || '',
    dia: data.dia || '',
    venta: cleanText(data.gestion_venta || data.categoria, 80),
    tipo_vehiculo: cleanText(data.gestion_tipo_vehiculo || data.vehiculo, 20).toLowerCase() === 'moto' ? 'moto' : 'carro',
    marca: marcaVehiculo || cleanText(data.marca, 60),
    modelo: modelos,
    anio: cleanYear(data.gestion_anio || data.anio),
    nombre,
    nota: cleanText(data.gestion_nota ?? data.descripcion, 500),
    precio: cleanText(data.precio, 40),
    fotos,
    aprobado: true,
    archivado: false,
    eliminado: false,
    catalogo_id: doc.id,
    catalogo_oculto: publicado === 'oculto',
    creado_en: data.creado_en?.toMillis ? data.creado_en.toMillis() : null,
  }
}

function catalogUpdateData({ marca, modelo, anio, nombre, nota, precio, tipoVehiculo, venta }, current = {}, now) {
  const categoria = cleanText(venta || current.gestion_venta || current.categoria, 80) || 'Repuestos'
  const modelos = [marca, modelo, anio].filter(Boolean).join(' ')
  return {
    // En el contrato público de `merida`, `marca` funciona como título del
    // producto y `modelos` contiene la compatibilidad del vehículo.
    marca: nombre,
    categoria,
    modelos,
    descripcion: nota,
    vehiculo: tipoVehiculo,
    precio: priceLabel(precio),
    buscar: searchTokens(nombre, marca, modelo, anio, nota, categoria),
    gestion_nombre: nombre,
    gestion_marca_vehiculo: marca,
    gestion_modelo: modelo,
    gestion_anio: anio,
    gestion_nota: nota,
    gestion_tipo_vehiculo: tipoVehiculo,
    gestion_venta: categoria,
    actualizado_en: now,
  }
}

function serializeAppPending(uid, pendingId, data = {}, user = {}, resolved = {}) {
  const commerceOwner = resolved.user && typeof resolved.user === 'object' ? resolved.user : user
  const linkedCommerce = resolved.commerce && typeof resolved.commerce === 'object' ? resolved.commerce : {}
  const dia = cleanText(
    data.dia || resolved.day || linkedCommerce.dia
      || commerceOwner.comercio_dia_actual || commerceOwner.comercio_autorizado?.dia || '',
    20,
  ).toLowerCase()
  const commerce = Object.keys(linkedCommerce).length
    ? linkedCommerce
    : commerceFromProfile(commerceOwner, data.comercio_id || commerceOwner.comercio_autorizado?.comercio_id || '', dia)
  const phone = commerce.whatsapp || data.comercio_whatsapp || data.telefono
    || commerceOwner.whatsapp || commerceOwner.telefono || commerceOwner.phone || ''
  const categoria = cleanText(data.categoria, 120)

  return {
    id: `app:${uid}:${pendingId}`,
    source: APP_PENDING_SOURCE,
    schema_version: data.schema_version || 1,
    operation_id: data.operation_id || `app:${uid}:${pendingId}`,
    estado_aprobacion: data.estado_aprobacion || 'pendiente',
    owner_uid: data.owner_uid || data.realtime_user_uid || resolved.uid || uid,
    owner_uids: Array.isArray(data.owner_uids)
      ? data.owner_uids
      : Array.from(new Set([uid, data.realtime_user_uid, resolved.uid].filter(Boolean))),
    identity_id: data.identity_id || identityIdForPhone(phone),
    app_uid: uid,
    app_pending_id: pendingId,
    app_association_status: resolved.linked ? 'vinculado' : 'sin_comercio',
    app_association_reason: resolved.reason || '',
    realtime_user_uid: resolved.uid || uid,
    telefono: phone,
    telefono_normalizado: internationalPhone(phone),
    comercio_whatsapp: phone,
    comercio_nombre: commerce.nombre_comercio || data.comercio_nombre || commerceOwner.nombre_comercio
      || commerceOwner.nombre || commerceOwner.google_nombre || '',
    creado_por: uid,
    comercio_id: commerce.comercio_id || cleanText(data.comercio_id, 80),
    dia: commerce.dia || dia,
    venta: categoria,
    tipo_vehiculo: cleanText(data.gestion_tipo_vehiculo || data.vehiculo, 20).toLowerCase() === 'moto' ? 'moto' : 'carro',
    marca: cleanText(data.gestion_marca_vehiculo || data.marca, 60),
    modelo: cleanText(data.gestion_modelo || data.modelos, 160),
    anio: cleanYear(data.gestion_anio),
    nombre: cleanText(data.gestion_nombre || categoria, 120) || 'Repuesto desde la app',
    nota: cleanText(data.gestion_nota ?? data.descripcion, 500),
    precio: cleanText(data.precio, 40),
    fotos: parseFotos(data.fotos),
    aprobado: false,
    archivado: false,
    catalogo_id: '',
    creado_en: pushTimestamp(pendingId),
  }
}

async function commerceProfile(rtdb, session) {
  const phone = session.tel || session.telefono
  // Fuente primaria: /users/<telefono>. Si no existe (usuario viejo de la app
  // Android indexado por uid de Google), se busca por whatsapp. rifas_usuarios
  // queda como fallback legacy.
  const direct = await rtdb.ref(`users/${phone}`).get()
  if (direct.exists()) return direct.val() || {}

  const target = canonPhone(phone)
  const allUsers = await rtdb.ref('users').get()
  if (allUsers.exists()) {
    for (const user of Object.values(allUsers.val() || {})) {
      if (user && typeof user === 'object' && canonPhone(user.whatsapp) === target) return user
    }
  }

  const rifas = await rtdb.ref(`rifas_usuarios/${phone}`).get()
  return rifas.exists() ? rifas.val() || {} : {}
}

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  const snap = await rtdb.ref('users').get()
  if (!snap.exists()) return null

  for (const [uid, user] of Object.entries(snap.val() || {})) {
    if (user && typeof user === 'object' && canonPhone(user.whatsapp || user.telefono || uid) === target) {
      return { uid, user }
    }
  }

  return null
}

function commerceFromProfile(profile = {}, commerceId = '', dia = '') {
  const dayValue = dia ? profile.comercios_por_dia?.[dia] : null
  const dayCommerce = dayValue?.comercios && commerceId
    ? dayValue.comercios[commerceId]
    : null
  return dayCommerce || profile.comercio_autorizado || profile
}

function findCommerceById(users = {}, commerceId = '', preferredDay = '') {
  if (!commerceId) return null

  for (const [uid, user] of Object.entries(users)) {
    if (!user || typeof user !== 'object') continue
    const preferred = user.comercios_por_dia?.[preferredDay]?.comercios?.[commerceId]
    if (preferred && typeof preferred === 'object') return { uid, user, commerce: preferred }

    for (const value of Object.values(user.comercios_por_dia || {})) {
      const commerce = value?.comercios?.[commerceId]
      if (commerce && typeof commerce === 'object') return { uid, user, commerce }
    }

    if (user.comercio_autorizado?.comercio_id === commerceId) {
      return { uid, user, commerce: user.comercio_autorizado }
    }
  }

  return null
}

function firstCommerceFromUser(uid, user = {}, preferredDay = '') {
  const currentId = cleanText(user.comercio_autorizado?.comercio_id, 80)
  if (currentId) {
    const direct = findCommerceById({ [uid]: user }, currentId, preferredDay)
    if (direct) return direct
  }

  const days = Object.entries(user.comercios_por_dia || {})
    .sort(([a], [b]) => {
      if (a === preferredDay) return -1
      if (b === preferredDay) return 1
      return 0
    })
  for (const [day, value] of days) {
    for (const [commerceId, commerce] of Object.entries(value?.comercios || {})) {
      if (!commerce || typeof commerce !== 'object') continue
      return {
        uid,
        user,
        commerce: { ...commerce, comercio_id: commerce.comercio_id || commerceId, dia: commerce.dia || day },
      }
    }
  }

  if (user.comercio_autorizado && typeof user.comercio_autorizado === 'object') {
    return { uid, user, commerce: user.comercio_autorizado }
  }
  if (user.nombre_comercio || user.vender === true) return { uid, user, commerce: user }
  return null
}

function findCommerceByPhone(users = {}, rawPhone = '', preferredDay = '') {
  const target = canonPhone(rawPhone)
  if (target.length < 10) return null
  const matches = []

  for (const [uid, user] of Object.entries(users)) {
    if (!user || typeof user !== 'object') continue
    for (const [day, value] of Object.entries(user.comercios_por_dia || {})) {
      for (const [commerceId, commerce] of Object.entries(value?.comercios || {})) {
        if (!commerce || typeof commerce !== 'object') continue
        const phone = commerce.whatsapp || commerce.whatsapp_normalizado || user.whatsapp || user.telefono
        if (canonPhone(phone) !== target) continue
        matches.push({
          uid,
          user,
          commerce: { ...commerce, comercio_id: commerce.comercio_id || commerceId, dia: commerce.dia || day },
        })
      }
    }
  }

  return matches.find((entry) => entry.commerce.dia === preferredDay) || matches[0] || null
}

function resolveAppCommerce(users = {}, appUid = '', pending = {}) {
  const directUser = users[appUid] && typeof users[appUid] === 'object' ? users[appUid] : {}
  const requestedId = cleanText(pending.comercio_id, 80)
  const hintedUid = realtimeKey(pending.realtime_user_uid, 128)
  const preferredDay = cleanText(
    pending.dia || directUser.comercio_dia_actual || directUser.comercio_autorizado?.dia,
    20,
  ).toLowerCase()

  if (hintedUid && users[hintedUid] && typeof users[hintedUid] === 'object') {
    const hintedUser = users[hintedUid]
    const hintedById = requestedId
      ? findCommerceById({ [hintedUid]: hintedUser }, requestedId, preferredDay)
      : null
    const hinted = hintedById || firstCommerceFromUser(hintedUid, hintedUser, preferredDay)
    if (hinted) {
      return { ...hinted, day: hinted.commerce.dia || preferredDay, linked: true, reason: 'realtime_user_uid' }
    }
  }

  if (requestedId) {
    const requested = findCommerceById(users, requestedId, preferredDay)
    if (requested) {
      return { ...requested, day: requested.commerce.dia || preferredDay, linked: true, reason: 'comercio_id' }
    }
  }

  const direct = firstCommerceFromUser(appUid, directUser, preferredDay)
  if (direct) {
    return { ...direct, day: direct.commerce.dia || preferredDay, linked: true, reason: 'app_uid' }
  }

  const phone = pending.comercio_whatsapp || pending.telefono
    || directUser.whatsapp || directUser.telefono || directUser.phone || ''
  const byPhone = findCommerceByPhone(users, phone, preferredDay)
  if (byPhone) {
    return { ...byPhone, day: byPhone.commerce.dia || preferredDay, linked: true, reason: 'whatsapp' }
  }

  return {
    uid: appUid,
    user: directUser,
    commerce: {},
    day: preferredDay,
    linked: false,
    reason: Object.keys(directUser).length ? 'usuario_sin_comercio' : 'usuario_no_encontrado',
  }
}

export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const url = new URL(request.url)
    const requestedTelefono = cleanPhone(url.searchParams.get('telefono'))
    const scope = cleanText(url.searchParams.get('scope'), 20)

    if (scope === 'all') {
      const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
      const rtdb = getAdminRealtimeDb()
      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) return NextResponse.json({ error: 'No puedes ver repuestos de otros comercios.' }, { status: 403 })

      const [recentSnap, firestorePendingSnap, catalogSnap, appPendingSnap, usersSnap] = await Promise.all([
        db.collection(REPUESTOS_COLLECTION).orderBy('creado_en', 'desc').limit(500).get()
          .catch(() => db.collection(REPUESTOS_COLLECTION).limit(500).get()),
        db.collection(REPUESTOS_COLLECTION).where('aprobado', '==', false).limit(1000).get()
          .catch(() => ({ docs: [] })),
        // El total de la paginación se calcula con el catálogo completo. Un
        // límite fijo aquí hacía que la interfaz informara 1.513 aunque ya
        // existieran más de 2.000 publicaciones.
        db.collection(CATALOGO_COLLECTION).get()
          .catch(() => ({ docs: [] })),
        rtdb.ref(APP_PENDING_PATH).get(),
        rtdb.ref('users').get(),
      ])

      const users = usersSnap.exists() ? usersSnap.val() || {} : {}
      const appItems = []
      if (appPendingSnap.exists()) {
        for (const [uid, pendingById] of Object.entries(appPendingSnap.val() || {})) {
          if (!pendingById || typeof pendingById !== 'object') continue
          for (const [pendingId, pending] of Object.entries(pendingById)) {
            if (!pending || typeof pending !== 'object') continue
            if (cleanText(pending.publicado, 30).toLowerCase() !== 'espera') continue
            const resolved = resolveAppCommerce(users, uid, pending)
            appItems.push(serializeAppPending(uid, pendingId, pending, resolved.user, resolved))
          }
        }
      }

      const firestoreDocsById = new Map()
      recentSnap.docs.forEach((doc) => firestoreDocsById.set(doc.id, doc))
      firestorePendingSnap.docs.forEach((doc) => firestoreDocsById.set(doc.id, doc))

      const catalogDocsById = new Map(catalogSnap.docs.map((doc) => [doc.id, doc]))
      const catalogDocsByRepuestoId = new Map()
      catalogSnap.docs.forEach((doc) => {
        const sourceId = cleanText(doc.data()?.comercio_repuesto_id, 64)
        if (sourceId) catalogDocsByRepuestoId.set(sourceId, doc)
      })
      const sourceItems = Array.from(firestoreDocsById.values()).map(serializeRepuesto)
      const sourceItemIds = new Set(sourceItems.map((item) => item.id))
      const linkedCatalogIds = new Set()
      const synchronizedSourceItems = sourceItems.map((item) => {
        const catalogDoc = (item.catalogo_id ? catalogDocsById.get(item.catalogo_id) : null)
          || catalogDocsByRepuestoId.get(item.id)
        if (!catalogDoc) return item
        const catalogItem = serializeCatalogRepuesto(catalogDoc)
        linkedCatalogIds.add(catalogDoc.id)
        return {
          ...item,
          catalogo_id: catalogDoc.id,
          catalogo_oculto: catalogItem.catalogo_oculto,
          fotos: item.fotos.length ? item.fotos : catalogItem.fotos,
        }
      })

      const catalogItems = catalogSnap.docs
        .filter((doc) => {
          if (linkedCatalogIds.has(doc.id)) return false
          const sourceId = cleanText(doc.data()?.comercio_repuesto_id, 64)
          return !sourceId || !sourceItemIds.has(sourceId)
        })
        .map(serializeCatalogRepuesto)
      const items = [
        ...synchronizedSourceItems,
        ...catalogItems,
        ...appItems,
      ]
        .filter((item) => !item.eliminado)
        .sort((a, b) => (b.creado_en ?? 0) - (a.creado_en ?? 0))
      return NextResponse.json({ ok: true, items })
    }

    const variants = Array.from(new Set([
      ...phoneVariants(session.telefono),
      ...phoneVariants(session.tel),
      ...phoneVariants(requestedTelefono),
    ]))
    // Los repuestos creados desde la app pueden identificar al comercio en
    // `comercio_whatsapp` o, en documentos antiguos, en `creado_por`. La web
    // usa `telefono`, por eso se consultan las tres formas y se deduplican.
    const phoneFields = ['telefono', 'comercio_whatsapp', 'creado_por']
    const snaps = await Promise.all(
      phoneFields.map((field) => db.collection(REPUESTOS_COLLECTION).where(field, 'in', variants).get()),
    )
    const docsById = new Map()
    snaps.forEach((snap) => snap.docs.forEach((doc) => docsById.set(doc.id, doc)))
    const targets = new Set([
      canonPhone(session.telefono),
      canonPhone(session.tel),
      canonPhone(requestedTelefono),
    ].filter(Boolean))
    const items = Array.from(docsById.values())
      .map(serializeRepuesto)
      .filter((item) => !item.eliminado && targets.has(repuestoPhone(item)))
      .sort((a, b) => (b.creado_en ?? 0) - (a.creado_en ?? 0))

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudieron cargar los repuestos.' }, { status: 400 })
  }
}

export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { getAdminDb, getAdminRealtimeDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const authorized = await canManageCommerces(rtdb, session)
    const comercioId = cleanText(body.comercio_id, 80)
    const dia = cleanText(body.dia, 20).toLowerCase()
    const venta = cleanText(body.venta, 80)
    const tipoVehiculo = cleanText(body.tipo_vehiculo, 20) === 'moto' ? 'moto' : 'carro'
    const marca = cleanText(body.marca, 60)
    const modelo = cleanText(body.modelo, 80)
    const anio = cleanYear(body.anio)
    const nombre = cleanText(body.nombre, 120)
    const nota = cleanText(body.nota, 500)
    const precio = cleanText(body.precio, 40)

    if (!marca) return NextResponse.json({ error: 'Selecciona la marca.' }, { status: 400 })
    if (!modelo) return NextResponse.json({ error: 'Escribe el modelo.' }, { status: 400 })
    if (!nombre) return NextResponse.json({ error: 'Escribe el nombre del repuesto.' }, { status: 400 })

    const requestedTelefono = cleanPhone(body.telefono || body.whatsapp)
    const ownerPhone = authorized && requestedTelefono ? requestedTelefono : session.telefono
    const identities = await resolveRealtimeIdentities(rtdb, ownerPhone)
    const owner = identities[0] ? { uid: identities[0].uid, user: identities[0].profile } : null
    const ownerUids = identities.map((identity) => identity.uid)
    const ownerProfile = owner?.user || await commerceProfile(rtdb, { ...session, telefono: ownerPhone, tel: ownerPhone })
    const ownerCommerce = commerceFromProfile(ownerProfile, comercioId, dia)
    const db = getAdminDb()

    const repuestoRef = db.collection(REPUESTOS_COLLECTION).doc()
    const repuestoData = {
      schema_version: DATA_SCHEMA_VERSION,
      record_type: 'comercio_repuesto_pendiente',
      origen: 'web',
      operation_id: `web:${repuestoRef.id}`,
      estado_aprobacion: 'pendiente',
      owner_uid: owner?.uid || '',
      owner_uids: ownerUids,
      identity_id: identityIdForPhone(ownerPhone),
      telefono: ownerPhone,
      telefono_normalizado: internationalPhone(ownerPhone),
      comercio_id: comercioId,
      dia,
      venta,
      tipo_vehiculo: tipoVehiculo,
      marca,
      modelo,
      anio,
      nombre,
      nota,
      precio,
      fotos: [],
      aprobado: false,
      archivado: false,
      catalogo_id: '',
      creado_por: session.telefono,
      comercio_nombre: ownerCommerce?.nombre_comercio || ownerProfile?.nombre || '',
      comercio_whatsapp: ownerCommerce?.whatsapp || ownerProfile?.whatsapp || ownerPhone,
      creado_en: adminFieldValue.serverTimestamp(),
      actualizado_en: adminFieldValue.serverTimestamp(),
    }

    // Modelo compartido para autocompletado: deduplicado por marca+modelo+anio.
    const modeloId = [slug(marca), slug(modelo), anio].filter(Boolean).join('_')
    const writes = [repuestoRef.set(repuestoData)]
    if (modeloId) {
      writes.push(
        db.collection(MODELOS_COLLECTION).doc(modeloId).set(
          {
            marca,
            marca_norm: slug(marca),
            modelo,
            anio,
            usos: adminFieldValue.increment(1),
            actualizado_en: adminFieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      )
    }
    await Promise.all(writes)

    return NextResponse.json({
      ok: true,
      item: {
        id: repuestoRef.id,
        telefono: ownerPhone,
        telefono_normalizado: internationalPhone(ownerPhone),
        comercio_id: comercioId,
        dia,
        venta,
        tipo_vehiculo: tipoVehiculo,
        marca,
        modelo,
        anio,
        nombre,
        nota,
        precio,
        fotos: [],
        aprobado: false,
        archivado: false,
        catalogo_id: '',
        schema_version: DATA_SCHEMA_VERSION,
        operation_id: `web:${repuestoRef.id}`,
        estado_aprobacion: 'pendiente',
        owner_uid: owner?.uid || '',
        owner_uids: ownerUids,
        identity_id: identityIdForPhone(ownerPhone),
        creado_en: Date.now(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el repuesto.' }, { status: 400 })
  }
}

export async function PATCH(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = cleanText(body.id, 64)
    if (!id) return NextResponse.json({ error: 'Falta el id del repuesto.' }, { status: 400 })
    const commerceId = cleanText(body.comercio_id, 80)
    const dia = cleanText(body.dia, 20).toLowerCase()
    const venta = cleanText(body.venta, 80)
    const action = cleanText(body.action, 30).toLowerCase()

    const { getAdminDb, getAdminRealtimeDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const rtdb = getAdminRealtimeDb()
    const source = cleanText(body.source, 30).toLowerCase()
    const requestedCatalogId = realtimeKey(
      body.catalogo_id || (source === CATALOG_SOURCE ? id.replace(/^catalog:/, '') : ''),
      120,
    )

    if (action === 'visibility') {
      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) {
        return NextResponse.json({ error: 'No puedes cambiar la visibilidad de este repuesto.' }, { status: 403 })
      }
      if (!requestedCatalogId) {
        return NextResponse.json({ error: 'No se encontró la publicación en el catálogo.' }, { status: 404 })
      }

      const catalogRef = db.collection(CATALOGO_COLLECTION).doc(requestedCatalogId)
      const catalogSnap = await catalogRef.get()
      if (!catalogSnap.exists) {
        return NextResponse.json({ error: 'La publicación ya no existe en el catálogo.' }, { status: 404 })
      }

      const oculto = body.oculto === true
      const now = adminFieldValue.serverTimestamp()
      const writes = [catalogRef.update({ publicado: oculto ? 'oculto' : 'publicado', actualizado_en: now })]
      const sourceId = source === CATALOG_SOURCE
        ? cleanText(catalogSnap.data()?.comercio_repuesto_id, 64)
        : id
      if (sourceId) {
        const sourceRef = db.collection(REPUESTOS_COLLECTION).doc(sourceId)
        const sourceSnap = await sourceRef.get()
        if (sourceSnap.exists) {
          writes.push(sourceRef.update({ catalogo_oculto: oculto, actualizado_en: now }))
        }
      }
      await Promise.all(writes)
      return NextResponse.json({ ok: true, catalogo_oculto: oculto })
    }

    if (action === 'unpublish') {
      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) {
        return NextResponse.json({ error: 'No puedes eliminar publicaciones de otros comercios.' }, { status: 403 })
      }

      if (source === APP_PENDING_SOURCE) {
        const appUid = realtimeKey(body.app_uid)
        const appPendingId = realtimeKey(body.app_pending_id)
        if (!appUid || !appPendingId) {
          return NextResponse.json({ error: 'La publicación de la app no tiene una referencia válida.' }, { status: 400 })
        }

        const pendingRef = rtdb.ref(`${APP_PENDING_PATH}/${appUid}/${appPendingId}`)
        const pendingSnap = await pendingRef.get()
        if (!pendingSnap.exists()) {
          return NextResponse.json({ error: 'No existe la publicación de la app.' }, { status: 404 })
        }

        const pending = pendingSnap.val() || {}
        const catalogId = realtimeKey(pending.catalogo_id || pending.idPublicacion, 120)
        if (!catalogId) {
          return NextResponse.json({ error: 'No se encontró el repuesto publicado en el catálogo.' }, { status: 404 })
        }

        await db.collection(CATALOGO_COLLECTION).doc(catalogId).delete()
        await pendingRef.update({
          publicado: 'eliminado',
          estado_aprobacion: 'eliminado',
          catalogo_id: null,
          catalogo_id_eliminado: catalogId,
          eliminado_en: Date.now(),
          eliminado_por: session.tel || session.telefono,
        })

        return NextResponse.json({ ok: true, deleted: true })
      }

      const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
      const snap = await ref.get()
      if (!snap.exists) return NextResponse.json({ error: 'No existe el repuesto.' }, { status: 404 })

      const item = snap.data() || {}
      if (!item.aprobado && !item.catalogo_id) {
        return NextResponse.json({ error: 'El repuesto no está publicado.' }, { status: 400 })
      }

      const catalogId = realtimeKey(item.catalogo_id, 120)
      const now = adminFieldValue.serverTimestamp()
      const batch = db.batch()
      if (catalogId) batch.delete(db.collection(CATALOGO_COLLECTION).doc(catalogId))
      batch.update(ref, {
        aprobado: false,
        archivado: true,
        eliminado: true,
        estado_aprobacion: 'eliminado',
        catalogo_id: '',
        catalogo_id_eliminado: catalogId || '',
        eliminado_en: now,
        eliminado_por: session.tel || session.telefono,
        actualizado_en: now,
      })
      await batch.commit()

      return NextResponse.json({ ok: true, deleted: true })
    }

    if (action === 'update' && source === CATALOG_SOURCE) {
      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) {
        return NextResponse.json({ error: 'No puedes editar publicaciones de otros comercios.' }, { status: 403 })
      }
      if (!requestedCatalogId) {
        return NextResponse.json({ error: 'No se encontró la publicación en el catálogo.' }, { status: 404 })
      }

      const marca = cleanText(body.marca, 60)
      const modelo = cleanText(body.modelo, 160)
      const anio = cleanYear(body.anio)
      const nombre = cleanText(body.nombre, 120)
      const nota = cleanText(body.nota, 500)
      const precio = cleanText(body.precio, 40)
      const tipoVehiculo = cleanText(body.tipo_vehiculo, 20) === 'moto' ? 'moto' : 'carro'
      if (!marca || !modelo || !nombre) {
        return NextResponse.json({ error: 'Completa marca, modelo y nombre del repuesto.' }, { status: 400 })
      }

      const catalogRef = db.collection(CATALOGO_COLLECTION).doc(requestedCatalogId)
      const catalogSnap = await catalogRef.get()
      if (!catalogSnap.exists) {
        return NextResponse.json({ error: 'La publicación ya no existe en el catálogo.' }, { status: 404 })
      }
      const current = catalogSnap.data() || {}
      const now = adminFieldValue.serverTimestamp()
      await catalogRef.update(catalogUpdateData({
        marca,
        modelo,
        anio,
        nombre,
        nota,
        precio,
        tipoVehiculo,
        venta: cleanText(body.venta, 80),
      }, current, now))
      return NextResponse.json({
        ok: true,
        item: {
          id,
          marca,
          modelo,
          anio,
          nombre,
          nota,
          precio,
          tipo_vehiculo: tipoVehiculo,
          catalogo_id: requestedCatalogId,
          catalogo_oculto: cleanText(current.publicado, 30).toLowerCase() === 'oculto',
        },
      })
    }

    if (action === 'update' && source === APP_PENDING_SOURCE) {
      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) {
        return NextResponse.json({ error: 'No puedes editar repuestos pendientes de la app.' }, { status: 403 })
      }
      const appUid = realtimeKey(body.app_uid)
      const appPendingId = realtimeKey(body.app_pending_id)
      if (!appUid || !appPendingId) {
        return NextResponse.json({ error: 'El repuesto de la app no tiene una referencia válida.' }, { status: 400 })
      }

      const marca = cleanText(body.marca, 60)
      const modelo = cleanText(body.modelo, 160)
      const anio = cleanYear(body.anio)
      const nombre = cleanText(body.nombre, 120)
      const nota = cleanText(body.nota, 500)
      const precio = cleanText(body.precio, 40)
      const tipoVehiculo = cleanText(body.tipo_vehiculo, 20) === 'moto' ? 'moto' : 'carro'
      if (!marca || !modelo || !nombre) {
        return NextResponse.json({ error: 'Completa marca, modelo y nombre del repuesto.' }, { status: 400 })
      }

      const pendingRef = rtdb.ref(`${APP_PENDING_PATH}/${appUid}/${appPendingId}`)
      const pendingSnap = await pendingRef.get()
      if (!pendingSnap.exists()) {
        return NextResponse.json({ error: 'El repuesto ya no está en espera.' }, { status: 404 })
      }
      const pending = pendingSnap.val() || {}
      if (cleanText(pending.publicado, 30).toLowerCase() !== 'espera') {
        return NextResponse.json({ error: 'Solo se pueden editar aquí las publicaciones pendientes.' }, { status: 400 })
      }

      await pendingRef.update({
        // Mantiene el contrato original de la app y agrega campos de gestión
        // para no perder la separación marca/modelo/año en futuras ediciones.
        marca,
        modelos: [modelo, anio].filter(Boolean).join(' '),
        categoria: nombre,
        descripcion: nota,
        precio,
        vehiculo: tipoVehiculo,
        gestion_nombre: nombre,
        gestion_marca_vehiculo: marca,
        gestion_modelo: modelo,
        gestion_anio: anio,
        gestion_nota: nota,
        gestion_tipo_vehiculo: tipoVehiculo,
        actualizado_en: Date.now(),
        editado_por: session.tel || session.telefono,
      })
      return NextResponse.json({
        ok: true,
        item: { id, marca, modelo, anio, nombre, nota, precio, tipo_vehiculo: tipoVehiculo },
      })
    }

    if (source === APP_PENDING_SOURCE) {
      const appUid = realtimeKey(body.app_uid)
      const appPendingId = realtimeKey(body.app_pending_id)
      if (!appUid || !appPendingId) {
        return NextResponse.json({ error: 'El repuesto de la app no tiene una referencia válida.' }, { status: 400 })
      }

      const authorized = await canManageCommerces(rtdb, session)
      if (!authorized) {
        return NextResponse.json({ error: 'No puedes aprobar repuestos de la app.' }, { status: 403 })
      }

      const pendingRef = rtdb.ref(`${APP_PENDING_PATH}/${appUid}/${appPendingId}`)
      const [pendingSnap, usersSnap] = await Promise.all([
        pendingRef.get(),
        rtdb.ref('users').get(),
      ])
      if (!pendingSnap.exists()) {
        return NextResponse.json({ error: 'El repuesto ya no está en espera.' }, { status: 404 })
      }

      const pending = pendingSnap.val() || {}
      const currentStatus = cleanText(pending.publicado, 30).toLowerCase()
      if (currentStatus !== 'espera') {
        if (pending.catalogo_id) return NextResponse.json({ ok: true, catalogo_id: pending.catalogo_id })
        return NextResponse.json({ error: 'El repuesto ya no está pendiente.' }, { status: 400 })
      }

      const users = usersSnap.exists() ? usersSnap.val() || {} : {}
      const profile = users[appUid] && typeof users[appUid] === 'object' ? users[appUid] : {}
      const requestedCommerceId = cleanText(body.comercio_id, 80)
      const requestedDay = cleanText(body.dia, 20).toLowerCase()
      const matchedCommerce = findCommerceById(users, requestedCommerceId, requestedDay)
      const commerceProfile = matchedCommerce?.user || profile
      const commerce = matchedCommerce?.commerce || commerceFromProfile(profile, requestedCommerceId, requestedDay)
      const effectiveCommerceId = commerce.comercio_id || requestedCommerceId
      const effectiveDay = commerce.dia || requestedDay || profile.comercio_dia_actual || ''
      const categoria = cleanText(pending.categoria || body.venta, 80) || 'Repuestos'
      const marca = cleanText(pending.marca, 60) || 'Repuesto'
      const modelos = cleanText(pending.modelos, 160)
      const descripcion = cleanText(pending.descripcion, 500)
      const vehiculo = cleanText(pending.vehiculo, 20).toLowerCase() === 'moto' ? 'moto' : 'carro'
      const catalogName = cleanText(pending.gestion_nombre || categoria || marca, 120) || 'Repuesto'
      const vehicleBrand = cleanText(pending.gestion_marca_vehiculo || marca, 60)
      const vehicleModel = cleanText(pending.gestion_modelo || modelos, 160)
      const vehicleYear = cleanYear(pending.gestion_anio)
      const catalogModels = [vehicleBrand, vehicleModel, vehicleYear].filter(Boolean).join(' ')
      const catalogDescription = cleanText(pending.gestion_nota ?? descripcion, 500)
      const estado = cleanText(pending.estado, 40) || 'disponible'
      const precio = cleanText(pending.precio, 40) || 'Consultar'
      const img = parseFotos(pending.fotos)
      const ownerPhone = commerce.whatsapp || profile.whatsapp || profile.telefono || profile.phone || ''
      const commerceName = cleanText(
        commerce.nombre_comercio || commerceProfile.nombre_comercio || profile.nombre || profile.google_nombre || '',
        120,
      )
      const requestedCatalogId = realtimeKey(pending.idPublicacion || appPendingId, 120)
      const catalogRef = requestedCatalogId
        ? db.collection(CATALOGO_COLLECTION).doc(requestedCatalogId)
        : db.collection(CATALOGO_COLLECTION).doc()
      const now = adminFieldValue.serverTimestamp()

      await Promise.all([
        catalogRef.set({
          schema_version: DATA_SCHEMA_VERSION,
          record_type: 'repuesto_catalogo',
          origen: 'app_movil',
          operation_id: pending.operation_id || `app:${appUid}:${appPendingId}`,
          owner_uid: matchedCommerce?.uid || pending.realtime_user_uid || appUid,
          owner_uids: Array.from(new Set([
            appUid,
            matchedCommerce?.uid,
            pending.realtime_user_uid,
          ].filter(Boolean))),
          identity_id: pending.identity_id || identityIdForPhone(ownerPhone),
          idPublicacion: catalogRef.id,
          marca: catalogName,
          categoria,
          modelos: catalogModels,
          descripcion: catalogDescription,
          vehiculo,
          precio,
          gestion_nombre: catalogName,
          gestion_marca_vehiculo: vehicleBrand,
          gestion_modelo: vehicleModel,
          gestion_anio: vehicleYear,
          gestion_nota: catalogDescription,
          gestion_tipo_vehiculo: vehiculo,
          gestion_venta: categoria,
          img,
          buscar: searchTokens(catalogName, categoria, catalogModels, catalogDescription),
          relevancia: '0',
          publicado: 'publicado',
          estado,
          whatsapp: appPhone(ownerPhone),
          userID: appUid,
          propietario_id: appUid,
          aprobado_por: session.tel || session.telefono,
          comercio: commerceName,
          comercio_direccion: commerce.comercio_direccion || commerceProfile.comercio_direccion || '',
          comercio_lat: commerce.comercio_lat ?? commerceProfile.comercio_lat ?? null,
          comercio_lng: commerce.comercio_lng ?? commerceProfile.comercio_lng ?? null,
          comercio_id: effectiveCommerceId || '',
          dia: effectiveDay,
          fuente: 'app_movil',
          app_pendiente_id: appPendingId,
          creado_en: now,
          actualizado_en: now,
        }),
        pendingRef.update({
          publicado: 'publicado',
          schema_version: DATA_SCHEMA_VERSION,
          estado_aprobacion: 'aprobado',
          catalogo_id: catalogRef.id,
          aprobado_en: Date.now(),
          aprobado_por: session.tel || session.telefono,
          comercio_id: effectiveCommerceId || '',
          dia: effectiveDay,
        }),
      ])

      return NextResponse.json({ ok: true, catalogo_id: catalogRef.id })
    }

    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'No existe el repuesto.' }, { status: 404 })

    const item = snap.data() || {}
    const authorized = await canManageCommerces(rtdb, session)
    const allowedPhones = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (!authorized && !allowedPhones.has(repuestoPhone(item))) {
      return NextResponse.json({ error: 'No puedes aprobar este repuesto.' }, { status: 403 })
    }
    if (body.action === 'archive') {
      if (item.aprobado) return NextResponse.json({ error: 'Un repuesto publicado no se puede archivar.' }, { status: 400 })
      const now = adminFieldValue.serverTimestamp()
      await ref.update({ archivado: true, estado_aprobacion: 'archivado', archivado_en: now, actualizado_en: now })
      return NextResponse.json({ ok: true, archivado: true })
    }
    if (body.action === 'restore') {
      if (item.aprobado) return NextResponse.json({ error: 'Un repuesto publicado no puede volver a pendiente.' }, { status: 400 })
      const now = adminFieldValue.serverTimestamp()
      await ref.update({ archivado: false, estado_aprobacion: 'pendiente', archivado_en: null, actualizado_en: now })
      return NextResponse.json({ ok: true, archivado: false })
    }
    if (body.action === 'update') {
      const marca = cleanText(body.marca, 60)
      const modelo = cleanText(body.modelo, 80)
      const anio = cleanYear(body.anio)
      const nombre = cleanText(body.nombre, 120)
      const nota = cleanText(body.nota, 500)
      const precio = cleanText(body.precio, 40)
      const tipoVehiculo = cleanText(body.tipo_vehiculo, 20) === 'moto' ? 'moto' : 'carro'
      if (!marca || !modelo || !nombre) {
        return NextResponse.json({ error: 'Completa marca, modelo y nombre del repuesto.' }, { status: 400 })
      }
      const now = adminFieldValue.serverTimestamp()
      const sourceUpdate = {
        marca,
        modelo,
        anio,
        nombre,
        nota,
        precio,
        tipo_vehiculo: tipoVehiculo,
        actualizado_en: now,
      }
      const batch = db.batch()
      batch.update(ref, sourceUpdate)
      const catalogId = realtimeKey(item.catalogo_id || requestedCatalogId, 120)
      if (item.aprobado && catalogId) {
        const catalogRef = db.collection(CATALOGO_COLLECTION).doc(catalogId)
        const catalogSnap = await catalogRef.get()
        if (!catalogSnap.exists) {
          return NextResponse.json({ error: 'La publicación ya no existe en el catálogo.' }, { status: 404 })
        }
        batch.update(catalogRef, catalogUpdateData({
          marca,
          modelo,
          anio,
          nombre,
          nota,
          precio,
          tipoVehiculo,
          venta: item.venta || venta,
        }, catalogSnap.data() || {}, now))
      }
      await batch.commit()
      return NextResponse.json({
        ok: true,
        item: {
          id,
          marca,
          modelo,
          anio,
          nombre,
          nota,
          precio,
          tipo_vehiculo: tipoVehiculo,
          catalogo_id: catalogId || item.catalogo_id || '',
          catalogo_oculto: Boolean(item.catalogo_oculto),
        },
      })
    }
    if (item.catalogo_id) {
      await ref.update({
        aprobado: true,
        archivado: false,
        estado_aprobacion: 'aprobado',
        actualizado_en: adminFieldValue.serverTimestamp(),
      })
      return NextResponse.json({ ok: true, catalogo_id: item.catalogo_id })
    }

    const effectiveDia = item.dia || dia
    // Al aprobar desde /usuario/comercio/autorizacion, el comercio seleccionado
    // por WhatsApp puede tener un id distinto al que guardo la app. El id
    // confirmado por el administrador debe reemplazar ese enlace viejo.
    const effectiveCommerceId = commerceId || item.comercio_id
    const effectiveVenta = item.venta || venta
    const ownerPhone = repuestoPhone(item) || session.telefono
    const owner = await findRealtimeUserByPhone(rtdb, ownerPhone)
    const profile = owner?.user || await commerceProfile(rtdb, { ...session, telefono: ownerPhone, tel: ownerPhone })
    const commerce = commerceFromProfile(profile, effectiveCommerceId, effectiveDia)
    const catalogRef = db.collection(CATALOGO_COLLECTION).doc()
    const now = adminFieldValue.serverTimestamp()
    // El catálogo usa las fotos propias del repuesto; si no tiene, cae a la del comercio.
    const repuestoFotos = Array.isArray(item.fotos) ? item.fotos.filter(Boolean) : []
    const fallbackImage = commerce.comercio_foto_url || profile.comercio_foto_url || ''
    const img = repuestoFotos.length ? repuestoFotos : (fallbackImage ? [fallbackImage] : [])
    // El catálogo pertenece al comercio elegido en el pendiente, no a quien
    // aprueba; el userID sigue apuntando al nodo RTDB del dueño.
    const commerceName = cleanText(
      commerce.nombre_comercio || profile.nombre_comercio || item.comercio_nombre || profile.nombre || '',
      120,
    )
    const commerceOwnerId = owner?.uid || cleanPhone(ownerPhone)
    const catalogName = cleanText(item.nombre || item.marca, 120) || 'Repuesto'
    const catalogDescription = cleanText(item.nota, 500)

    await Promise.all([
      catalogRef.set({
        schema_version: DATA_SCHEMA_VERSION,
        record_type: 'repuesto_catalogo',
        origen: item.origen || item.fuente || 'web',
        operation_id: item.operation_id || `comercio-repuesto:${id}`,
        owner_uid: item.owner_uid || commerceOwnerId,
        owner_uids: Array.from(new Set([
          ...(Array.isArray(item.owner_uids) ? item.owner_uids : []),
          commerceOwnerId,
        ].filter(Boolean))),
        identity_id: item.identity_id || identityIdForPhone(ownerPhone),
        // La app ordena el catálogo por idPublicacion: sin este campo el
        // documento queda excluido de los resultados.
        idPublicacion: catalogRef.id,
        marca: catalogName,
        categoria: effectiveVenta || 'Repuestos',
        modelos: [item.marca, item.modelo, item.anio].filter(Boolean).join(' '),
        descripcion: catalogDescription,
        vehiculo: item.tipo_vehiculo || 'carro',
        precio: priceLabel(item.precio),
        gestion_nombre: catalogName,
        gestion_marca_vehiculo: item.marca || '',
        gestion_modelo: item.modelo || '',
        gestion_anio: item.anio || '',
        gestion_nota: item.nota || '',
        gestion_tipo_vehiculo: item.tipo_vehiculo || 'carro',
        gestion_venta: effectiveVenta || 'Repuestos',
        img,
        buscar: searchTokens(catalogName, item.marca, item.modelo, item.anio, catalogDescription, effectiveVenta),
        relevancia: '0',
        publicado: 'publicado',
        estado: 'disponible',
        whatsapp: localPhone(commerce.whatsapp || item.comercio_whatsapp || ownerPhone),
        userID: commerceOwnerId,
        propietario_id: commerceOwnerId,
        aprobado_por: session.tel || session.telefono,
        comercio: commerceName,
        comercio_direccion: commerce.comercio_direccion || '',
        comercio_lat: commerce.comercio_lat ?? null,
        comercio_lng: commerce.comercio_lng ?? null,
        comercio_repuesto_id: id,
        creado_en: now,
        actualizado_en: now,
      }),
      ref.update({
        aprobado: true,
        archivado: false,
        estado_aprobacion: 'aprobado',
        comercio_id: effectiveCommerceId || item.comercio_id || '',
        dia: effectiveDia || item.dia || '',
        venta: effectiveVenta || item.venta || '',
        catalogo_id: catalogRef.id,
        catalogo_oculto: false,
        aprobado_en: now,
        actualizado_en: now,
      }),
    ])

    return NextResponse.json({ ok: true, catalogo_id: catalogRef.id })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo aprobar el repuesto.' }, { status: 400 })
  }
}

export async function DELETE(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const id = cleanText(new URL(request.url).searchParams.get('id'), 64)
    if (!id) return NextResponse.json({ error: 'Falta el id del repuesto.' }, { status: 400 })

    const { getAdminDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'No existe el repuesto.' }, { status: 404 })
    const item = snap.data() || {}
    const allowedPhones = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (!allowedPhones.has(repuestoPhone(item))) {
      return NextResponse.json({ error: 'No puedes borrar este repuesto.' }, { status: 403 })
    }
    // Borrado lógico: conserva trazabilidad y evita pérdida irreversible por
    // errores de identidad o una acción accidental desde el panel. Si ya fue
    // aprobado, el documento público del catálogo sí se elimina.
    const now = adminFieldValue.serverTimestamp()
    const catalogId = realtimeKey(item.catalogo_id, 120)
    const batch = db.batch()
    if (catalogId) batch.delete(db.collection(CATALOGO_COLLECTION).doc(catalogId))
    batch.update(ref, {
      aprobado: false,
      archivado: true,
      eliminado: true,
      estado_aprobacion: 'eliminado',
      catalogo_id: '',
      catalogo_id_eliminado: catalogId || '',
      eliminado_en: now,
      actualizado_en: now,
    })
    await batch.commit()

    return NextResponse.json({ ok: true, deleted: 'soft' })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo borrar el repuesto.' }, { status: 400 })
  }
}
