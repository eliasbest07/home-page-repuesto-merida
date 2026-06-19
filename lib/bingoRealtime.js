import { get, ref, runTransaction, update } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import {
  checkBingo,
  generateCarton,
  generateCartonId,
  generateCode,
  generarBombo,
  playerCartones,
} from '@/lib/bingo';

export const MAX_CARTONES_POR_JUGADOR = 4;

export function newCartonEntry(now = Date.now()) {
  return { filas: generateCarton(), creadoEn: now };
}
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
  hostAvatarUrl = '',
  modo,
  intervaloSeg,
  premio = 0,
  precioCarton = 0,
  comienzaEn = null,
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
      premio,
      precioCarton,
      comienzaEn,
      bombo: [],
      ganador: null,
      createdAt: now,
      updatedAt: now,
      players: {
        [playerId]: {
          nombre: hostName,
          telefono: hostPhone,
          avatarUrl: hostAvatarUrl,
          cartones: { [generateCartonId()]: newCartonEntry(now) },
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
    Object.entries(room.players || {}).map(([playerId, player]) => {
      const renovado = { ...player, gano: false };
      if (player.cartones && typeof player.cartones === 'object') {
        renovado.cartones = Object.fromEntries(
          Object.entries(player.cartones).map(([cartonId, data]) => [
            cartonId,
            { ...data, filas: generateCarton() },
          ])
        );
      } else {
        renovado.carton = generateCarton();
      }
      return [playerId, renovado];
    })
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
      const cartonGanador = playerCartones(player).find((entry) =>
        checkBingo(entry.carton, numerosCantados, room.modoVictoria || 'linea')
      );
      if (cartonGanador) {
        players[playerId] = { ...player, gano: true };
        ganador = { jugadorId: playerId, nombre: player.nombre, cartonId: cartonGanador.id };
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
  const cartonGanador = playerCartones(player).find((entry) =>
    checkBingo(entry.carton, cantadas, modo)
  );
  if (!cartonGanador) {
    throw new Error('Ninguno de tus cartones cumple el patrón ganador todavía.');
  }

  return {
    ...room,
    estado: 'terminado',
    ganador: { jugadorId: playerId, nombre: player.nombre, cartonId: cartonGanador.id },
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

export function addCartonState(room, playerId) {
  const player = room.players?.[playerId];
  if (!player) {
    throw new Error('Jugador no encontrado.');
  }
  if (room.estado !== 'esperando') {
    throw new Error('Solo puedes agregar cartones antes de iniciar la partida.');
  }

  const now = Date.now();
  const cartones = { ...(player.cartones || {}) };
  // Migra el cartón legado (campo `carton`) al mapa con id propio
  if (!player.cartones && player.carton) {
    cartones[generateCartonId()] = { filas: player.carton, creadoEn: player.joinedAt || now };
  }
  if (Object.keys(cartones).length >= MAX_CARTONES_POR_JUGADOR) {
    throw new Error(`Máximo ${MAX_CARTONES_POR_JUGADOR} cartones por jugador.`);
  }
  cartones[generateCartonId()] = newCartonEntry(now);

  return {
    ...room,
    players: {
      ...(room.players || {}),
      [playerId]: { ...player, carton: null, cartones },
    },
    updatedAt: now,
  };
}

export function removeCartonState(room, playerId, cartonId) {
  const player = room.players?.[playerId];
  if (!player) {
    throw new Error('Jugador no encontrado.');
  }
  if (room.estado !== 'esperando') {
    throw new Error('Solo puedes eliminar cartones antes de iniciar la partida.');
  }

  const actuales = playerCartones(player);
  if (actuales.length <= 1) {
    throw new Error('Debes conservar al menos un cartón.');
  }
  if (!actuales.some((entry) => entry.id === cartonId)) {
    throw new Error('Cartón no encontrado.');
  }

  const cartones = Object.fromEntries(
    actuales
      .filter((entry) => entry.id !== cartonId)
      .map((entry) => [entry.id, { filas: entry.carton, creadoEn: entry.creadoEn }])
  );

  return {
    ...room,
    players: {
      ...(room.players || {}),
      [playerId]: { ...player, carton: null, cartones },
    },
    updatedAt: Date.now(),
  };
}
