import assert from 'node:assert/strict'

import {
  publicProfileAllowedKeys,
  sanitizePublicProfile,
} from '../lib/publicProfileContract.js'

const privateKeys = new Set([
  'cedula',
  'cedula_estado',
  'correo',
  'email',
  'telefono',
  'whatsapp',
  'tokenNotif',
  'consentimientos',
  'lat',
  'lng',
  'ubicacion',
  'mensajes',
  'creditos',
])
const allowed = new Set(publicProfileAllowedKeys())

function assertContract(uid, source, expected) {
  const result = sanitizePublicProfile(uid, source, { canonicalUid: uid, updatedAt: 1 })
  assert.deepEqual(
    Object.keys(result).filter((key) => !allowed.has(key)),
    [],
    'El perfil público incluyó un campo fuera de contrato.',
  )
  assert.deepEqual(
    Object.keys(result).filter((key) => privateKeys.has(key)),
    [],
    'El perfil público filtró un dato privado.',
  )
  assert.equal(result.uid, uid)
  assert.equal(result.canonical_uid, uid)
  for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value)
  return result
}

const personal = assertContract('firebase_uid_1', {
  nombre: 'Elias',
  foto: 'https://example.test/profile.jpg',
  ciudad: 'Mérida',
  cedula: 'V12345678',
  email: 'private@example.test',
  whatsapp: '04141234567',
  lat: 8.5,
  lng: -71.1,
  tokenNotif: 'private-token',
}, {
  nombre: 'Elias',
  vender: false,
  tipovender: 'individuo',
})
assert.equal(personal.whatsapp_public, undefined)
assert.equal(personal.comercio_lat, undefined)

const commerce = assertContract('firebase_uid_2', {
  nombre: 'Persona privada',
  whatsapp: '04141234567',
  vender: true,
  comercio_autorizado: {
    autorizado: true,
    comercio_id: 'comercio_1',
    nombre_comercio: 'Tienda pública',
    comercio_direccion: 'Mérida',
    comercio_lat: 8.59,
    comercio_lng: -71.14,
    whatsapp: '04141234567',
  },
}, {
  nombre: 'Tienda pública',
  vender: true,
  tipovender: 'tienda',
  whatsapp_public: '+584141234567',
  public_contact_enabled: true,
})
assert.equal(commerce.comercio_lat, 8.59)
assert.equal(commerce.comercio_lng, -71.14)

const adminOnly = assertContract('firebase_uid_3', {
  nombre: 'Administrador',
  autorizado: true,
  whatsapp: '04141234567',
}, {
  vender: false,
  tipovender: 'individuo',
})
assert.equal(adminOnly.whatsapp_public, undefined)

console.log('Contrato public_profiles: 3 escenarios válidos, 0 campos privados.')
