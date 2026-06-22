import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'comercios'
const MAX_FILE_SIZE = 5 * 1024 * 1024
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

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max)
}

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  const paths = ['users', '']

  for (const path of paths) {
    // El SDK Admin rechaza rtdb.ref('') ("path must be non-empty"); la raíz
    // se obtiene con ref() sin argumento.
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

export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const form = await request.formData()
    const foto = form.get('foto')
    const direccion = cleanText(form.get('direccion'), 200)
    const vender = String(form.get('vender')) === 'true'

    const latRaw = form.get('lat')
    const lngRaw = form.get('lng')
    const lat = latRaw === null || latRaw === '' ? null : Number(latRaw)
    const lng = lngRaw === null || lngRaw === '' ? null : Number(lngRaw)
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

    const { getAdminRealtimeDb, getAdminBucket, STORAGE_BUCKET } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()

    // Si llega un archivo nuevo lo subimos; si no, conservamos la URL existente.
    let fotoUrl = cleanText(form.get('foto_url'), 500)
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
      const storagePath = `${STORAGE_PREFIX}/${session.key}.${ext}`
      const buffer = Buffer.from(await foto.arrayBuffer())
      // Token de descarga (igual que getDownloadURL del cliente): la URL con
      // token sirve la imagen sin necesidad de que el bucket sea público.
      // El token cambia en cada subida, así que también rompe el caché.
      const downloadToken = crypto.randomUUID()
      await bucket.file(storagePath).save(buffer, {
        resumable: false,
        contentType: foto.type,
        metadata: {
          cacheControl: 'public, max-age=3600',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      })
      const encodedPath = encodeURIComponent(storagePath)
      fotoUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`
    }

    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const updatedAt = Date.now()

    const patch = {
      comercio_foto_url: fotoUrl,
      comercio_direccion: direccion,
      vender,
      ...(hasCoords
        ? { comercio_lat: lat, comercio_lng: lng, comercio_ubicacion: `${lat}, ${lng}` }
        : {}),
      comercio_actualizado_en: updatedAt,
    }

    // Fuente de verdad: /users (nodo existente de la app Android o /users/<telefono>
    // sembrando identidad). rifas_usuarios NO se escribe: es exclusivo de rifas.
    const usersPath = official?.uid
      ? `${official.path ? `${official.path}/` : ''}${official.uid}`
      : `users/${session.telefono}`
    const usersPatch = official?.uid
      ? patch
      : { whatsapp: session.telefono, telefono: session.telefono, id: session.telefono, ...patch }

    await rtdb.ref(usersPath).update(usersPatch)

    return NextResponse.json({ ok: true, comercio: patch, realtime_user_uid: official?.uid || session.telefono })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el comercio.' }, { status: 400 })
  }
}
