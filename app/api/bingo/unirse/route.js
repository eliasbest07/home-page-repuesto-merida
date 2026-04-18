import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ref, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import {
  createPlayerId,
  readRoom,
  resolveRoomIdByCode,
  roomPath,
} from '@/lib/bingoRealtime';
import { generateCarton } from '@/lib/bingo';
import { BINGO_SESSION_COOKIE, readBingoSession } from '@/lib/bingoSession';

export async function POST(request) {
  try {
    const session = readBingoSession(cookies().get(BINGO_SESSION_COOKIE)?.value);
    if (!session?.phone) {
      return NextResponse.json({ error: 'Debes verificar tu WhatsApp para entrar a una sala.' }, { status: 401 });
    }

    const body = await request.json();
    const codigo = String(body.codigo || '').trim().toUpperCase();
    const nombre = String(body.nombreJugador || '').trim();

    if (codigo.length !== 6) {
      return NextResponse.json({ error: 'El código de sala debe tener 6 caracteres.' }, { status: 400 });
    }
    if (!nombre) {
      return NextResponse.json({ error: 'Ingresa tu nombre.' }, { status: 400 });
    }

    const roomId = await resolveRoomIdByCode(codigo);
    if (!roomId) {
      return NextResponse.json({ error: 'Sala no encontrada.' }, { status: 404 });
    }

    const room = await readRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Sala no disponible.' }, { status: 404 });
    }
    if (room.estado === 'terminado') {
      return NextResponse.json({ error: 'La sala ya terminó.' }, { status: 409 });
    }

    const playerId = createPlayerId(session.phone);
    const existing = room.players?.[playerId];
    const player = existing || {
      nombre,
      telefono: session.phone,
      carton: generateCarton(),
      gano: false,
      isHost: false,
      joinedAt: Date.now(),
    };

    await update(ref(rtdb), {
      [`${roomPath(roomId)}/players/${playerId}`]: {
        ...player,
        nombre,
      },
      [`${roomPath(roomId)}/updatedAt`]: Date.now(),
      [`bingoRoomMemberships/${playerId}/${roomId}`]: {
        joinedAt: player.joinedAt || Date.now(),
        role: existing?.isHost ? 'host' : 'player',
      },
    });

    return NextResponse.json({ ok: true, roomId, playerId });
  } catch {
    return NextResponse.json({ error: 'No se pudo entrar a la sala.' }, { status: 500 });
  }
}
