import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODELOS_COLLECTION = 'modelos_vehiculos'

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
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

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Devuelve los modelos guardados para una marca, ordenados por uso, para
// autocompletar el campo modelo al crear un repuesto.
export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const marca = String(new URL(request.url).searchParams.get('marca') || '').trim()
    if (!marca) return NextResponse.json({ ok: true, items: [] })

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const snap = await db.collection(MODELOS_COLLECTION).where('marca_norm', '==', slug(marca)).get()
    const items = snap.docs
      .map((doc) => {
        const d = doc.data() || {}
        return { modelo: d.modelo || '', anio: d.anio || '', usos: Number(d.usos || 0) }
      })
      .filter((item) => item.modelo)
      .sort((a, b) => b.usos - a.usos || a.modelo.localeCompare(b.modelo))
      .slice(0, 100)

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudieron cargar los modelos.' }, { status: 400 })
  }
}
