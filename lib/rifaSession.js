'use client'

import { signInWithCustomToken, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const KEY = 'rifa_session'

export function phoneKey(phone = '') {
  return String(phone).replace(/\D/g, '')
}

export function saveSession(data) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() }))
}

export function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  // Limpia también restos del flujo de login para forzar carga fresca desde Firebase.
  try {
    localStorage.removeItem('login_redirect')
    localStorage.removeItem('login_google_pending')
  } catch {}
  // El JWT local y Firebase Auth forman una sola sesión lógica.
  void signOut(auth).catch(() => {})
}

export function isLoggedIn() {
  const s = getSession()
  if (!s?.token) return false
  if (s.expiresAt && Date.now() > s.expiresAt) return false
  return true
}

/**
 * Valida el token contra el servidor, auto-refresca si queda <1 día.
 * Devuelve la sesión actualizada o null si expiró/inválida.
 * Útil en useEffect de páginas protegidas.
 */
export async function ensureSession() {
  if (typeof window === 'undefined') return null
  const local = getSession()
  if (!local?.token) return null
  if (local.expiresAt && Date.now() > local.expiresAt) {
    clearSession()
    return null
  }
  try {
    const res = await fetch('/api/rifa/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: local.token }),
      cache: 'no-store',
    })
    if (res.status === 401) { clearSession(); return null }
    if (!res.ok) return local // backend caído: usa la sesión local mientras
    const data = await res.json()
    if (
      data.firebaseCustomToken
      && data.canonical_uid
      && auth.currentUser?.uid !== data.canonical_uid
    ) {
      const credential = await signInWithCustomToken(auth, data.firebaseCustomToken)
      if (credential.user.uid !== data.canonical_uid) {
        throw new Error('La identidad Firebase no coincide con la sesión.')
      }
    }
    const updated = {
      ...local,
      telefono: data.telefono || local.telefono,
      google_uid: data.google_uid || local.google_uid || null,
      canonical_uid: data.canonical_uid || local.canonical_uid || data.realtime_uid || local.realtime_uid || null,
      realtime_uid: data.realtime_uid || local.realtime_uid || null,
      perfil: data.perfil ?? local.perfil,
      prefill: data.prefill ?? local.prefill ?? null,
      rifas_vendedor: data.rifas_vendedor ?? local.rifas_vendedor ?? [],
      token: data.token,
      expiresAt: data.expiresAt,
    }
    saveSession(updated)
    return updated
  } catch {
    return local
  }
}
