import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  BINGO_SESSION_COOKIE,
  createBingoSession,
  getBingoCookieOptions,
} from '@/lib/bingoSession';
import { getWhatsAppAuthBase, getWhatsAppAuthHeaders, normalizePhone } from '@/lib/whatsappAuth';

export async function POST(request) {
  try {
    const { telefono, codigo } = await request.json();
    const phone = normalizePhone(telefono);
    const otp = String(codigo || '').trim();

    if (!phone || otp.length !== 6) {
      return NextResponse.json({ error: 'Datos de verificación inválidos.' }, { status: 400 });
    }

    const response = await fetch(`${getWhatsAppAuthBase()}/auth/verificar-otp`, {
      method: 'POST',
      headers: getWhatsAppAuthHeaders(),
      body: JSON.stringify({ telefono: phone, codigo: otp }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'No se pudo verificar el código.' },
        { status: response.status }
      );
    }

    const token = createBingoSession({
      phone,
      token: data.token || '',
      verifiedAt: Date.now(),
    });

    cookies().set(BINGO_SESSION_COOKIE, token, getBingoCookieOptions());
    return NextResponse.json({ ok: true, phone });
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar el código.' }, { status: 500 });
  }
}
