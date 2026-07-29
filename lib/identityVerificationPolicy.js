export const IDENTITY_VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000
export const IDENTITY_VERIFICATION_USER_LIMIT = 5
export const IDENTITY_VERIFICATION_IP_LIMIT = 20
export const IDENTITY_VERIFICATION_LOCK_MS = 5 * 60 * 1000

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function isIdentityVerificationApproved(profile = {}, verification = {}) {
  const profileStatus = String(profile?.cedula_estado || '').trim().toLowerCase()
  const verificationStatus = String(verification?.estado || '').trim().toLowerCase()
  const documentNumber = String(profile?.cedula || '').replace(/\D/g, '')

  return (
    documentNumber.length >= 6
    || profileStatus === 'aprobado'
    || verificationStatus === 'aprobado'
  )
}

export function evaluateIdentityVerificationLimit(
  currentValue,
  {
    limit,
    now = Date.now(),
    windowMs = IDENTITY_VERIFICATION_WINDOW_MS,
  },
) {
  const safeLimit = Math.max(1, Math.floor(positiveNumber(limit) || 1))
  const safeWindowMs = Math.max(1000, Math.floor(positiveNumber(windowMs) || IDENTITY_VERIFICATION_WINDOW_MS))
  const current = currentValue && typeof currentValue === 'object' ? currentValue : {}
  const startedAt = positiveNumber(current.window_started_at)
  const storedResetAt = positiveNumber(current.reset_at)
  const resetAt = storedResetAt || (startedAt ? startedAt + safeWindowMs : 0)
  const count = Math.max(0, Math.floor(positiveNumber(current.count)))

  if (!startedAt || !resetAt || now >= resetAt) {
    return {
      allowed: true,
      retryAfter: 0,
      next: {
        count: 1,
        window_started_at: now,
        reset_at: now + safeWindowMs,
      },
    }
  }

  if (count >= safeLimit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      next: null,
    }
  }

  return {
    allowed: true,
    retryAfter: 0,
    next: {
      count: count + 1,
      window_started_at: startedAt,
      reset_at: resetAt,
    },
  }
}

export function activeIdentityVerificationLock(verification, now = Date.now()) {
  const current = verification && typeof verification === 'object' ? verification : {}
  const attemptId = String(current.procesando_id || '').trim()
  const expiresAt = positiveNumber(current.procesando_hasta)

  if (!attemptId || !expiresAt || now >= expiresAt) return null

  return {
    attemptId,
    expiresAt,
    retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  }
}
