import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORAGE_PREFIX = 'verificaciones-cedula'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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

function validateImage(file, label) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error(`Falta la foto ${label}.`)
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`La foto ${label} debe ser JPG, PNG o WebP.`)
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error(`La foto ${label} debe pesar máximo 5 MB.`)
  }
}

async function fileToBuffer(file) {
  return Buffer.from(await file.arrayBuffer())
}

async function uploadPrivateImage({ bucket, file, buffer, telefono, kind, batchId }) {
  const ext = EXTENSIONS[file.type] || 'jpg'
  const storagePath = `${STORAGE_PREFIX}/${telefono}/${batchId}-${kind}.${ext}`

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
    if (!match) throw new Error('Gemini no devolvió JSON válido.')
    return JSON.parse(match[0])
  }
}

async function verifyWithGemini({ cedulaFile, cedulaBuffer, selfieFile, selfieBuffer }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en el servidor.')

  const model = process.env.GEMINI_VERIFICATION_MODEL || 'gemini-3.5-flash'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Gemini no pudo validar las fotos.')
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
    throw new Error(result?.razon || 'No se pudo confirmar la cédula y la selfie.')
  }

  if (numero.length < 6 || numero.length > 10) {
    throw new Error('Gemini no pudo leer un número de cédula válido.')
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
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const form = await request.formData()
    const cedulaFoto = form.get('cedula_foto')
    const selfie = form.get('selfie_cedula')

    validateImage(cedulaFoto, 'de la cédula')
    validateImage(selfie, 'selfie con la cédula')
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

    const {
      adminFieldValue,
      getAdminBucket,
      getAdminDb,
      getAdminRealtimeDb,
    } = await import('@/lib/firebaseAdmin')

    const bucket = getAdminBucket()
    const db = getAdminDb()
    const rtdb = getAdminRealtimeDb()
    const batchId = `${Date.now()}-${crypto.randomUUID()}`
    const [cedulaFile, selfieFile] = await Promise.all([
      uploadPrivateImage({ bucket, file: cedulaFoto, buffer: cedulaBuffer, telefono: session.telefono, kind: 'cedula', batchId }),
      uploadPrivateImage({ bucket, file: selfie, buffer: selfieBuffer, telefono: session.telefono, kind: 'selfie-cedula', batchId }),
    ])

    const official = await findRealtimeUserByPhone(rtdb, session.telefono)
    const now = adminFieldValue.serverTimestamp()
    const realtimeNow = Date.now()

    const verificationData = {
      telefono: session.telefono,
      cedula: cedulaNumero,
      estado: 'aprobado',
      gemini,
      archivos: {
        cedula: cedulaFile,
        selfie_cedula: selfieFile,
      },
      enviado_en: now,
      actualizado_en: now,
      realtime_user_uid: official?.uid || '',
    }

    await Promise.all([
      db.collection('verificaciones_cedula').doc(session.telefono).set(verificationData, { merge: true }),
      rtdb.ref(`rifas_usuarios/${session.key}`).update({
        cedula: cedulaNumero,
        cedula_estado: 'aprobado',
        cedula_actualizada_en: realtimeNow,
      }),
      official?.uid
        ? rtdb.ref(`${official.path ? `${official.path}/` : ''}${official.uid}`).update({
            cedula: cedulaNumero,
            cedula_estado: 'aprobado',
            cedula_actualizada_en: realtimeNow,
          })
        : Promise.resolve(),
    ])

    return NextResponse.json({
      ok: true,
      estado: 'aprobado',
      cedula: cedulaNumero,
      datos: gemini.cedula,
      realtime_user_uid: official?.uid || null,
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo verificar la cédula.' }, { status: 400 })
  }
}
