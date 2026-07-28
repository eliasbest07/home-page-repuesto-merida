import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { get, ref } from 'firebase/database'

import { rtdb } from '@/lib/firebase'
import {
  getWhatsAppAuthBase,
  getWhatsAppAuthHeaders,
  normalizePhone,
  phoneKey,
} from '@/lib/whatsappAuth'
import { checkOtpVerificationRateLimit } from '@/lib/whatsappRateLimit'
import { verifyMobileAuthChallenge } from '@/lib/mobileAuthChallenge'
import { issueCanonicalFirebaseSession } from '@/lib/canonicalIdentity'
import { resolverPerfil } from '@/lib/perfilUsuario'
import { signRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanInstallId(value) {
  const installId = String(value || '').trim()
  return /^[a-zA-Z0-9_-]{16,128}$/.test(installId) ? installId : ''
}

async function verifiedGoogleIdentity(idToken) {
  const token = String(idToken || '').trim()
  if (!token || token.length > 4096) return null
  try {
    const { getAdminAuth } = await import('@/lib/firebaseAdmin')
    const decoded = await (await getAdminAuth()).verifyIdToken(token)
    const identities = decoded.firebase?.identities || {}
    const hasGoogleIdentity =
      decoded.firebase?.sign_in_provider === 'google.com'
      || Array.isArray(identities['google.com'])
    if (!hasGoogleIdentity) return null
    return {
      uid: decoded.uid,
      email: String(decoded.email || '').trim().toLowerCase().slice(0, 180),
    }
  } catch {
    return null
  }
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
    const codigo = String(body.codigo || '').trim()
    const installId = cleanInstallId(body.installId)
    const challenge = verifyMobileAuthChallenge(body.challenge, {
      installId,
      phoneKey: key,
    })
    if (!challenge || !/^\d{4}$/.test(codigo)) {
      return NextResponse.json({ error: 'Código o solicitud inválidos.' }, { status: 401 })
    }

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const browserId = `mobile:${crypto.createHash('sha256').update(installId).digest('hex').slice(0, 24)}`
    const rateLimit = checkOtpVerificationRateLimit({ browserId, phoneKey: key, ip })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Demasiados intentos de verificación.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
      )
    }

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

    const botData = await response.json().catch(() => ({}))
    if (!response.ok || !botData.ok) {
      return NextResponse.json(
        { error: botData.error || 'No se pudo verificar el código.' },
        { status: response.status === 200 ? 401 : response.status },
      )
    }

    const google = await verifiedGoogleIdentity(body.googleIdToken)
    const identity = await issueCanonicalFirebaseSession({
      telefono,
      preferredAuthUid: google?.uid || '',
      source: google?.uid ? 'whatsapp_otp_mobile_google' : 'whatsapp_otp_mobile',
      profilePatch: google?.uid ? {
        google_uid: google.uid,
        google_email: google.email,
        google_verificado_en: Date.now(),
      } : null,
    })
    const [{ perfil, prefill }, vendSnap] = await Promise.all([
      resolverPerfil({ telefono, key, realtimeUid: identity.canonicalUid }),
      get(ref(rtdb, `vendedor_index/${key}`)),
    ])
    const rifasVendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []
    const { token, expiresAt } = signRifaToken({
      sub: identity.canonicalUid,
      uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      tel: key,
      telefono,
      auth_provider: 'whatsapp',
    })

    return NextResponse.json({
      ok: true,
      telefono,
      canonical_uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      firebaseCustomToken: identity.firebaseCustomToken,
      google_uid: google?.uid || '',
      perfil,
      prefill,
      rifas_vendedor: rifasVendedor,
      token,
      expiresAt,
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Error inesperado.' }, { status: 500 })
  }
}
