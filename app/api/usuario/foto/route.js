import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'perfiles'
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
    if (!foto || typeof foto.arrayBuffer !== 'function' || foto.size <= 0) {
      return NextResponse.json({ error: 'Falta la foto.' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(foto.type)) {
      return NextResponse.json({ error: 'La foto debe ser JPG, PNG o WebP.' }, { status: 400 })
    }
    if (foto.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'La foto debe pesar máximo 5 MB.' }, { status: 400 })
    }

    const { getAdminRealtimeDb, getAdminBucket, STORAGE_BUCKET } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const bucket = getAdminBucket()

    const ext = EXTENSIONS[foto.type] || 'jpg'
    const storagePath = `${STORAGE_PREFIX}/${session.key}.${ext}`
    const buffer = Buffer.from(await foto.arrayBuffer())
    // Token de descarga (igual que getDownloadURL): sirve la imagen sin que el
    // bucket sea público; cambia en cada subida, así rompe el caché.
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
    const fotoUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`

    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const patch = { foto_url: fotoUrl, foto: fotoUrl, foto_actualizada_en: Date.now() }

    await Promise.all([
      rtdb.ref(`rifas_usuarios/${session.key}`).update(patch),
      official?.uid
        ? rtdb.ref(`${official.path ? `${official.path}/` : ''}${official.uid}`).update(patch)
        : Promise.resolve(),
    ])

    return NextResponse.json({ ok: true, foto_url: fotoUrl })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar la foto.' }, { status: 400 })
  }
}
