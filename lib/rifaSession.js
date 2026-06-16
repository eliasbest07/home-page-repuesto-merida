'use client'

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
    const updated = {
      ...local,
      telefono: data.telefono || local.telefono,
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
