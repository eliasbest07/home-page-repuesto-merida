import { NextResponse } from 'next/server'
import { rtdb } from '@/lib/firebase'
import { ref, get } from 'firebase/database'
import { phoneKey } from '@/lib/whatsappAuth'
import { signRifaToken } from '@/lib/rifaJwt'
import { resolverPerfil, construirPerfil, canonPhone } from '@/lib/perfilUsuario'
import { issueCanonicalFirebaseSession } from '@/lib/canonicalIdentity'

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

function storedPhone(user = {}, fallbackKey = '') {
  const candidates = [user.whatsapp, user.telefono, user.phone, user.numero, user.id]
  if (/^[+\d\s().-]+$/.test(String(fallbackKey || ''))) candidates.push(fallbackKey)

  for (const value of candidates) {
    const clean = phoneKey(value)
    if (clean.length >= 10 && canonPhone(value).length >= 10) return String(value)
  }
  return ''
}

// Busca el usuario de Realtime Database vinculado a esta cuenta de Google.
// 1) /users/{uid}: usuarios del app Android (la clave del nodo es el uid de Google).
// 2) /users/*: nodo con google_uid/google_email igual (lo escribe el flujo magic).
// 3) rifas_usuarios: fallback legacy de vinculaciones antiguas.
// Devuelve tambien el nodo exacto para no mezclar perfiles que comparten telefono.
async function findLinkedUser({ uid, email }) {
  const { getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
  const adminRtdb = getAdminRealtimeDb()
  let directUserExists = false

  // 1) Registro oficial del app Android, indexado por uid de Google.
  if (uid) {
    const snap = await adminRtdb.ref(`users/${uid}`).get()
    if (snap.exists()) {
      directUserExists = true
      const u = snap.val() || {}
      const telefono = storedPhone(u)
      if (telefono) {
        return { telefono, key: phoneKey(telefono), realtimeUid: uid, user: u, source: 'users' }
      }
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
        const telefono = storedPhone(v, k)
        if (telefono) {
          return { telefono, key: phoneKey(telefono), realtimeUid: k, user: v, source: 'users' }
        }
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
        const telefono = storedPhone(v, key)
        if (telefono) return { telefono, key: phoneKey(telefono), user: v, source: 'rifas_usuarios' }
      }
    }
  }

  return directUserExists ? { missingPhone: true } : null
}

async function resolveLinkedProfile(linked, googleUid) {
  if (linked.source !== 'users' || !linked.user) {
    return resolverPerfil({ telefono: linked.telefono, key: linked.key })
  }

  const rifasSnap = await get(ref(rtdb, `rifas_usuarios/${linked.key}`))
  const rifas = rifasSnap.exists() ? rifasSnap.val() : null
  const { perfil, completo } = construirPerfil({
    telefono: linked.telefono,
    rifas,
    oficial: { uid: linked.realtimeUid, ...linked.user },
  })
  const exactProfile = {
    ...perfil,
    uid: linked.realtimeUid,
    google_uid: googleUid,
  }
  return completo
    ? { perfil: exactProfile, prefill: null }
    : { perfil: null, prefill: exactProfile }
}

export async function POST(request) {
  try {
    const { idToken } = await request.json().catch(() => ({}))
    const google = await verifyGoogle(idToken)
    if (!google?.uid) {
      return NextResponse.json({ error: 'No se pudo validar la cuenta de Google.' }, { status: 401 })
    }

    const linked = await findLinkedUser(google)
    if (!linked?.key) {
      return NextResponse.json({
        ok: true,
        linked: false,
        reason: linked?.missingPhone ? 'missing_phone' : 'not_found',
      })
    }

    const { telefono, key } = linked
    const identity = await issueCanonicalFirebaseSession({
      telefono,
      preferredAuthUid: google.uid,
      source: 'google',
      profilePatch: {
        google_uid: google.uid,
        google_email: google.email,
        google_verificado_en: Date.now(),
      },
    })
    linked.realtimeUid = identity.canonicalUid
    linked.user = identity.canonicalProfile
    linked.source = 'users'
    const [{ perfil, prefill }, vendSnap] = await Promise.all([
      resolveLinkedProfile(linked, google.uid),
      get(ref(rtdb, `vendedor_index/${key}`)),
    ])
    const rifas_vendedor = vendSnap.exists() ? Object.keys(vendSnap.val() || {}) : []
    const { token, expiresAt } = signRifaToken({
      sub: identity.canonicalUid,
      tel: key,
      telefono,
      uid: identity.canonicalUid,
      google_uid: google.uid,
      realtime_uid: identity.canonicalUid,
      auth_provider: 'google',
    })

    return NextResponse.json({
      ok: true,
      linked: true,
      google_uid: google.uid,
      canonical_uid: identity.canonicalUid,
      realtime_uid: identity.canonicalUid,
      firebaseCustomToken: identity.firebaseCustomToken,
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
