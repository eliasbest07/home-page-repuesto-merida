import 'server-only'

import crypto from 'node:crypto'

import {
  activeIdentityVerificationLock,
  evaluateIdentityVerificationLimit,
  IDENTITY_VERIFICATION_IP_LIMIT,
  IDENTITY_VERIFICATION_LOCK_MS,
  IDENTITY_VERIFICATION_USER_LIMIT,
  isIdentityVerificationApproved,
} from '@/lib/identityVerificationPolicy'

const VERIFICATION_COLLECTION = 'verificaciones_cedula'
const LIMIT_COLLECTION = 'verificacion_cedula_limites'

export class IdentityVerificationGuardError extends Error {
  constructor(message, {
    code = 'verification_guard_error',
    status = 400,
    retryAfter = 0,
    expose = true,
  } = {}) {
    super(message)
    this.name = 'IdentityVerificationGuardError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
    this.expose = expose
  }
}

function guardSecret() {
  const secret =
    process.env.VERIFICATION_RATE_LIMIT_SECRET
    || process.env.RIFA_JWT_SECRET
    || process.env.WA_CLIENT_KEY_SECRET
    || ''

  if (secret.length < 32) {
    throw new IdentityVerificationGuardError(
      'No se pudo iniciar la verificación.',
      {
        code: 'rate_limit_secret_missing',
        status: 503,
        expose: false,
      },
    )
  }

  return secret
}

function subjectId(scope, value) {
  const digest = crypto
    .createHmac('sha256', guardSecret())
    .update(`${scope}:${String(value || '')}`)
    .digest('hex')

  return `${scope}_${digest.slice(0, 40)}`
}

export function identityVerificationRequestIp(request) {
  const forwarded =
    request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || ''

  return String(forwarded).split(',')[0].trim().slice(0, 128)
}

function rateLimitError(result) {
  return new IdentityVerificationGuardError(
    'Alcanzaste el límite de verificaciones. Intenta nuevamente más tarde.',
    {
      code: 'verification_rate_limited',
      status: 429,
      retryAfter: result.retryAfter,
    },
  )
}

export async function beginIdentityVerification({
  db,
  telefono,
  uid,
  ip,
  now = Date.now(),
}) {
  const attemptId = crypto.randomUUID()
  const verificationRef = db.collection(VERIFICATION_COLLECTION).doc(telefono)
  const userLimitRef = db.collection(LIMIT_COLLECTION).doc(subjectId('user', uid))
  const ipLimitRef = ip
    ? db.collection(LIMIT_COLLECTION).doc(subjectId('ip', ip))
    : null

  await db.runTransaction(async (transaction) => {
    const verificationSnap = await transaction.get(verificationRef)
    const userLimitSnap = await transaction.get(userLimitRef)
    const ipLimitSnap = ipLimitRef ? await transaction.get(ipLimitRef) : null
    const verification = verificationSnap.exists ? verificationSnap.data() || {} : {}

    if (isIdentityVerificationApproved({}, verification)) {
      throw new IdentityVerificationGuardError(
        'Esta cuenta ya tiene una identidad aprobada. Para cambiarla debes solicitar revisión administrativa.',
        {
          code: 'verification_already_approved',
          status: 409,
        },
      )
    }

    const activeLock = activeIdentityVerificationLock(verification, now)
    if (activeLock) {
      throw new IdentityVerificationGuardError(
        'Ya existe una verificación en proceso para esta cuenta.',
        {
          code: 'verification_in_progress',
          status: 409,
          retryAfter: activeLock.retryAfter,
        },
      )
    }

    const userLimit = evaluateIdentityVerificationLimit(
      userLimitSnap.exists ? userLimitSnap.data() : null,
      { limit: IDENTITY_VERIFICATION_USER_LIMIT, now },
    )
    if (!userLimit.allowed) throw rateLimitError(userLimit)

    const ipLimit = ipLimitRef
      ? evaluateIdentityVerificationLimit(
          ipLimitSnap?.exists ? ipLimitSnap.data() : null,
          { limit: IDENTITY_VERIFICATION_IP_LIMIT, now },
        )
      : null
    if (ipLimit && !ipLimit.allowed) throw rateLimitError(ipLimit)

    transaction.set(userLimitRef, {
      ...userLimit.next,
      scope: 'user',
      actualizado_en: now,
    }, { merge: true })

    if (ipLimitRef && ipLimit) {
      transaction.set(ipLimitRef, {
        ...ipLimit.next,
        scope: 'ip',
        actualizado_en: now,
      }, { merge: true })
    }

    transaction.set(verificationRef, {
      telefono,
      realtime_user_uid: uid,
      estado: 'procesando',
      procesando_id: attemptId,
      procesando_en: now,
      procesando_hasta: now + IDENTITY_VERIFICATION_LOCK_MS,
      actualizado_en: now,
    }, { merge: true })
  })

  return { attemptId }
}

export async function completeIdentityVerification({
  db,
  fieldValue,
  telefono,
  attemptId,
  verificationData,
}) {
  const verificationRef = db.collection(VERIFICATION_COLLECTION).doc(telefono)

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(verificationRef)
    const current = snapshot.exists ? snapshot.data() || {} : {}

    if (String(current.procesando_id || '') !== attemptId) {
      throw new IdentityVerificationGuardError(
        'La sesión de verificación expiró. Vuelve a intentarlo.',
        {
          code: 'verification_attempt_expired',
          status: 409,
        },
      )
    }

    transaction.set(verificationRef, {
      ...verificationData,
      procesando_id: fieldValue.delete(),
      procesando_en: fieldValue.delete(),
      procesando_hasta: fieldValue.delete(),
      ultimo_error_codigo: fieldValue.delete(),
    }, { merge: true })
  })
}

export async function releaseIdentityVerification({
  db,
  fieldValue,
  telefono,
  attemptId,
  failureCode = 'verification_failed',
  now = Date.now(),
}) {
  if (!db || !attemptId || !telefono) return
  const verificationRef = db.collection(VERIFICATION_COLLECTION).doc(telefono)

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(verificationRef)
    if (!snapshot.exists) return
    const current = snapshot.data() || {}

    if (
      String(current.procesando_id || '') !== attemptId
      || isIdentityVerificationApproved({}, current)
    ) return

    transaction.set(verificationRef, {
      estado: 'rechazado',
      ultimo_error_codigo: String(failureCode || 'verification_failed').slice(0, 80),
      ultimo_intento_en: now,
      actualizado_en: now,
      procesando_id: fieldValue.delete(),
      procesando_en: fieldValue.delete(),
      procesando_hasta: fieldValue.delete(),
    }, { merge: true })
  })
}
