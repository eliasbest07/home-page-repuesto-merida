import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPUESTOS_COLLECTION = 'comercio_repuestos'
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

function isAuthorized(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
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

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  const snap = await rtdb.ref('users').get()
  if (!snap.exists()) return null

  for (const user of Object.values(snap.val() || {})) {
    if (user && typeof user === 'object' && canonPhone(user.whatsapp || user.telefono) === target) return user
  }

  return null
}

async function currentAuthorization(rtdb, session) {
  const [rifasSnap, official] = await Promise.all([
    rtdb.ref(`rifas_usuarios/${cleanPhone(session.tel || session.telefono)}/autorizado`).get(),
    findRealtimeUserByPhone(rtdb, session.telefono),
  ])
  return isAuthorized(rifasSnap.val()) || isAuthorized(official?.autorizado)
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
    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Repuesto no encontrado.' }, { status: 404 })

    const data = snap.data() || {}
    const authorized = await currentAuthorization(getAdminRealtimeDb(), session)
    const allowed = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (!authorized && data.telefono && !allowed.has(canonPhone(data.telefono))) {
      return NextResponse.json({ error: 'No puedes editar este repuesto.' }, { status: 403 })
    }

    const fotos = Array.isArray(data.fotos) ? data.fotos : []
    if (fotos.length >= MAX_FOTOS) {
      return NextResponse.json({ error: `Máximo ${MAX_FOTOS} fotos por repuesto.` }, { status: 400 })
    }

    const bucket = getAdminBucket()
    const ext = EXTENSIONS[foto.type] || 'jpg'
    const storagePath = `comercio_repuestos/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
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
    const now = adminFieldValue.serverTimestamp()
    const writes = [ref.update({ fotos: nextFotos, actualizado_en: now })]
    // Si ya está publicado en el catálogo, sincroniza las imágenes del doc `merida`.
    if (data.catalogo_id) {
      writes.push(
        db.collection('merida').doc(data.catalogo_id).set(
          { img: nextFotos, actualizado_en: now },
          { merge: true },
        ),
      )
    }
    await Promise.all(writes)

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
    if (!id || !url) return NextResponse.json({ error: 'Falta la foto del repuesto.' }, { status: 400 })

    const { getAdminDb, getAdminRealtimeDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'Repuesto no encontrado.' }, { status: 404 })

    const data = snap.data() || {}
    const authorized = await currentAuthorization(getAdminRealtimeDb(), session)
    const allowed = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (!authorized && data.telefono && !allowed.has(canonPhone(data.telefono))) {
      return NextResponse.json({ error: 'No puedes editar este repuesto.' }, { status: 403 })
    }
    const fotos = Array.isArray(data.fotos) ? data.fotos : []
    const nextFotos = fotos.filter((foto) => foto !== url)
    if (nextFotos.length === fotos.length) return NextResponse.json({ error: 'La foto ya no existe.' }, { status: 404 })

    const now = adminFieldValue.serverTimestamp()
    const writes = [ref.update({ fotos: nextFotos, actualizado_en: now })]
    if (data.catalogo_id) {
      writes.push(db.collection('merida').doc(data.catalogo_id).set({ img: nextFotos, actualizado_en: now }, { merge: true }))
    }
    await Promise.all(writes)
    return NextResponse.json({ ok: true, fotos: nextFotos })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo quitar la foto.' }, { status: 400 })
  }
}
