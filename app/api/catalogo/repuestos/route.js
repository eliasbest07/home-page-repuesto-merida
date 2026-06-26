import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max)
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

function internationalPhone(raw) {
  const canon = canonPhone(raw)
  return canon ? `+58${canon}` : ''
}

function dataUrlParts(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/)
  if (!match) return null
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1]
  return { mime, ext, base64: match[2] }
}

async function resolveRegisteredProfile({ rtdb, telefono, key }) {
  const [rifasSnap, usersSnap] = await Promise.all([
    rtdb.ref(`rifas_usuarios/${key}`).get(),
    rtdb.ref('users').get(),
  ])
  const rifas = rifasSnap.exists() ? rifasSnap.val() : null
  const target = canonPhone(telefono || key)
  let official = null
  let officialUid = ''

  if (usersSnap.exists()) {
    const users = usersSnap.val() || {}
    for (const [uid, user] of Object.entries(users)) {
      if (user && canonPhone(user.whatsapp) === target) {
        official = user
        officialUid = uid
        break
      }
    }
  }

  // /users (oficial) es primario; rifas_usuarios queda como fallback legacy.
  return {
    uid: official?.uid || official?.id || officialUid || rifas?.uid || '',
    cedula: cleanText(official?.cedula || rifas?.cedula, 30),
    nombre: cleanText(official?.nombre || official?.google_nombre || rifas?.nombre, 120),
    whatsapp: cleanPhone(official?.whatsapp || rifas?.whatsapp || telefono || key),
    comercio_id: cleanText(official?.comercio_autorizado?.comercio_id || official?.comercio_id || '', 80),
    comercio_nombre: cleanText(official?.comercio_autorizado?.nombre_comercio || official?.nombre_comercio || official?.nombre || rifas?.nombre, 120),
    comercio_whatsapp: cleanPhone(official?.comercio_autorizado?.whatsapp || official?.whatsapp || telefono || key),
    comercio_direccion: cleanText(official?.comercio_autorizado?.comercio_direccion || official?.comercio_direccion, 220),
    comercio_lat: official?.comercio_autorizado?.comercio_lat ?? official?.comercio_lat ?? null,
    comercio_lng: official?.comercio_autorizado?.comercio_lng ?? official?.comercio_lng ?? null,
  }
}

export async function POST(request) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    const payload = verifyRifaToken(token)

    if (!payload?.tel) {
      return NextResponse.json({ error: 'Inicia sesión con WhatsApp para publicar.' }, { status: 401 })
    }

    const telefono = payload.telefono || payload.tel
    const {
      adminFieldValue,
      getAdminBucket,
      getAdminDb,
      getAdminRealtimeDb,
    } = await import('@/lib/firebaseAdmin')
    const perfil = await resolveRegisteredProfile({
      rtdb: getAdminRealtimeDb(),
      telefono,
      key: payload.tel,
    })

    if (!perfil?.cedula) {
      return NextResponse.json(
        { error: 'Completa tu perfil con cédula antes de publicar repuestos del catálogo.' },
        { status: 403 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const titulo = cleanText(body.titulo, 90)
    const categoria = cleanText(body.categoria, 60)
    const modelos = cleanText(body.modelos, 140)
    const descripcion = cleanText(body.descripcion, 500)
    const precio = cleanText(body.precio, 40)
    const vehiculo = cleanText(body.vehiculo, 120)
    const whatsapp = cleanPhone(telefono)
    const image = dataUrlParts(body.imagen)

    if (!titulo || !categoria || !modelos || !precio || !image) {
      return NextResponse.json(
        { error: 'Título, categoría, compatibilidad, precio e imagen son obligatorios.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(image.base64, 'base64')
    if (buffer.length <= 0 || buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'La imagen debe pesar máximo 5MB.' }, { status: 400 })
    }

    const db = getAdminDb()
    const docRef = db.collection('comercio_repuestos').doc()
    const storagePath = `comercio_repuestos/${docRef.id}/principal.${image.ext}`
    const downloadToken = crypto.randomUUID()
    const file = getAdminBucket().file(storagePath)

    await file.save(buffer, {
      contentType: image.mime,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    })

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
    const now = adminFieldValue.serverTimestamp()

    await docRef.set({
      telefono: whatsapp,
      telefono_normalizado: internationalPhone(whatsapp),
      comercio_id: perfil.comercio_id || '',
      dia: '',
      venta: categoria,
      tipo_vehiculo: vehiculo && /\bmoto\b/i.test(vehiculo) ? 'moto' : 'carro',
      marca: vehiculo || categoria,
      modelo: modelos,
      anio: '',
      nombre: titulo,
      nota: descripcion,
      precio,
      fotos: [publicUrl],
      aprobado: false,
      catalogo_id: '',
      destacado: true,
      fuente: 'catalogo_destacado',
      cedula: perfil.cedula,
      creado_por: payload.tel,
      comercio_nombre: perfil.comercio_nombre,
      comercio_whatsapp: perfil.comercio_whatsapp || whatsapp,
      comercio_direccion: perfil.comercio_direccion,
      comercio_lat: perfil.comercio_lat,
      comercio_lng: perfil.comercio_lng,
      creado_en: now,
      actualizado_en: now,
    })

    return NextResponse.json({ ok: true, id: docRef.id, image: publicUrl, estado: 'pendiente' })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'No se pudo publicar el repuesto.' }, { status: 500 })
  }
}
