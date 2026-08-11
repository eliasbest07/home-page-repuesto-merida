import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { canManageCommerces } from '@/lib/comercioAuthorization'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPUESTOS_COLLECTION = 'comercio_repuestos'
const CATALOGO_COLLECTION = 'merida'
const APP_PENDING_PATH = 'aprobarPublicacion'
const APP_PENDING_SOURCE = 'app_realtime'
const CATALOG_SOURCE = 'catalogo'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FOTOS = 4
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
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

function realtimeKey(value, max = 128) {
  const key = String(value || '').trim().slice(0, max)
  return key && !/[.#$/\[\]]/.test(key) ? key : ''
}

function parseFotos(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, MAX_FOTOS)
  if (value && typeof value === 'object') return Object.values(value).map((item) => String(item || '').trim()).filter(Boolean).slice(0, MAX_FOTOS)
  const text = String(value || '').trim()
  if (!text) return []
  try {
    return parseFotos(JSON.parse(text))
  } catch {
    return /^https?:\/\//i.test(text) ? [text] : []
  }
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

// Sube una foto al repuesto. La imagen llega ya comprimida desde el cliente
// (prepareImageForUpload); aquí solo se valida y se guarda en Storage. Máximo
// MAX_FOTOS por repuesto, guardadas en el array `fotos` del doc Firestore.
export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const form = await request.formData()
    const id = String(form.get('id') || '').trim().slice(0, 64)
    const source = String(form.get('source') || '').trim().toLowerCase()
    const appUid = realtimeKey(form.get('app_uid'))
    const appPendingId = realtimeKey(form.get('app_pending_id'))
    const requestedCatalogId = realtimeKey(form.get('catalogo_id'), 120)
    const foto = form.get('foto')
    if (!id) return NextResponse.json({ error: 'Falta el repuesto.' }, { status: 400 })
    if (!foto || typeof foto.arrayBuffer !== 'function' || foto.size <= 0) {
      return NextResponse.json({ error: 'Falta la foto.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(foto.type)) {
      return NextResponse.json({ error: 'La foto debe ser JPG, PNG o WebP.' }, { status: 400 })
    }
    if (foto.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'La foto debe pesar máximo 5 MB.' }, { status: 400 })
    }

    const { getAdminDb, getAdminBucket, getAdminRealtimeDb, STORAGE_BUCKET, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const rtdb = getAdminRealtimeDb()
    const authorized = await canManageCommerces(rtdb, session)
    const allowed = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    let fotos = []
    let storageFolder = `comercio_repuestos/${id}`
    let saveFotos

    if (source === APP_PENDING_SOURCE) {
      if (!authorized) return NextResponse.json({ error: 'No puedes editar repuestos pendientes de la app.' }, { status: 403 })
      if (!appUid || !appPendingId) return NextResponse.json({ error: 'La publicación de la app no tiene una referencia válida.' }, { status: 400 })
      const pendingRef = rtdb.ref(`${APP_PENDING_PATH}/${appUid}/${appPendingId}`)
      const pendingSnap = await pendingRef.get()
      if (!pendingSnap.exists()) return NextResponse.json({ error: 'Repuesto pendiente no encontrado.' }, { status: 404 })
      fotos = parseFotos(pendingSnap.val()?.fotos)
      storageFolder = `aprobar_publicacion/${appUid}/${appPendingId}`
      saveFotos = (nextFotos) => pendingRef.update({ fotos: nextFotos, actualizado_en: Date.now() })
    } else if (source === CATALOG_SOURCE) {
      if (!authorized) return NextResponse.json({ error: 'No puedes editar fotos del catálogo.' }, { status: 403 })
      const catalogId = requestedCatalogId || realtimeKey(id.replace(/^catalog:/, ''), 120)
      if (!catalogId) return NextResponse.json({ error: 'No se encontró la publicación del catálogo.' }, { status: 404 })
      const catalogRef = db.collection(CATALOGO_COLLECTION).doc(catalogId)
      const catalogSnap = await catalogRef.get()
      if (!catalogSnap.exists) return NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 })
      fotos = parseFotos(catalogSnap.data()?.img)
      storageFolder = `catalogo_repuestos/${catalogId}`
      saveFotos = (nextFotos) => catalogRef.update({ img: nextFotos, actualizado_en: adminFieldValue.serverTimestamp() })
    } else {
      const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
      const snap = await ref.get()
      if (!snap.exists) return NextResponse.json({ error: 'Repuesto no encontrado.' }, { status: 404 })
      const data = snap.data() || {}
      if (!authorized && !allowed.has(repuestoPhone(data))) {
        return NextResponse.json({ error: 'No puedes editar este repuesto.' }, { status: 403 })
      }
      fotos = parseFotos(data.fotos)
      saveFotos = async (nextFotos) => {
        const now = adminFieldValue.serverTimestamp()
        const writes = [ref.update({ fotos: nextFotos, actualizado_en: now })]
        if (data.catalogo_id) {
          writes.push(db.collection(CATALOGO_COLLECTION).doc(data.catalogo_id).set({ img: nextFotos, actualizado_en: now }, { merge: true }))
        }
        await Promise.all(writes)
      }
    }

    if (fotos.length >= MAX_FOTOS) {
      return NextResponse.json({ error: `Máximo ${MAX_FOTOS} fotos por repuesto.` }, { status: 400 })
    }

    const bucket = getAdminBucket()
    const ext = EXTENSIONS[foto.type] || 'jpg'
    const storagePath = `${storageFolder}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await foto.arrayBuffer())
    const downloadToken = crypto.randomUUID()
    await bucket.file(storagePath).save(buffer, {
      resumable: false,
      contentType: foto.type,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })
    const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
    const nextFotos = [...fotos, url].slice(0, MAX_FOTOS)
    await saveFotos(nextFotos)

    return NextResponse.json({ ok: true, fotos: nextFotos })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo subir la foto.' }, { status: 400 })
  }
}

export async function DELETE(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '').trim().slice(0, 64)
    const url = String(body.url || '').trim()
    const source = String(body.source || '').trim().toLowerCase()
    const appUid = realtimeKey(body.app_uid)
    const appPendingId = realtimeKey(body.app_pending_id)
    const requestedCatalogId = realtimeKey(body.catalogo_id, 120)
    if (!id || !url) return NextResponse.json({ error: 'Falta la foto del repuesto.' }, { status: 400 })

    const { getAdminDb, getAdminRealtimeDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const rtdb = getAdminRealtimeDb()
    const authorized = await canManageCommerces(rtdb, session)
    const allowed = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    let fotos = []
    let saveFotos

    if (source === APP_PENDING_SOURCE) {
      if (!authorized) return NextResponse.json({ error: 'No puedes editar repuestos pendientes de la app.' }, { status: 403 })
      if (!appUid || !appPendingId) return NextResponse.json({ error: 'La publicación de la app no tiene una referencia válida.' }, { status: 400 })
      const pendingRef = rtdb.ref(`${APP_PENDING_PATH}/${appUid}/${appPendingId}`)
      const pendingSnap = await pendingRef.get()
      if (!pendingSnap.exists()) return NextResponse.json({ error: 'Repuesto pendiente no encontrado.' }, { status: 404 })
      fotos = parseFotos(pendingSnap.val()?.fotos)
      saveFotos = (nextFotos) => pendingRef.update({ fotos: nextFotos, actualizado_en: Date.now() })
    } else if (source === CATALOG_SOURCE) {
      if (!authorized) return NextResponse.json({ error: 'No puedes editar fotos del catálogo.' }, { status: 403 })
      const catalogId = requestedCatalogId || realtimeKey(id.replace(/^catalog:/, ''), 120)
      if (!catalogId) return NextResponse.json({ error: 'No se encontró la publicación del catálogo.' }, { status: 404 })
      const catalogRef = db.collection(CATALOGO_COLLECTION).doc(catalogId)
      const catalogSnap = await catalogRef.get()
      if (!catalogSnap.exists) return NextResponse.json({ error: 'Publicación no encontrada.' }, { status: 404 })
      fotos = parseFotos(catalogSnap.data()?.img)
      saveFotos = (nextFotos) => catalogRef.update({ img: nextFotos, actualizado_en: adminFieldValue.serverTimestamp() })
    } else {
      const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
      const snap = await ref.get()
      if (!snap.exists) return NextResponse.json({ error: 'Repuesto no encontrado.' }, { status: 404 })
      const data = snap.data() || {}
      if (!authorized && !allowed.has(repuestoPhone(data))) {
        return NextResponse.json({ error: 'No puedes editar este repuesto.' }, { status: 403 })
      }
      fotos = parseFotos(data.fotos)
      saveFotos = async (nextFotos) => {
        const now = adminFieldValue.serverTimestamp()
        const writes = [ref.update({ fotos: nextFotos, actualizado_en: now })]
        if (data.catalogo_id) {
          writes.push(db.collection(CATALOGO_COLLECTION).doc(data.catalogo_id).set({ img: nextFotos, actualizado_en: now }, { merge: true }))
        }
        await Promise.all(writes)
      }
    }

    const nextFotos = fotos.filter((foto) => foto !== url)
    if (nextFotos.length === fotos.length) return NextResponse.json({ error: 'La foto ya no existe.' }, { status: 404 })
    await saveFotos(nextFotos)
    return NextResponse.json({ ok: true, fotos: nextFotos })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo quitar la foto.' }, { status: 400 })
  }
}
