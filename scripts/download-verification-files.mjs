#!/usr/bin/env node

/**
 * Descarga administrativa local de documentos privados de verificación.
 *
 * Uso:
 *   npm run privacy:download-verification -- --phone=584121234567
 *   npm run privacy:download-verification -- --phone=584121234567 --out=output/private-verifications/caso-123
 *
 * No expone una URL web. Requiere credenciales administrativas de Firebase.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getDatabase } from 'firebase-admin/database'

process.umask(0o077)

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const STORAGE_BUCKET = process.env.FIREBASE_ADMIN_STORAGE_BUCKET
  || process.env.FIREBASE_STORAGE_BUCKET
  || 'repuestos-merida.appspot.com'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL
  || process.env.FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
const phoneArg = process.argv.find((arg) => arg.startsWith('--phone='))
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const phone = String(phoneArg?.slice('--phone='.length) || '').replace(/\D/g, '')

if (phone.length < 10 || phone.length > 15) {
  console.error('Indica un teléfono válido con --phone=, solo para el caso autorizado.')
  process.exit(1)
}

const outputDir = path.resolve(
  outArg?.slice('--out='.length) || `output/private-verifications/${phone}`,
)
const COLLECTIONS = ['verificaciones_edad', 'verificaciones_cedula']

function serviceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
  }
  return null
}

function extension(file) {
  const byPath = path.extname(String(file?.path || '')).replace(/^\./, '')
  if (byPath) return byPath
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[file?.content_type] || 'bin'
}

async function main() {
  const serviceAccount = serviceAccountFromEnv()
  const app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    databaseURL: DATABASE_URL,
  })
  const db = getFirestore(app)
  const bucket = getStorage(app).bucket()
  const rtdb = getDatabase(app)
  const downloaded = []

  try {
    await fs.mkdir(outputDir, { recursive: true, mode: 0o700 })

    for (const collection of COLLECTIONS) {
      const snapshot = await db.collection(collection).doc(phone).get()
      if (!snapshot.exists) continue
      const files = snapshot.data()?.archivos || {}

      for (const [kind, file] of Object.entries(files)) {
        const storagePath = String(file?.path || '').trim()
        if (!storagePath) continue
        const destination = path.join(outputDir, `${collection}-${kind}.${extension(file)}`)
        await bucket.file(storagePath).download({ destination })
        await fs.chmod(destination, 0o600)
        downloaded.push({ collection, kind, storagePath, destination })
      }
    }

    // Compatibilidad con documentos conservados por la app Flutter:
    // Storage/fotocedula|fotofacecedula/{uid}, indexados de forma privada en
    // RTDB verificarCedula/{uid}. Firebase Admin puede leerlos aunque las
    // reglas de cliente nieguen toda lectura.
    const usersSnap = await rtdb.ref('users').get()
    const target = phone.replace(/^58/, '').replace(/^0+/, '')
    const matchingUids = Object.entries(usersSnap.val() || {})
      .filter(([uid, profile]) => {
        if (!profile || typeof profile !== 'object') return false
        const candidate = String(profile.whatsapp || profile.telefono || uid)
          .replace(/\D/g, '')
          .replace(/^58/, '')
          .replace(/^0+/, '')
        return candidate === target
      })
      .map(([uid, profile]) => String(profile.canonical_uid || uid))

    for (const uid of new Set(matchingUids)) {
      const verificationSnap = await rtdb.ref(`verificarCedula/${uid}`).get()
      if (!verificationSnap.exists()) continue
      const verification = verificationSnap.val() || {}
      const legacyFiles = {
        cedula_app: verification.fotocedula,
        selfie_cedula_app: verification.fotocaracedula,
      }
      for (const [kind, rawPath] of Object.entries(legacyFiles)) {
        const storagePath = String(rawPath || '').trim()
        if (
          !storagePath.startsWith('fotocedula/')
          && !storagePath.startsWith('fotofacecedula/')
        ) continue
        const destination = path.join(outputDir, `app-${uid}-${kind}.jpg`)
        await bucket.file(storagePath).download({ destination })
        await fs.chmod(destination, 0o600)
        downloaded.push({
          collection: 'verificarCedula',
          kind,
          storagePath,
          destination,
        })
      }
    }

    if (!downloaded.length) {
      throw new Error('No se encontraron archivos privados para ese teléfono.')
    }

    console.log(JSON.stringify({
      phone,
      output_directory: outputDir,
      downloaded: downloaded.map(({ collection, kind, destination }) => ({
        collection,
        kind,
        destination,
      })),
    }, null, 2))
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exitCode = 1
})
