import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { verifyRifaToken, signRifaToken, shouldRefreshToken } from '@/lib/rifaJwt'
import { resolverPerfil, construirPerfil } from '@/lib/perfilUsuario'

async function resolveSessionProfile(payload, telefono, tel) {
  if (payload.auth_provider !== 'google' || !payload.uid) {
    return resolverPerfil({ telefono, key: tel })
  }

  const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
  const realtimeUid = payload.realtime_uid || payload.uid
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
    google_uid: payload.uid,
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
    const [{ perfil, prefill }, vendSnap] = await Promise.all([
      resolveSessionProfile(payload, telefono, tel),
      get(ref(rtdb, `vendedor_index/${tel}`)),
    ])
    const rifas_vendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []

    let outToken = token
    let expiresAt = payload.exp * 1000
    if (shouldRefreshToken(payload)) {
      const signed = signRifaToken({
        tel,
        telefono,
        ...(payload.uid ? { uid: payload.uid } : {}),
        ...(payload.realtime_uid ? { realtime_uid: payload.realtime_uid } : {}),
        ...(payload.auth_provider ? { auth_provider: payload.auth_provider } : {}),
      })
      outToken = signed.token
      expiresAt = signed.expiresAt
    }

    return NextResponse.json({
      ok: true,
      telefono: payload.telefono || null,
      tel,
      google_uid: payload.uid || '',
      realtime_uid: payload.realtime_uid || payload.uid || '',
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
