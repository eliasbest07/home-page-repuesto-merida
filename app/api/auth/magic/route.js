import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import {
  getWhatsAppAuthBase,
  getWhatsAppAuthHeaders,
  phoneKey,
} from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'

// Consume el enlace mágico: el BOT valida el token (un solo uso) contra
// Firebase; si es válido, esta API emite el JWT de sesión para ese número y
// devuelve a dónde redirigir (el debate de la solicitud).
export async function POST(request) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 })
    }

    let response
    try {
      response = await fetch(`${getWhatsAppAuthBase()}/auth/consumir-magic`, {
        method: 'POST',
        headers: getWhatsAppAuthHeaders(),
        body: JSON.stringify({ token }),
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json({ error: 'No se pudo contactar el servicio de WhatsApp.' }, { status: 502 })
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.ok || !data.telefono) {
      return NextResponse.json(
        { error: data.error || 'No se pudo validar el enlace.' },
        { status: response.status === 200 ? 401 : response.status }
      )
    }

    const key = phoneKey(data.telefono)

    let perfil = null
    const perfilSnap = await get(ref(rtdb, `rifas_usuarios/${key}`))
    if (perfilSnap.exists()) perfil = perfilSnap.val()

    let rifasVendedor = []
    const vendSnap = await get(ref(rtdb, `vendedor_index/${key}`))
    if (vendSnap.exists()) rifasVendedor = Object.keys(vendSnap.val() || {})

    const { token: jwt, expiresAt } = signRifaToken({ tel: key, telefono: data.telefono })

    return NextResponse.json({
      ok: true,
      telefono: data.telefono,
      perfil,
      rifas_vendedor: rifasVendedor,
      token: jwt,
      expiresAt,
      redirect: data.redirect || '/solicitados',
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
