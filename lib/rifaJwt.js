import crypto from 'crypto'

const SECRET = process.env.RIFA_JWT_SECRET || 'dev-rifa-secret-CHANGE-IN-PRODUCTION'
const TTL_MS = 2 * 24 * 60 * 60 * 1000 // 2 días
const REFRESH_WHEN_REMAINING_MS = 1 * 24 * 60 * 60 * 1000 // refresca si queda <1 día

if (!process.env.RIFA_JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[rifa] RIFA_JWT_SECRET no está configurada en producción — usar un secreto seguro')
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export function signRifaToken(payload, ttlMs = TTL_MS) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Date.now()
  const expMs = now + ttlMs
  const full = { ...payload, iat: Math.floor(now / 1000), exp: Math.floor(expMs / 1000) }
  const h = b64url(JSON.stringify(header))
  const p = b64url(JSON.stringify(full))
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  return { token: `${h}.${p}.${sig}`, expiresAt: expMs }
}

export function verifyRifaToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  if (!safeEq(expected, s)) return null
  try {
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'))
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}

export function shouldRefreshToken(payload) {
  if (!payload?.exp) return false
  const expMs = payload.exp * 1000
  return (expMs - Date.now()) < REFRESH_WHEN_REMAINING_MS
}

function safeEq(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
