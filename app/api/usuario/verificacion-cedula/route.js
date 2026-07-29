import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { AI_VERIFICATION_CONSENT_VERSION } from '@/lib/legalConfig'
import {
  beginIdentityVerification,
  completeIdentityVerification,
  IdentityVerificationGuardError,
  identityVerificationRequestIp,
  releaseIdentityVerification,
} from '@/lib/identityVerificationGuard'
import { isIdentityVerificationApproved } from '@/lib/identityVerificationPolicy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'verificaciones-cedula'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_REQUEST_SIZE = 11 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

class VerificationRequestError extends Error {
  constructor(message, {
    code = 'verification_request_error',
    status = 400,
    expose = true,
  } = {}) {
    super(message)
    this.name = 'VerificationRequestError'
    this.code = code
    this.status = status
    this.expose = expose
  }
}

function safeGeminiReason(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

function safeServerError(value) {
  return String(value || '')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[CLAVE REDACTADA]')
    .slice(0, 300)
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (!d) return ''
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function authPayload(request) {
  const payload = verifyRifaToken(bearerToken(request))
  const telefono = cleanPhone(payload?.telefono || payload?.tel)
  const key = cleanPhone(payload?.tel || payload?.telefono)
  if (!payload || telefono.length < 10 || key.length < 10) return null
  return { ...payload, telefono, key }
}

function safeUid(value) {
  const uid = String(value || '').trim()
  if (!uid || uid.length > 128 || /[.#$\[\]/]/.test(uid)) return ''
  return uid
}

function validateImage(file, label) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new VerificationRequestError(`Falta la foto ${label}.`, {
      code: 'missing_image',
    })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new VerificationRequestError(`La foto ${label} debe ser JPG, PNG o WebP.`, {
      code: 'invalid_image_type',
    })
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new VerificationRequestError(`La foto ${label} debe pesar máximo 5 MB.`, {
      code: 'invalid_image_size',
    })
  }
}

async function fileToBuffer(file) {
  return Buffer.from(await file.arrayBuffer())
}

async function uploadPrivateImage({ bucket, file, buffer, telefono, kind }) {
  const storagePath = `${STORAGE_PREFIX}/${telefono}/${kind}`

  await bucket.file(storagePath).save(buffer, {
    resumable: false,
    contentType: file.type,
    metadata: {
      cacheControl: 'private, no-store, max-age=0',
      metadata: {
        owner: telefono,
        verificationKind: kind,
      },
    },
  })

  return {
    path: storagePath,
    content_type: file.type,
    size: file.size,
    original_name: String(file.name || '').slice(0, 120),
  }
}

function geminiSchema() {
  return {
    type: 'OBJECT',
    properties: {
      cedula: {
        type: 'OBJECT',
        properties: {
          es_cedula_venezolana: { type: 'BOOLEAN' },
          datos_legibles: { type: 'BOOLEAN' },
          numero: { type: 'STRING' },
          nombres: { type: 'STRING' },
          apellidos: { type: 'STRING' },
          fecha_nacimiento: { type: 'STRING' },
          nacionalidad: { type: 'STRING' },
          razon: { type: 'STRING' },
        },
        required: ['es_cedula_venezolana', 'datos_legibles', 'numero', 'nombres', 'apellidos', 'fecha_nacimiento', 'nacionalidad', 'razon'],
      },
      selfie: {
        type: 'OBJECT',
        properties: {
          se_ve_persona: { type: 'BOOLEAN' },
          sostiene_cedula: { type: 'BOOLEAN' },
          cedula_parece_la_misma: { type: 'BOOLEAN' },
          cara_visible: { type: 'BOOLEAN' },
          razon: { type: 'STRING' },
        },
        required: ['se_ve_persona', 'sostiene_cedula', 'cedula_parece_la_misma', 'cara_visible', 'razon'],
      },
      verificacion_aprobada: { type: 'BOOLEAN' },
      razon: { type: 'STRING' },
    },
    required: ['cedula', 'selfie', 'verificacion_aprobada', 'razon'],
  }
}

function parseGeminiJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/)
    if (!match) {
      throw new VerificationRequestError(
        'El análisis automático no devolvió un resultado válido.',
        {
          code: 'gemini_invalid_response',
          status: 502,
        },
      )
    }
    try {
      return JSON.parse(match[0])
    } catch {
      throw new VerificationRequestError(
        'El análisis automático no devolvió un resultado válido.',
        {
          code: 'gemini_invalid_json',
          status: 502,
        },
      )
    }
  }
}

async function verifyWithGemini({ cedulaFile, cedulaBuffer, selfieFile, selfieBuffer }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new VerificationRequestError(
      'El análisis automático no está disponible temporalmente.',
      {
        code: 'gemini_key_missing',
        status: 503,
        expose: false,
      },
    )
  }

  const model = process.env.GEMINI_VERIFICATION_MODEL || 'gemini-3.5-flash'
  let response
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Analiza estas dos imagenes para verificacion de edad en Repuestos Merida.',
                  'Imagen 1: foto frontal de una cedula venezolana.',
                  'Imagen 2: selfie de la persona sosteniendo esa cedula.',
                  'Devuelve solo JSON. No inventes datos. Si algun dato no se lee, marca datos_legibles=false.',
                  'Aprueba solo si la primera imagen parece una cedula venezolana, el numero y datos principales son legibles, en la segunda imagen se ve una persona con cara visible sosteniendo una cedula que parece la misma.',
                ].join('\n'),
              },
              {
                inline_data: {
                  mime_type: cedulaFile.type,
                  data: cedulaBuffer.toString('base64'),
                },
              },
              {
                inline_data: {
                  mime_type: selfieFile.type,
                  data: selfieBuffer.toString('base64'),
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: geminiSchema(),
        },
      }),
    })
  } catch {
    throw new VerificationRequestError(
      'No se pudo contactar el servicio de análisis. Intenta nuevamente.',
      {
        code: 'gemini_network_error',
        status: 502,
      },
    )
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Gemini rechazó la solicitud de verificación.', {
      status: response.status,
      upstreamCode: String(payload?.error?.status || '').slice(0, 80),
    })
    throw new VerificationRequestError(
      'El análisis automático no está disponible temporalmente. Intenta nuevamente.',
      {
        code: 'gemini_upstream_error',
        status: 502,
      },
    )
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
  const result = parseGeminiJson(text)
  const numero = cleanPhone(result?.cedula?.numero)

  if (
    !result?.verificacion_aprobada ||
    !result?.cedula?.es_cedula_venezolana ||
    !result?.cedula?.datos_legibles ||
    !numero ||
    !result?.selfie?.se_ve_persona ||
    !result?.selfie?.sostiene_cedula ||
    !result?.selfie?.cedula_parece_la_misma ||
    !result?.selfie?.cara_visible
  ) {
    throw new VerificationRequestError(
      safeGeminiReason(result?.razon) || 'No se pudo confirmar la cédula y la selfie.',
      {
        code: 'identity_images_rejected',
        status: 422,
      },
    )
  }

  if (numero.length < 6 || numero.length > 10) {
    throw new VerificationRequestError('No se pudo leer un número de cédula válido.', {
      code: 'invalid_document_number',
      status: 422,
    })
  }

  return { ...result, cedula: { ...result.cedula, numero } }
}

async function findRealtimeUserByPhone(rtdb, telefono) {
  const target = canonPhone(telefono)
  const paths = ['users', '']

  for (const path of paths) {
    // El SDK Admin rechaza rtdb.ref('') ("path must be non-empty"); la raíz
    // se obtiene con ref() sin argumento.
    const snap = await (path ? rtdb.ref(path) : rtdb.ref()).get()
    if (!snap.exists()) continue

    const users = snap.val() || {}
    for (const [uid, user] of Object.entries(users)) {
      if (user && typeof user === 'object' && canonPhone(user.whatsapp) === target) {
        return { path, uid, user }
      }
    }
  }

  return null
}

export async function POST(request) {
  let adminDb = null
  let adminFieldValueRef = null
  let verificationAttemptId = ''
  let verificationPhone = ''

  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_REQUEST_SIZE) {
      throw new VerificationRequestError('La solicitud supera el tamaño permitido.', {
        code: 'request_too_large',
        status: 413,
      })
    }

    const form = await request.formData()
    if (
      form.get('consent_accepted') !== 'true' ||
      form.get('consent_version') !== AI_VERIFICATION_CONSENT_VERSION
    ) {
      return NextResponse.json({
        error: 'Falta el consentimiento vigente para el análisis con inteligencia artificial.',
      }, { status: 400 })
    }
    const cedulaFoto = form.get('cedula_foto')
    const selfie = form.get('selfie_cedula')

    validateImage(cedulaFoto, 'de la cédula')
    validateImage(selfie, 'selfie con la cédula')

    const {
      adminFieldValue,
      getAdminBucket,
      getAdminDb,
      getAdminRealtimeDb,
    } = await import('@/lib/firebaseAdmin')

    const bucket = getAdminBucket()
    const db = getAdminDb()
    const rtdb = getAdminRealtimeDb()
    adminDb = db
    adminFieldValueRef = adminFieldValue
    verificationPhone = session.telefono

    const signedUid = safeUid(session.realtime_uid || session.canonical_uid)
    const official = signedUid ? null : await findRealtimeUserByPhone(rtdb, session.telefono)
    const targetUid = signedUid || safeUid(official?.uid)
    if (!targetUid) {
      throw new VerificationRequestError(
        'Renueva tu sesión para completar la verificación.',
        {
          code: 'canonical_identity_missing',
          status: 409,
        },
      )
    }

    const profileSnapshot = await rtdb.ref(`users/${targetUid}`).get()
    const currentProfile = profileSnapshot.exists ? profileSnapshot.val() || {} : {}
    if (isIdentityVerificationApproved(currentProfile, {})) {
      throw new IdentityVerificationGuardError(
        'Esta cuenta ya tiene una identidad aprobada. Para cambiarla debes solicitar revisión administrativa.',
        {
          code: 'verification_already_approved',
          status: 409,
        },
      )
    }

    const verificationAttempt = await beginIdentityVerification({
      db,
      telefono: session.telefono,
      uid: targetUid,
      ip: identityVerificationRequestIp(request),
    })
    verificationAttemptId = verificationAttempt.attemptId

    const [cedulaBuffer, selfieBuffer] = await Promise.all([
      fileToBuffer(cedulaFoto),
      fileToBuffer(selfie),
    ])
    const gemini = await verifyWithGemini({
      cedulaFile: cedulaFoto,
      cedulaBuffer,
      selfieFile: selfie,
      selfieBuffer,
    })
    const cedulaNumero = gemini.cedula.numero

    const [cedulaFile, selfieFile] = await Promise.all([
      uploadPrivateImage({
        bucket,
        file: cedulaFoto,
        buffer: cedulaBuffer,
        telefono: session.telefono,
        kind: 'cedula',
      }),
      uploadPrivateImage({
        bucket,
        file: selfie,
        buffer: selfieBuffer,
        telefono: session.telefono,
        kind: 'selfie-cedula',
      }),
    ])

    const now = adminFieldValue.serverTimestamp()
    const realtimeNow = Date.now()

    const verificationData = {
      telefono: session.telefono,
      cedula_ultimos4: cedulaNumero.slice(-4),
      estado: 'aprobado',
      metodo: 'google_gemini',
      proveedor_ia: 'Google Gemini',
      controles: {
        es_cedula_venezolana: Boolean(gemini.cedula.es_cedula_venezolana),
        datos_legibles: Boolean(gemini.cedula.datos_legibles),
        se_ve_persona: Boolean(gemini.selfie.se_ve_persona),
        sostiene_cedula: Boolean(gemini.selfie.sostiene_cedula),
        cedula_parece_la_misma: Boolean(gemini.selfie.cedula_parece_la_misma),
        cara_visible: Boolean(gemini.selfie.cara_visible),
      },
      imagenes_conservadas: true,
      archivos: {
        cedula: cedulaFile,
        selfie_cedula: selfieFile,
      },
      consentimiento: {
        aceptado: true,
        version: AI_VERIFICATION_CONSENT_VERSION,
        aceptado_en: now,
      },
      enviado_en: now,
      actualizado_en: now,
      realtime_user_uid: targetUid,
    }

    // La cédula queda en el perfil privado canónico; nunca se crea un nodo
    // cuyo identificador sea el teléfono.
    const cedulaPatch = {
      cedula: cedulaNumero,
      cedula_estado: 'aprobado',
      cedula_actualizada_en: realtimeNow,
    }
    const usersPath = `users/${targetUid}`
    const usersPatch = {
      whatsapp: session.telefono,
      telefono: session.telefono,
      id: targetUid,
      canonical_uid: targetUid,
      ...cedulaPatch,
    }

    await Promise.all([
      completeIdentityVerification({
        db,
        fieldValue: adminFieldValue,
        telefono: session.telefono,
        attemptId: verificationAttemptId,
        verificationData,
      }),
      rtdb.ref(usersPath).update(usersPatch),
    ])
    verificationAttemptId = ''

    return NextResponse.json({
      ok: true,
      estado: 'aprobado',
      cedula: cedulaNumero,
      realtime_user_uid: targetUid,
    })
  } catch (error) {
    if (adminDb && adminFieldValueRef && verificationAttemptId && verificationPhone) {
      await releaseIdentityVerification({
        db: adminDb,
        fieldValue: adminFieldValueRef,
        telefono: verificationPhone,
        attemptId: verificationAttemptId,
        failureCode: error?.code,
      }).catch((releaseError) => {
        console.error('No se pudo liberar el bloqueo de verificación.', {
          name: releaseError?.name,
          code: releaseError?.code,
        })
      })
    }

    const expected =
      error instanceof VerificationRequestError
      || error instanceof IdentityVerificationGuardError
    const status = expected ? Number(error.status || 400) : 500
    const message = expected && error.expose !== false
      ? error.message
      : 'No se pudo completar la verificación. Intenta nuevamente.'
    const headers = Number(error?.retryAfter) > 0
      ? { 'Retry-After': String(Math.ceil(error.retryAfter)) }
      : undefined

    if (!expected || error.expose === false) {
      console.error('Error interno de verificación de identidad.', {
        name: error?.name,
        code: error?.code,
        status,
        message: safeServerError(error?.message),
      })
    }

    return NextResponse.json({ error: message }, { status, headers })
  }
}
