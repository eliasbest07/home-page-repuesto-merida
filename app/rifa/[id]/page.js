'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { rtdb } from '@/lib/firebase'
import { ref as dbRef, onValue, update, remove, serverTimestamp } from 'firebase/database'
import { phoneKey, ensureSession } from '@/lib/rifaSession'
import { descargarPngEstadoRifa } from '@/lib/rifaCanvas'
import { normalizePhone } from '@/lib/whatsappAuth'
import { buildWhatsAppRequest } from '@/lib/whatsappClient'

const ESTADO_COLOR = {
  disponible: 'bg-white border-gray-200 text-gray-800 hover:border-yellow-400',
  reservado:  'bg-yellow-100 border-yellow-400 text-yellow-900',
  vendido:    'bg-emerald-500 border-emerald-600 text-white',
}

function formatVES(n) {
  return Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function RifaDetallePage() {
  const router = useRouter()
  const { id } = useParams()
  const [session, setSessionState] = useState(null)
  const [rifa, setRifa] = useState(null)
  const [numeros, setNumeros] = useState({})
  const [vendedores, setVendedores] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('numeros') // 'numeros' | 'vendedores'

  const [showAsignar, setShowAsignar] = useState(false)
  const [vNombre, setVNombre] = useState('')
  const [vTel, setVTel] = useState('')
  const [vMsg, setVMsg] = useState(null)
  const [vError, setVError] = useState(null)
  const [vLoading, setVLoading] = useState(false)

  const [selNum, setSelNum] = useState(null)
  const [pngBusy, setPngBusy] = useState(false)

  useEffect(() => {
    ensureSession().then((s) => {
      const cur = typeof window !== 'undefined' ? window.location.pathname : '/rifa/dashboard'
      if (!s?.telefono) { router.replace('/login?redirect=' + encodeURIComponent(cur)); return }
      if (!s.perfil) { router.replace('/registro?redirect=' + encodeURIComponent(cur)); return }
      setSessionState(s)
    })
  }, [router])

  useEffect(() => {
    if (!id) return
    const r1 = onValue(dbRef(rtdb, `rifas/${id}`), (snap) => {
      const data = snap.val()
      setRifa(data ? { id, ...data } : null)
      setLoading(false)
    })
    const r2 = onValue(dbRef(rtdb, `rifas/${id}/numeros`), (snap) => {
      setNumeros(snap.val() || {})
    })
    const r3 = onValue(dbRef(rtdb, `rifas/${id}/vendedores`), (snap) => {
      setVendedores(snap.val() || {})
    })
    return () => { r1(); r2(); r3() }
  }, [id])

  const stats = useMemo(() => {
    const vals = Object.values(numeros)
    const vendidos = vals.filter((n) => n?.estado === 'vendido').length
    const reservados = vals.filter((n) => n?.estado === 'reservado').length
    const recaudado = vendidos * Number(rifa?.precio_numero || 0)
    return { vendidos, reservados, disponibles: 100 - vendidos - reservados, recaudado }
  }, [numeros, rifa])

  const esCreador = session && rifa && phoneKey(session.telefono) === phoneKey(rifa.creador)

  async function asignarVendedor() {
    setVError(null); setVMsg(null); setVLoading(true)
    try {
      const tel = normalizePhone(vTel)
      if (!tel) throw new Error('Número inválido')
      if (!vNombre.trim()) throw new Error('Ingresa un nombre')
      const key = phoneKey(tel)

      // Llamar API para enviar OTP de vendedor
      const res = await fetch('/api/rifa/enviar-codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(await buildWhatsAppRequest({
          telefono: tel,
          intent: 'rifa_vendedor',
          rifa_id: id,
          sessionToken: session.token,
        })),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el código')

      // Registrar vendedor pendiente y crear índice
      await update(dbRef(rtdb), {
        [`rifas/${id}/vendedores/${key}`]: {
          nombre: vNombre.trim(),
          telefono: tel,
          asignado_en: serverTimestamp(),
        },
        [`vendedor_index/${key}/${id}`]: true,
      })

      setVMsg(`✓ Código enviado a ${tel}. El vendedor ya aparece en la lista.`)
      setVNombre(''); setVTel('')
    } catch (e) {
      setVError(e.message)
    } finally {
      setVLoading(false)
    }
  }

  async function eliminarVendedor(key) {
    if (!confirm('¿Quitar este vendedor de la rifa?')) return
    await Promise.all([
      remove(dbRef(rtdb, `rifas/${id}/vendedores/${key}`)),
      remove(dbRef(rtdb, `vendedor_index/${key}/${id}`)),
    ])
  }

  async function exportarPng() {
    if (!rifa) return
    setPngBusy(true)
    try {
      await descargarPngEstadoRifa({ rifa, numeros })
    } finally {
      setPngBusy(false)
    }
  }

  if (!session) return null
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando rifa...</div>
  if (!rifa) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3">
      <div className="text-gray-500">Rifa no encontrada</div>
      <Link href="/rifa/dashboard" className="btn-brand">← Volver</Link>
    </div>
  )

  const num = selNum != null ? numeros[selNum] : null
  const vendedorNombre = (k) => vendedores[k]?.nombre || k

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50">
      <nav className="bg-gray-900 h-14 flex items-center justify-between px-4 shadow-lg sticky top-0 z-40">
        <Link href="/rifa/dashboard" className="text-gray-400 hover:text-white text-sm">← Mis rifas</Link>
        <span className="text-white font-bold font-brand truncate max-w-[50%]">{rifa.titulo}</span>
        <div className="w-12" />
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Header con info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-4 flex flex-col sm:flex-row gap-4">
          {rifa.foto_url ? (
            <img src={rifa.foto_url} alt="" className="w-full sm:w-40 h-32 sm:h-32 object-cover rounded-xl" />
          ) : (
            <div className="w-full sm:w-40 h-32 bg-gradient-to-br from-yellow-400 to-emerald-500 rounded-xl flex items-center justify-center text-5xl">🎁</div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold font-brand text-gray-900">{rifa.titulo}</h1>
            <p className="text-sm text-gray-600">🎁 {rifa.premio}</p>
            <p className="text-sm text-gray-500">📅 {rifa.fecha_sorteo ? new Date(rifa.fecha_sorteo).toLocaleDateString('es-VE') : '—'}</p>
            <p className="text-sm font-bold text-yellow-700 mt-1">Bs. {formatVES(rifa.precio_numero)} por número</p>
          </div>
          <div className="flex flex-col gap-2 sm:w-40">
            <button onClick={exportarPng} disabled={pngBusy} className="btn-brand w-full justify-center">
              {pngBusy ? 'Generando...' : '⬇ PNG estado'}
            </button>
            {esCreador && (
              <button onClick={() => setShowAsignar(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-all">
                + Vendedor
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-2xl font-bold text-emerald-600">{stats.vendidos}</div>
            <div className="text-xs text-gray-500">Vendidos</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-2xl font-bold text-yellow-600">{stats.reservados}</div>
            <div className="text-xs text-gray-500">Reservados</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-2xl font-bold text-gray-800">{stats.disponibles}</div>
            <div className="text-xs text-gray-500">Disponibles</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100">
            <div className="text-lg font-bold text-gray-900">Bs. {formatVES(stats.recaudado)}</div>
            <div className="text-xs text-gray-500">Recaudado</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTab('numeros')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'numeros' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>Números</button>
          <button onClick={() => setTab('vendedores')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'vendedores' ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
            Vendedores ({Object.keys(vendedores).length})
          </button>
        </div>

        {tab === 'numeros' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
              {Array.from({ length: 100 }, (_, i) => {
                const k = String(i).padStart(2, '0')
                const n = numeros[k] || { estado: 'disponible' }
                return (
                  <button
                    key={k}
                    onClick={() => setSelNum(k)}
                    className={`aspect-square rounded-lg border-2 text-xs sm:text-sm font-bold transition-all ${ESTADO_COLOR[n.estado] || ESTADO_COLOR.disponible}`}
                    title={n.estado}
                  >
                    {k}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-white border border-gray-300 rounded"/> Disponible</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded"/> Reservado</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 border border-emerald-600 rounded"/> Vendido</span>
            </div>
          </div>
        )}

        {tab === 'vendedores' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            {Object.keys(vendedores).length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Aún no hay vendedores. Toca &ldquo;+ Vendedor&rdquo; para invitar uno por WhatsApp.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {Object.entries(vendedores).map(([k, v]) => {
                  const ventas = Object.values(numeros).filter((n) => n?.vendedor === k && n?.estado === 'vendido').length
                  return (
                    <li key={k} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{v.nombre}</div>
                        <div className="text-xs text-gray-500">{v.telefono} · {ventas} ventas</div>
                      </div>
                      {esCreador && (
                        <button onClick={() => eliminarVendedor(k)} className="text-xs text-red-600 hover:underline">Quitar</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* Modal asignar vendedor */}
      {showAsignar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowAsignar(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold font-brand">Asignar vendedor</h2>
            <p className="text-sm text-gray-500">Se enviará un código por WhatsApp. Con ese código entrará al sistema y podrá vender los números de esta rifa.</p>
            <input value={vNombre} onChange={(e) => setVNombre(e.target.value)} placeholder="Nombre del vendedor" className="border border-gray-200 rounded-xl px-4 py-3 w-full" />
            <input value={vTel} onChange={(e) => setVTel(e.target.value)} placeholder="+58 424 1234567" type="tel" className="border border-gray-200 rounded-xl px-4 py-3 w-full" />
            <button onClick={asignarVendedor} disabled={vLoading} className="btn-brand w-full justify-center">
              {vLoading ? 'Enviando...' : 'Enviar código y agregar'}
            </button>
            {vMsg && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl px-4 py-3 border border-emerald-100">{vMsg}</div>}
            {vError && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{vError}</div>}
            <button onClick={() => setShowAsignar(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal detalle número */}
      {selNum != null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelNum(null)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-5xl font-bold font-brand">{selNum}</div>
              <div className="text-sm text-gray-500 capitalize mt-1">{num?.estado || 'disponible'}</div>
            </div>
            {num?.estado === 'vendido' && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <div><span className="font-semibold">Comprador:</span> {num.comprador_nombre || '—'}</div>
                <div><span className="font-semibold">Teléfono:</span> {num.comprador_telefono || '—'}</div>
                <div><span className="font-semibold">Vendedor:</span> {vendedorNombre(num.vendedor)}</div>
                {num.vendido_en && <div><span className="font-semibold">Fecha:</span> {new Date(num.vendido_en).toLocaleString('es-VE')}</div>}
              </div>
            )}
            {esCreador && num?.estado === 'vendido' && (
              <button
                onClick={async () => {
                  if (!confirm('¿Liberar este número?')) return
                  await update(dbRef(rtdb, `rifas/${id}/numeros/${selNum}`), { estado: 'disponible', comprador_nombre: null, comprador_telefono: null, vendedor: null, vendido_en: null })
                  await update(dbRef(rtdb, `rifas/${id}`), { numeros_vendidos: Math.max(0, stats.vendidos - 1) })
                  setSelNum(null)
                }}
                className="w-full text-sm text-red-600 hover:underline"
              >
                Liberar número
              </button>
            )}
            <button onClick={() => setSelNum(null)} className="w-full text-sm text-gray-500 hover:text-gray-700">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
