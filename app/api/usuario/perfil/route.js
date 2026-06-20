import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function cleanYear(value) {
  const year = cleanPhone(value).slice(0, 4)
  if (!year) return ''
  const n = Number(year)
  return n >= 1900 && n <= 2100 ? year : ''
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

    const body = await request.json().catch(() => ({}))
    const tipoVehiculo = cleanText(body.tipo_vehiculo, 20).toLowerCase()
    const allowedType = ['carro', 'moto'].includes(tipoVehiculo) ? tipoVehiculo : ''
    const marca = cleanText(body.marca, 60)
    const modelo = cleanText(body.modelo, 80)
    const anio = cleanYear(body.anio)
    const ubicacionTexto = cleanText(body.ubicacion_texto, 180)
    const lat = body.lat === null || body.lat === undefined || body.lat === '' ? null : Number(body.lat)
    const lng = body.lng === null || body.lng === undefined || body.lng === '' ? null : Number(body.lng)
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

    const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const rtdb = getAdminRealtimeDb()
    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const updatedAt = Date.now()

    const patch = {
      tipo_vehiculo: allowedType,
      vehiculo_tipo: allowedType,
      marca,
      vehiculo_marca: marca,
      modelo,
      vehiculo_modelo: modelo,
      anio,
      vehiculo_anio: anio,
      ubicacion_texto: ubicacionTexto,
      ...(hasCoords ? { lat, lng, ubicacion: `${lat}, ${lng}` } : {}),
      perfil_actualizado_en: updatedAt,
    }

    await Promise.all([
      rtdb.ref(`rifas_usuarios/${session.key}`).update(patch),
      official?.uid ? rtdb.ref(`${official.path ? `${official.path}/` : ''}${official.uid}`).update(patch) : Promise.resolve(),
    ])

    return NextResponse.json({ ok: true, perfil: patch, realtime_user_uid: official?.uid || null })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el perfil.' }, { status: 400 })
  }
}
