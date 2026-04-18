import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ref, runTransaction } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import {
  claimBingoState,
  createPlayerId,
  drawNextNumberState,
  restartRoomState,
  roomPath,
  startRoomState,
} from '@/lib/bingoRealtime';
import { BINGO_SESSION_COOKIE, readBingoSession } from '@/lib/bingoSession';

function unauthorized(message) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function POST(request, { params }) {
  try {
    const session = readBingoSession(cookies().get(BINGO_SESSION_COOKIE)?.value);
    if (!session?.phone) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { action } = await request.json();
    const playerId = createPlayerId(session.phone);
    const targetRef = ref(rtdb, roomPath(params.id));

    const tx = await runTransaction(targetRef, (room) => {
      if (!room) {
        throw new Error('Sala no encontrada.');
      }

      const isHost = room.hostPlayerId === playerId;

      switch (action) {
        case 'start':
          if (!isHost) throw new Error('__HOST_ONLY__');
          return startRoomState(room);
        case 'draw':
          if (!isHost) throw new Error('__HOST_ONLY__');
          return drawNextNumberState(room);
        case 'toggle-auto':
          if (!isHost) throw new Error('__HOST_ONLY__');
          return {
            ...room,
            autoCantar: !room.autoCantar,
            updatedAt: Date.now(),
          };
        case 'reset':
          if (!isHost) throw new Error('__HOST_ONLY__');
          return restartRoomState(room);
        case 'claim':
          if (!room.players?.[playerId]) throw new Error('__PLAYER_REQUIRED__');
          return claimBingoState(room, playerId);
        default:
          throw new Error('__INVALID_ACTION__');
      }
    });

    if (!tx.committed || !tx.snapshot.exists()) {
      return NextResponse.json({ error: 'No se pudo completar la acción.' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, room: tx.snapshot.val() });
  } catch (error) {
    if (error.message === '__HOST_ONLY__') {
      return unauthorized('Solo el anfitrión puede realizar esa acción.');
    }
    if (error.message === '__PLAYER_REQUIRED__') {
      return unauthorized('Debes estar dentro de la sala para jugar.');
    }
    if (error.message === '__INVALID_ACTION__') {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'No se pudo completar la acción.' }, { status: 500 });
  }
}
