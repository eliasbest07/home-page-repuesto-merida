import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import {
  MagicLinkError,
  completeMagicLinkClaim,
} from '@/lib/magicLinkClaim'

export const runtime = 'nodejs'

export async function POST(request) {
  try {
    const {
      token,
      claim,
      firebaseIdToken,
      canonicalUid,
    } = await request.json().catch(() => ({}))
    if (!firebaseIdToken || !canonicalUid) {
      return NextResponse.json({ error: 'Confirmación incompleta.' }, { status: 400 })
    }
    const auth = await getAdminAuth()
    const decoded = await auth.verifyIdToken(String(firebaseIdToken))
    if (decoded.uid !== canonicalUid) {
      return NextResponse.json({ error: 'La identidad Firebase no coincide.' }, { status: 403 })
    }
    await completeMagicLinkClaim({
      token,
      claimId: claim,
      canonicalUid: decoded.uid,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof MagicLinkError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[api/auth/magic/complete] No se pudo confirmar la sesión:', error)
    return NextResponse.json({ error: 'No se pudo confirmar la sesión.' }, { status: 500 })
  }
}
