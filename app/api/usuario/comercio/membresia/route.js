import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { findAuthorizedCommerceByPhone } from '@/lib/comercioPublicationPolicy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMERCIOS_COLLECTION = 'comercios_autorizados'

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export async function GET(request) {
  try {
    const payload = verifyRifaToken(bearerToken(request))
    const telefono = cleanPhone(payload?.telefono || payload?.tel)
    if (!payload || telefono.length < 10) {
      return NextResponse.json({ ok: false, autorizado: false }, { status: 401 })
    }

    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const snap = await getAdminDb().collection(COMERCIOS_COLLECTION).get()

    // Coincide si el teléfono de la sesión es el WhatsApp/dueño de algún comercio
    // autorizado. El whatsapp puede venir como placeholder, así que se comparan
    // los varios campos de teléfono del documento.
    const commerces = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    const autorizado = Boolean(findAuthorizedCommerceByPhone(commerces, telefono))

    return NextResponse.json({ ok: true, autorizado })
  } catch (error) {
    return NextResponse.json({ ok: false, autorizado: false, error: error?.message || 'Error' }, { status: 200 })
  }
}
