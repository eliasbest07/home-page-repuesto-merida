import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get, remove, update } from 'firebase/database'
import { normalizePhone, phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { verifyOtpHash } from '@/lib/otpSecurity'
import {
  WA_BROWSER_COOKIE,
  assertSameOrigin,
  verifyClientKey,
} from '@/lib/whatsappCapability'
import { checkOtpVerificationRateLimit } from '@/lib/whatsappRateLimit'

const MAX_ATTEMPTS = 5

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

    const snap = await get(ref(rtdb, `rifas_otps/${key}`))
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Solicita un código primero.' }, { status: 404 })
    }
    const data = snap.val()
    if (Date.now() > Number(data.expira_en || 0)) {
      await remove(ref(rtdb, `rifas_otps/${key}`))
      return NextResponse.json({ error: 'El código expiró. Solicita uno nuevo.' }, { status: 410 })
    }
    if (Number(data.intentos || 0) >= MAX_ATTEMPTS) {
      await remove(ref(rtdb, `rifas_otps/${key}`))
      return NextResponse.json({ error: 'Demasiados intentos. Solicita otro código.' }, { status: 429 })
    }
    if (!verifyOtpHash(key, codigo, data.codigo)) {
      await update(ref(rtdb, `rifas_otps/${key}`), {
        intentos: Number(data.intentos || 0) + 1,
      })
      return NextResponse.json({ error: 'Código incorrecto.' }, { status: 401 })
    }

    await remove(ref(rtdb, `rifas_otps/${key}`))

    let perfil = null
    const perfilSnap = await get(ref(rtdb, `rifas_usuarios/${key}`))
    if (perfilSnap.exists()) perfil = perfilSnap.val()

    let rifasVendedor = []
    const vendSnap = await get(ref(rtdb, `vendedor_index/${key}`))
    if (vendSnap.exists()) {
      const v = vendSnap.val() || {}
      rifasVendedor = Object.keys(v)
    }

    const { token, expiresAt } = signRifaToken({ tel: key, telefono })

    return NextResponse.json({
      ok: true,
      telefono,
      tipo: data.tipo || 'usuario',
      rifa_id: data.rifa_id || null,
      perfil,
      rifas_vendedor: rifasVendedor,
      token,
      expiresAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
