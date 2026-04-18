import { NextResponse } from 'next/server';
import { getWhatsAppAuthBase, getWhatsAppAuthHeaders, normalizePhone } from '@/lib/whatsappAuth';

export async function POST(request) {
  try {
    const { telefono } = await request.json();
    const phone = normalizePhone(telefono);

    if (!phone) {
      return NextResponse.json({ error: 'Ingresa un número de WhatsApp válido.' }, { status: 400 });
    }

    const response = await fetch(`${getWhatsAppAuthBase()}/auth/solicitar-otp`, {
      method: 'POST',
      headers: getWhatsAppAuthHeaders(),
      body: JSON.stringify({ telefono: phone }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'No se pudo enviar el código por WhatsApp.' },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo solicitar el código.' }, { status: 500 });
  }
}
