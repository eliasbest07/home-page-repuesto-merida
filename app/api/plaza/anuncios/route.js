import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['vende', 'ofrece_servicio', 'empleo_oferta', 'busca'])

function cleanText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanTitle(value) {
  const title = cleanText(value, 90)
  return title ? title[0].toLocaleUpperCase('es-VE') + title.slice(1) : ''
}

function canonPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('58') && digits.length >= 12) digits = digits.slice(2)
  return digits.replace(/^0+/, '')
}

function parseImage(dataUrl) {
  if (!dataUrl) return null
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/)
  if (!match) throw new Error('La imagen debe ser JPG, PNG o WebP.')
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  return { mime, ext: mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1], buffer: Buffer.from(match[2], 'base64') }
}

async function verifiedProfile(rtdb, phone) {
  const target = canonPhone(phone)
  const snapshot = await rtdb.ref('users').get()
  if (!snapshot.exists()) return null
  return Object.values(snapshot.val() || {}).find(user =>
    user && canonPhone(user.whatsapp) === target && Boolean(user.cedula || user.cedula_estado === 'aprobado')
  ) || null
}

export async function POST(request) {
  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const payload = verifyRifaToken(token)
    if (!payload?.tel) return NextResponse.json({ error: 'Inicia sesión para publicar.' }, { status: 401 })

    const { adminFieldValue, getAdminBucket, getAdminDb, getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const phone = payload.telefono || payload.tel
    if (!await verifiedProfile(getAdminRealtimeDb(), phone)) {
      return NextResponse.json({ error: 'Necesitas una cédula verificada para publicar.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const tipo = cleanText(body.tipo, 40)
    const titulo = cleanTitle(body.titulo)
    const descripcion = cleanText(body.descripcion, 1000)
    const categoria = cleanText(body.categoria, 60)
    const precio = Number(body.precio)
    const image = parseImage(body.imagen)

    if (!ALLOWED_TYPES.has(tipo) || !titulo || !descripcion || !categoria || !Number.isFinite(precio) || precio < 0) {
      return NextResponse.json({ error: 'Revisa los datos obligatorios del anuncio.' }, { status: 400 })
    }
    if (image && (image.buffer.length <= 0 || image.buffer.length > MAX_IMAGE_BYTES)) {
      return NextResponse.json({ error: 'La imagen debe pesar máximo 5MB.' }, { status: 400 })
    }

    const db = getAdminDb()
    const docRef = db.collection('anuncios').doc()
    let imageUrl = null
    if (image) {
      const path = `imagenes_anuncios/${docRef.id}.${image.ext}`
      const file = getAdminBucket().file(path)
      const downloadToken = crypto.randomUUID()
      await file.save(image.buffer, {
        contentType: image.mime,
        metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: downloadToken } },
      })
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`
    }

    const now = adminFieldValue.serverTimestamp()
    const telefono = String(phone)
    await docRef.set({
      tipo, titulo, descripcion, precio, categoria,
      disponible: true,
      aprobado: false,
      estado_aprobacion: 'pendiente',
      fuente: 'web_usuario',
      prioridad: 'media',
      telefono,
      whatsapp: telefono,
      vendedor: telefono,
      redes: [],
      pagos: [],
      imagen_url: imageUrl,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ ok: true, id: docRef.id, estado: 'pendiente' })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo enviar el anuncio.' }, { status: 500 })
  }
}
