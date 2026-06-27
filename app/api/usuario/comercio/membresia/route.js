import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMERCIOS_COLLECTION = 'comercios_autorizados'

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canonPhone(raw) {
  let d = cleanPhone(raw)
  if (!d) return ''
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || ''
}

export async function GET(request) {
  try {
    const payload = verifyRifaToken(bearerToken(request))
    const telefono = cleanPhone(payload?.telefono || payload?.tel)
    if (!payload || telefono.length < 10) {
      return NextResponse.json({ ok: false, autorizado: false }, { status: 401 })
    }

    const target = canonPhone(telefono)
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const snap = await getAdminDb().collection(COMERCIOS_COLLECTION).get()

    // Coincide si el teléfono de la sesión es el WhatsApp/dueño de algún comercio
    // autorizado. El whatsapp puede venir como placeholder, así que se comparan
    // los varios campos de teléfono del documento.
    let autorizado = false
    snap.forEach((doc) => {
      if (autorizado) return
      const d = doc.data() || {}
      const candidates = [d.whatsapp, d.whatsapp_normalizado, d.telefono_usuario, d.telefono_key]
      if (candidates.some((value) => value && canonPhone(value) === target)) {
        autorizado = true
      }
    })

    return NextResponse.json({ ok: true, autorizado })
  } catch (error) {
    return NextResponse.json({ ok: false, autorizado: false, error: error?.message || 'Error' }, { status: 200 })
  }
}
