import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import {
  getWhatsAppAuthBase,
  getWhatsAppAuthHeaders,
  normalizePhone,
  phoneKey,
} from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil } from '@/lib/perfilUsuario'
import {
  WA_BROWSER_COOKIE,
  assertSameOrigin,
  verifyClientKey,
} from '@/lib/whatsappCapability'
import { checkOtpVerificationRateLimit } from '@/lib/whatsappRateLimit'

// El BOT compara el código contra el que tiene escrito en Firebase para ese
// número. Si coincide, esta API emite el JWT de sesión (la web es la dueña de
// la sesión) y devuelve el perfil del usuario.
export async function POST(request) {
  try {
    if (!assertSameOrigin(request)) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
    }

    const body = await request.json()
    const telefono = normalizePhone(body?.telefono)
    const codigo = String(body?.codigo || '').trim()
    const browserId = cookies().get(WA_BROWSER_COOKIE)?.value

    if (!telefono || !/^\d{4}$/.test(codigo)) {
      return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 })
    }
    if (!verifyClientKey(body?.clientKey, browserId, 'login')) {
      return NextResponse.json({ error: 'Credencial de navegador inválida o expirada.' }, { status: 401 })
    }

    const key = phoneKey(telefono)
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const rateLimit = checkOtpVerificationRateLimit({ browserId, phoneKey: key, ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Demasiados intentos de verificación.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // El bot compara el código contra Firebase.
    let response
    try {
      response = await fetch(`${getWhatsAppAuthBase()}/auth/verificar-otp`, {
        method: 'POST',
        headers: getWhatsAppAuthHeaders(),
        body: JSON.stringify({ telefono, codigo }),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'No se pudo contactar el servicio de WhatsApp.' }, { status: 502 })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok) {
      return NextResponse.json(
        { error: data.error || 'No se pudo verificar el código.' },
        { status: response.status === 200 ? 401 : response.status }
      )
    }

    // Código correcto → recuperar perfil (guardado u oficial) y emitir el JWT.
    const { perfil, prefill } = await resolverPerfil({ telefono, key })

    let rifasVendedor = []
    const vendSnap = await get(ref(rtdb, `vendedor_index/${key}`))
    if (vendSnap.exists()) {
      rifasVendedor = Object.keys(vendSnap.val() || {})
    }

    const { token, expiresAt } = signRifaToken({ tel: key, telefono })

    return NextResponse.json({
      ok: true,
      telefono,
      perfil,
      prefill,
      rifas_vendedor: rifasVendedor,
      token,
      expiresAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
