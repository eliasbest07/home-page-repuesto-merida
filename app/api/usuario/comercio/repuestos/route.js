import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REPUESTOS_COLLECTION = 'comercio_repuestos'
const MODELOS_COLLECTION = 'modelos_vehiculos'
const CATALOGO_COLLECTION = 'merida'

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function phoneVariants(raw) {
  const clean = cleanPhone(raw)
  const canon = canonPhone(raw)
  return Array.from(new Set([
    clean,
    canon,
    canon ? `0${canon}` : '',
    canon ? `58${canon}` : '',
  ].filter(Boolean)))
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

// Precio como texto libre (ej. "10", "10 verdes", "Consultar"). Para mostrarlo
// se antepone "$" solo si es puramente numérico.
function priceLabel(value) {
  if (value === null || value === undefined || value === '') return 'Consultar'
  const s = String(value).trim()
  if (!s) return 'Consultar'
  return /^\d+(\.\d+)?$/.test(s) ? `$${s}` : s
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
    telefono: data.telefono || '',
    comercio_id: data.comercio_id || '',
    dia: data.dia || '',
    venta: data.venta || '',
    tipo_vehiculo: data.tipo_vehiculo || 'carro',
    marca: data.marca || '',
    modelo: data.modelo || '',
    anio: data.anio || '',
    nombre: data.nombre || '',
    nota: data.nota || '',
    precio: data.precio ?? '',
    fotos: Array.isArray(data.fotos) ? data.fotos : [],
    aprobado: Boolean(data.aprobado),
    catalogo_id: data.catalogo_id || '',
    creado_en: data.creado_en?.toMillis ? data.creado_en.toMillis() : null,
  }
}

async function commerceProfile(rtdb, session) {
  const phone = session.tel || session.telefono
  // Fuente primaria: /users/<telefono>. Si no existe (usuario viejo de la app
  // Android indexado por uid de Google), se busca por whatsapp. rifas_usuarios
  // queda como fallback legacy.
  const direct = await rtdb.ref(`users/${phone}`).get()
  if (direct.exists()) return direct.val() || {}

  const target = canonPhone(phone)
  const allUsers = await rtdb.ref('users').get()
  if (allUsers.exists()) {
    for (const user of Object.values(allUsers.val() || {})) {
      if (user && typeof user === 'object' && canonPhone(user.whatsapp) === target) return user
    }
  }

  const rifas = await rtdb.ref(`rifas_usuarios/${phone}`).get()
  return rifas.exists() ? rifas.val() || {} : {}
}

export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const requestedTelefono = cleanPhone(new URL(request.url).searchParams.get('telefono'))
    const variants = Array.from(new Set([
      ...phoneVariants(session.telefono),
      ...phoneVariants(session.tel),
      ...phoneVariants(requestedTelefono),
    ]))
    const snaps = await Promise.all(
      variants.map((telefono) => db.collection(REPUESTOS_COLLECTION).where('telefono', '==', telefono).get()),
    )
    const docsById = new Map()
    snaps.forEach((snap) => snap.docs.forEach((doc) => docsById.set(doc.id, doc)))
    const targets = new Set([
      canonPhone(session.telefono),
      canonPhone(session.tel),
      canonPhone(requestedTelefono),
    ].filter(Boolean))
    const items = Array.from(docsById.values())
      .map(serializeRepuesto)
      .filter((item) => !item.telefono || targets.has(canonPhone(item.telefono)))
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
    const comercioId = cleanText(body.comercio_id, 80)
    const dia = cleanText(body.dia, 20).toLowerCase()
    const venta = cleanText(body.venta, 80)
    const tipoVehiculo = cleanText(body.tipo_vehiculo, 20) === 'moto' ? 'moto' : 'carro'
    const marca = cleanText(body.marca, 60)
    const modelo = cleanText(body.modelo, 80)
    const anio = cleanYear(body.anio)
    const nombre = cleanText(body.nombre, 120)
    const nota = cleanText(body.nota, 500)
    const precio = cleanText(body.precio, 40)

    if (!marca) return NextResponse.json({ error: 'Selecciona la marca.' }, { status: 400 })
    if (!modelo) return NextResponse.json({ error: 'Escribe el modelo.' }, { status: 400 })
    if (!nombre) return NextResponse.json({ error: 'Escribe el nombre del repuesto.' }, { status: 400 })

    const { getAdminDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()

    const repuestoRef = db.collection(REPUESTOS_COLLECTION).doc()
    const repuestoData = {
      telefono: session.telefono,
      comercio_id: comercioId,
      dia,
      venta,
      tipo_vehiculo: tipoVehiculo,
      marca,
      modelo,
      anio,
      nombre,
      nota,
      precio,
      fotos: [],
      aprobado: false,
      catalogo_id: '',
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
      item: {
        id: repuestoRef.id,
        comercio_id: comercioId,
        dia,
        venta,
        tipo_vehiculo: tipoVehiculo,
        marca,
        modelo,
        anio,
        nombre,
        nota,
        precio,
        fotos: [],
        aprobado: false,
        catalogo_id: '',
        creado_en: Date.now(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo guardar el repuesto.' }, { status: 400 })
  }
}

export async function PATCH(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = cleanText(body.id, 64)
    if (!id) return NextResponse.json({ error: 'Falta el id del repuesto.' }, { status: 400 })
    const commerceId = cleanText(body.comercio_id, 80)
    const dia = cleanText(body.dia, 20).toLowerCase()
    const venta = cleanText(body.venta, 80)

    const { getAdminDb, getAdminRealtimeDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const ref = db.collection(REPUESTOS_COLLECTION).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return NextResponse.json({ error: 'No existe el repuesto.' }, { status: 404 })

    const item = snap.data() || {}
    const allowedPhones = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (item.telefono && !allowedPhones.has(canonPhone(item.telefono))) {
      return NextResponse.json({ error: 'No puedes aprobar este repuesto.' }, { status: 403 })
    }
    if (item.catalogo_id) {
      await ref.update({ aprobado: true, actualizado_en: adminFieldValue.serverTimestamp() })
      return NextResponse.json({ ok: true, catalogo_id: item.catalogo_id })
    }

    const profile = await commerceProfile(getAdminRealtimeDb(), session)
    const effectiveDia = item.dia || dia
    const effectiveCommerceId = item.comercio_id || commerceId
    const effectiveVenta = item.venta || venta
    const dayValue = effectiveDia ? profile.comercios_por_dia?.[effectiveDia] : null
    const dayCommerce = dayValue?.comercios && effectiveCommerceId
      ? dayValue.comercios[effectiveCommerceId]
      : dayValue
    const commerce = dayCommerce || profile.comercio_autorizado || profile
    const catalogRef = db.collection(CATALOGO_COLLECTION).doc()
    const now = adminFieldValue.serverTimestamp()
    // El catálogo usa las fotos propias del repuesto; si no tiene, cae a la del comercio.
    const repuestoFotos = Array.isArray(item.fotos) ? item.fotos.filter(Boolean) : []
    const fallbackImage = commerce.comercio_foto_url || profile.comercio_foto_url || ''
    const img = repuestoFotos.length ? repuestoFotos : (fallbackImage ? [fallbackImage] : [])

    await Promise.all([
      catalogRef.set({
        marca: item.nombre || 'Repuesto',
        categoria: effectiveVenta || 'Repuestos',
        modelos: [item.marca, item.modelo, item.anio].filter(Boolean).join(' '),
        descripcion: item.nota || '',
        vehiculo: item.tipo_vehiculo || 'carro',
        precio: priceLabel(item.precio),
        img,
        relevancia: '0',
        publicado: 'publicado',
        estado: 'disponible',
        whatsapp: commerce.whatsapp || session.telefono,
        userID: session.tel || session.telefono,
        propietario_id: session.tel || session.telefono,
        comercio: commerce.nombre_comercio || profile.nombre || '',
        comercio_direccion: commerce.comercio_direccion || '',
        comercio_lat: commerce.comercio_lat ?? null,
        comercio_lng: commerce.comercio_lng ?? null,
        comercio_repuesto_id: id,
        creado_en: now,
        actualizado_en: now,
      }),
      ref.update({
        aprobado: true,
        comercio_id: effectiveCommerceId || item.comercio_id || '',
        dia: effectiveDia || item.dia || '',
        venta: effectiveVenta || item.venta || '',
        catalogo_id: catalogRef.id,
        aprobado_en: now,
        actualizado_en: now,
      }),
    ])

    return NextResponse.json({ ok: true, catalogo_id: catalogRef.id })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo aprobar el repuesto.' }, { status: 400 })
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
    const allowedPhones = new Set([canonPhone(session.telefono), canonPhone(session.tel)].filter(Boolean))
    if (snap.data()?.telefono && !allowedPhones.has(canonPhone(snap.data()?.telefono))) {
      return NextResponse.json({ error: 'No puedes borrar este repuesto.' }, { status: 403 })
    }
    await ref.delete()

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo borrar el repuesto.' }, { status: 400 })
  }
}
