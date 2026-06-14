import { NextResponse } from 'next/server';
import { push, ref, set, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import {
  buildRoom,
  createUniqueRoomCode,
  finalizeRoomCode,
  roomPath,
} from '@/lib/bingoRealtime';
import { verifyRifaToken } from '@/lib/rifaJwt';

const VALID_MODES = new Set(['linea', 'L', 'T', 'lleno']);

export async function POST(request) {
  try {
    const body = await request.json();
    // Sesión = JWT que dejó el enlace mágico (sin dependencia del bot).
    const session = verifyRifaToken(body.token);
    const phone = session?.telefono || session?.tel;
    if (!phone) {
      return NextResponse.json({ error: 'Debes verificar tu WhatsApp para crear una sala.' }, { status: 401 });
    }
    session.phone = phone;
    const hostName = String(body.nombreJugador || '').trim();
    const roomName = String(body.nombreSala || '').trim();
    const modo = VALID_MODES.has(body.modo) ? body.modo : 'linea';
    const intervaloSeg = Math.max(3, Math.min(20, Number(body.intervalo) || 6));
    const premio = Math.max(0, Math.min(1_000_000_000, Math.round(Number(body.premio) || 0)));
    const precioCarton = Math.max(0, Math.min(1_000_000_000, Math.round(Number(body.precioCarton) || 0)));
    // Minutos hasta el inicio programado (0 = sin horario, máx 7 días)
    const enMinutos = Math.max(0, Math.min(10080, Math.round(Number(body.enMinutos) || 0)));
    const comienzaEn = enMinutos > 0 ? Date.now() + enMinutos * 60_000 : null;

    if (!hostName) {
      return NextResponse.json({ error: 'Ingresa tu nombre para crear la sala.' }, { status: 400 });
    }

    const roomRef = push(ref(rtdb, 'bingoRooms'));
    const roomId = roomRef.key;
    const code = await createUniqueRoomCode();
    const { room, playerId } = buildRoom({
      roomId,
      code,
      roomName,
      hostName,
      hostPhone: session.phone,
      modo,
      intervaloSeg,
      premio,
      precioCarton,
      comienzaEn,
    });

    await set(roomRef, room);
    await finalizeRoomCode(code, roomId);
    await update(ref(rtdb, `bingoRoomMemberships/${playerId}/${roomId}`), {
      joinedAt: Date.now(),
      role: 'host',
    });

    return NextResponse.json({ ok: true, roomId, playerId, code });
  } catch (error) {
    console.error('[bingo] Error creando sala:', error);
    return NextResponse.json({ error: 'No se pudo crear la sala.' }, { status: 500 });
  }
}
