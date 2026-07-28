import 'server-only'

import crypto from 'node:crypto'

const TTL_MS = 15 * 60 * 1000

function getSecret() {
  const secret =
    process.env.WA_CLIENT_KEY_SECRET
    || process.env.RIFA_JWT_SECRET
    || (process.env.NODE_ENV !== 'production' ? 'dev-mobile-auth-secret-change-now' : '')
  if (secret.length < 32) {
    throw new Error('WA_CLIENT_KEY_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

function signature(encoded) {
  return crypto.createHmac('sha256', getSecret()).update(encoded).digest('base64url')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function deviceHash(installId) {
  return crypto.createHash('sha256').update(String(installId)).digest('hex').slice(0, 32)
}

export function issueMobileAuthChallenge({ installId, phoneKey }) {
  const now = Date.now()
  const payload = {
    device: deviceHash(installId),
    phone: phoneKey,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + TTL_MS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return {
    challenge: `${encoded}.${signature(encoded)}`,
    expiresAt: payload.exp,
  }
}

export function verifyMobileAuthChallenge(token, { installId, phoneKey }) {
  const [encoded, signed, extra] = String(token || '').split('.')
  if (!encoded || !signed || extra || !safeEqual(signature(encoded), signed)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      payload.device !== deviceHash(installId)
      || payload.phone !== phoneKey
      || Date.now() >= Number(payload.exp || 0)
    ) return null
    return payload
  } catch {
    return null
  }
}
