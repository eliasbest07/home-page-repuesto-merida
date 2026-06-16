import { NextResponse } from 'next/server'
import { firestore, rtdb } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, get } from 'firebase/database'
import { phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil } from '@/lib/perfilUsuario'

// Consume el enlace mágico leyendo Firebase DIRECTAMENTE (no llama al bot).
// El bot ya escribió en Firestore (magic_links/{token}) la autorización para
// ese número. Aquí la web comprueba esa autorización, marca el token como
// usado (un solo uso) y emite el JWT de sesión.
export async function POST(request) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 })
    }

    const linkRef = doc(firestore, 'magic_links', token)
    const snap = await getDoc(linkRef)
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Enlace inválido.' }, { status: 404 })
    }
    const data = snap.data() || {}

    if (data.usado) {
      return NextResponse.json({ error: 'Este enlace ya fue usado.' }, { status: 410 })
    }
    if (Date.now() > Number(data.expira_en || 0)) {
      return NextResponse.json({ error: 'El enlace expiró. Pide uno nuevo por WhatsApp.' }, { status: 410 })
    }

    const telefono = data.telefono || data.numero || ''
    const key = phoneKey(telefono)
    if (!key) {
      return NextResponse.json({ error: 'Enlace inválido.' }, { status: 400 })
    }

    // Un solo uso: marcar usado (la regla solo permite tocar usado/usado_en).
    await updateDoc(linkRef, { usado: true, usado_en: Date.now() })

    // Recupera el perfil: ya guardado (rifas_usuarios) o el oficial (/users).
    const { perfil, prefill } = await resolverPerfil({ telefono, key })

    let rifasVendedor = []
    const vendSnap = await get(ref(rtdb, `vendedor_index/${key}`))
    if (vendSnap.exists()) rifasVendedor = Object.keys(vendSnap.val() || {})

    const { token: jwt, expiresAt } = signRifaToken({ tel: key, telefono })

    return NextResponse.json({
      ok: true,
      telefono,
      perfil,
      prefill,
      rifas_vendedor: rifasVendedor,
      token: jwt,
      expiresAt,
      redirect: data.redirect || '/',
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
