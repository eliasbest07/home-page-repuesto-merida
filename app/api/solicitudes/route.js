import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import {
  DATA_SCHEMA_VERSION,
  canonicalPhone,
  cleanPhone,
  identityIdForPhone,
  resolveRealtimeIdentities,
} from '@/lib/dataContractV2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value, max = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function bearer(request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function validYear(value) {
  const year = cleanPhone(value).slice(0, 4)
  const numeric = Number(year)
  return numeric >= 1900 && numeric <= 2100 ? year : ''
}

export async function POST(request) {
  try {
    const session = verifyRifaToken(bearer(request))
    const sessionPhone = session?.telefono || session?.tel
    const phone = canonicalPhone(sessionPhone)
    if (!session || phone.length < 10) {
      return NextResponse.json({ error: 'Inicia sesión para publicar la solicitud.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const repuesto = text(body.repuesto, 120)
    const tipoVehiculo = text(body.tipo_vehiculo, 20).toLowerCase()
    const marca = text(body.marca, 60).toLowerCase()
    const modelo = text(body.modelo, 80)
    const anio = validYear(body.anio)
    if (!repuesto || !marca || !modelo || !anio || !['carro', 'moto', 'bicicleta'].includes(tipoVehiculo)) {
      return NextResponse.json({ error: 'Revisa repuesto, vehículo, marca, modelo y año.' }, { status: 400 })
    }

    const requestedOperation = text(body.operation_id, 180)
    const operationId = requestedOperation || `web:${phone}:${crypto.randomUUID()}`
    const documentId = crypto.createHash('sha256').update(operationId).digest('hex')
    const { adminFieldValue, getAdminDb, getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const identities = await resolveRealtimeIdentities(getAdminRealtimeDb(), phone)
    const ownerUids = identities.map((identity) => identity.uid)
    const ownerUid = ownerUids[0] || ''
    const now = adminFieldValue.serverTimestamp()
    const db = getAdminDb()
    const ref = db.collection('solicitudes_repuestos').doc(documentId)
    const data = {
      schema_version: DATA_SCHEMA_VERSION,
      record_type: 'solicitud_repuesto',
      origen: 'web',
      operation_id: operationId,
      identity_id: identityIdForPhone(phone),
      owner_uid: ownerUid,
      owner_uids: ownerUids,
      // Compatibilidad con app/web/bot anteriores.
      id: Date.now(),
      contacto_id: phone,
      numero: phone,
      title: `+58${phone}`,
      uid: ownerUid,
      repuesto,
      tipo_vehiculo: tipoVehiculo,
      marca,
      modelo,
      anio,
      cantidad: '',
      estado: 'solicitado',
      confianza: 1,
      falta_info: '',
      destacada: false,
      notas: '',
      creado_en: now,
      actualizado_en: now,
    }

    const existing = await ref.get()
    if (!existing.exists) await ref.create(data)
    return NextResponse.json({ ok: true, id: ref.id, duplicated: existing.exists })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo publicar la solicitud.' }, { status: 500 })
  }
}
