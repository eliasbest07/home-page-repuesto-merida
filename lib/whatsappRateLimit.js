const WINDOW_MS = 10 * 60 * 1000

const store = globalThis.__waRequestRateLimit || new Map()
globalThis.__waRequestRateLimit = store

function consume(key, limit, now) {
  const current = store.get(key)
  if (!current || now >= current.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, retryAfter: 0 }
  }
  if (current.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }
  current.count += 1
  return { ok: true, retryAfter: 0 }
}

export function checkWhatsAppRateLimit({ browserId, phoneKey, ip }) {
  const now = Date.now()
  const checks = [
    consume(`browser:${browserId}`, 8, now),
    consume(`phone:${phoneKey}`, 3, now),
    consume(`ip:${ip || 'unknown'}`, 12, now),
  ]
  const blocked = checks.find((result) => !result.ok)
  return blocked || { ok: true, retryAfter: 0 }
}

export function checkOtpVerificationRateLimit({ browserId, phoneKey, ip }) {
  const now = Date.now()
  const checks = [
    consume(`verify-browser:${browserId}`, 15, now),
    consume(`verify-phone:${phoneKey}`, 10, now),
    consume(`verify-ip:${ip || 'unknown'}`, 30, now),
  ]
  const blocked = checks.find((result) => !result.ok)
  return blocked || { ok: true, retryAfter: 0 }
}
