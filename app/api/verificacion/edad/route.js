import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'

const COLLECTION = 'verificaciones_edad'
const STORAGE_PREFIX = 'verificaciones-edad'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function authPayload(request) {
  const payload = verifyRifaToken(bearerToken(request))
  const telefono = String(payload?.tel || payload?.telefono || '').replace(/\D/g, '')
  if (!payload || telefono.length < 10) return null
  return { ...payload, telefono }
}

function publicStatus(data) {
  if (!data) return { estado: 'sin_verificar' }
  return {
    estado: data.estado || 'pendiente',
    enviado_en: data.enviado_en?.toMillis?.() || null,
    actualizado_en: data.actualizado_en?.toMillis?.() || null,
    rechazado_motivo: data.estado === 'rechazado' ? data.rechazado_motivo || '' : '',
  }
}

async function adminServices() {
  const { adminFieldValue, getAdminBucket, getAdminDb } = await import('@/lib/firebaseAdmin')
  return {
    bucket: getAdminBucket(),
    db: getAdminDb(),
    fieldValue: adminFieldValue,
  }
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

async function uploadPrivateImage({ bucket, file, telefono, kind, batchId }) {
  const ext = EXTENSIONS[file.type] || 'jpg'
  const storagePath = `${STORAGE_PREFIX}/${telefono}/${batchId}-${kind}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

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

export async function GET(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const { db } = await adminServices()
    const snap = await db.collection(COLLECTION).doc(session.telefono).get()
    return NextResponse.json({ ok: true, ...publicStatus(snap.exists ? snap.data() : null) })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar la verificación.' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = authPayload(request)
    if (!session) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 })

    const form = await request.formData()
    const cedula = form.get('cedula')
    const selfie = form.get('selfie')

    validateImage(cedula, 'de la cédula')
    validateImage(selfie, 'selfie con la cédula')

    const { bucket, db, fieldValue } = await adminServices()
    const batchId = `${Date.now()}-${crypto.randomUUID()}`
    const [cedulaFile, selfieFile] = await Promise.all([
      uploadPrivateImage({ bucket, file: cedula, telefono: session.telefono, kind: 'cedula', batchId }),
      uploadPrivateImage({ bucket, file: selfie, telefono: session.telefono, kind: 'selfie-cedula', batchId }),
    ])

    await db.collection(COLLECTION).doc(session.telefono).set({
      telefono: session.telefono,
      estado: 'pendiente',
      archivos: {
        cedula: cedulaFile,
        selfie_cedula: selfieFile,
      },
      enviado_en: fieldValue.serverTimestamp(),
      actualizado_en: fieldValue.serverTimestamp(),
      revisado_en: null,
      rechazado_motivo: '',
    }, { merge: true })

    return NextResponse.json({ ok: true, estado: 'pendiente' })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo enviar la verificación.' }, { status: 400 })
  }
}
