import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 1
const KEY_LENGTH = 32
const IV_LENGTH = 12
const SALT_LENGTH = 16
const TAG_LENGTH = 16

function randomText(bytes = 12) {
  return randomBytes(bytes).toString('base64url')
}

function deriveKey(masterKey, salt) {
  if (typeof masterKey !== 'string' || masterKey.length < 32) {
    throw new TypeError('WA_ENCRYPTION_MASTER_KEY debe tener al menos 32 caracteres.')
  }
  return scryptSync(masterKey, salt, KEY_LENGTH)
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('El contenido debe ser un objeto JSON.')
  }
}

// Integrado desde /home/eliasmontillabtm/Documents/GitHub/cifrandojson.
export function encryptJson(payload, masterKey) {
  validatePayload(payload)

  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(masterKey, salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  const encryptedPacket = [
    `cj${VERSION}`,
    salt.toString('base64url'),
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.')

  const propertyCount = 1 + randomBytes(1)[0] % 3
  const encryptedPosition = randomBytes(1)[0] % propertyCount
  const envelope = {}

  for (let index = 0; index < propertyCount; index += 1) {
    envelope[randomText(9)] =
      index === encryptedPosition ? encryptedPacket : randomText(24)
  }
  return envelope
}

export function decryptJson(envelope, masterKey) {
  validatePayload(envelope)
  const candidates = Object.values(envelope).filter(
    (value) => typeof value === 'string' && value.startsWith(`cj${VERSION}.`)
  )
  if (candidates.length !== 1) {
    throw new Error('El JSON no contiene exactamente un paquete cifrado válido.')
  }

  const parts = candidates[0].split('.')
  if (parts.length !== 5) throw new Error('El paquete cifrado tiene un formato inválido.')

  const [, saltText, ivText, tagText, ciphertextText] = parts
  const salt = Buffer.from(saltText, 'base64url')
  const iv = Buffer.from(ivText, 'base64url')
  const tag = Buffer.from(tagText, 'base64url')
  const ciphertext = Buffer.from(ciphertextText, 'base64url')

  if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('El paquete cifrado tiene parámetros inválidos.')
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, deriveKey(masterKey, salt), iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return JSON.parse(plaintext.toString('utf8'))
  } catch {
    throw new Error('No se pudo descifrar: llave incorrecta o datos alterados.')
  }
}
