import { NextResponse } from 'next/server';

// Descontinuado: ver request-code. El bingo ahora usa el enlace mágico de
// WhatsApp + Firebase, sin OTP ni dependencia al servidor del bot.
export async function POST() {
  return NextResponse.json(
    { error: 'Método descontinuado. Inicia sesión con el enlace de WhatsApp.' },
    { status: 410 }
  );
}
