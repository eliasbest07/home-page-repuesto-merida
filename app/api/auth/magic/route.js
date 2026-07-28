import { NextResponse } from 'next/server'
import { phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil } from '@/lib/perfilUsuario'
import { issueCanonicalFirebaseSession } from '@/lib/canonicalIdentity'
import {
  MagicLinkError,
  bindMagicLinkClaim,
  claimMagicLink,
  releaseMagicLinkClaim,
} from '@/lib/magicLinkClaim'

export const runtime = 'nodejs'

function cleanText(value, max = 180) {
  return String(value || '').trim().slice(0, max)
}

async function resolveGoogleUser(idToken) {
  const token = cleanText(idToken, 4096)
  if (!token) return null
  try {
    const { getAdminAuth } = await import('@/lib/firebaseAdmin')
    const auth = await getAdminAuth()
    const decoded = await auth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: cleanText(decoded.email, 180),
      nombre: cleanText(decoded.name, 120),
      foto_url: cleanText(decoded.picture, 500),
    }
  } catch {
    return null
  }
}

// El bot ya escribió magic_links/{token}. Esta primera fase reserva el enlace
// sin consumirlo; /complete lo marca usado únicamente tras comprobar que el
// navegador sí logró iniciar Firebase Auth.
export async function POST(request) {
  let claimed = null
  try {
    const { token, googleIdToken } = await request.json()
    claimed = await claimMagicLink(token)
    const data = claimed.data

    const telefono = data.telefono || data.numero || ''
    const key = phoneKey(telefono)
    if (!key) {
      return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 })
    }

    const googleUser = await resolveGoogleUser(googleIdToken)
    const identity = await issueCanonicalFirebaseSession({
      telefono,
      preferredAuthUid: googleUser?.uid || '',
      source: googleUser?.uid ? 'whatsapp_magic_google' : 'whatsapp_magic',
      profilePatch: googleUser?.uid ? {
        google_uid: googleUser.uid,
        google_email: googleUser.email,
        google_nombre: googleUser.nombre,
        google_foto: googleUser.foto_url,
        google_verificado_en: Date.now(),
      } : null,
    })
    await bindMagicLinkClaim({
      token: claimed.token,
      claimId: claimed.claimId,
      canonicalUid: identity.canonicalUid,
    })

    // Recupera el perfil: ya guardado (rifas_usuarios) o el oficial (/users).
    let { perfil, prefill } = await resolverPerfil({
      telefono,
      key,
      realtimeUid: identity.canonicalUid,
    })
    if (googleUser?.uid) {
      const googlePrefill = {
        uid: googleUser.uid,
        google_uid: googleUser.uid,
        google_email: googleUser.email,
        nombre: googleUser.nombre,
        foto_url: googleUser.foto_url,
      }
      perfil = perfil ? { ...googlePrefill, ...perfil } : perfil
      prefill = prefill ? { ...googlePrefill, ...prefill } : prefill || googlePrefill
    }

    let rifasVendedor = []
    const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    const vendSnap = await getAdminRealtimeDb().ref(`vendedor_index/${key}`).get()
    if (vendSnap.exists()) rifasVendedor = Object.keys(vendSnap.val() || {})

    const { token: jwt, expiresAt } = signRifaToken({
      sub: identity.canonicalUid,
      uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      ...(googleUser?.uid ? { google_uid: googleUser.uid } : {}),
      tel: key,
      telefono,
      auth_provider: googleUser?.uid ? 'google' : 'whatsapp',
    })

    return NextResponse.json({
      ok: true,
      telefono,
      perfil,
      prefill,
      rifas_vendedor: rifasVendedor,
      token: jwt,
      expiresAt,
      canonical_uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      firebaseCustomToken: identity.firebaseCustomToken,
      magic_claim: claimed.claimId,
      google: googleUser,
      redirect: data.redirect || '/',
    })
  } catch (err) {
    if (claimed) await releaseMagicLinkClaim(claimed).catch(() => {})
    if (err instanceof MagicLinkError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/auth/magic] No se pudo preparar la sesión:', err)
    return NextResponse.json({ error: 'No se pudo iniciar sesión. Intenta nuevamente.' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { token, claim } = await request.json().catch(() => ({}))
    await releaseMagicLinkClaim({ token, claimId: claim })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
