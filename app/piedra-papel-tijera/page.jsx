'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ref, get, set } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { ensureSession, phoneKey } from '@/lib/rifaSession'

const OPTIONS = [
  { key: 'piedra', label: 'Piedra', icon: '✊', beats: 'tijera', color: 'border-slate-300 bg-slate-50 text-slate-900' },
  { key: 'papel', label: 'Papel', icon: '✋', beats: 'piedra', color: 'border-sky-300 bg-sky-50 text-sky-900' },
  { key: 'tijera', label: 'Tijera', icon: '✌️', beats: 'papel', color: 'border-rose-300 bg-rose-50 text-rose-900' },
]

const OPTION_BY_KEY = Object.fromEntries(OPTIONS.map((option) => [option.key, option]))
const SPIN_DELAYS = [70, 80, 95, 115, 145, 185, 235, 300, 380]
const INITIAL_CREDITS = 20

function pickRandomOption() {
  return OPTIONS[Math.floor(Math.random() * OPTIONS.length)]
}

function getResult(playerKey, rivalKey) {
  if (playerKey === rivalKey) return 'draw'
  return OPTION_BY_KEY[playerKey].beats === rivalKey ? 'win' : 'loss'
}

function resultCopy(result) {
  if (result === 'win') return { title: 'Ganaste', tone: 'text-emerald-300', badge: 'bg-emerald-400 text-gray-950' }
  if (result === 'loss') return { title: 'Perdiste', tone: 'text-red-300', badge: 'bg-red-400 text-white' }
  return { title: 'Empate', tone: 'text-yellow-300', badge: 'bg-yellow-300 text-gray-950' }
}

export default function PiedraPapelTijeraPage() {
  const [playerChoice, setPlayerChoice] = useState(null)
  const [rivalChoice, setRivalChoice] = useState(null)
  const [result, setResult] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [creditsEnabled, setCreditsEnabled] = useState(false)
  const [credits, setCredits] = useState(INITIAL_CREDITS)
  const [stake, setStake] = useState(1)
  const [creditMessage, setCreditMessage] = useState('')
  const [history, setHistory] = useState([])
  const timersRef = useRef([])

  // Crédito sincronizado en RTDB solo si el usuario inició sesión con WhatsApp.
  const [userKey, setUserKey] = useState(null)
  const [persistReady, setPersistReady] = useState(false)

  const resultState = result ? resultCopy(result) : null
  const canPlayWithCredits = !creditsEnabled || credits >= stake

  const stats = useMemo(() => {
    return history.reduce(
      (acc, item) => {
        acc[item.result] += 1
        return acc
      },
      { win: 0, draw: 0, loss: 0 }
    )
  }, [history])

  function clearTimers() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timersRef.current = []
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  // Al entrar: si hay sesión con WhatsApp, carga el crédito guardado del usuario.
  useEffect(() => {
    let cancelled = false
    ensureSession().then(async (s) => {
      if (cancelled || !s?.telefono) return
      const key = phoneKey(s.telefono)
      try {
        const snap = await get(ref(rtdb, `users/${key}/credito_juego`))
        const saved = snap.val()
        if (!cancelled && typeof saved === 'number' && Number.isFinite(saved)) {
          setCredits(saved)
        }
      } catch {}
      if (!cancelled) {
        setUserKey(key)
        setPersistReady(true)
      }
    })
    return () => { cancelled = true }
  }, [])

  // Guarda en RTDB cada vez que cambia el crédito (solo si inició con WhatsApp).
  useEffect(() => {
    if (!persistReady || !userKey) return
    set(ref(rtdb, `users/${userKey}/credito_juego`), credits).catch(() => {})
  }, [credits, userKey, persistReady])

  function settleCredits(roundResult, currentStake) {
    if (!creditsEnabled) return ''

    if (roundResult === 'win') {
      setCredits((value) => value + currentStake * 2)
      return `+${currentStake * 2} créditos`
    }

    if (roundResult === 'draw') {
      setCredits((value) => value + currentStake)
      return 'Crédito devuelto'
    }

    return `-${currentStake} crédito${currentStake === 1 ? '' : 's'}`
  }

  function play(option) {
    if (isPlaying) return

    if (creditsEnabled && credits < stake) {
      setCreditMessage('Créditos insuficientes')
      return
    }

    clearTimers()
    setIsPlaying(true)
    setPlayerChoice(option)
    setResult(null)
    setCreditMessage('')
    setRivalChoice(pickRandomOption())

    const roundStake = stake
    if (creditsEnabled) setCredits((value) => value - roundStake)

    const finalRival = pickRandomOption()
    let elapsed = 0

    SPIN_DELAYS.forEach((delay, index) => {
      elapsed += delay
      const timerId = window.setTimeout(() => {
        if (index === SPIN_DELAYS.length - 1) {
          const roundResult = getResult(option.key, finalRival.key)
          const creditSummary = settleCredits(roundResult, roundStake)

          setRivalChoice(finalRival)
          setResult(roundResult)
          setCreditMessage(creditSummary)
          setHistory((items) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              player: option,
              rival: finalRival,
              result: roundResult,
              creditSummary,
            },
            ...items.slice(0, 5),
          ])
          setIsPlaying(false)
          return
        }

        setRivalChoice(OPTIONS[index % OPTIONS.length])
      }, elapsed)
      timersRef.current.push(timerId)
    })
  }

  function resetCredits() {
    if (isPlaying) return
    setCredits(INITIAL_CREDITS)
    setCreditMessage('')
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-800 bg-gray-900 text-yellow-300">
            ←
          </Link>
          <div className="min-w-0 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">Club Repuestos Mérida</p>
            <h1 className="font-brand text-xl text-white">Piedra, papel o tijera</h1>
          </div>
          <div className="h-10 w-10" />
        </header>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-2xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-gray-500">Tú</p>
              <div className="mt-3 text-6xl leading-none">{playerChoice?.icon || '•'}</div>
              <p className="mt-3 min-h-5 text-sm font-bold text-gray-200">{playerChoice?.label || 'Elige'}</p>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-gray-500">Rival</p>
              <div className={`mt-3 text-6xl leading-none ${isPlaying ? 'scale-110 transition-transform' : ''}`}>
                {rivalChoice?.icon || '•'}
              </div>
              <p className="mt-3 min-h-5 text-sm font-bold text-gray-200">
                {rivalChoice?.label || 'Esperando'}
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-[74px] rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-center">
            {isPlaying ? (
              <>
                <p className="text-sm font-semibold text-gray-300">Revelando jugada...</p>
                <div className="mx-auto mt-3 h-2 w-40 overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-yellow-300" />
                </div>
              </>
            ) : resultState ? (
              <>
                <p className={`font-brand text-3xl ${resultState.tone}`}>{resultState.title}</p>
                {creditMessage ? <p className="mt-1 text-xs font-bold text-gray-400">{creditMessage}</p> : null}
              </>
            ) : (
              <>
                <p className="font-brand text-2xl text-yellow-300">Listo</p>
                <p className="mt-1 text-xs text-gray-400">Selecciona una opción para iniciar.</p>
              </>
            )}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => play(option)}
              disabled={isPlaying || !canPlayWithCredits}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border p-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${option.color}`}
            >
              <span className="text-4xl leading-none">{option.icon}</span>
              <span className="mt-2 text-xs font-extrabold">{option.label}</span>
            </button>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">Modo créditos</p>
              <p className="text-xs text-gray-500">Apuesta, gana, empata o pierde créditos.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (isPlaying) return
                setCreditsEnabled((value) => !value)
                setCreditMessage('')
              }}
              className={`relative h-8 w-14 rounded-full border transition ${
                creditsEnabled ? 'border-yellow-300 bg-yellow-300' : 'border-gray-700 bg-gray-950'
              }`}
              aria-label="Activar modo créditos"
              aria-pressed={creditsEnabled}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                  creditsEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-950 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500">Créditos</p>
              <p className="mt-1 font-brand text-3xl text-yellow-300">{credits}</p>
              <p className="mt-1 text-[10px] font-bold">
                {userKey ? (
                  <span className="text-emerald-400">✓ Guardado en tu cuenta</span>
                ) : (
                  <span className="text-gray-600">Inicia con WhatsApp para guardar</span>
                )}
              </p>
            </div>
            <div className="rounded-xl bg-gray-950 p-3">
              <p className="text-xs font-semibold uppercase text-gray-500">Apuesta</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStake((value) => Math.max(1, value - 1))}
                  disabled={isPlaying}
                  className="h-8 w-8 rounded-lg bg-gray-800 text-lg font-bold text-white disabled:opacity-40"
                >
                  −
                </button>
                <span className="font-brand text-2xl text-white">{stake}</span>
                <button
                  type="button"
                  onClick={() => setStake((value) => Math.min(5, value + 1))}
                  disabled={isPlaying}
                  className="h-8 w-8 rounded-lg bg-gray-800 text-lg font-bold text-white disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {!canPlayWithCredits ? (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs font-bold text-red-300">
              No tienes créditos suficientes para esa apuesta.
            </p>
          ) : null}

          <button
            type="button"
            onClick={resetCredits}
            disabled={isPlaying}
            className="mt-3 w-full rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-bold text-gray-300 disabled:opacity-40"
          >
            Reiniciar créditos
          </button>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-emerald-400/10 p-3">
            <p className="font-brand text-2xl text-emerald-300">{stats.win}</p>
            <p className="text-[11px] font-bold text-emerald-200">Ganadas</p>
          </div>
          <div className="rounded-xl bg-yellow-300/10 p-3">
            <p className="font-brand text-2xl text-yellow-300">{stats.draw}</p>
            <p className="text-[11px] font-bold text-yellow-200">Empates</p>
          </div>
          <div className="rounded-xl bg-red-400/10 p-3">
            <p className="font-brand text-2xl text-red-300">{stats.loss}</p>
            <p className="text-[11px] font-bold text-red-200">Perdidas</p>
          </div>
        </section>

        {history.length > 0 ? (
          <section className="mt-4 space-y-2 pb-6">
            {history.map((item) => {
              const itemResult = resultCopy(item.result)
              return (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
                  <div className="flex items-center gap-2 text-xl">
                    <span>{item.player.icon}</span>
                    <span className="text-xs font-bold text-gray-500">vs</span>
                    <span>{item.rival.icon}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${itemResult.badge}`}>
                    {itemResult.title}
                  </span>
                </div>
              )
            })}
          </section>
        ) : null}
      </section>
    </main>
  )
}
