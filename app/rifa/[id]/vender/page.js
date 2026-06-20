'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { rtdb } from '@/lib/firebase'
import { ref as dbRef, onValue, update, get, serverTimestamp } from 'firebase/database'
import { phoneKey, clearSession, ensureSession } from '@/lib/rifaSession'

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-base w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'

const ESTADO_COLOR = {
  disponible: 'bg-white border-gray-200 text-gray-800 hover:border-yellow-400',
  reservado:  'bg-yellow-100 border-yellow-400 text-yellow-900',
  vendido:    'bg-emerald-500 border-emerald-600 text-white',
}

function formatVES(n) {
  return Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function VenderPage() {
  const router = useRouter()
  const { id } = useParams()
  const [session, setSessionState] = useState(null)
  const [rifa, setRifa] = useState(null)
  const [numeros, setNumeros] = useState({})
  const [autorizado, setAutorizado] = useState(false)

  const [selNum, setSelNum] = useState(null)
  const [compNombre, setCN] = useState('')
  const [compTel, setCT] = useState('')
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => {
    ensureSession().then((s) => {
      const cur = typeof window !== 'undefined' ? window.location.pathname : '/rifa/dashboard'
      if (!s?.telefono) { router.replace('/login?redirect=' + encodeURIComponent(cur)); return }
      setSessionState(s)
    })
  }, [router])

  useEffect(() => {
    if (!id || !session?.telefono) return
    const key = phoneKey(session.telefono)
    const r1 = onValue(dbRef(rtdb, `rifas/${id}`), (snap) => setRifa(snap.exists() ? { id, ...snap.val() } : null))
    const r2 = onValue(dbRef(rtdb, `rifas/${id}/numeros`), (snap) => setNumeros(snap.val() || {}))
    // Verificar autorización
    get(dbRef(rtdb, `rifas/${id}/vendedores/${key}`)).then((snap) => {
      const esVendedor = snap.exists()
      const esCreador = Boolean(session.telefono && rifa?.creador && phoneKey(session.telefono) === phoneKey(rifa.creador))
      setAutorizado(esVendedor || esCreador)
    })
    return () => { r1(); r2() }
  }, [id, session, rifa?.creador])

  const stats = useMemo(() => {
    const key = phoneKey(session?.telefono || '')
    const mias = Object.values(numeros).filter((n) => n?.vendedor === key && n?.estado === 'vendido').length
    const totales = Object.values(numeros).filter((n) => n?.estado === 'vendido').length
    return { mias, totales, recaudado: mias * Number(rifa?.precio_numero || 0) }
  }, [numeros, session, rifa])

  async function venderNumero() {
    if (selNum == null) return
    setErrMsg(null); setSaving(true)
    try {
      if (!compNombre.trim()) throw new Error('Nombre del comprador requerido')
      if (!compTel.trim()) throw new Error('Teléfono del comprador requerido')
      const key = phoneKey(session.telefono)
      const numEstado = numeros[selNum]?.estado
      if (numEstado !== 'disponible') throw new Error('Ese número ya no está disponible')

      const vendidosActuales = Object.values(numeros).filter((n) => n?.estado === 'vendido').length

      await update(dbRef(rtdb), {
        [`rifas/${id}/numeros/${selNum}`]: {
          estado: 'vendido',
          vendedor: key,
          comprador_nombre: compNombre.trim(),
          comprador_telefono: compTel.trim(),
          vendido_en: Date.now(),
        },
        [`rifas/${id}/numeros_vendidos`]: vendidosActuales + 1,
      })

      setSelNum(null); setCN(''); setCT('')
    } catch (e) {
      setErrMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  function salir() { clearSession(); router.replace('/rifa') }

  if (!session) return null
  if (!rifa) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>
  if (!autorizado) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold">No autorizado</h2>
      <p className="text-sm text-gray-500">No formas parte del equipo de vendedores de esta rifa.</p>
      <button onClick={salir} className="btn-brand">Salir</button>
    </div>
  )

  const num = selNum != null ? numeros[selNum] : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50">
      <nav className="bg-gray-900 h-14 flex items-center justify-between px-4 shadow-lg sticky top-0 z-40">
        <Link href="/rifa" className="text-gray-400 hover:text-white text-sm">Inicio</Link>
        <span className="text-white font-bold font-brand text-sm truncate max-w-[50%]">Vender · {rifa.titulo}</span>
        <button onClick={salir} className="text-gray-400 hover:text-white text-sm">Salir</button>
      </nav>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="text-xs text-gray-500">Premio</div>
          <div className="font-bold text-gray-900 mb-1">{rifa.premio}</div>
          <div className="text-sm font-bold text-yellow-700">Bs. {formatVES(rifa.precio_numero)} por número</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-2xl font-bold text-emerald-600">{stats.mias}</div>
            <div className="text-xs text-gray-500">Tus ventas</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-2xl font-bold text-gray-800">{stats.totales}/100</div>
            <div className="text-xs text-gray-500">Total rifa</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-lg font-bold text-gray-900">Bs. {formatVES(stats.recaudado)}</div>
            <div className="text-xs text-gray-500">Tu recaudo</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Toca un número disponible para venderlo</h3>
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {Array.from({ length: 100 }, (_, i) => {
              const k = String(i).padStart(2, '0')
              const n = numeros[k] || { estado: 'disponible' }
              const disponible = n.estado === 'disponible'
              return (
                <button
                  key={k}
                  onClick={() => disponible ? setSelNum(k) : null}
                  disabled={!disponible}
                  className={`aspect-square rounded-lg border-2 text-xs sm:text-sm font-bold transition-all ${ESTADO_COLOR[n.estado]} ${disponible ? '' : 'cursor-not-allowed'}`}
                >
                  {k}
                </button>
              )
            })}
          </div>
        </div>
      </main>

      {selNum != null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelNum(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-5xl font-bold font-brand">{selNum}</div>
              <div className="text-xs text-gray-500 mt-1">Bs. {formatVES(rifa.precio_numero)}</div>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Nombre del comprador</span>
              <input value={compNombre} onChange={(e) => setCN(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Teléfono</span>
              <input value={compTel} onChange={(e) => setCT(e.target.value)} type="tel" className={FIELD} placeholder="+58 424..." />
            </label>
            <button onClick={venderNumero} disabled={saving} className="btn-brand w-full justify-center">
              {saving ? 'Guardando...' : `Marcar ${selNum} como vendido`}
            </button>
            {errMsg && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{errMsg}</div>}
            <button onClick={() => setSelNum(null)} className="w-full text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
