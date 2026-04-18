'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onValue, ref } from 'firebase/database';
import Carton from '../../components/Carton';
import ControlesHost from '../../components/ControlesHost';
import ListaJugadores from '../../components/ListaJugadores';
import ModalGanador from '../../components/ModalGanador';
import TableroCantadas from '../../components/TableroCantadas';
import { normalizePlayersMap, roomPath } from '@/lib/bingoRealtime';
import { rtdb } from '@/lib/firebase';
import { phoneKey } from '@/lib/whatsappAuth';

function getStoredName() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('bingo_display_name') || '';
}

export default function SalaBingo() {
  const { id } = useParams();
  const router = useRouter();

  const [room, setRoom] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cantando, setCantando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [ganadorModal, setGanadorModal] = useState(null);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);
  const [activeTab, setActiveTab] = useState('carton');
  const autoIntervalRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    fetch('/api/bingo/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (!data.authenticated) {
          router.replace('/bingo');
          return;
        }
        setSession(data);
      })
      .catch(() => {
        if (mounted) {
          router.replace('/bingo');
        }
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!id) return undefined;

    const unsubscribe = onValue(
      ref(rtdb, roomPath(id)),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError('Sala no encontrada.');
          setLoading(false);
          return;
        }

        const value = snapshot.val();
        setRoom(value);
        setLoading(false);

        if (value.estado === 'terminado' && value.ganador) {
          setGanadorModal(value.ganador);
          setMostrarModal(true);
        }
      },
      () => {
        setError('No se pudo sincronizar la sala.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const jugadores = useMemo(() => {
    const list = normalizePlayersMap(room?.players).sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });
    return list;
  }, [room?.players]);

  const miJugadorId = session?.phone ? phoneKey(session.phone) : '';
  const miJugador = jugadores.find((player) => player.id === miJugadorId) || null;
  const esHost = room?.hostPlayerId === miJugadorId;
  const cantadas = room?.numerosCantados || [];
  const esTuGanador = Boolean(ganadorModal && ganadorModal.jugadorId === miJugadorId);

  async function runAction(action) {
    setActionError('');
    const res = await fetch(`/api/bingo/salas/${id}/accion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo completar la acción.');
    }
    return data;
  }

  async function iniciarJuego() {
    try {
      await runAction('start');
      setActiveTab('carton');
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function cantarSiguiente() {
    if (cantando) return;
    setCantando(true);
    try {
      await runAction('draw');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCantando(false);
    }
  }

  async function toggleAutoCantar() {
    try {
      await runAction('toggle-auto');
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function nuevaPartida() {
    try {
      await runAction('reset');
      setMostrarModal(false);
      setGanadorModal(null);
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function reclamarBingo() {
    try {
      await runAction('claim');
    } catch (err) {
      setActionError(err.message);
    }
  }

  useEffect(() => {
    clearInterval(autoIntervalRef.current);

    if (room?.autoCantar && room?.estado === 'jugando' && esHost) {
      autoIntervalRef.current = setInterval(() => {
        cantarSiguiente();
      }, (room.intervaloSeg || 6) * 1000);
    }

    return () => clearInterval(autoIntervalRef.current);
  }, [room?.autoCantar, room?.estado, room?.intervaloSeg, esHost]); // eslint-disable-line react-hooks/exhaustive-deps

  function copiarCodigo() {
    if (!room?.codigo) return;
    navigator.clipboard.writeText(room.codigo);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 1500);
  }

  function compartirWhatsApp() {
    if (!room?.codigo) return;
    const text = encodeURIComponent(
      `Te invito a una partida de bingo.\nCódigo: *${room.codigo}*\nEntra en ${window.location.origin}/bingo`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-yellow border-t-transparent" />
          <p className="mt-3 text-sm text-gray-400">Conectando a la sala…</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="text-center">
          <p className="text-lg text-red-400">{error || 'Sala no disponible.'}</p>
          <button
            onClick={() => router.push('/bingo')}
            className="mt-4 rounded-xl bg-brand-yellow px-5 py-3 font-semibold text-gray-900"
          >
            Volver a bingo
          </button>
        </div>
      </div>
    );
  }

  const cardsStrip = (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
          Cartones en sala
        </h2>
        <span className="text-xs text-gray-500">{jugadores.length} jugadores</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
        {jugadores.map((player) => (
          <div
            key={player.id}
            className={`min-w-[190px] rounded-2xl border p-3 ${
              player.id === miJugadorId
                ? 'border-brand-yellow bg-yellow-500/10'
                : player.gano
                ? 'border-green-500/40 bg-green-500/10'
                : 'border-gray-800 bg-gray-900'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {player.nombre}
                  {player.id === miJugadorId ? ' (tú)' : ''}
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                  {player.isHost ? 'Anfitrión' : 'Jugador'}
                </p>
              </div>
              {player.gano && (
                <span className="rounded-full bg-brand-yellow px-2 py-1 text-[10px] font-bold text-gray-900">
                  BINGO
                </span>
              )}
            </div>
            <Carton carton={player.carton} cantadas={cantadas} ultimoNum={room.ultimoNumero} soloVer compact />
          </div>
        ))}
      </div>
    </section>
  );

  if (room.estado === 'esperando') {
    return (
      <main className="min-h-screen bg-gray-950 px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-3xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Sala lista</p>
                <h1 className="mt-2 font-brand text-3xl text-white">{room.nombre}</h1>
                <p className="mt-2 text-sm text-gray-400">
                  Todos los jugadores entran con WhatsApp verificado.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-700 bg-gray-950 px-6 py-4 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Código</p>
                <button onClick={copiarCodigo} className="mt-2 font-mono text-4xl font-extrabold tracking-[0.3em] text-brand-yellow">
                  {room.codigo}
                </button>
                <button
                  onClick={compartirWhatsApp}
                  className="mt-4 w-full rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#128C7E]"
                >
                  Invitar por WhatsApp
                </button>
              </div>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6">
              {cardsStrip}
            </div>

            <div className="space-y-6">
              <ListaJugadores jugadores={jugadores} hostNombre={room.hostNombre} miJugadorId={miJugadorId} />
              {actionError && <p className="text-sm text-red-400">{actionError}</p>}
              {esHost ? (
                <ControlesHost sala={room} jugadores={jugadores} onIniciar={iniciarJuego} />
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
                  Esperando al anfitrión. Cuando inicie la partida, los cartones se sincronizan en tiempo real.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{room.nombre}</p>
            <p className="text-xs text-gray-500">
              {room.estado === 'jugando' ? 'Partida en vivo' : 'Partida terminada'}
            </p>
          </div>
          <button
            onClick={copiarCodigo}
            className="rounded-lg bg-gray-800 px-3 py-2 font-mono text-xs text-gray-300 transition hover:text-brand-yellow"
          >
            {room.codigo} {copiadoCodigo ? '✓' : '⎘'}
          </button>
        </div>
      </header>

      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="mx-auto flex max-w-6xl">
          {[
            { key: 'carton', label: 'Cartón' },
            { key: 'numeros', label: 'Números' },
            { key: 'jugadores', label: 'Sala' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'border-b-2 border-brand-yellow text-brand-yellow'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr),320px]">
        <section className="space-y-5">
          {activeTab === 'carton' && (
            <>
              {room.ultimoNumero ? (
                <div className="flex items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900 px-4 py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-yellow font-brand text-3xl font-extrabold text-gray-900">
                    {room.ultimoNumero}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Último número</p>
                    <p className="text-2xl font-bold text-white">{room.ultimoNumero}</p>
                  </div>
                  <p className="ml-auto text-sm text-gray-500">{cantadas.length}/75</p>
                </div>
              ) : null}

              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Tu cartón</p>
                    <p className="text-lg font-semibold text-white">{miJugador?.nombre || getStoredName()}</p>
                  </div>
                  {miJugador?.gano && (
                    <span className="rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-gray-900">
                      Ganador
                    </span>
                  )}
                </div>

                {miJugador ? (
                  <Carton carton={miJugador.carton} cantadas={cantadas} ultimoNum={room.ultimoNumero} />
                ) : (
                  <p className="text-center text-sm text-gray-500">Aún no apareces en esta sala.</p>
                )}

                {!esHost && room.estado === 'jugando' && miJugador && !miJugador.gano && (
                  <button
                    onClick={reclamarBingo}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 to-brand-yellow py-4 font-brand text-2xl font-extrabold tracking-[0.2em] text-gray-900 transition hover:scale-[1.01]"
                  >
                    ¡BINGO!
                  </button>
                )}
              </div>

              {cardsStrip}
            </>
          )}

          {activeTab === 'numeros' && (
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
              <TableroCantadas cantadas={cantadas} ultimoNum={room.ultimoNumero} />
            </div>
          )}

          {activeTab === 'jugadores' && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
                <ListaJugadores jugadores={jugadores} hostNombre={room.hostNombre} miJugadorId={miJugadorId} />
              </div>
              {cardsStrip}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Partida</p>
              <button
                onClick={compartirWhatsApp}
                className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#128C7E]"
              >
                WhatsApp
              </button>
            </div>
            <p className="text-lg font-semibold text-white">{room.codigo}</p>
            <p className="mt-2 text-sm text-gray-400">
              {room.modoVictoria === 'linea' ? 'Línea' : room.modoVictoria} · {room.intervaloSeg}s
            </p>
          </div>

          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
            <ListaJugadores jugadores={jugadores} hostNombre={room.hostNombre} miJugadorId={miJugadorId} />
          </div>

          {actionError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {actionError}
            </div>
          )}

          {esHost && (
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
              <ControlesHost
                sala={room}
                jugadores={jugadores}
                onIniciar={iniciarJuego}
                onCantarNum={cantarSiguiente}
                onToggleAuto={toggleAutoCantar}
                onNuevaPartida={nuevaPartida}
                cantando={cantando}
              />
            </div>
          )}
        </aside>
      </div>

      {mostrarModal && ganadorModal && (
        <ModalGanador
          ganador={ganadorModal}
          esTu={esTuGanador}
          esHost={esHost}
          onCerrar={() => setMostrarModal(false)}
          onNuevaPartida={nuevaPartida}
        />
      )}
    </main>
  );
}
