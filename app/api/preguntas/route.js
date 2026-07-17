import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import {
  DATA_SCHEMA_VERSION,
  canonicalPhone,
  identityIdForPhone,
  resolveRealtimeIdentities,
} from '@/lib/dataContractV2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function bearer(request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export async function POST(request) {
  try {
    const session = verifyRifaToken(bearer(request))
    const phone = canonicalPhone(session?.telefono || session?.tel)
    if (!session || phone.length < 10) {
      return NextResponse.json({ error: 'Inicia sesión para registrar la pregunta.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const productId = text(body.producto_id || body.idPublicacion, 128)
    const question = text(body.pregunta || body.texto, 500)
    const productName = text(body.producto_nombre, 120)
    const sellerId = text(body.vendedor_id || body.vendedorId, 128)
    if (!productId || !question) {
      return NextResponse.json({ error: 'Falta la publicación o la pregunta.' }, { status: 400 })
    }

    const { adminFieldValue, getAdminDb, getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const identities = await resolveRealtimeIdentities(getAdminRealtimeDb(), phone)
    const authorUid = identities[0]?.uid || identityIdForPhone(phone)
    const operationId = text(body.operation_id, 180) || `web:${authorUid}:${crypto.randomUUID()}`
    const ref = getAdminDb().collection('preguntas_repuestos').doc(
      crypto.createHash('sha256').update(operationId).digest('hex'),
    )
    const existing = await ref.get()
    if (!existing.exists) {
      const now = adminFieldValue.serverTimestamp()
      await ref.create({
        schema_version: DATA_SCHEMA_VERSION,
        record_type: 'pregunta_repuesto',
        origen: 'web',
        operation_id: operationId,
        autor_identity_id: identityIdForPhone(phone),
        autor_uid: authorUid,
        uid: authorUid,
        producto_id: productId,
        idPublicacion: productId,
        producto_nombre: productName,
        vendedor_id: sellerId,
        vendedorId: sellerId,
        pregunta: question,
        texto: question,
        nombre: text(session.nombre || identities[0]?.profile?.nombre || 'Usuario', 80),
        foto: '',
        imagen: '',
        respuesta: '',
        respondida: false,
        creado_en: now,
        actualizado_en: now,
      })
    }
    return NextResponse.json({ ok: true, id: ref.id, duplicated: existing.exists })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo registrar la pregunta.' }, { status: 500 })
  }
}
