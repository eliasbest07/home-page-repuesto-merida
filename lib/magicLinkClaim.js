import 'server-only'

import crypto from 'crypto'
import { getAdminDb } from '@/lib/firebaseAdmin'

const CLAIM_TTL_MS = 2 * 60 * 1000

export class MagicLinkError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'MagicLinkError'
    this.status = status
  }
}

export function validMagicToken(value) {
  const token = String(value || '').trim()
  return /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : ''
}

function validClaimId(value) {
  const claimId = String(value || '').trim()
  return /^[a-f0-9-]{36}$/.test(claimId) ? claimId : ''
}

export async function claimMagicLink(rawToken) {
  const token = validMagicToken(rawToken)
  if (!token) throw new MagicLinkError('Enlace inválido.', 400)

  const db = getAdminDb()
  const ref = db.collection('magic_links').doc(token)
  const claimId = crypto.randomUUID()
  const now = Date.now()
  const data = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new MagicLinkError('Enlace inválido.', 404)
    const current = snapshot.data() || {}
    if (current.usado) throw new MagicLinkError('Este enlace ya fue usado.', 410)
    if (now > Number(current.expira_en || 0)) {
      throw new MagicLinkError('El enlace expiró. Pide uno nuevo por WhatsApp.', 410)
    }
    if (current.procesando_id && now < Number(current.procesando_expira_en || 0)) {
      throw new MagicLinkError('Este enlace se está validando. Intenta nuevamente en unos segundos.', 409)
    }
    transaction.update(ref, {
      procesando_id: claimId,
      procesando_en: now,
      procesando_expira_en: now + CLAIM_TTL_MS,
      procesando_uid: null,
    })
    return current
  })
  return { token, claimId, data }
}

export async function bindMagicLinkClaim({ token, claimId, canonicalUid }) {
  const safeToken = validMagicToken(token)
  const safeClaimId = validClaimId(claimId)
  const uid = String(canonicalUid || '').trim()
  if (!safeToken || !safeClaimId || !uid) throw new MagicLinkError('Reserva de enlace inválida.', 400)

  const db = getAdminDb()
  const ref = db.collection('magic_links').doc(safeToken)
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.data() || {}
    if (!snapshot.exists || current.usado || current.procesando_id !== safeClaimId) {
      throw new MagicLinkError('La reserva del enlace ya no es válida.', 409)
    }
    transaction.update(ref, { procesando_uid: uid })
  })
}

export async function completeMagicLinkClaim({ token, claimId, canonicalUid }) {
  const safeToken = validMagicToken(token)
  const safeClaimId = validClaimId(claimId)
  const uid = String(canonicalUid || '').trim()
  if (!safeToken || !safeClaimId || !uid) throw new MagicLinkError('Confirmación inválida.', 400)

  const db = getAdminDb()
  const ref = db.collection('magic_links').doc(safeToken)
  const now = Date.now()
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.data() || {}
    if (!snapshot.exists || current.usado) throw new MagicLinkError('Este enlace ya fue usado.', 410)
    if (
      current.procesando_id !== safeClaimId
      || current.procesando_uid !== uid
      || now > Number(current.procesando_expira_en || 0)
    ) {
      throw new MagicLinkError('La confirmación del enlace expiró. Intenta nuevamente.', 409)
    }
    transaction.update(ref, {
      usado: true,
      usado_en: now,
      procesando_id: null,
      procesando_en: null,
      procesando_expira_en: null,
      procesando_uid: null,
    })
  })
}

export async function releaseMagicLinkClaim({ token, claimId }) {
  const safeToken = validMagicToken(token)
  const safeClaimId = validClaimId(claimId)
  if (!safeToken || !safeClaimId) return false

  const db = getAdminDb()
  const ref = db.collection('magic_links').doc(safeToken)
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.data() || {}
    if (!snapshot.exists || current.usado || current.procesando_id !== safeClaimId) return false
    transaction.update(ref, {
      procesando_id: null,
      procesando_en: null,
      procesando_expira_en: null,
      procesando_uid: null,
    })
    return true
  })
}
