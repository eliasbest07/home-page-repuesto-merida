import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { verifyRifaToken, signRifaToken, shouldRefreshToken } from '@/lib/rifaJwt'
import { resolverPerfil, construirPerfil } from '@/lib/perfilUsuario'
import { issueCanonicalFirebaseSession } from '@/lib/canonicalIdentity'

async function resolveSessionProfile(payload, telefono, tel) {
  const realtimeUid = payload.realtime_uid || payload.uid
  if (!realtimeUid) return resolverPerfil({ telefono, key: tel })

  const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
  const userSnap = await getAdminRealtimeDb().ref(`users/${realtimeUid}`).get()
  if (!userSnap.exists()) return resolverPerfil({ telefono, key: tel })

  const rifasSnap = await get(ref(rtdb, `rifas_usuarios/${tel}`))
  const rifas = rifasSnap.exists() ? rifasSnap.val() : null
  const { perfil, completo } = construirPerfil({
    telefono,
    rifas,
    oficial: { uid: realtimeUid, ...(userSnap.val() || {}) },
  })
  const exactProfile = {
    ...perfil,
    uid: realtimeUid,
    ...(payload.google_uid ? { google_uid: payload.google_uid } : {}),
  }
  return completo
    ? { perfil: exactProfile, prefill: null }
    : { perfil: null, prefill: exactProfile }
}

export async function POST(request) {
  try {
    const { token } = await request.json().catch(() => ({}))
    const payload = verifyRifaToken(token)
    if (!payload?.tel) {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 })
    }

    const tel = payload.tel
    const telefono = payload.telefono || tel
    const identity = await issueCanonicalFirebaseSession({
      telefono,
      preferredAuthUid:
        payload.google_uid
        || (payload.auth_provider === 'google' ? payload.uid || '' : ''),
      source: payload.auth_provider === 'google' ? 'google_session' : 'whatsapp_session',
    })
    const canonicalPayload = {
      ...payload,
      sub: identity.canonicalUid,
      uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
    }
    const [{ perfil, prefill }, vendSnap] = await Promise.all([
      resolveSessionProfile(canonicalPayload, telefono, tel),
      get(ref(rtdb, `vendedor_index/${tel}`)),
    ])
    const rifas_vendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []

    let outToken = token
    let expiresAt = payload.exp * 1000
    if (
      shouldRefreshToken(payload)
      || payload.uid !== identity.canonicalUid
      || payload.realtime_uid !== identity.canonicalUid
    ) {
      const signed = signRifaToken({
        tel,
        telefono,
        sub: identity.canonicalUid,
        uid: identity.canonicalUid,
        realtime_uid: identity.canonicalUid,
        ...(payload.google_uid ? { google_uid: payload.google_uid } : {}),
        ...(payload.auth_provider ? { auth_provider: payload.auth_provider } : {}),
      })
      outToken = signed.token
      expiresAt = signed.expiresAt
    }

    return NextResponse.json({
      ok: true,
      telefono: payload.telefono || null,
      tel,
      google_uid: payload.google_uid || '',
      canonical_uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      firebaseCustomToken: identity.firebaseCustomToken,
      perfil,
      prefill,
      rifas_vendedor,
      token: outToken,
      expiresAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado' }, { status: 500 })
  }
}
