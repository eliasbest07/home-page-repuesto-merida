import { NextResponse } from 'next/server';

// Descontinuado: el login del bingo ya no usa código OTP. Ahora se inicia
// sesión con el enlace mágico de WhatsApp (botón wa.me → el bot responde un
// enlace que la web valida contra Firebase). Sin dependencia al servidor del bot.
export async function POST() {
  return NextResponse.json(
    { error: 'Método descontinuado. Inicia sesión con el enlace de WhatsApp.' },
    { status: 410 }
  );
}
