'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizePhone } from '@/lib/whatsappAuth';

const MODOS = [
  { value: 'linea', label: 'Línea', desc: 'Fila, columna o diagonal' },
  { value: 'L', label: 'Letra L', desc: 'Columna izquierda + fila inferior' },
  { value: 'T', label: 'Letra T', desc: 'Fila superior + columna central' },
  { value: 'lleno', label: 'Cartón lleno', desc: 'Todo el cartón' },
];

function saveDisplayName(name) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bingo_display_name', name);
}

function getDisplayName() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('bingo_display_name') || '';
}

export default function BingoLanding() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [session, setSession] = useState({ authenticated: false, phone: '' });
  const [authStep, setAuthStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [tab, setTab] = useState('crear');
  const [nombreJugador, setNombreJugador] = useState('');
  const [nombreSala, setNombreSala] = useState('');
  const [modo, setModo] = useState('linea');
  const [intervalo, setIntervalo] = useState(6);
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNombreJugador(getDisplayName());
    fetch('/api/bingo/auth/session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setSession(data);
        if (data.authenticated) {
          setAuthStep('done');
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  async function sendCode() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setAuthError('Ingresa un número de WhatsApp válido.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/bingo/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: normalized }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el código.');
      setPhone(normalized);
      setAuthStep('otp');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyCode() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/bingo/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: phone, codigo: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo verificar el código.');
      setSession({ authenticated: true, phone: data.phone });
      setAuthStep('done');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await fetch('/api/bingo/auth/logout', { method: 'POST' });
    setSession({ authenticated: false, phone: '' });
    setAuthStep('phone');
    setOtp('');
  }

  async function handleCrear(e) {
    e.preventDefault();
    if (!session.authenticated) {
      setError('Primero verifica tu WhatsApp.');
      return;
    }

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
          nombreJugador: trimmedName,
          nombreSala,
          modo,
          intervalo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la sala.');
      router.push(`/bingo/sala/${data.roomId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleUnirse(e) {
    e.preventDefault();
    if (!session.authenticated) {
      setError('Primero verifica tu WhatsApp.');
      return;
    }

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
          codigo,
          nombreJugador: trimmedName,
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

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[420px,1fr]">
        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <div className="mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow text-3xl shadow-lg shadow-yellow-500/30">
              🎱
            </div>
            <h1 className="mt-4 font-brand text-3xl text-white">Bingo en vivo</h1>
            <p className="mt-2 text-sm text-gray-400">
              Cada sala es una partida en tiempo real. Para entrar debes verificar tu WhatsApp.
            </p>
          </div>

          {!authChecked ? (
            <div className="py-8 text-center text-sm text-gray-500">Validando sesión…</div>
          ) : session.authenticated ? (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-green-300">WhatsApp verificado</p>
              <p className="mt-2 text-lg font-semibold text-white">{session.phone}</p>
              <button
                onClick={logout}
                className="mt-4 rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {authStep === 'phone' && (
                <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Registro</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Verifica tu número</h2>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+58 424 000 0000"
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white outline-none transition focus:border-brand-yellow"
                  />
                  {authError && <p className="text-sm text-red-400">{authError}</p>}
                  <button
                    onClick={sendCode}
                    disabled={authLoading || !phone.trim()}
                    className="w-full rounded-xl bg-brand-yellow px-4 py-3 font-semibold text-gray-900 transition hover:bg-yellow-300 disabled:opacity-50"
                  >
                    {authLoading ? 'Enviando…' : 'Enviar código por WhatsApp'}
                  </button>
                </div>
              )}

              {authStep === 'otp' && (
                <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-950/60 p-5">
                  <p className="text-sm text-gray-400">Código enviado a {phone}</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white outline-none transition focus:border-brand-yellow"
                  />
                  {authError && <p className="text-sm text-red-400">{authError}</p>}
                  <button
                    onClick={verifyCode}
                    disabled={authLoading || otp.length !== 6}
                    className="w-full rounded-xl bg-brand-green px-4 py-3 font-semibold text-white transition hover:bg-green-400 disabled:opacity-50"
                  >
                    {authLoading ? 'Verificando…' : 'Verificar código'}
                  </button>
                  <button
                    onClick={() => { setAuthStep('phone'); setOtp(''); setAuthError(''); }}
                    className="w-full text-sm text-gray-500 transition hover:text-gray-300"
                  >
                    Cambiar número
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
          <div className="mb-6 flex rounded-2xl bg-gray-950 p-1">
            {['crear', 'unirse'].map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  tab === value
                    ? value === 'crear'
                      ? 'bg-brand-yellow text-gray-900'
                      : 'bg-brand-green text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {value === 'crear' ? 'Crear sala' : 'Unirse a sala'}
              </button>
            ))}
          </div>

          <form onSubmit={tab === 'crear' ? handleCrear : handleUnirse} className="space-y-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Tu nombre visible
              </label>
              <input
                type="text"
                value={nombreJugador}
                onChange={(e) => setNombreJugador(e.target.value)}
                maxLength={30}
                placeholder="Ej: María"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition focus:border-brand-yellow"
              />
            </div>

            {tab === 'crear' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Nombre de la sala
                  </label>
                  <input
                    type="text"
                    value={nombreSala}
                    onChange={(e) => setNombreSala(e.target.value)}
                    maxLength={40}
                    placeholder="Ej: Bingo familiar"
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none transition focus:border-brand-yellow"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Modo de victoria
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MODOS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setModo(item.value)}
                        className={`rounded-xl border p-3 text-left transition ${
                          modo === item.value
                            ? 'border-brand-yellow bg-yellow-500/10 text-brand-yellow'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs opacity-70">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Intervalo automático
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="20"
                    value={intervalo}
                    onChange={(e) => setIntervalo(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="mt-2 text-sm text-gray-400">{intervalo} segundos entre números</p>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Código de sala
                </label>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABC123"
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 font-mono tracking-[0.25em] text-white outline-none transition focus:border-brand-green"
                />
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !session.authenticated}
              className="w-full rounded-2xl bg-gradient-to-r from-brand-yellow to-yellow-300 px-4 py-4 text-lg font-bold text-gray-900 transition hover:scale-[1.01] disabled:opacity-50"
            >
              {loading ? 'Procesando…' : tab === 'crear' ? 'Crear partida' : 'Entrar a la sala'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
