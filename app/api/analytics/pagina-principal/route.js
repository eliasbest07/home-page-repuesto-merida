import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAILY_COLLECTION = 'analytics_pagina_principal_diario'
const SESSIONS_COLLECTION = 'analytics_pagina_principal_sesiones'

function bearerToken(request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let phone = cleanPhone(raw)
  if (phone.startsWith('58') && phone.length >= 12) phone = phone.slice(2)
  return phone.replace(/^0+/, '')
}

function isAuthorized(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function meridaDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function canReadAnalytics(request, rtdb) {
  const payload = verifyRifaToken(bearerToken(request))
  const rawPhone = payload?.telefono || payload?.tel
  if (!payload || cleanPhone(rawPhone).length < 10) return false

  const direct = await rtdb.ref(`rifas_usuarios/${cleanPhone(rawPhone)}/autorizado`).get()
  if (isAuthorized(direct.val())) return true

  const target = canonPhone(rawPhone)
  const users = await rtdb.ref('users').get()
  for (const [key, user] of Object.entries(users.val() || {})) {
    if (!user || typeof user !== 'object') continue
    const phone = canonPhone(user.whatsapp || user.telefono || key)
    if (phone === target && isAuthorized(user.autorizado)) return true
  }
  return false
}

export async function POST(request) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    if (/bot|crawler|spider|slurp|preview/i.test(userAgent)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const body = await request.json().catch(() => ({}))
    const sessionId = String(body.session_id || '')
    const action = body.action === 'heartbeat' ? 'heartbeat' : 'start'
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(sessionId)) {
      return NextResponse.json({ error: 'Sesión de visita inválida.' }, { status: 400 })
    }

    const { getAdminDb, adminFieldValue } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId)

    if (action === 'start') {
      const day = meridaDay()
      const dailyRef = db.collection(DAILY_COLLECTION).doc(day)
      await db.runTransaction(async (transaction) => {
        const [sessionSnap, dailySnap] = await Promise.all([
          transaction.get(sessionRef),
          transaction.get(dailyRef),
        ])
        if (sessionSnap.exists) return
        const daily = dailySnap.data() || {}
        transaction.set(sessionRef, {
          day,
          duration_seconds: 0,
          started_at: adminFieldValue.serverTimestamp(),
          updated_at: adminFieldValue.serverTimestamp(),
        })
        transaction.set(dailyRef, {
          day,
          visits: Number(daily.visits || 0) + 1,
          total_duration_seconds: Number(daily.total_duration_seconds || 0),
          updated_at: adminFieldValue.serverTimestamp(),
        })
      })
      return NextResponse.json({ ok: true })
    }

    const duration = Math.max(0, Math.min(86400, Math.floor(Number(body.duration_seconds) || 0)))
    await db.runTransaction(async (transaction) => {
      const sessionSnap = await transaction.get(sessionRef)
      if (!sessionSnap.exists) return
      const session = sessionSnap.data() || {}
      const previousDuration = Number(session.duration_seconds || 0)
      const delta = Math.max(0, duration - previousDuration)
      if (!delta) return
      const dailyRef = db.collection(DAILY_COLLECTION).doc(session.day)
      const dailySnap = await transaction.get(dailyRef)
      const daily = dailySnap.data() || {}
      transaction.update(sessionRef, {
        duration_seconds: duration,
        updated_at: adminFieldValue.serverTimestamp(),
      })
      transaction.set(dailyRef, {
        day: session.day,
        visits: Number(daily.visits || 0),
        total_duration_seconds: Number(daily.total_duration_seconds || 0) + delta,
        updated_at: adminFieldValue.serverTimestamp(),
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo registrar la visita.' }, { status: 400 })
  }
}

export async function GET(request) {
  try {
    const { getAdminDb, getAdminRealtimeDb } = await import('@/lib/firebaseAdmin')
    if (!await canReadAnalytics(request, getAdminRealtimeDb())) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    const snap = await getAdminDb().collection(DAILY_COLLECTION).orderBy('day', 'desc').limit(30).get()
    const days = snap.docs.map((doc) => {
      const data = doc.data() || {}
      const visits = Number(data.visits || 0)
      const totalDuration = Number(data.total_duration_seconds || 0)
      return {
        day: data.day || doc.id,
        visits,
        average_duration_seconds: visits ? Math.round(totalDuration / visits) : 0,
      }
    })
    return NextResponse.json({ ok: true, days })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudieron cargar las estadísticas.' }, { status: 400 })
  }
}
