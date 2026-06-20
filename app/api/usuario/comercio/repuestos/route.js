import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPUESTOS_COLLECTION = 'comercio_repuestos'
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

function cleanText(value, max = 120) {
  return String(value || '').trim().slice(0, max)
}

function cleanYear(value) {
  const year = cleanPhone(value).slice(0, 4)
  if (!year) return ''
  const n = Number(year)
  return n >= 1900 && n <= 2100 ? year : ''
}

function cleanPrice(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

// Slug ASCII para deduplicar modelos: "Toyota" -> "toyota".
function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function serializeRepuesto(doc) {
  const data = doc.data() || {}
  return {
    id: doc.id,
    marca: data.marca || '',
    modelo: data.modelo || '',
    anio: data.anio || '',
    nombre: data.nombre || '',
    nota: data.nota || '',
    precio: data.precio ?? null,
    creado_en: data.creado_en?.toMillis ? data.creado_en.toMillis() : null,
  }
}

export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const snap = await db.collection(REPUESTOS_COLLECTION).where('telefono', '==', session.telefono).get()
    const items = snap.docs
      .map(serializeRepuesto)
      .sort((a, b) => (b.creado_en ?? 0) - (a.creado_en ?? 0))

    return NextResponse.json({ ok: true, items })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudieron cargar los repuestos.' }, { status: 400 })
  }
}

export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const marca = cleanText(body.marca, 60)
    const modelo = cleanText(body.modelo, 80)
    const anio = cleanYear(body.anio)
    const nombre = cleanText(body.nombre, 120)
    const nota = cleanText(body.nota, 500)
    const precio = cleanPrice(body.precio)

    if (!marca) return NextResponse.json({ error: 'Selecciona la marca.' }, { status: 400 })
    if (!modelo) return NextResponse.json({ error: 'Escribe el modelo.' }, { status: 400 })
    if (!nombre) return NextResponse.json({ error: 'Escribe el nombre del repuesto.' }, { status: 400 })

    const { getAdminDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()

    const repuestoRef = db.collection(REPUESTOS_COLLECTION).doc()
    const repuestoData = {
      telefono: session.telefono,
      marca,
      modelo,
      anio,
      nombre,
      nota,
      precio,
      creado_en: adminFieldValue.serverTimestamp(),
    }

    // Modelo compartido para autocompletado: deduplicado por marca+modelo+anio.
    const modeloId = [slug(marca), slug(modelo), anio].filter(Boolean).join('_')
    const writes = [repuestoRef.set(repuestoData)]
    if (modeloId) {
      writes.push(
        db.collection(MODELOS_COLLECTION).doc(modeloId).set(
          {
            marca,
            marca_norm: slug(marca),
            modelo,
            anio,
            usos: adminFieldValue.increment(1),
            actualizado_en: adminFieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      )
    }
    await Promise.all(writes)

    return NextResponse.json({
      ok: true,
      item: { id: repuestoRef.id, marca, modelo, anio, nombre, nota, precio, creado_en: Date.now() },
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el repuesto.' }, { status: 400 })
  }
}

export async function DELETE(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const id = cleanText(new URL(request.url).searchParams.get('id'), 64)
    if (!id) return NextResponse.json({ error: 'Falta el id del repuesto.' }, { status: 400 })

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'No existe el repuesto.' }, { status: 404 })
    if ((snap.data()?.telefono || '') !== session.telefono) {
      return NextResponse.json({ error: 'No puedes borrar este repuesto.' }, { status: 403 })
    }
    await ref.delete()

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo borrar el repuesto.' }, { status: 400 })
  }
}
