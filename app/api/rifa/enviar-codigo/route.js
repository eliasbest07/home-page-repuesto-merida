import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { get, ref, set, serverTimestamp } from 'firebase/database'
import { normalizePhone, phoneKey } from '@/lib/whatsappAuth'
import { encryptJson } from '@/lib/secureJson'
import { hashOtp } from '@/lib/otpSecurity'
import {
  WA_BROWSER_COOKIE,
  assertSameOrigin,
  browserFingerprint,
  verifyClientKey,
} from '@/lib/whatsappCapability'
import { checkWhatsAppRateLimit } from '@/lib/whatsappRateLimit'
import { verifyRifaToken } from '@/lib/rifaJwt'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 min

function generarCodigo() {
  return String(crypto.randomInt(1000, 10000))
}

function numeroVE(input) {
  let d = String(input).replace(/\D/g, '')
  if (d.startsWith('58')) return d
  if (d.startsWith('0'))  return '58' + d.slice(1)
  if (d.length === 10 && d.startsWith('4')) return '58' + d
  return d
}

function getBotConfig() {
  const botUrl =
    process.env.WA_BOT_SEND_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://localhost:4003/api/wa/send' : '')
  const masterKey = process.env.WA_ENCRYPTION_MASTER_KEY || ''
  if (!botUrl) throw new Error('WA_BOT_SEND_URL no está configurada.')
  if (masterKey.length < 32) {
    throw new Error('WA_ENCRYPTION_MASTER_KEY no está configurada correctamente.')
  }
  return { botUrl, masterKey }
}

async function enviarPorBot({ telefono, codigo, mensaje, intent, browserId }) {
  const { botUrl, masterKey } = getBotConfig()
  const numero = numeroVE(telefono)
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.WA_BOT_AUTH) headers['Authorization'] = process.env.WA_BOT_AUTH

  const issuedAt = new Date()
  const encryptedBody = encryptJson({
    version: 1,
    requestId: crypto.randomUUID(),
    browserKeyId: browserFingerprint(browserId),
    numero,
    intencion: intent,
    codigo,
    mensaje,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 2 * 60 * 1000).toISOString(),
  }, masterKey)

  const res = await fetch(botUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'X-Payload-Format': 'cifrando-json-v1',
    },
    body: JSON.stringify(encryptedBody),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Bot WhatsApp error ${res.status}`)
  }
  return { ok: true, numero }
}

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
    const tipo = intent === 'rifa_vendedor' ? 'vendedor' : 'usuario'
    const rifaId = body?.rifa_id || null
    const browserId = cookies().get(WA_BROWSER_COOKIE)?.value
    const capability = verifyClientKey(body?.clientKey, browserId, intent)

    if (!telefono) {
      return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 400 })
    }
    if (!capability) {
      return NextResponse.json({ error: 'Credencial de navegador inválida o expirada.' }, { status: 401 })
    }
    if (tipo === 'vendedor' && !rifaId) {
      return NextResponse.json({ error: 'Falta el ID de la rifa.' }, { status: 400 })
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

    if (intent === 'rifa_vendedor') {
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

    const codigo = generarCodigo()
    const expira_en = Date.now() + OTP_TTL_MS

    await set(ref(rtdb, `rifas_otps/${key}`), {
      codigo: hashOtp(key, codigo),
      expira_en,
      tipo,
      rifa_id: rifaId,
      telefono,
      intent,
      intentos: 0,
      creado_en: serverTimestamp(),
    })

    const mensaje = tipo === 'vendedor'
      ? `🔧 Repuestos Mérida — Tu código de vendedor de rifa es: *${codigo}*\nVálido por 10 minutos.`
      : `🔧 Repuestos Mérida — Tu código de acceso es: *${codigo}*\nVálido por 10 minutos.`

    try {
      await enviarPorBot({ telefono, codigo, mensaje, intent, browserId })
    } catch (err) {
      return NextResponse.json({ error: err.message || 'No se pudo enviar el código.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
