import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { GoogleAuth } from 'google-auth-library'

const APPLY_CONFIRMATION = 'DEPLOY_PROVISIONAL_PUBLIC_PROFILES_V1'
const DATABASE_URL = (
  process.env.FIREBASE_DATABASE_URL
  || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  || 'https://repuestos-merida-default-rtdb.firebaseio.com'
).replace(/\/+$/, '')

function sha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

async function accessToken() {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/firebase.database',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  })
  const client = await auth.getClient()
  const result = await client.getAccessToken()
  const token = typeof result === 'string' ? result : result?.token
  if (!token) throw new Error('No se pudo obtener un access token administrativo.')
  return token
}

async function requestRules(token, { method = 'GET', body = null } = {}) {
  const url = `${DATABASE_URL}/.settings/rules.json?access_token=${encodeURIComponent(token)}`
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { error: text.slice(0, 500) }
  }
  if (!response.ok) {
    throw new Error(`Firebase rechazó las reglas (${response.status}): ${JSON.stringify(parsed)}`)
  }
  return parsed
}

const apply = hasFlag('--apply')
const localPath = path.resolve(option('--rules') || 'database.rules.json')
const backupDir = option('--backup-dir')
const local = JSON.parse(await fs.readFile(localPath, 'utf8'))
const publicProfiles = local?.rules?.public_profiles

if (
  !publicProfiles
  || publicProfiles['.read'] !== true
  || !String(publicProfiles?.$uid?.['.write'] || '').includes('auth.uid === $uid')
) {
  throw new Error('El archivo local no contiene el contrato seguro esperado para public_profiles.')
}
if (apply && local?.rules?.users?.['.read'] !== true) {
  throw new Error('Este comando solo publica la fase provisional: /users debe seguir legible hasta distribuir la app.')
}
if (apply && process.env.FIREBASE_RULES_DEPLOY_CONFIRM !== APPLY_CONFIRMATION) {
  throw new Error(`Falta FIREBASE_RULES_DEPLOY_CONFIRM=${APPLY_CONFIRMATION}.`)
}

const token = await accessToken()
const live = await requestRules(token)
const liveRoots = Object.keys(live?.rules || {}).sort()
const localRoots = Object.keys(local?.rules || {}).sort()

if (!apply) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'compare-only',
    live_sha256: sha(live),
    local_sha256: sha(local),
    same: sha(live) === sha(local),
    roots_only_in_live: liveRoots.filter((key) => !localRoots.includes(key)),
    roots_only_in_local: localRoots.filter((key) => !liveRoots.includes(key)),
    live_users_public_read: live?.rules?.users?.['.read'] === true,
    live_public_profiles_present: Boolean(live?.rules?.public_profiles),
  }, null, 2))
  process.exit(0)
}

if (!backupDir) throw new Error('Antes de publicar debes indicar --backup-dir.')
const resolvedBackupDir = path.resolve(backupDir)
await fs.mkdir(resolvedBackupDir, { recursive: true, mode: 0o700 })
const backupPath = path.join(resolvedBackupDir, 'rtdb-rules.before-public-profiles.json')
await fs.writeFile(backupPath, `${JSON.stringify(live, null, 2)}\n`, { mode: 0o600 })
await fs.chmod(backupPath, 0o600)

await requestRules(token, { method: 'PUT', body: local })
const deployed = await requestRules(token)
if (sha(deployed) !== sha(local)) {
  throw new Error('Firebase respondió, pero las reglas leídas no coinciden con el archivo local.')
}

console.log(JSON.stringify({
  ok: true,
  mode: 'applied-provisional',
  backup: backupPath,
  deployed_sha256: sha(deployed),
  users_public_read_preserved: deployed?.rules?.users?.['.read'] === true,
  public_profiles_enabled: Boolean(deployed?.rules?.public_profiles),
}, null, 2))
