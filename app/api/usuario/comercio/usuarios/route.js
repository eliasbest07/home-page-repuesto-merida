import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'
import { canManageCommerces } from '@/lib/comercioAuthorization'
import { compareRealtimeUsers, realtimeUidTier } from '@/lib/realtimeUserLookup'

// Control de usuarios nuevos desde la ruta de autorización.
//
// La app Android deja publicar cuando `users/{uid}` tiene `whatsapp` y
// `cedula` (ver `verificacionParaPublicar` en la app). Aprobar aquí escribe la
// cédula en esas cuentas. Las fotos de la cédula vienen de dos lugares:
// - App: Realtime `verificarCedula/{uid}` (`fotocedula`, `fotocaracedula`),
//   como URL pública vieja o como ruta privada de Storage.
// - Web: Firestore `verificaciones_cedula/{telefono}` (`archivos.*.path`).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEB_VERIFICATION_COLLECTION = 'verificaciones_cedula'
const SIGNED_URL_TTL_MS = 15 * 60 * 1000
const MAX_PENDING = 60

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function cleanText(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function authPayload(request) {
  const payload = verifyRifaToken(bearerToken(request))
  const telefono = cleanPhone(payload?.telefono || payload?.tel)
  if (!payload || telefono.length < 10) return null
  return { ...payload, telefono }
}

function userPhones(uid, user = {}) {
  const phones = [user.whatsapp, user.telefono, user.phone, user.id]
    .map(canonPhone)
    .filter((phone) => phone.length >= 10)
  if (phones.length === 0 && canonPhone(uid).length >= 10) phones.push(canonPhone(uid))
  return phones
}

function cedulaDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

// Mismo criterio que la app: basta con que exista `cedula` y `whatsapp`.
function canPublishInApp(user = {}) {
  return Boolean(String(user.whatsapp ?? '').trim()) && Boolean(String(user.cedula ?? '').trim())
}

function summarizeAccount(uid, user = {}) {
  return {
    uid,
    real_account: realtimeUidTier(uid) === 0,
    nombre: cleanText(user.nombre || user.google_nombre, 120),
    nombre_comercio: cleanText(user.nombre_comercio, 120),
    foto: cleanText(user.foto || user.foto_url, 500),
    whatsapp: cleanText(user.whatsapp, 30),
    telefono: cleanText(user.telefono, 30),
    cedula: cleanText(user.cedula, 20),
    cedula_estado: cleanText(user.cedula_estado, 30).toLowerCase(),
    cedula_actualizada_en: Number(user.cedula_actualizada_en) || null,
    cedula_aprobada_por: cleanText(user.cedula_aprobada_por, 30),
    vender: user.vender === true,
    ciudad: cleanText(user.ciudad, 80),
    fecha: cleanText(user.fecha, 40),
    puede_publicar_app: canPublishInApp(user),
  }
}

async function photoUrl(bucket, value) {
  const raw = cleanText(value, 1000)
  if (!raw) return ''
  // Las URLs viejas de la app apuntan a archivos que ya pueden no existir:
  // se convierten a ruta para comprobarlo y firmar una URL nueva.
  const storageUrl = raw.match(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/i)
  if (/^https?:\/\//i.test(raw) && !storageUrl) return raw
  const path = storageUrl ? decodeURIComponent(storageUrl[1]) : raw.replace(/^\/+/, '')
  try {
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) return ''
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + SIGNED_URL_TTL_MS })
    return url
  } catch {
    return ''
  }
}

async function appCedulaPhotos(rtdb, bucket, uid) {
  const snap = await rtdb.ref(`verificarCedula/${uid}`).get()
  if (!snap.exists()) return null
  const data = snap.val() || {}
  const [cedula, selfie] = await Promise.all([
    photoUrl(bucket, data.fotocedula),
    photoUrl(bucket, data.fotocaracedula),
  ])
  if (!cedula && !selfie) return null
  return { origen: 'app', uid, cedula, selfie }
}

async function webVerification(db, bucket, phone) {
  const canon = canonPhone(phone)
  if (canon.length < 10) return null
  const ids = Array.from(new Set([cleanPhone(phone), `58${canon}`, canon, `0${canon}`]))
  const snaps = await db.getAll(...ids.map((id) => db.collection(WEB_VERIFICATION_COLLECTION).doc(id)))
  const doc = snaps.find((item) => item.exists)
  if (!doc) return null
  const data = doc.data() || {}
  const [cedula, selfie] = await Promise.all([
    photoUrl(bucket, data.archivos?.cedula?.path),
    photoUrl(bucket, data.archivos?.selfie_cedula?.path),
  ])
  const gemini = data.gemini?.cedula || {}
  return {
    origen: 'web',
    id: doc.id,
    estado: cleanText(data.estado, 30).toLowerCase(),
    cedula,
    selfie,
    numero: cedulaDigits(gemini.numero),
    nombres: cleanText(gemini.nombres || data.nombres, 120),
    apellidos: cleanText(gemini.apellidos || data.apellidos, 120),
    fecha_nacimiento: cleanText(gemini.fecha_nacimiento, 30),
  }
}

function matchingAccounts(users, target) {
  return Object.entries(users || {})
    .filter(([uid, user]) => user && typeof user === 'object' && userPhones(uid, user).includes(target))
    .map(([uid, user]) => ({ uid, user }))
    .sort(compareRealtimeUsers)
}

async function requireAdmin(request) {
  const session = authPayload(request)
  if (!session) return { error: NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 }) }
  const admin = await import('@/lib/firebaseAdmin')
  const rtdb = admin.getAdminRealtimeDb()
  const authorized = await canManageCommerces(rtdb, session)
  if (!authorized) {
    return { error: NextResponse.json({ error: 'No tienes permiso para revisar usuarios.' }, { status: 403 }) }
  }
  return { session, admin, rtdb }
}

export async function GET(request) {
  try {
    const ctx = await requireAdmin(request)
    if (ctx.error) return ctx.error
    const { admin, rtdb } = ctx
    const bucket = admin.getAdminBucket()
    const db = admin.getAdminDb()
    const rawPhone = new URL(request.url).searchParams.get('telefono')
    const target = canonPhone(rawPhone)

    // Sin teléfono: usuarios que subieron la cédula en la app y todavía no
    // tienen `cedula` en su cuenta, es decir, esperan aprobación.
    if (!target) {
      const [pendingSnap, usersSnap] = await Promise.all([
        rtdb.ref('verificarCedula').get(),
        rtdb.ref('users').get(),
      ])
      const users = usersSnap.exists() ? usersSnap.val() || {} : {}
      const pendientes = Object.entries(pendingSnap.exists() ? pendingSnap.val() || {} : {})
        .filter(([uid, data]) => data && typeof data === 'object' && (data.fotocedula || data.fotocaracedula)
          && !String(users[uid]?.cedula ?? '').trim())
        .slice(0, MAX_PENDING)
        .map(([uid]) => {
          const user = users[uid] || {}
          return {
            ...summarizeAccount(uid, user),
            telefono_busqueda: userPhones(uid, user)[0] || '',
          }
        })
      return NextResponse.json({ ok: true, pendientes })
    }

    if (target.length < 10) {
      return NextResponse.json({ error: 'Escribe un número de teléfono completo.' }, { status: 400 })
    }

    const usersSnap = await rtdb.ref('users').get()
    const users = usersSnap.exists() ? usersSnap.val() || {} : {}
    const matches = matchingAccounts(users, target)
    const [appPhotos, web] = await Promise.all([
      Promise.all(matches.map(({ uid }) => appCedulaPhotos(rtdb, bucket, uid))),
      webVerification(db, bucket, rawPhone),
    ])

    const cuentas = matches.map(({ uid, user }) => summarizeAccount(uid, user))
    const appAccounts = cuentas.filter((account) => account.real_account)
    return NextResponse.json({
      ok: true,
      telefono: `+58${target}`,
      encontrado: cuentas.length > 0,
      cuentas,
      // La app publica con la cuenta real (uid de Google/Apple o wa_…).
      puede_publicar_app: appAccounts.length > 0
        ? appAccounts.every((account) => account.puede_publicar_app)
        : cuentas.some((account) => account.puede_publicar_app),
      fotos: [...appPhotos.filter(Boolean), ...(web && (web.cedula || web.selfie) ? [web] : [])],
      verificacion_web: web,
      cedula_sugerida: web?.numero || cuentas.map((account) => cedulaDigits(account.cedula)).find(Boolean) || '',
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo buscar el usuario.' }, { status: 400 })
  }
}

export async function POST(request) {
  try {
    const ctx = await requireAdmin(request)
    if (ctx.error) return ctx.error
    const { session, rtdb } = ctx
    const body = await request.json().catch(() => ({}))
    const target = canonPhone(body.telefono)
    const accion = body.accion === 'revocar' ? 'revocar' : 'aprobar'
    const cedula = cedulaDigits(body.cedula)
    if (target.length < 10) return NextResponse.json({ error: 'Teléfono inválido.' }, { status: 400 })
    if (accion === 'aprobar' && (cedula.length < 6 || cedula.length > 10)) {
      return NextResponse.json({ error: 'Escribe el número de cédula (6 a 10 dígitos).' }, { status: 400 })
    }

    const usersSnap = await rtdb.ref('users').get()
    const matches = matchingAccounts(usersSnap.exists() ? usersSnap.val() || {} : {}, target)
    if (matches.length === 0) {
      return NextResponse.json({ error: 'No hay ninguna cuenta con ese teléfono.' }, { status: 404 })
    }
    // Se escribe en todas las cuentas reales del teléfono (la app lee la suya
    // por uid). Si solo existen nodos del panel, se usa el mejor de ellos.
    const realAccounts = matches.filter(({ uid }) => realtimeUidTier(uid) === 0)
    const targets = realAccounts.length > 0 ? realAccounts : [matches[0]]

    const now = Date.now()
    const patch = {}
    for (const { uid, user } of targets) {
      if (accion === 'aprobar') {
        patch[`users/${uid}/cedula`] = cedula
        patch[`users/${uid}/cedula_estado`] = 'aprobado'
        patch[`users/${uid}/cedula_actualizada_en`] = now
        patch[`users/${uid}/cedula_aprobada_por`] = session.telefono
        // Sin `whatsapp` la app tampoco deja publicar.
        if (!String(user.whatsapp ?? '').trim()) patch[`users/${uid}/whatsapp`] = `58${target}`
      } else {
        patch[`users/${uid}/cedula`] = null
        patch[`users/${uid}/cedula_estado`] = 'rechazado'
        patch[`users/${uid}/cedula_actualizada_en`] = now
        patch[`users/${uid}/cedula_aprobada_por`] = session.telefono
      }
    }
    await rtdb.ref().update(patch)

    return NextResponse.json({ ok: true, accion, cuentas: targets.map(({ uid }) => uid) })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el usuario.' }, { status: 400 })
  }
}
