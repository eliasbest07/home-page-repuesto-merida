import { NextResponse } from 'next/server'
import { firestore, rtdb } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, get } from 'firebase/database'
import { phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil } from '@/lib/perfilUsuario'
import { issueCanonicalFirebaseSession } from '@/lib/canonicalIdentity'

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

// Consume el enlace mágico leyendo Firebase DIRECTAMENTE (no llama al bot).
// El bot ya escribió en Firestore (magic_links/{token}) la autorización para
// ese número. Aquí la web comprueba esa autorización, marca el token como
// usado (un solo uso) y emite el JWT de sesión.
export async function POST(request) {
  try {
    const { token, googleIdToken } = await request.json()
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
    const vendSnap = await get(ref(rtdb, `vendedor_index/${key}`))
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
      google: googleUser,
      redirect: data.redirect || '/',
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
