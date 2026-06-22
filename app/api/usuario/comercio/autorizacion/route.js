import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'comercios_autorizados'
const FIRESTORE_COLLECTION = 'comercios_autorizados'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const DAYS = new Set(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (!d) return ''
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function authPayload(request) {
  const payload = verifyRifaToken(bearerToken(request))
  const telefono = cleanPhone(payload?.telefono || payload?.tel)
  const key = cleanPhone(payload?.tel || payload?.telefono)
  if (!payload || telefono.length < 10 || key.length < 10) return null
  return { ...payload, telefono, key }
}

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function cleanId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
}

function cleanList(value, maxItems = 80) {
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, maxItems)
}

function cleanJsonList(value, maxItems = 80) {
  try {
    const list = JSON.parse(String(value || '[]'))
    if (!Array.isArray(list)) return []
    return list.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems)
  } catch {
    return []
  }
}

function isAuthorized(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  const paths = ['users', '']

  for (const path of paths) {
    const snap = await (path ? rtdb.ref(path) : rtdb.ref()).get()
    if (!snap.exists()) continue

    const users = snap.val() || {}
    for (const [uid, user] of Object.entries(users)) {
      if (user && typeof user === 'object' && canonPhone(user.whatsapp) === target) {
        return { path, uid, user }
      }
    }
  }

  return null
}

async function currentAuthorization(rtdb, session, official) {
  const rifasSnap = await rtdb.ref(`rifas_usuarios/${session.key}/autorizado`).get()
  return isAuthorized(rifasSnap.val()) || isAuthorized(official?.user?.autorizado)
}

export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const form = await request.formData()
    const day = cleanText(form.get('dia'), 20).toLowerCase()
    if (!DAYS.has(day)) return NextResponse.json({ error: 'Selecciona un día válido.' }, { status: 400 })
    const requestedCommerceId = cleanId(form.get('comercio_id'))
    const commerceId = requestedCommerceId || `com_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`

    const { getAdminRealtimeDb, getAdminBucket, getAdminDb, STORAGE_BUCKET, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const firestore = getAdminDb()
    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const authorized = await currentAuthorization(rtdb, session, official)
    if (!authorized) {
      return NextResponse.json({ error: 'Tu solicitud aún está en espera de autorización.' }, { status: 403 })
    }

    const latRaw = form.get('lat')
    const lngRaw = form.get('lng')
    const lat = latRaw === null || latRaw === '' ? null : Number(latRaw)
    const lng = lngRaw === null || lngRaw === '' ? null : Number(lngRaw)
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    const tipoVehiculo = cleanText(form.get('tipo_vehiculo'), 20).toLowerCase()
    const safeVehicleType = tipoVehiculo === 'moto' ? 'moto' : 'carro'
    const existingPhotoUrl = cleanText(form.get('foto_url'), 500)

    let fotoUrl = existingPhotoUrl
    const foto = form.get('foto')
    const hasNewPhoto = foto && typeof foto.arrayBuffer === 'function' && foto.size > 0
    if (hasNewPhoto) {
      if (!ALLOWED_TYPES.has(foto.type)) {
        return NextResponse.json({ error: 'La foto debe ser JPG, PNG o WebP.' }, { status: 400 })
      }
      if (foto.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'La foto debe pesar máximo 5 MB.' }, { status: 400 })
      }
      const bucket = getAdminBucket()
      const ext = EXTENSIONS[foto.type] || 'jpg'
      const storagePath = `${STORAGE_PREFIX}/${session.key}/${day}/${commerceId}.${ext}`
      const buffer = Buffer.from(await foto.arrayBuffer())
      const downloadToken = crypto.randomUUID()
      await bucket.file(storagePath).save(buffer, {
        resumable: false,
        contentType: foto.type,
        metadata: {
          cacheControl: 'public, max-age=3600',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      })
      fotoUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
    }

    const updatedAt = Date.now()
    const commerce = {
      comercio_id: commerceId,
      dia: day,
      autorizado: true,
      nombre_comercio: cleanText(form.get('nombre_comercio'), 120),
      whatsapp: cleanPhone(form.get('whatsapp')).slice(0, 15),
      comercio_foto_url: fotoUrl,
      comercio_direccion: cleanText(form.get('direccion'), 220),
      ...(hasCoords ? { comercio_lat: lat, comercio_lng: lng, comercio_ubicacion: `${lat}, ${lng}` } : {}),
      tipo_vehiculo: safeVehicleType,
      lista_ventas_repuestos: cleanList(form.get('lista_ventas_repuestos')),
      marcas_carro: cleanJsonList(form.get('marcas_carro')),
      marcas_moto: cleanJsonList(form.get('marcas_moto')),
      actualizado_en: updatedAt,
    }

    const patch = {
      autorizado: true,
      comercio_autorizado_actualizado_en: updatedAt,
      comercio_dia_actual: day,
      comercio_autorizado: commerce,
      [`comercios_por_dia/${day}/dia`]: day,
      [`comercios_por_dia/${day}/comercio_actual_id`]: commerceId,
      [`comercios_por_dia/${day}/comercios/${commerceId}`]: commerce,
    }

    // Fuente de verdad: /users (nodo existente o /users/<telefono> con identidad).
    // rifas_usuarios NO se escribe: es exclusivo del flujo de rifas.
    const usersPath = official?.uid
      ? `${official.path ? `${official.path}/` : ''}${official.uid}`
      : `users/${session.telefono}`
    const usersPatch = official?.uid
      ? patch
      : { whatsapp: session.telefono, telefono: session.telefono, id: session.telefono, ...patch }

    await Promise.all([
      rtdb.ref(usersPath).update(usersPatch),
      firestore.collection(FIRESTORE_COLLECTION).doc(`${session.key}_${day}_${commerceId}`).set({
        ...commerce,
        telefono_usuario: session.telefono,
        telefono_key: session.key,
        dia: day,
        realtime_user_uid: official?.uid || session.telefono,
        realtime_user_path: usersPath,
        actualizado_en_ms: updatedAt,
        actualizado_en: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    return NextResponse.json({ ok: true, dia: day, comercio_id: commerceId, comercio: commerce, realtime_user_uid: official?.uid || session.telefono })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el comercio.' }, { status: 400 })
  }
}
