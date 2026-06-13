import crypto from 'node:crypto'

export const WA_BROWSER_COOKIE = 'wa_browser_id'
export const WA_ALLOWED_INTENTS = ['login', 'rifa_vendedor']

const TOKEN_TTL_MS = 15 * 60 * 1000
const COOKIE_TTL_SECONDS = 30 * 24 * 60 * 60

function getSecret() {
  const secret =
    process.env.WA_CLIENT_KEY_SECRET ||
    process.env.RIFA_JWT_SECRET ||
    (process.env.NODE_ENV !== 'production' ? 'dev-wa-client-key-change-in-production' : '')
  if (secret.length < 32) {
    throw new Error('WA_CLIENT_KEY_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function createBrowserId() {
  return crypto.randomBytes(24).toString('base64url')
}

export function getBrowserCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_TTL_SECONDS,
  }
}

export function issueClientKey(browserId) {
  const now = Date.now()
  const payload = {
    sid: browserId,
    jti: crypto.randomUUID(),
    intents: WA_ALLOWED_INTENTS,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return {
    clientKey: `${encoded}.${sign(encoded)}`,
    expiresAt: payload.exp,
  }
}

export function verifyClientKey(token, browserId, intent) {
  if (!token || !browserId || !WA_ALLOWED_INTENTS.includes(intent)) return null
  const [encoded, signature, extra] = String(token).split('.')
  if (!encoded || !signature || extra || !safeEqual(sign(encoded), signature)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (
      payload.sid !== browserId ||
      !Array.isArray(payload.intents) ||
      !payload.intents.includes(intent) ||
      Date.now() >= Number(payload.exp || 0)
    ) return null
    return payload
  } catch {
    return null
  }
}

export function assertSameOrigin(request) {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false
  if (fetchSite === 'same-origin') return true

  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'

  try {
    const expectedHost =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host')
    return new URL(origin).host === expectedHost
  } catch {
    return false
  }
}

export function browserFingerprint(browserId) {
  return crypto.createHash('sha256').update(browserId).digest('hex').slice(0, 24)
}
