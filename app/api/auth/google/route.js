import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil, canonPhone } from '@/lib/perfilUsuario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cleanText(value, max = 4096) {
  return String(value || '').trim().slice(0, max)
}

async function verifyGoogle(idToken) {
  const token = cleanText(idToken, 4096)
  if (!token) return null
  try {
    const { getAdminAuth } = await import('@/lib/firebaseAdmin')
    const auth = await getAdminAuth()
    const decoded = await auth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: cleanText(decoded.email, 180).toLowerCase(),
    }
  } catch {
    return null
  }
}

// Busca el WhatsApp ya vinculado a esta cuenta de Google.
// 1) /users/{uid}: usuarios del app Android (la clave del nodo es el uid de Google).
// 2) /users/*: nodo con google_uid/google_email igual (lo escribe el flujo magic).
// 3) rifas_usuarios: fallback legacy de vinculaciones antiguas.
// Devuelve { telefono, key } o null.
async function findLinkedPhone({ uid, email }) {
  const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
  const adminRtdb = getAdminRealtimeDb()

  // 1) Registro oficial del app Android, indexado por uid de Google.
  if (uid) {
    const snap = await adminRtdb.ref(`users/${uid}`).get()
    if (snap.exists()) {
      const u = snap.val() || {}
      const wa = u.whatsapp || ''
      if (canonPhone(wa)) return { telefono: wa, key: phoneKey(wa) }
    }
  }

  // 2) Vinculación previa en /users (fuente de verdad), por google_uid/email.
  const usersSnap = await adminRtdb.ref('users').get()
  if (usersSnap.exists()) {
    const all = usersSnap.val() || {}
    for (const [k, v] of Object.entries(all)) {
      if (!v || typeof v !== 'object') continue
      const matchUid = uid && v.google_uid === uid
      const matchEmail = email && String(v.google_email || '').toLowerCase() === email
      if (matchUid || matchEmail) {
        const wa = v.whatsapp || k
        return { telefono: wa, key: phoneKey(wa) }
      }
    }
  }

  // 3) Fallback legacy: vinculación antigua guardada en rifas_usuarios.
  const rifasSnap = await adminRtdb.ref('rifas_usuarios').get()
  if (rifasSnap.exists()) {
    const all = rifasSnap.val() || {}
    for (const [key, v] of Object.entries(all)) {
      if (!v || typeof v !== 'object') continue
      const matchUid = uid && v.google_uid === uid
      const matchEmail = email && String(v.google_email || '').toLowerCase() === email
      if (matchUid || matchEmail) {
        return { telefono: v.whatsapp || key, key }
      }
    }
  }

  return null
}

export async function POST(request) {
  try {
    const { idToken } = await request.json().catch(() => ({}))
    const google = await verifyGoogle(idToken)
    if (!google?.uid) {
      return NextResponse.json({ error: 'No se pudo validar la cuenta de Google.' }, { status: 401 })
    }

    const linked = await findLinkedPhone(google)
    if (!linked?.key) {
      // No tiene WhatsApp vinculado todavía: el cliente sigue con la verificación por WhatsApp.
      return NextResponse.json({ ok: true, linked: false })
    }

    const { telefono, key } = linked
    const [{ perfil, prefill }, vendSnap] = await Promise.all([
      resolverPerfil({ telefono, key }),
      get(ref(rtdb, `vendedor_index/${key}`)),
    ])
    const rifas_vendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []
    const { token, expiresAt } = signRifaToken({ tel: key, telefono })

    return NextResponse.json({
      ok: true,
      linked: true,
      telefono,
      perfil,
      prefill,
      rifas_vendedor,
      token,
      expiresAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Error inesperado.' }, { status: 500 })
  }
}
