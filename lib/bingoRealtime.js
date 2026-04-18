import { get, ref, runTransaction, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { checkBingo, generateCarton, generateCode, generarBombo } from '@/lib/bingo';
import { phoneKey } from '@/lib/whatsappAuth';

export function roomPath(roomId) {
  return `bingoRooms/${roomId}`;
}

export function roomCodePath(code) {
  return `bingoRoomCodes/${code}`;
}

export function createPlayerId(phone) {
  return phoneKey(phone);
}

export function normalizePlayersMap(players = {}) {
  return Object.entries(players || {}).map(([id, player]) => ({ id, ...player }));
}

export async function resolveRoomIdByCode(code) {
  const snap = await get(ref(rtdb, roomCodePath(code)));
  return snap.exists() ? snap.val() : null;
}

export async function readRoom(roomId) {
  const snap = await get(ref(rtdb, roomPath(roomId)));
  return snap.exists() ? snap.val() : null;
}

export async function createUniqueRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateCode();
    const claim = await runTransaction(ref(rtdb, roomCodePath(code)), (current) => current || '__pending__');
    if (claim.committed && claim.snapshot.val() === '__pending__') {
      return code;
    }
  }
  throw new Error('No se pudo generar un código de sala único.');
}

export async function finalizeRoomCode(code, roomId) {
  await update(ref(rtdb), {
    [roomCodePath(code)]: roomId,
  });
}

export function buildRoom({
  roomId,
  code,
  roomName,
  hostName,
  hostPhone,
  modo,
  intervaloSeg,
}) {
  const playerId = createPlayerId(hostPhone);
  const now = Date.now();

  return {
    room: {
      id: roomId,
      codigo: code,
      nombre: roomName || `Sala de ${hostName}`,
      hostPlayerId: playerId,
      hostNombre: hostName,
      hostTelefono: hostPhone,
      estado: 'esperando',
      numerosCantados: [],
      ultimoNumero: null,
      modoVictoria: modo,
      autoCantar: false,
      intervaloSeg,
      bombo: [],
      ganador: null,
      createdAt: now,
      updatedAt: now,
      players: {
        [playerId]: {
          nombre: hostName,
          telefono: hostPhone,
          carton: generateCarton(),
          gano: false,
          isHost: true,
          joinedAt: now,
        },
      },
    },
    playerId,
  };
}

export function restartRoomState(room) {
  const players = Object.fromEntries(
    Object.entries(room.players || {}).map(([playerId, player]) => [
      playerId,
      {
        ...player,
        carton: generateCarton(),
        gano: false,
      },
    ])
  );

  return {
    ...room,
    estado: 'esperando',
    numerosCantados: [],
    ultimoNumero: null,
    ganador: null,
    autoCantar: false,
    bombo: [],
    players,
    updatedAt: Date.now(),
  };
}

export function startRoomState(room) {
  return {
    ...room,
    estado: 'jugando',
    numerosCantados: [],
    ultimoNumero: null,
    ganador: null,
    bombo: generarBombo(),
    updatedAt: Date.now(),
  };
}

export function drawNextNumberState(room) {
  if (room.estado !== 'jugando') {
    throw new Error('La partida no está activa.');
  }

  const bombo = Array.isArray(room.bombo) ? [...room.bombo] : [];
  const siguiente = bombo.shift();
  if (!siguiente) {
    throw new Error('No quedan números por cantar.');
  }

  const numerosCantados = [...(room.numerosCantados || []), siguiente];
  const players = { ...(room.players || {}) };
  let ganador = room.ganador || null;
  let estado = room.estado;

  if (!ganador) {
    for (const [playerId, player] of Object.entries(players)) {
      if (player.gano) continue;
      if (checkBingo(player.carton, numerosCantados, room.modoVictoria || 'linea')) {
        players[playerId] = { ...player, gano: true };
        ganador = { jugadorId: playerId, nombre: player.nombre };
        estado = 'terminado';
        break;
      }
    }
  }

  return {
    ...room,
    bombo,
    numerosCantados,
    ultimoNumero: siguiente,
    players,
    ganador,
    estado,
    updatedAt: Date.now(),
  };
}

export function claimBingoState(room, playerId) {
  const player = room.players?.[playerId];
  if (!player) {
    throw new Error('Jugador no encontrado.');
  }
  if (room.estado !== 'jugando') {
    throw new Error('La partida no está activa.');
  }
  const cantadas = room.numerosCantados || [];
  const modo = room.modoVictoria || 'linea';
  if (!checkBingo(player.carton, cantadas, modo)) {
    throw new Error('Ese cartón todavía no cumple el patrón ganador.');
  }

  return {
    ...room,
    estado: 'terminado',
    ganador: { jugadorId: playerId, nombre: player.nombre },
    players: {
      ...(room.players || {}),
      [playerId]: {
        ...player,
        gano: true,
      },
    },
    updatedAt: Date.now(),
  };
}
