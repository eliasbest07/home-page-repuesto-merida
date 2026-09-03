import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { syncPublicProfilesFromUsers } from '@/lib/publicProfileAdmin'
import { canManageCommerces } from '@/lib/comercioAuthorization'
import { pickCanonicalRealtimeUser } from '@/lib/realtimeUserLookup'
import {
  indexIdentityProfilesByPhone,
  summarizeIdentityVerification,
} from '@/lib/identityVerificationPolicy'

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

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  if (!target) return null
  const snap = await rtdb.ref('users').get()
  if (!snap.exists()) return null

  let uidFallback = null
  const matches = []
  for (const [uid, user] of Object.entries(snap.val() || {})) {
    if (!user || typeof user !== 'object') continue
    const phones = [user.whatsapp, user.telefono, user.phone, user.id]
      .map(canonPhone)
      .filter((phone) => phone.length >= 10)
    if (phones.includes(target)) matches.push({ path: 'users', uid, user })
    if (phones.length === 0 && canonPhone(uid) === target) {
      uidFallback = { path: 'users', uid, user }
    }
  }

  const owner = pickCanonicalRealtimeUser(matches) || uidFallback
  if (!owner) return null
  return {
    ...owner,
    identityProfiles: matches.length > 0 ? matches.map((match) => match.user) : [owner.user],
  }
}

async function findCommerceLocations(rtdb, day, commerceId) {
  if (!commerceId) return []
  const snap = await rtdb.ref('users').get()
  if (!snap.exists()) return []

  const locations = []
  for (const [uid, user] of Object.entries(snap.val() || {})) {
    if (!user || typeof user !== 'object') continue
    const commerce = user.comercios_por_dia?.[day]?.comercios?.[commerceId]
    if (commerce && typeof commerce === 'object') locations.push({ uid, user, commerce })
  }
  return locations
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
      const hasCommercePhone = Object.prototype.hasOwnProperty.call(commerce, 'whatsapp')
      const realPhone = hasCommercePhone ? commerce.whatsapp : (user.whatsapp || user.telefono || '')
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

  if (Object.keys(byDay).length === 0 && (
    user.comercio_autorizado || user.comercio_foto_url || user.comercio_direccion || user.nombre_comercio || user.vender
  )) {
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
    const authorized = await canManageCommerces(rtdb, session)
    if (!authorized) {
      return NextResponse.json({ error: 'Tu solicitud aún está en espera de autorización.' }, { status: 403 })
    }

    const [snap, legacySnap] = await Promise.all([
      rtdb.ref('users').get(),
      rtdb.ref('rifas_usuarios').get(),
    ])
    const users = snap.exists() ? snap.val() || {} : {}
    const legacyUsers = legacySnap.exists() ? legacySnap.val() || {} : {}
    const identityProfilesByPhone = indexIdentityProfilesByPhone(legacyUsers, users)
    const comerciosPorDia = {}

    for (const [uid, user] of Object.entries(users)) {
      if (!user || typeof user !== 'object') continue
      const byDay = collectCommerceByDay(user, uid)
      for (const [day, value] of Object.entries(byDay)) {
        comerciosPorDia[day] = comerciosPorDia[day] || { dia: day, comercios: {} }
        for (const [commerceId, rawCommerce] of Object.entries(value.comercios || {})) {
          const commercePhone = canonPhone(rawCommerce?.whatsapp)
          const commerce = {
            ...rawCommerce,
            identity_verification: summarizeIdentityVerification([
              user,
              ...(identityProfilesByPhone.get(commercePhone) || []),
            ]),
          }
          const current = comerciosPorDia[day].comercios[commerceId]
          const currentUpdatedAt = Number(current?.actualizado_en || 0)
          const nextUpdatedAt = Number(commerce?.actualizado_en || 0)
          const currentHasValidPhone = canonPhone(current?.whatsapp).length >= 10
          const nextHasValidPhone = canonPhone(commerce?.whatsapp).length >= 10
          if (current && currentHasValidPhone !== nextHasValidPhone) {
            if (currentHasValidPhone) continue
            comerciosPorDia[day].comercios[commerceId] = commerce
            continue
          }
          if (current && currentUpdatedAt > nextUpdatedAt) continue
          comerciosPorDia[day].comercios[commerceId] = commerce
        }
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
    const originalRealtimeUid = cleanId(form.get('realtime_user_uid'))

    const { getAdminRealtimeDb, getAdminBucket, getAdminDb, STORAGE_BUCKET, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const firestore = getAdminDb()
    const authorized = await canManageCommerces(rtdb, session)
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
      whatsapp: commercePhone,
      telefono: commercePhone,
      vender: true,
      nombre_comercio: commerce.nombre_comercio,
      comercio_foto_url: commerce.comercio_foto_url,
      comercio_direccion: commerce.comercio_direccion,
      ...(hasCoords ? { comercio_lat: lat, comercio_lng: lng, comercio_ubicacion: `${lat}, ${lng}` } : {}),
      comercio_autorizado_actualizado_en: updatedAt,
      comercio_dia_actual: day,
      comercio_autorizado: commerce,
    }

    // Fuente de verdad: /users. Si el teléfono pertenece a una cuenta canónica,
    // se actualiza esa cuenta. De lo contrario se usa un id sintético del
    // comercio; nunca se crea un UID basado en el número telefónico.
    let usersPath
    let usersPatch
    if (hasValidPhone && owner?.uid) {
      usersPath = `${owner.path ? `${owner.path}/` : ''}${owner.uid}`
      usersPatch = { ...profilePatch, ...dayPatch }
    } else {
      usersPath = `users/${commerceId}`
      usersPatch = hasValidPhone
        ? { id: commerceId, sin_cuenta_vinculada: true, ...profilePatch, ...dayPatch }
        : { id: commerceId, sin_telefono: true, ...dayPatch }
    }

    const phoneKey = cleanPhone(commercePhone) || commerceId
    const realtimeUid = owner?.uid || commerceId
    const firestoreDocId = `${phoneKey}_${day}_${commerceId}`

    const [commerceLocations, firestoreMatches] = await Promise.all([
      requestedCommerceId ? findCommerceLocations(rtdb, day, commerceId) : Promise.resolve([]),
      requestedCommerceId
        ? firestore.collection(FIRESTORE_COLLECTION).where('comercio_id', '==', commerceId).get()
        : Promise.resolve({ docs: [] }),
    ])

    const realtimePatch = {}
    for (const [key, value] of Object.entries(usersPatch)) {
      realtimePatch[`${usersPath}/${key}`] = value
    }

    // Al cambiar el WhatsApp, el comercio puede pasar a otro /users/{uid}.
    // Borra las ubicaciones anteriores del mismo comercio y dia para que la
    // lista no vuelva a mostrar una copia con el numero viejo.
    for (const location of commerceLocations) {
      const locationPath = `users/${location.uid}`
      if (locationPath === usersPath) continue
      realtimePatch[`${locationPath}/comercios_por_dia/${day}/comercios/${commerceId}`] = null
      if (location.user.comercios_por_dia?.[day]?.comercio_actual_id === commerceId) {
        realtimePatch[`${locationPath}/comercios_por_dia/${day}/comercio_actual_id`] = null
      }
      if (location.user.comercio_autorizado?.comercio_id === commerceId) {
        realtimePatch[`${locationPath}/comercio_autorizado`] = null
        realtimePatch[`${locationPath}/comercio_dia_actual`] = null
        realtimePatch[`${locationPath}/nombre_comercio`] = null
        realtimePatch[`${locationPath}/comercio_foto_url`] = null
        realtimePatch[`${locationPath}/comercio_direccion`] = null
        realtimePatch[`${locationPath}/comercio_lat`] = null
        realtimePatch[`${locationPath}/comercio_lng`] = null
        realtimePatch[`${locationPath}/comercio_ubicacion`] = null
        realtimePatch[`${locationPath}/vender`] = null
      }
    }

    // Si el cliente conoce el nodo original pero era una copia incompleta, se
    // limpia igualmente aunque no haya aparecido en el escaneo anterior.
    if (originalRealtimeUid && `users/${originalRealtimeUid}` !== usersPath) {
      realtimePatch[`users/${originalRealtimeUid}/comercios_por_dia/${day}/comercios/${commerceId}`] = null
    }

    const commerceDoc = firestore.collection(FIRESTORE_COLLECTION).doc(firestoreDocId)
    const staleFirestoreDocs = firestoreMatches.docs.filter((doc) => {
      const data = doc.data() || {}
      return doc.id !== firestoreDocId && data.dia === day
    })

    await Promise.all([
      rtdb.ref().update(realtimePatch),
      commerceDoc.set({
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
      ...staleFirestoreDocs.map((doc) => doc.ref.delete()),
    ])
    await syncPublicProfilesFromUsers([
      realtimeUid,
      originalRealtimeUid,
      ...commerceLocations.map((location) => location.uid),
    ], { rtdb })

    return NextResponse.json({
      ok: true,
      dia: day,
      comercio_id: commerceId,
      comercio: {
        ...commerce,
        realtime_user_uid: realtimeUid,
        identity_verification: summarizeIdentityVerification(owner?.identityProfiles || [owner?.user]),
      },
      realtime_user_uid: realtimeUid,
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el comercio.' }, { status: 400 })
  }
}
