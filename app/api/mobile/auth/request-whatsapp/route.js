import crypto from 'node:crypto'
import { NextResponse } from 'next/server'

import {
  getWhatsAppAuthBase,
  getWhatsAppAuthHeaders,
  normalizePhone,
  phoneKey,
} from '@/lib/whatsappAuth'
import { checkWhatsAppRateLimit } from '@/lib/whatsappRateLimit'
import { issueMobileAuthChallenge } from '@/lib/mobileAuthChallenge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanInstallId(value) {
  const installId = String(value || '').trim()
  return /^[a-zA-Z0-9_-]{16,128}$/.test(installId) ? installId : ''
}

export async function POST(request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 4096) {
      return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })
    }

    const body = await request.json().catch(() => ({}))
    const telefono = normalizePhone(body.telefono)
    const key = phoneKey(telefono)
    const installId = cleanInstallId(body.installId)
    if (!installId || key.length < 10 || key.length > 15) {
      return NextResponse.json({ error: 'Datos de acceso inválidos.' }, { status: 400 })
    }

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const browserId = `mobile:${crypto.createHash('sha256').update(installId).digest('hex').slice(0, 24)}`
    const rateLimit = checkWhatsAppRateLimit({ browserId, phoneKey: key, ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera antes de solicitar otro código.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

    let response
    try {
      response = await fetch(`${getWhatsAppAuthBase()}/auth/solicitar-otp`, {
        method: 'POST',
        headers: getWhatsAppAuthHeaders(),
        body: JSON.stringify({ telefono, intent: 'login' }),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'No se pudo contactar el servicio de WhatsApp.' }, { status: 502 })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'No se pudo enviar el código.' },
        { status: response.status },
      )
    }

    const challenge = issueMobileAuthChallenge({ installId, phoneKey: key })
    return NextResponse.json({ ok: true, ...challenge })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Error inesperado.' }, { status: 500 })
  }
}
