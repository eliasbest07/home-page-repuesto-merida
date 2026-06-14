import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { get, ref } from 'firebase/database'
import {
  getWhatsAppAuthBase,
  getWhatsAppAuthHeaders,
  normalizePhone,
  phoneKey,
} from '@/lib/whatsappAuth'
import {
  WA_BROWSER_COOKIE,
  assertSameOrigin,
  verifyClientKey,
} from '@/lib/whatsappCapability'
import { checkWhatsAppRateLimit } from '@/lib/whatsappRateLimit'
import { verifyRifaToken } from '@/lib/rifaJwt'

// El BOT es la autoridad del OTP: genera el código, lo escribe en Firebase
// para ese número y lo envía por WhatsApp. Aquí solo validamos la petición
// (mismo origen, credencial de navegador, rate-limit y permisos) y delegamos.
export async function POST(request) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
    }

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 4096) {
      return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })
    }

    const body = await request.json()
    const telefono = normalizePhone(body?.telefono)
    const intent = String(body?.intent || '')
    const rifaId = body?.rifa_id || null
    const browserId = cookies().get(WA_BROWSER_COOKIE)?.value
    const capability = verifyClientKey(body?.clientKey, browserId, intent)

    if (!telefono) {
      return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 400 })
    }
    if (!capability) {
      return NextResponse.json({ error: 'Credencial de navegador inválida o expirada.' }, { status: 401 })
    }

    const key = phoneKey(telefono)
    if (key.length < 8 || key.length > 15) {
      return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 400 })
    }

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const rateLimit = checkWhatsAppRateLimit({ browserId, phoneKey: key, ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera antes de solicitar otro código.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // Permisos según la intención.
    if (intent === 'rifa_vendedor') {
      if (!rifaId) {
        return NextResponse.json({ error: 'Falta el ID de la rifa.' }, { status: 400 })
      }
      const session = verifyRifaToken(body?.sessionToken)
      if (!session?.tel) {
        return NextResponse.json({ error: 'Debes iniciar sesión para asignar vendedores.' }, { status: 401 })
      }
      const rifaSnap = await get(ref(rtdb, `rifas/${rifaId}`))
      const rifa = rifaSnap.exists() ? rifaSnap.val() : null
      if (!rifa || phoneKey(rifa.creador_key || rifa.creador) !== phoneKey(session.tel)) {
        return NextResponse.json({ error: 'No tienes permiso para modificar esta rifa.' }, { status: 403 })
      }
    } else if (intent !== 'login') {
      return NextResponse.json({ error: 'Intención no permitida.' }, { status: 400 })
    }

    // Delega al bot: genera + escribe en Firebase + envía por WhatsApp.
    let response
    try {
      response = await fetch(`${getWhatsAppAuthBase()}/auth/solicitar-otp`, {
        method: 'POST',
        headers: getWhatsAppAuthHeaders(),
        body: JSON.stringify({ telefono, intent }),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'No se pudo contactar el servicio de WhatsApp.' }, { status: 502 })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'No se pudo enviar el código.' },
        { status: response.status }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
