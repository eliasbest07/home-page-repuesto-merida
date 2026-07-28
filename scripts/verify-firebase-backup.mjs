#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import zlib from 'node:zlib'
import { finished } from 'node:stream/promises'

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
if (!sourceArg) {
  console.error('Uso: npm run verify:firebase-backup -- --source=backups/firebase-AAAA-MM-DD_...')
  process.exit(2)
}
const sourceDir = path.resolve(sourceArg.slice('--source='.length))

async function sha256(filePath) {
  const hash = crypto.createHash('sha256')
  const input = fs.createReadStream(filePath)
  input.on('data', (chunk) => hash.update(chunk))
  await finished(input)
  return hash.digest('hex')
}

function insideSource(relativePath) {
  const fullPath = path.resolve(sourceDir, relativePath)
  if (fullPath !== sourceDir && !fullPath.startsWith(`${sourceDir}${path.sep}`)) {
    throw new Error(`Ruta fuera del respaldo: ${relativePath}`)
  }
  return fullPath
}

async function verifyFile(entry) {
  const filePath = insideSource(entry.path)
  const stat = await fsp.stat(filePath)
  if (stat.size !== entry.bytes) throw new Error(`Tamaño incorrecto: ${entry.path}`)
  if (await sha256(filePath) !== entry.sha256) throw new Error(`SHA-256 incorrecto: ${entry.path}`)
}

async function ndjsonRecords(filePath) {
  const input = fs.createReadStream(filePath).pipe(zlib.createGunzip())
  const lines = readline.createInterface({ input, crlfDelay: Infinity })
  const records = []
  for await (const line of lines) {
    if (line.trim()) records.push(JSON.parse(line))
  }
  return records
}

async function verifyPermissions(currentPath, violations) {
  const stat = await fsp.stat(currentPath)
  const permissions = stat.mode & 0o777
  const expected = stat.isDirectory() ? 0o700 : 0o600
  if (permissions !== expected) {
    violations.push({ path: path.relative(sourceDir, currentPath) || '.', actual: permissions.toString(8), expected: expected.toString(8) })
  }
  if (!stat.isDirectory()) return
  for (const name of await fsp.readdir(currentPath)) {
    await verifyPermissions(path.join(currentPath, name), violations)
  }
}

async function main() {
  const manifest = JSON.parse(await fsp.readFile(path.join(sourceDir, 'manifest.json'), 'utf8'))
  await Promise.all([
    verifyFile(manifest.rtdb),
    verifyFile(manifest.firestore),
    verifyFile(manifest.auth),
    verifyFile(manifest.readme),
    manifest.storage?.manifest ? verifyFile(manifest.storage.manifest) : Promise.resolve(),
  ])

  const rtdbText = await new Promise((resolve, reject) => {
    const chunks = []
    fs.createReadStream(insideSource(manifest.rtdb.path))
      .pipe(zlib.createGunzip())
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      .on('error', reject)
  })
  JSON.parse(rtdbText)

  const firestoreRecords = await ndjsonRecords(insideSource(manifest.firestore.path))
  const authRecords = await ndjsonRecords(insideSource(manifest.auth.path))
  if (firestoreRecords.length !== manifest.firestore.documents) throw new Error('Conteo de Firestore incorrecto.')
  if (authRecords.length !== manifest.auth.users) throw new Error('Conteo de Auth incorrecto.')

  let storageBytes = 0
  let storageObjects = 0
  if (manifest.storage?.manifest) {
    const storageManifestPath = insideSource(path.join('storage', manifest.storage.manifest.path.split('/').at(-1)))
    const objects = await ndjsonRecords(storageManifestPath)
    for (const object of objects) {
      const filePath = insideSource(path.join('storage', object.local_file))
      const stat = await fsp.stat(filePath)
      if (stat.size !== object.bytes) throw new Error(`Tamaño de objeto incorrecto: ${object.local_file}`)
      if (await sha256(filePath) !== object.sha256) throw new Error(`SHA de objeto incorrecto: ${object.local_file}`)
      storageBytes += stat.size
      storageObjects += 1
    }
    if (storageObjects !== manifest.storage.objects || storageBytes !== manifest.storage.bytes) {
      throw new Error('El inventario de Storage no coincide con manifest.json.')
    }
  }

  const permissionViolations = []
  await verifyPermissions(sourceDir, permissionViolations)
  if (permissionViolations.length) {
    throw new Error(`Permisos inseguros: ${JSON.stringify(permissionViolations)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    source: sourceDir,
    project_id: manifest.project_id,
    rtdb_json_valid: true,
    firestore_documents: firestoreRecords.length,
    auth_users: authRecords.length,
    storage_objects: storageObjects,
    storage_bytes: storageBytes,
    sha256_verified: true,
    private_permissions_verified: true,
  }, null, 2))
}

main().catch((error) => {
  console.error(`[verify-backup] ${error.message}`)
  process.exitCode = 1
})
