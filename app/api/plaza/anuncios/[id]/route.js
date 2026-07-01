import { NextResponse } from 'next/server'
import { verifyRifaToken } from '@/lib/rifaJwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function canonPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (digits.startsWith('58') && digits.length >= 12) digits = digits.slice(2)
  return digits.replace(/^0+/, '')
}

function cleanText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanTitle(value) {
  const title = cleanText(value, 90)
  return title ? title[0].toLocaleUpperCase('es-VE') + title.slice(1) : ''
}

export async function PATCH(request, { params }) {
  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const payload = verifyRifaToken(token)
    if (!payload?.tel) return NextResponse.json({ error: 'Inicia sesión para administrar el anuncio.' }, { status: 401 })

    const { adminFieldValue, getAdminDb } = await import('@/lib/firebaseAdmin')
    const ref = getAdminDb().collection('anuncios').doc(String(params.id || ''))
    const snapshot = await ref.get()
    if (!snapshot.exists) return NextResponse.json({ error: 'Anuncio no encontrado.' }, { status: 404 })

    const item = snapshot.data()
    const sessionPhone = canonPhone(payload.telefono || payload.tel)
    // La propiedad corresponde exclusivamente al WhatsApp público utilizado
    // por el botón de contacto del anuncio.
    const ownerPhone = canonPhone(item.whatsapp)
    if (!sessionPhone || sessionPhone !== ownerPhone) {
      return NextResponse.json({ error: 'Este anuncio pertenece a otro número de WhatsApp.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const now = adminFieldValue.serverTimestamp()

    if (body.action === 'retire') {
      await ref.update({ aprobado: false, disponible: false, estado_aprobacion: 'retirado', updatedAt: now })
      return NextResponse.json({ ok: true, estado: 'retirado' })
    }

    if (body.action === 'edit') {
      const titulo = cleanTitle(body.titulo)
      const descripcion = cleanText(body.descripcion, 1000)
      const categoria = cleanText(body.categoria, 60)
      const precio = Number(body.precio)
      if (!titulo || !descripcion || !categoria || !Number.isFinite(precio) || precio < 0) {
        return NextResponse.json({ error: 'Revisa el título, descripción, categoría y precio.' }, { status: 400 })
      }
      await ref.update({
        titulo,
        descripcion,
        categoria,
        precio,
        aprobado: false,
        disponible: true,
        estado_aprobacion: 'pendiente',
        updatedAt: now,
      })
      return NextResponse.json({ ok: true, estado: 'pendiente' })
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'No se pudo actualizar el anuncio.' }, { status: 500 })
  }
}
