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

function internationalPhone(raw) {
  const canon = canonPhone(raw)
  return canon ? `+58${canon}` : ''
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
      if (user && typeof user === 'object' && canonPhone(user.whatsapp || user.telefono || uid) === target) {
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

function collectCommerceByDay(user = {}, uid = '') {
  const byDay = {}
  const source = user.comercios_por_dia || {}

  for (const day of DAYS) {
    const value = source?.[day]
    const list = []
    if (value?.comercios && typeof value.comercios === 'object') {
      for (const [id, commerce] of Object.entries(value.comercios)) {
        if (commerce && typeof commerce === 'object') list.push({ ...commerce, comercio_id: commerce.comercio_id || id })
      }
    } else if (value && typeof value === 'object' && (value.nombre_comercio || value.whatsapp)) {
      list.push({ ...value, comercio_id: value.comercio_id || 'principal' })
    }

    for (const commerce of list) {
      // No usar el uid como WhatsApp: un comercio sin teléfono debe quedar vacío.
      const realPhone = commerce.whatsapp || user.whatsapp || user.telefono || ''
      const item = {
        ...commerce,
        dia: commerce.dia || day,
        whatsapp: realPhone,
        whatsapp_normalizado: internationalPhone(realPhone),
        realtime_user_uid: uid,
      }
      byDay[day] = byDay[day] || { dia: day, comercios: {} }
      byDay[day].comercios[item.comercio_id] = item
    }
  }

  if (Object.keys(byDay).length === 0 && (user.comercio_autorizado || user.comercio_foto_url || user.comercio_direccion || user.whatsapp)) {
    const base = user.comercio_autorizado && typeof user.comercio_autorizado === 'object'
      ? user.comercio_autorizado
      : user
    const day = base.dia && DAYS.has(base.dia) ? base.dia : 'lunes'
    const commercePhone = base.whatsapp || user.whatsapp || user.telefono || uid
    const commerceId = base.comercio_id || uid || canonPhone(commercePhone) || 'principal'
    byDay[day] = {
      dia: day,
      comercios: {
        [commerceId]: {
          ...base,
          comercio_id: commerceId,
          dia: day,
          whatsapp: base.whatsapp || commercePhone,
          whatsapp_normalizado: internationalPhone(commercePhone),
          realtime_user_uid: uid,
        },
      },
    }
  }

  return byDay
}

export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const authorized = await currentAuthorization(rtdb, session, official)
    if (!authorized) {
      return NextResponse.json({ error: 'Tu solicitud aún está en espera de autorización.' }, { status: 403 })
    }

    const snap = await rtdb.ref('users').get()
    const users = snap.exists() ? snap.val() || {} : {}
    const comerciosPorDia = {}

    for (const [uid, user] of Object.entries(users)) {
      if (!user || typeof user !== 'object') continue
      const byDay = collectCommerceByDay(user, uid)
      for (const [day, value] of Object.entries(byDay)) {
        comerciosPorDia[day] = comerciosPorDia[day] || { dia: day, comercios: {} }
        Object.assign(comerciosPorDia[day].comercios, value.comercios)
      }
    }

    return NextResponse.json({ ok: true, comercios_por_dia: comerciosPorDia })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudieron cargar los comercios.' }, { status: 400 })
  }
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
    const commercePhone = cleanPhone(form.get('whatsapp')).slice(0, 15)
    const hasValidPhone = canonPhone(commercePhone).length >= 10
    // WhatsApp es opcional: si no es válido, el comercio se guarda bajo un id propio.
    const owner = hasValidPhone ? await findRealtimeUserByPhone(rtdb, commercePhone) : null

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
      whatsapp: commercePhone,
      whatsapp_normalizado: internationalPhone(commercePhone),
      comercio_foto_url: fotoUrl,
      comercio_direccion: cleanText(form.get('direccion'), 220),
      ...(hasCoords ? { comercio_lat: lat, comercio_lng: lng, comercio_ubicacion: `${lat}, ${lng}` } : {}),
      tipo_vehiculo: safeVehicleType,
      lista_ventas_repuestos: cleanList(form.get('lista_ventas_repuestos')),
      marcas_carro: cleanJsonList(form.get('marcas_carro')),
      marcas_moto: cleanJsonList(form.get('marcas_moto')),
      actualizado_en: updatedAt,
    }

    const dayPatch = {
      [`comercios_por_dia/${day}/dia`]: day,
      [`comercios_por_dia/${day}/comercio_actual_id`]: commerceId,
      [`comercios_por_dia/${day}/comercios/${commerceId}`]: commerce,
    }
    // La foto/direccion/coords se escriben en el perfil top-level a proposito:
    // el comercio (en /usuario/comercio) y el usuario autorizado comparten la
    // MISMA foto del comercio, viendola y asignandola desde ambos lugares.
    const profilePatch = {
      autorizado: true,
      whatsapp: commercePhone,
      telefono: owner?.user?.telefono || commercePhone,
      vender: true,
      nombre_comercio: commerce.nombre_comercio,
      comercio_foto_url: commerce.comercio_foto_url,
      comercio_direccion: commerce.comercio_direccion,
      ...(hasCoords ? { comercio_lat: lat, comercio_lng: lng, comercio_ubicacion: `${lat}, ${lng}` } : {}),
      comercio_autorizado_actualizado_en: updatedAt,
      comercio_dia_actual: day,
      comercio_autorizado: commerce,
    }

    // Fuente de verdad: /users. rifas_usuarios NO se escribe (exclusivo de rifas).
    // - Con WhatsApp válido: nodo del dueño existente o users/<telefono>.
    // - Sin WhatsApp válido: nodo sintético users/<commerceId>, con SOLO la
    //   estructura del comercio. Nunca se adjunta a la cuenta del admin ni de otro
    //   usuario, ni se escribe un perfil/vender en él.
    let usersPath
    let usersPatch
    if (hasValidPhone) {
      usersPath = owner?.uid
        ? `${owner.path ? `${owner.path}/` : ''}${owner.uid}`
        : `users/${commercePhone}`
      usersPatch = owner?.uid
        ? { ...profilePatch, ...dayPatch }
        : { id: commercePhone, ...profilePatch, ...dayPatch }
    } else {
      usersPath = `users/${commerceId}`
      usersPatch = { id: commerceId, sin_telefono: true, ...dayPatch }
    }

    const phoneKey = cleanPhone(owner?.user?.telefono || commercePhone) || commerceId
    const realtimeUid = owner?.uid || (hasValidPhone ? commercePhone : commerceId)

    await Promise.all([
      rtdb.ref(usersPath).update(usersPatch),
      firestore.collection(FIRESTORE_COLLECTION).doc(`${phoneKey}_${day}_${commerceId}`).set({
        ...commerce,
        telefono_usuario: commercePhone,
        telefono_key: phoneKey,
        editado_por: session.telefono,
        dia: day,
        realtime_user_uid: realtimeUid,
        realtime_user_path: usersPath,
        actualizado_en_ms: updatedAt,
        actualizado_en: adminFieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    return NextResponse.json({ ok: true, dia: day, comercio_id: commerceId, comercio: commerce, realtime_user_uid: realtimeUid })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el comercio.' }, { status: 400 })
  }
}
