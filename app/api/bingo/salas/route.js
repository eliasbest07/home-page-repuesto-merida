import { NextResponse } from 'next/server';
import { push, ref, set, update } from 'firebase/database';
import { cookies } from 'next/headers';
import { rtdb } from '@/lib/firebase';
import {
  buildRoom,
  createUniqueRoomCode,
  finalizeRoomCode,
  roomPath,
} from '@/lib/bingoRealtime';
import { BINGO_SESSION_COOKIE, readBingoSession } from '@/lib/bingoSession';

const VALID_MODES = new Set(['linea', 'L', 'T', 'lleno']);

export async function POST(request) {
  try {
    const session = readBingoSession(cookies().get(BINGO_SESSION_COOKIE)?.value);
    if (!session?.phone) {
      return NextResponse.json({ error: 'Debes verificar tu WhatsApp para crear una sala.' }, { status: 401 });
    }

    const body = await request.json();
    const hostName = String(body.nombreJugador || '').trim();
    const roomName = String(body.nombreSala || '').trim();
    const modo = VALID_MODES.has(body.modo) ? body.modo : 'linea';
    const intervaloSeg = Math.max(3, Math.min(20, Number(body.intervalo) || 6));

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
    });

    await set(roomRef, room);
    await finalizeRoomCode(code, roomId);
    await update(ref(rtdb, `bingoRoomMemberships/${playerId}/${roomId}`), {
      joinedAt: Date.now(),
      role: 'host',
    });

    return NextResponse.json({ ok: true, roomId, playerId, code });
  } catch {
    return NextResponse.json({ error: 'No se pudo crear la sala.' }, { status: 500 });
  }
}
