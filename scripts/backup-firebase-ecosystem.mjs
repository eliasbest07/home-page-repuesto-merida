#!/usr/bin/env node

/**
 * Respaldo local privado del proyecto Firebase compartido por web/app/bot.
 *
 * Incluye:
 * - Realtime Database completo (exportVal, comprimido con gzip).
 * - Todos los documentos y subcolecciones de Firestore en NDJSON tipado.
 * - Metadatos de usuarios de Firebase Auth (no incluye secretos de proveedor).
 * - Objetos y metadatos de Firebase Storage, salvo --skip-storage.
 *
 * Uso:
 *   npm run backup:firebase
 *   npm run backup:firebase -- --out=backups/firebase-manual
 *   npm run backup:firebase -- --skip-storage
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import zlib from 'node:zlib'
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

process.umask(0o077)

const PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'repuestos-merida'
const DATABASE_URL = process.env.FIREBASE_ADMIN_DATABASE_URL
  || process.env.FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
const STORAGE_BUCKET = process.env.FIREBASE_ADMIN_STORAGE_BUCKET
  || process.env.FIREBASE_STORAGE_BUCKET
  || 'repuestos-merida.appspot.com'
const outArg = process.argv.find((arg) => arg.startsWith('--out='))
const skipStorage = process.argv.includes('--skip-storage')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '_UTC')
const outputDir = path.resolve(outArg ? outArg.slice('--out='.length) : `backups/firebase-${stamp}`)

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

function encodeFirestore(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { __firebase_type__: 'number', value: 'NaN' }
    if (value === Infinity) return { __firebase_type__: 'number', value: 'Infinity' }
    if (value === -Infinity) return { __firebase_type__: 'number', value: '-Infinity' }
    return value
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __firebase_type__: 'bytes', base64: Buffer.from(value).toString('base64') }
  }
  if (value instanceof Date) {
    return { __firebase_type__: 'date', iso: value.toISOString() }
  }
  if (Array.isArray(value)) return value.map(encodeFirestore)

  const constructor = value?.constructor?.name || ''
  if (constructor === 'Timestamp' && typeof value.toMillis === 'function') {
    return {
      __firebase_type__: 'timestamp',
      seconds: String(value.seconds),
      nanoseconds: Number(value.nanoseconds || 0),
    }
  }
  if (constructor === 'GeoPoint') {
    return {
      __firebase_type__: 'geopoint',
      latitude: value.latitude,
      longitude: value.longitude,
    }
  }
  if (constructor === 'DocumentReference' || (value?.path && value?.firestore)) {
    return { __firebase_type__: 'reference', path: value.path }
  }
  if (typeof value?.toArray === 'function') {
    return { __firebase_type__: 'vector', values: value.toArray().map(encodeFirestore) }
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeFirestore(item)]))
  }
  throw new Error(`Tipo Firestore no soportado: ${constructor || typeof value}`)
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  const input = fs.createReadStream(filePath)
  input.on('data', (chunk) => hash.update(chunk))
  await finished(input)
  return hash.digest('hex')
}

async function fileInfo(filePath) {
  const stat = await fsp.stat(filePath)
  return {
    path: path.relative(outputDir, filePath),
    bytes: stat.size,
    sha256: await sha256File(filePath),
  }
}

async function writeGzip(filePath, contents) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  const destination = fs.createWriteStream(filePath, { mode: 0o600 })
  await pipeline(Readable.from([contents]), zlib.createGzip({ level: 9 }), destination)
  await fsp.chmod(filePath, 0o600)
}

async function createNdjsonGzipWriter(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  const destination = fs.createWriteStream(filePath, { mode: 0o600 })
  const gzip = zlib.createGzip({ level: 9 })
  gzip.pipe(destination)
  return {
    async write(record) {
      if (!gzip.write(`${JSON.stringify(record)}\n`)) {
        await new Promise((resolve) => gzip.once('drain', resolve))
      }
    },
    async close() {
      gzip.end()
      await finished(destination)
      await fsp.chmod(filePath, 0o600)
    },
  }
}

async function* firestoreDocuments(collectionRef) {
  const snapshot = await collectionRef.get()
  for (const document of snapshot.docs) {
    yield document
    const children = await document.ref.listCollections()
    for (const child of children) yield* firestoreDocuments(child)
  }
}

async function backupRealtime(rtdb) {
  console.log('[backup] Leyendo Realtime Database completo...')
  const snapshot = await rtdb.ref('/').get()
  const filePath = path.join(outputDir, 'rtdb', 'root.export.json.gz')
  await writeGzip(filePath, `${JSON.stringify(snapshot.exportVal())}\n`)
  console.log('[backup] Realtime Database guardado.')
  return fileInfo(filePath)
}

async function backupFirestore(firestore) {
  console.log('[backup] Recorriendo Firestore y subcolecciones...')
  const filePath = path.join(outputDir, 'firestore', 'documents.ndjson.gz')
  const writer = await createNdjsonGzipWriter(filePath)
  const roots = await firestore.listCollections()
  let documents = 0
  const collections = new Set()
  for (const collection of roots.sort((a, b) => a.id.localeCompare(b.id))) {
    for await (const document of firestoreDocuments(collection)) {
      collections.add(document.ref.parent.path)
      await writer.write({
        path: document.ref.path,
        create_time_ms: document.createTime?.toMillis?.() || null,
        update_time_ms: document.updateTime?.toMillis?.() || null,
        data: encodeFirestore(document.data()),
      })
      documents += 1
      if (documents % 250 === 0) console.log(`[backup] Firestore: ${documents} documentos...`)
    }
  }
  await writer.close()
  console.log(`[backup] Firestore guardado: ${documents} documentos en ${collections.size} colecciones/rutas.`)
  return { ...(await fileInfo(filePath)), documents, collections: collections.size }
}

async function backupAuth(auth) {
  console.log('[backup] Leyendo metadatos de Firebase Auth...')
  const filePath = path.join(outputDir, 'auth', 'users.ndjson.gz')
  const writer = await createNdjsonGzipWriter(filePath)
  let users = 0
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      await writer.write({
        uid: user.uid,
        email: user.email || null,
        email_verified: user.emailVerified,
        phone_number: user.phoneNumber || null,
        display_name: user.displayName || null,
        photo_url: user.photoURL || null,
        disabled: user.disabled,
        provider_data: user.providerData.map((provider) => ({
          uid: provider.uid,
          provider_id: provider.providerId,
          email: provider.email || null,
          phone_number: provider.phoneNumber || null,
          display_name: provider.displayName || null,
          photo_url: provider.photoURL || null,
        })),
        custom_claims: user.customClaims || {},
        metadata: {
          creation_time: user.metadata.creationTime || null,
          last_sign_in_time: user.metadata.lastSignInTime || null,
          last_refresh_time: user.metadata.lastRefreshTime || null,
        },
      })
      users += 1
    }
    pageToken = page.pageToken
  } while (pageToken)
  await writer.close()
  console.log(`[backup] Firebase Auth guardado: ${users} usuarios (metadatos, no tokens de proveedor).`)
  return { ...(await fileInfo(filePath)), users }
}

async function mapLimit(items, concurrency, worker) {
  let next = 0
  const results = new Array(items.length)
  async function run() {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run))
  return results
}

async function inventoryStorage(bucket) {
  console.log(`[backup] Inventariando Storage (${bucket.name}) antes de descargar...`)
  const [files] = await bucket.getFiles()
  const entries = await mapLimit(files, 8, async (file) => {
    const [metadata] = await file.getMetadata()
    return { file, metadata, size: Number(metadata.size || 0) }
  })
  const bytes = entries.reduce((sum, entry) => sum + entry.size, 0)
  console.log(`[backup] Storage contiene ${entries.length} objetos y ${bytes} bytes.`)
  return { entries, bytes }
}

async function assertDiskCapacity(storageBytes) {
  const stats = await fsp.statfs(outputDir)
  const available = Number(stats.bavail) * Number(stats.bsize)
  const safetyMargin = 256 * 1024 * 1024
  const required = storageBytes + safetyMargin
  if (required > available) {
    throw new Error(
      `Espacio insuficiente: disponibles ${available} bytes; Storage requiere ${storageBytes} bytes más ${safetyMargin} de margen.`,
    )
  }
  console.log(`[backup] Espacio disponible verificado: ${available} bytes.`)
}

async function backupStorage(bucket, inventory) {
  const { entries, bytes: inventoryBytes } = inventory
  const objectsDir = path.join(outputDir, 'storage', 'objects')
  await fsp.mkdir(objectsDir, { recursive: true, mode: 0o700 })
  const manifestPath = path.join(outputDir, 'storage', 'objects.ndjson.gz')
  const writer = await createNdjsonGzipWriter(manifestPath)
  let totalBytes = 0
  let completed = 0

  const records = await mapLimit(entries, 4, async ({ file, metadata, size }) => {
    const localName = `${crypto.createHash('sha256').update(file.name).digest('hex')}.bin`
    const destination = path.join(objectsDir, localName)
    await file.download({ destination, validation: 'crc32c' })
    await fsp.chmod(destination, 0o600)
    totalBytes += size
    completed += 1
    if (completed % 50 === 0 || completed === entries.length) {
      console.log(`[backup] Storage: ${completed}/${entries.length} objetos...`)
    }
    return {
      name: file.name,
      local_file: `objects/${localName}`,
      bytes: size,
      sha256: await sha256File(destination),
      content_type: metadata.contentType || null,
      cache_control: metadata.cacheControl || null,
      content_disposition: metadata.contentDisposition || null,
      content_encoding: metadata.contentEncoding || null,
      content_language: metadata.contentLanguage || null,
      md5_hash: metadata.md5Hash || null,
      crc32c: metadata.crc32c || null,
      generation: metadata.generation || null,
      metageneration: metadata.metageneration || null,
      time_created: metadata.timeCreated || null,
      updated: metadata.updated || null,
      custom_metadata: metadata.metadata || {},
    }
  })
  records.sort((a, b) => a.name.localeCompare(b.name))
  for (const record of records) await writer.write(record)
  await writer.close()
  if (totalBytes !== inventoryBytes) throw new Error('El total descargado de Storage no coincide con el inventario previo.')
  console.log(`[backup] Storage guardado: ${entries.length} objetos, ${totalBytes} bytes.`)
  return {
    manifest: await fileInfo(manifestPath),
    objects: entries.length,
    bytes: totalBytes,
  }
}

async function main() {
  await fsp.mkdir(outputDir, { recursive: true, mode: 0o700 })
  await fsp.chmod(outputDir, 0o700)
  const account = serviceAccountFromEnv()
  const app = initializeApp({
    credential: account ? cert(account) : applicationDefault(),
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL,
    storageBucket: STORAGE_BUCKET,
  }, `backup-${Date.now()}`)

  const startedAt = new Date()
  try {
    const bucket = getStorage(app).bucket()
    const storageInventory = skipStorage ? null : await inventoryStorage(bucket)
    if (storageInventory) await assertDiskCapacity(storageInventory.bytes)
    const rtdb = await backupRealtime(getDatabase(app))
    const firestore = await backupFirestore(getFirestore(app))
    const auth = await backupAuth(getAuth(app))
    const storage = skipStorage ? { skipped: true } : await backupStorage(bucket, storageInventory)

    const readmePath = path.join(outputDir, 'README-PRIVADO.md')
    const readme = `# Respaldo privado de Firebase\n\n`
      + `Proyecto: ${PROJECT_ID}\n\n`
      + `Creado: ${startedAt.toISOString()}\n\n`
      + `Este directorio contiene PII y datos operativos. No debe añadirse a Git, enviarse por correo ni compartirse sin cifrado.\n\n`
      + `- RTDB usa exportVal y conserva prioridades.\n`
      + `- Firestore contiene un documento NDJSON tipado por línea, incluida su ruta completa y subcolecciones.\n`
      + `- Auth contiene metadatos de cuentas; no contiene tokens ni secretos de proveedores externos.\n`
      + `- Storage conserva cada objeto con su hash y un manifiesto que relaciona nombre remoto y archivo local.\n\n`
      + `Antes de restaurar, verificar SHA-256 contra manifest.json y hacerlo primero en un proyecto Firebase de prueba.\n`
    await fsp.writeFile(readmePath, readme, { mode: 0o600 })

    const manifest = {
      schema_version: 1,
      project_id: PROJECT_ID,
      database_url: DATABASE_URL,
      storage_bucket: STORAGE_BUCKET,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      output_directory: outputDir,
      contains_personal_data: true,
      permissions_expected: { directories: '0700', files: '0600' },
      rtdb,
      firestore,
      auth,
      storage,
      readme: await fileInfo(readmePath),
    }
    const manifestPath = path.join(outputDir, 'manifest.json')
    await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
    await fsp.chmod(manifestPath, 0o600)

    console.log(JSON.stringify({
      ok: true,
      output: outputDir,
      firestore_documents: firestore.documents,
      auth_users: auth.users,
      storage_objects: storage.objects ?? 0,
      storage_bytes: storage.bytes ?? 0,
      manifest: manifestPath,
    }, null, 2))
  } catch (error) {
    const failedPath = path.join(outputDir, 'BACKUP-INCOMPLETO.txt')
    await fsp.writeFile(failedPath, `${new Date().toISOString()}\n${error.stack || error.message}\n`, { mode: 0o600 })
    throw error
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(`[backup] Falló: ${error.message}`)
  console.error(`[backup] El directorio parcial se conserva para diagnóstico: ${outputDir}`)
  process.exitCode = 1
})
