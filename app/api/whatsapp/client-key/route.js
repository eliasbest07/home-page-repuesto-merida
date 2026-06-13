import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  WA_BROWSER_COOKIE,
  assertSameOrigin,
  createBrowserId,
  getBrowserCookieOptions,
  issueClientKey,
} from '@/lib/whatsappCapability'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 })
  }

  let browserId = cookies().get(WA_BROWSER_COOKIE)?.value
  if (!browserId) browserId = createBrowserId()

  const credential = issueClientKey(browserId)
  const response = NextResponse.json(credential)
  response.cookies.set(WA_BROWSER_COOKIE, browserId, getBrowserCookieOptions())
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
