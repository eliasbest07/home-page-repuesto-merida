'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { playerCartones } from '@/lib/bingo';
import { phoneKey } from '@/lib/whatsappAuth';
import { ensureSession, clearSession, getSession } from '@/lib/rifaSession';
import Carton from './components/Carton';

const MODOS = [
  { value: 'linea', label: 'Línea', desc: 'Fila, columna o diagonal' },
  { value: 'L', label: 'Letra L', desc: 'Columna izquierda + fila inferior' },
  { value: 'T', label: 'Letra T', desc: 'Fila superior + columna central' },
  { value: 'lleno', label: 'Cartón lleno', desc: 'Todo el cartón' },
];

const INICIO_OPCIONES = [
  { value: 0, label: 'Ahora (sin horario)' },
  { value: 5, label: 'En 5 minutos' },
  { value: 15, label: 'En 15 minutos' },
  { value: 30, label: 'En 30 minutos' },
  { value: 60, label: 'En 1 hora' },
  { value: 180, label: 'En 3 horas' },
  { value: 720, label: 'En 12 horas' },
  { value: 1440, label: 'En 24 horas' },
];

const FILTROS = [
  { key: 'todas', label: 'Todas' },
  { key: 'proximas', label: 'Próximas' },
  { key: 'populares', label: 'Populares' },
  { key: 'gratis', label: 'Gratis' },
  { key: 'mis', label: 'Mis Salas' },
];

// WhatsApp oficial del bot (donde el bot escucha y responde el enlace mágico).
const WA_OFICIAL = '584123375417';
const MSG_BINGO = 'Hola Oso, quiero iniciar sesión en Repuestos Mérida desde Bingo para crear o unirme a una sala. Mándame el link, por favor.';
function waOficialUrl(mensaje) {
  return `https://wa.me/${WA_OFICIAL}?text=${encodeURIComponent(mensaje)}`;
}

const ICONOS_SALA = ['🏆', '👑', '🎉', '🎱'];
const GRADIENTES_SALA = [
  'from-pink-500 via-rose-500 to-orange-400',
  'from-amber-400 via-yellow-500 to-red-500',
  'from-violet-500 via-purple-500 to-blue-500',
  'from-emerald-400 via-teal-500 to-cyan-500',
];
const PROFILE_PHOTO_KEY = 'bingo_profile_photo';

function saveDisplayName(name) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bingo_display_name', name);
}

function getDisplayName() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('bingo_display_name') || '';
}

function saveProfilePhoto(value) {
  if (typeof window === 'undefined') return;
  if (value) localStorage.setItem(PROFILE_PHOTO_KEY, value);
  else localStorage.removeItem(PROFILE_PHOTO_KEY);
}

function getProfilePhoto() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(PROFILE_PHOTO_KEY) || '';
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecciona una imagen válida.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function formatMoney(value) {
  return `$${new Intl.NumberFormat('es-VE').format(value || 0)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function countdownText(comienzaEn, now) {
  if (!comienzaEn) return null;
  const totalSec = Math.floor((comienzaEn - now) / 1000);
  if (totalSec <= 0) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function hashIndex(str, mod) {
  let acc = 0;
  for (let i = 0; i < (str || '').length; i += 1) acc = (acc * 31 + str.charCodeAt(i)) % 997;
  return acc % mod;
}

// ─── Iconos SVG inline ────────────────────────────────────────────────────────

const IconSearch = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const IconClock = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const IconFire = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2c.7 3.2-.6 5-2.2 6.6C8.1 10.3 6.5 12 6.5 14.7A5.6 5.6 0 0 0 12 20.5a5.7 5.7 0 0 0 5.5-5.8c0-2.8-1.4-4.6-2.6-6C13.6 7 12.5 5 12 2Z" />
  </svg>
);
const IconGift = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </svg>
);
const IconUsers = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTicket = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-6Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </svg>
);
const IconTrash = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
const IconUser = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconPlus = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// ─── Página ───────────────────────────────────────────────────────────────────

export default function BingoLobby() {
  const router = useRouter();

  // Sesión / auth
  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState({ authenticated: false, phone: '' });
  const [authStep, setAuthStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Salas en vivo
  const [salas, setSalas] = useState([]);
  const [salasLoading, setSalasLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // UI
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [modal, setModal] = useState(null); // 'auth' | 'crear' | 'codigo' | null
  const [joinTarget, setJoinTarget] = useState(null);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [cartonBusy, setCartonBusy] = useState('');
  const [error, setError] = useState('');
  const [perfilError, setPerfilError] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState('');

  // Formularios
  const [nombreJugador, setNombreJugador] = useState('');
  const [nombreSala, setNombreSala] = useState('');
  const [modo, setModo] = useState('linea');
  const [intervalo, setIntervalo] = useState(6);
  const [premio, setPremio] = useState('');
  const [precioCarton, setPrecioCarton] = useState('');
  const [enMinutos, setEnMinutos] = useState(30);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);

  const perfilRef = useRef(null);

  useEffect(() => {
    setNombreJugador(getDisplayName());
    setFotoPerfil(getProfilePhoto());
    // La sesión la deja el enlace mágico (rifaSession en localStorage).
    ensureSession()
      .then((s) => {
        if (s?.telefono) {
          setSession({ authenticated: true, phone: s.telefono });
          setAuthStep('done');
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, 'bingoRooms'),
      (snapshot) => {
        const value = snapshot.val() || {};
        setSalas(Object.entries(value).map(([id, room]) => ({ ...room, id })));
        setSalasLoading(false);
      },
      () => setSalasLoading(false)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (perfilRef.current && !perfilRef.current.contains(e.target)) setPerfilAbierto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const miId = session.phone ? phoneKey(session.phone) : '';

  const salasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let list = salas.filter((sala) => {
      if (q && !`${sala.nombre || ''} ${sala.codigo || ''}`.toLowerCase().includes(q)) return false;
      const soyMiembro = Boolean(miId && sala.players?.[miId]);
      switch (filtro) {
        case 'proximas':
          return sala.estado === 'esperando';
        case 'populares':
          return sala.estado !== 'terminado';
        case 'gratis':
          return sala.estado !== 'terminado' && !(sala.precioCarton > 0);
        case 'mis':
          return soyMiembro;
        default:
          return sala.estado !== 'terminado' || soyMiembro;
      }
    });

    if (filtro === 'populares') {
      list = list.sort(
        (a, b) => Object.keys(b.players || {}).length - Object.keys(a.players || {}).length
      );
    } else if (filtro === 'mis') {
      list = list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else {
      // Próximas a comenzar primero; sin horario al final, luego las más recientes
      list = list.sort((a, b) => {
        const aT = a.comienzaEn && a.comienzaEn > now ? a.comienzaEn : Infinity;
        const bT = b.comienzaEn && b.comienzaEn > now ? b.comienzaEn : Infinity;
        if (aT !== bT) return aT - bT;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
    return list;
  }, [salas, busqueda, filtro, miId, now]);

  // ── Auth ──
  async function logout() {
    clearSession();
    setSession({ authenticated: false, phone: '' });
    setAuthStep('phone');
    setOtp('');
    setPerfilAbierto(false);
  }

  function guardarNombrePerfil(value) {
    setNombreJugador(value);
    saveDisplayName(value.trim());
  }

  async function cambiarFotoPerfil(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPerfilError('');
    try {
      const resized = await resizeProfilePhoto(file);
      setFotoPerfil(resized);
      saveProfilePhoto(resized);
    } catch (err) {
      setPerfilError(err.message || 'No se pudo guardar la foto.');
    } finally {
      event.target.value = '';
    }
  }

  function quitarFotoPerfil() {
    setFotoPerfil('');
    saveProfilePhoto('');
  }

  // ── Salas ──
  async function crearSala(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const trimmedName = nombreJugador.trim();
      if (!trimmedName) throw new Error('Ingresa tu nombre.');
      saveDisplayName(trimmedName);

      const res = await fetch('/api/bingo/salas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: getSession()?.token,
          nombreJugador: trimmedName,
          nombreSala,
          modo,
          intervalo,
          premio: Number(premio) || 0,
          precioCarton: Number(precioCarton) || 0,
          enMinutos,
          avatarUrl: fotoPerfil,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la sala.');
      router.push(`/bingo/sala/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la sala.');
      setLoading(false);
    }
  }

  async function unirse({ roomId, codigoSala }) {
    setLoading(true);
    setError('');
    try {
      const trimmedName = nombreJugador.trim();
      if (!trimmedName) throw new Error('Ingresa tu nombre.');
      saveDisplayName(trimmedName);

      const res = await fetch('/api/bingo/unirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: getSession()?.token,
          roomId,
          codigo: codigoSala,
          nombreJugador: trimmedName,
          avatarUrl: fotoPerfil,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo entrar a la sala.');
      router.push(`/bingo/sala/${data.roomId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function verSala(sala) {
    setError('');
    router.push(`/bingo/sala/${sala.id}`);
  }

  async function accionCarton(salaId, action, cartonId) {
    setCartonBusy(`${salaId}:${cartonId || 'add'}`);
    setError('');
    try {
      const res = await fetch(`/api/bingo/salas/${salaId}/accion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: getSession()?.token, action, cartonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el cartón.');
    } catch (err) {
      setError(err.message);
    } finally {
      setCartonBusy('');
    }
  }

  function abrirCrear() {
    setError('');
    setModal(session.authenticated ? 'crear' : 'auth');
  }

  // ── Render ──
  const authForm = (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Verifica tu WhatsApp para crear salas y jugar. Pulsa el botón: te
        abrirá WhatsApp con un mensaje listo. Envíalo y el Oso te responderá con
        un enlace para iniciar sesión y seguir creando tu sala.
      </p>
      <a
        href={waOficialUrl(MSG_BINGO)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-3 font-semibold text-white transition hover:bg-green-400"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.207zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
        </svg>
        Recibir enlace por WhatsApp
      </a>
      <p className="text-xs text-gray-500">
        Se abrirá un chat con nuestro WhatsApp oficial (+{WA_OFICIAL}).
      </p>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-950 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800/70 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
            <span className="font-brand text-2xl font-extrabold text-brand-yellow">Bingo</span>
          </Link>

          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar salas..."
              className="w-full rounded-full border border-gray-800 bg-gray-900 py-2.5 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-brand-yellow"
            />
          </div>

          <button
            onClick={abrirCrear}
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand-yellow px-3.5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-yellow-300 sm:px-4"
          >
            <IconPlus className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Crear Sala</span>
          </button>

          <div className="relative shrink-0" ref={perfilRef}>
            <button
              onClick={() => (session.authenticated ? setPerfilAbierto((v) => !v) : setModal('auth'))}
              aria-label="Perfil"
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                session.authenticated
                  ? 'border-brand-green/50 bg-green-500/10 text-brand-green'
                  : 'border-gray-800 bg-gray-900 text-gray-400 hover:text-white'
              }`}
            >
              {fotoPerfil ? (
                <Image src={fotoPerfil} alt="" width={40} height={40} unoptimized className="h-full w-full rounded-full object-cover" />
              ) : (
                <IconUser className="h-5 w-5" />
              )}
            </button>
            {perfilAbierto && session.authenticated && (
              <div className="absolute right-0 top-12 w-72 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-700 bg-gray-800">
                    {fotoPerfil ? (
                      <Image src={fotoPerfil} alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-gray-300">
                        {nombreJugador.trim()?.[0]?.toUpperCase() || <IconUser className="h-6 w-6" />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Perfil de jugador</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{session.phone}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-gray-700 px-3 text-sm font-semibold text-gray-300 transition hover:border-brand-green hover:text-brand-green">
                    Cambiar foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={cambiarFotoPerfil}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={quitarFotoPerfil}
                    disabled={!fotoPerfil}
                    className="h-10 rounded-xl border border-gray-700 px-3 text-sm font-semibold text-gray-300 transition hover:border-red-500/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-gray-500">
                    Nombre visible
                  </span>
                  <input
                    type="text"
                    value={nombreJugador}
                    onChange={(event) => guardarNombrePerfil(event.target.value)}
                    maxLength={30}
                    placeholder="Ej: María"
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-gray-600 focus:border-brand-yellow"
                  />
                </label>

                {perfilError && <p className="mt-3 text-xs font-semibold text-red-300">{perfilError}</p>}

                <button
                  onClick={logout}
                  className="mt-4 w-full rounded-xl border border-gray-700 px-3 py-2.5 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-4">
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTROS.map((item) => (
              <button
                key={item.key}
                onClick={() => setFiltro(item.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filtro === item.key
                    ? 'bg-brand-yellow text-gray-900'
                    : 'border border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600'
                }`}
              >
                {item.key === 'todas' && <span className="text-base leading-none">☰</span>}
                {item.key === 'proximas' && <IconClock className="h-4 w-4" />}
                {item.key === 'populares' && <IconFire className="h-4 w-4 text-orange-400" />}
                {item.key === 'gratis' && <IconGift className="h-4 w-4 text-rose-400" />}
                {item.key === 'mis' && <IconUsers className="h-4 w-4" />}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-3 pt-4 sm:px-4">
        {/* Banner */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 p-5">
          <div className="relative z-10 max-w-[65%]">
            <h1 className="font-brand text-xl font-extrabold leading-tight text-white sm:text-2xl">
              ¡Juega y gana increíbles premios!
            </h1>
            <p className="mt-1.5 text-sm text-blue-100">
              Únete a las salas de Bingo y gana premios increíbles.
            </p>
          </div>
          <div className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 select-none text-right">
            <span className="block rotate-6 font-brand text-3xl font-extrabold tracking-tight text-brand-yellow drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] sm:text-4xl">
              BINGO!
            </span>
            <span className="mr-4 block text-2xl sm:text-3xl">🪙🎱✨</span>
          </div>
        </section>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500">
            {salasLoading ? 'Cargando salas…' : `${salasFiltradas.length} sala${salasFiltradas.length === 1 ? '' : 's'}`}
          </p>
          <button
            onClick={() => { setError(''); setModal('codigo'); }}
            className="text-xs font-semibold text-brand-yellow transition hover:text-yellow-300"
          >
            ¿Tienes un código de sala?
          </button>
        </div>

        {error && !modal && !joinTarget && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}

        {/* Lista de salas */}
        {!salasLoading && salasFiltradas.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center">
            <p className="text-4xl">🎱</p>
            <p className="mt-3 font-semibold text-white">No hay salas por aquí</p>
            <p className="mt-1 text-sm text-gray-500">
              {filtro === 'mis'
                ? 'Todavía no has entrado a ninguna sala.'
                : 'Crea la primera sala y reparte los cartones.'}
            </p>
            <button
              onClick={abrirCrear}
              className="mt-5 rounded-full bg-brand-yellow px-5 py-2.5 text-sm font-bold text-gray-900 transition hover:bg-yellow-300"
            >
              + Crear Sala
            </button>
          </div>
        )}

        {salasFiltradas.map((sala) => {
          const jugadores = Object.keys(sala.players || {}).length;
          const restante = countdownText(sala.comienzaEn, now);
          const enVivo = sala.estado === 'jugando';
          const terminada = sala.estado === 'terminado';
          const idx = hashIndex(sala.id, ICONOS_SALA.length);
          const miPlayer = miId ? sala.players?.[miId] : null;
          const misCartones = miPlayer ? playerCartones(miPlayer) : [];
          const esperando = sala.estado === 'esperando';

          return (
            <article key={sala.id} className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
              <div className="flex gap-3.5 p-4">
                {/* Icono */}
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-3xl shadow-lg ${GRADIENTES_SALA[idx]}`}
                >
                  {ICONOS_SALA[idx]}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${
                      enVivo
                        ? 'bg-green-500/20 text-brand-green'
                        : terminada
                        ? 'bg-gray-700/50 text-gray-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {enVivo ? 'En vivo' : terminada ? 'Finalizada' : 'Próxima'}
                  </span>
                  <h3 className="mt-1 truncate font-brand text-lg font-bold text-white">{sala.nombre}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <IconUsers className="h-3.5 w-3.5" /> {jugadores} Jugador{jugadores === 1 ? '' : 'es'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/70 px-3 py-1.5">
                      <IconGift className="h-4 w-4 text-brand-green" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Premio</p>
                        <p className="text-sm font-bold text-brand-green">{formatMoney(sala.premio)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/70 px-3 py-1.5">
                      <IconTicket className="h-4 w-4 text-gray-300" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Cartón</p>
                        <p className="text-sm font-bold text-white">
                          {sala.precioCarton > 0 ? formatMoney(sala.precioCarton) : 'Gratis'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Countdown + acción */}
                <div className="flex w-[104px] shrink-0 flex-col justify-between gap-2">
                  <div className="rounded-xl border border-gray-800 bg-gray-950/70 px-2 py-2 text-center">
                    {enVivo ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Partida</p>
                        <p className="font-mono text-lg font-extrabold text-brand-green">EN VIVO</p>
                      </>
                    ) : restante ? (
                      <>
                        <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                          <IconClock className="h-3 w-3" /> Comienza en
                        </p>
                        <p className="font-mono text-xl font-extrabold tabular-nums text-blue-400">{restante}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Estado</p>
                        <p className="text-sm font-bold text-gray-300">{terminada ? 'Cerrada' : 'Por iniciar'}</p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => verSala(sala)}
                    disabled={terminada && !miPlayer}
                    className="rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
                  >
                    Ver sala
                  </button>
                </div>
              </div>

              {/* Tus cartones */}
              {misCartones.length > 0 && !terminada && (
                <div className="border-t border-gray-800 bg-gray-950/60 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <IconTicket className="h-4 w-4 text-brand-yellow" />
                    <p className="text-xs font-extrabold uppercase tracking-widest text-brand-yellow">
                      Tu cartón ({misCartones.length})
                    </p>
                    <span className="text-xs text-gray-500">· Listo para jugar</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {misCartones.map((entry) => (
                      <div key={entry.id} className="w-[180px] shrink-0 rounded-xl border border-gray-800 bg-gray-900 p-2.5">
                        <Carton carton={entry.carton} cantadas={[]} soloVer compact />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="truncate rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-[11px] font-bold text-brand-yellow">
                            Cartón #{entry.id}
                          </span>
                          {esperando && misCartones.length > 1 && (
                            <button
                              onClick={() => accionCarton(sala.id, 'remove-carton', entry.id)}
                              disabled={cartonBusy === `${sala.id}:${entry.id}`}
                              aria-label="Eliminar cartón"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 text-gray-400 transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {esperando && misCartones.length < 4 && (
                      <button
                        onClick={() => accionCarton(sala.id, 'add-carton')}
                        disabled={cartonBusy === `${sala.id}:add`}
                        className="flex w-[110px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 text-gray-500 transition hover:border-brand-yellow hover:text-brand-yellow disabled:opacity-50"
                      >
                        <IconPlus className="h-6 w-6" />
                        <span className="text-xs font-semibold">Otro cartón</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Modal: login */}
      {modal === 'auth' && (
        <Modal titulo="Verifica tu WhatsApp" onCerrar={() => setModal(null)}>
          {!authChecked ? (
            <p className="py-6 text-center text-sm text-gray-500">Validando sesión…</p>
          ) : (
            authForm
          )}
        </Modal>
      )}

      {/* Modal: crear sala */}
      {modal === 'crear' && (
        <Modal titulo="Crear Sala" onCerrar={() => setModal(null)}>
          {!session.authenticated ? (
            authForm
          ) : (
            <form onSubmit={crearSala} className="space-y-4">
              <Campo label="Nombre de la sala">
                <input
                  type="text"
                  value={nombreSala}
                  onChange={(e) => setNombreSala(e.target.value)}
                  maxLength={40}
                  placeholder="Ej: Suerte Máxima"
                  className="input-bingo"
                />
              </Campo>
              <Campo label="Tu nombre visible">
                <input
                  type="text"
                  value={nombreJugador}
                  onChange={(e) => setNombreJugador(e.target.value)}
                  maxLength={30}
                  placeholder="Ej: María"
                  className="input-bingo"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Premio ($)">
                  <input
                    type="number"
                    min="0"
                    value={premio}
                    onChange={(e) => setPremio(e.target.value)}
                    placeholder="500000"
                    className="input-bingo"
                  />
                </Campo>
                <Campo label="Cartón ($ · 0 = gratis)">
                  <input
                    type="number"
                    min="0"
                    value={precioCarton}
                    onChange={(e) => setPrecioCarton(e.target.value)}
                    placeholder="3000"
                    className="input-bingo"
                  />
                </Campo>
              </div>
              <Campo label="Comienza">
                <select
                  value={enMinutos}
                  onChange={(e) => setEnMinutos(Number(e.target.value))}
                  className="input-bingo"
                >
                  {INICIO_OPCIONES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Modo de victoria">
                <div className="grid grid-cols-2 gap-2">
                  {MODOS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setModo(item.value)}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        modo === item.value
                          ? 'border-brand-yellow bg-yellow-500/10 text-brand-yellow'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-[11px] opacity-70">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </Campo>
              <Campo label={`Intervalo automático: ${intervalo}s entre números`}>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={intervalo}
                  onChange={(e) => setIntervalo(Number(e.target.value))}
                  className="w-full"
                />
              </Campo>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-brand-yellow to-yellow-300 px-4 py-3.5 text-lg font-bold text-gray-900 transition hover:scale-[1.01] disabled:opacity-50"
              >
                {loading ? 'Creando…' : 'Crear Sala'}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* Modal: unirse con código */}
      {modal === 'codigo' && (
        <Modal titulo="Unirse con código" onCerrar={() => setModal(null)}>
          {!session.authenticated ? (
            authForm
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); unirse({ codigoSala: codigo }); }}
              className="space-y-4"
            >
              <Campo label="Tu nombre visible">
                <input
                  type="text"
                  value={nombreJugador}
                  onChange={(e) => setNombreJugador(e.target.value)}
                  maxLength={30}
                  placeholder="Ej: María"
                  className="input-bingo"
                />
              </Campo>
              <Campo label="Código de sala">
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  className="input-bingo font-mono tracking-[0.25em]"
                />
              </Campo>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || codigo.length !== 6}
                className="w-full rounded-2xl bg-brand-green px-4 py-3.5 text-lg font-bold text-white transition hover:bg-green-400 disabled:opacity-50"
              >
                {loading ? 'Entrando…' : 'Entrar a la sala'}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* Modal: entrar a sala desde la lista */}
      {joinTarget && (
        <Modal titulo={`Entrar a ${joinTarget.nombre}`} onCerrar={() => setJoinTarget(null)}>
          <form
            onSubmit={(e) => { e.preventDefault(); unirse({ roomId: joinTarget.id }); }}
            className="space-y-4"
          >
            <div className="flex gap-2 text-sm">
              <span className="rounded-lg bg-green-500/10 px-3 py-1.5 font-semibold text-brand-green">
                Premio {formatMoney(joinTarget.premio)}
              </span>
              <span className="rounded-lg bg-gray-800 px-3 py-1.5 font-semibold text-gray-200">
                Cartón {joinTarget.precioCarton > 0 ? formatMoney(joinTarget.precioCarton) : 'Gratis'}
              </span>
            </div>
            {joinTarget.precioCarton > 0 && (
              <p className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                El pago del cartón se coordina con el anfitrión por WhatsApp.
              </p>
            )}
            <Campo label="Tu nombre visible">
              <input
                type="text"
                value={nombreJugador}
                onChange={(e) => setNombreJugador(e.target.value)}
                maxLength={30}
                placeholder="Ej: María"
                className="input-bingo"
              />
            </Campo>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3.5 text-lg font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Tomar cartón y entrar'}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-800 bg-gray-900 p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-brand text-xl font-bold text-white">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 text-gray-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
