import crypto from 'node:crypto'

function getSecret() {
  const secret =
    process.env.WA_OTP_HASH_SECRET ||
    process.env.WA_ENCRYPTION_MASTER_KEY ||
    (process.env.NODE_ENV !== 'production' ? 'dev-otp-hash-secret-change-in-production' : '')
  if (secret.length < 32) {
    throw new Error('WA_OTP_HASH_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

export function hashOtp(phoneKey, code) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${phoneKey}:${String(code)}`)
    .digest('base64url')
}

export function verifyOtpHash(phoneKey, code, expectedHash) {
  const actual = Buffer.from(hashOtp(phoneKey, code))
  const expected = Buffer.from(String(expectedHash || ''))
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}
