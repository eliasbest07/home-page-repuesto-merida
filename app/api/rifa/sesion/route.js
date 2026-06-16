import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { verifyRifaToken, signRifaToken, shouldRefreshToken } from '@/lib/rifaJwt'
import { resolverPerfil } from '@/lib/perfilUsuario'

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
      resolverPerfil({ telefono, key: tel }),
      get(ref(rtdb, `vendedor_index/${tel}`)),
    ])
    const rifas_vendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []

    let outToken = token
    let expiresAt = payload.exp * 1000
    if (shouldRefreshToken(payload)) {
      const signed = signRifaToken({ tel, telefono })
      outToken = signed.token
      expiresAt = signed.expiresAt
    }

    return NextResponse.json({
      ok: true,
      telefono: payload.telefono || null,
      tel,
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
