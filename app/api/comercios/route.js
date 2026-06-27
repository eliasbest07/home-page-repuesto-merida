import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMERCIOS_COLLECTION = 'comercios_autorizados'
const REPUESTOS_COLLECTION = 'comercio_repuestos'
const MAX_REPUESTOS = 1500

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

function num(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function validCoords(lat, lng) {
  return (
    lat != null && lng != null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

function cleanText(value, max = 200) {
  return String(value || '').trim().slice(0, max)
}

function serializeRepuesto(doc) {
  const data = doc.data() || {}
  const fotos = Array.isArray(data.fotos) ? data.fotos.filter(Boolean) : []
  return {
    id: doc.id,
    nombre: cleanText(data.nombre, 120) || 'Repuesto',
    marca: cleanText(data.marca, 60),
    modelo: cleanText(data.modelo, 80),
    anio: cleanText(data.anio, 10),
    precio: cleanText(data.precio, 40),
    nota: cleanText(data.nota, 240),
    foto_url: fotos[0] || '',
    tipo_vehiculo: data.tipo_vehiculo === 'moto' ? 'moto' : 'carro',
    comercio_id: cleanText(data.comercio_id, 80),
    _phone: canonPhone(data.telefono || data.comercio_whatsapp),
  }
}

export async function GET() {
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()

    const [comerciosSnap, repuestosSnap] = await Promise.all([
      db.collection(COMERCIOS_COLLECTION).get(),
      db
        .collection(REPUESTOS_COLLECTION)
        .limit(MAX_REPUESTOS)
        .get()
        .catch(() => ({ docs: [] })),
    ])

    // 1) Comercios autorizados. Un mismo comercio puede repetirse (uno por día);
    //    se deduplica por comercio_id, conservando el registro más reciente.
    const byCommerceId = new Map()
    comerciosSnap.forEach((doc) => {
      const d = doc.data() || {}
      const lat = num(d.comercio_lat)
      const lng = num(d.comercio_lng)
      const nombre = cleanText(d.nombre_comercio, 120)
      const foto = cleanText(d.comercio_foto_url, 500)

      // Ficha mínima: coordenadas + nombre + foto.
      if (!validCoords(lat, lng) || !nombre || !foto) return

      const comercioId = cleanText(d.comercio_id, 80) || doc.id
      const phone = canonPhone(d.whatsapp)
      const updated = num(d.actualizado_en_ms) || 0
      const prev = byCommerceId.get(comercioId)
      if (prev && prev._updated >= updated) return

      byCommerceId.set(comercioId, {
        id: comercioId,
        nombre,
        foto_url: foto,
        direccion: cleanText(d.comercio_direccion, 220),
        whatsapp: internationalPhone(d.whatsapp),
        tipo_vehiculo: d.tipo_vehiculo === 'moto' ? 'moto' : 'carro',
        lat,
        lng,
        repuestos: [],
        _phone: phone,
        _updated: updated,
      })
    })

    // Índice auxiliar por teléfono canónico (respaldo de enlace).
    const byPhone = new Map()
    for (const c of byCommerceId.values()) {
      if (c._phone) byPhone.set(c._phone, c)
    }

    // 2) Repuestos -> se enlazan por comercio_id; si no, por teléfono.
    const repuestos = repuestosSnap.docs.map(serializeRepuesto)
    for (const rep of repuestos) {
      const comercio =
        (rep.comercio_id && byCommerceId.get(rep.comercio_id)) ||
        (rep._phone && byPhone.get(rep._phone)) ||
        null
      if (!comercio) continue
      const { comercio_id, _phone, ...card } = rep
      comercio.repuestos.push(card)
    }

    const comercios = Array.from(byCommerceId.values())
      .map(({ _phone, _updated, ...c }) => ({ ...c, total_repuestos: c.repuestos.length }))

    return NextResponse.json({ ok: true, comercios })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'No se pudieron cargar los comercios.', comercios: [] },
      { status: 200 },
    )
  }
}
