'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { rtdb } from '@/lib/firebase'
import { ref as dbRef, onValue, query, orderByChild, equalTo, get } from 'firebase/database'
import { clearSession, phoneKey, ensureSession } from '@/lib/rifaSession'

function formatVES(n) {
  const v = Number(n || 0)
  return v.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function formatFecha(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

export default function RifaDashboardPage() {
  const router = useRouter()
  const [session, setSessionState] = useState(null)
  const [rifas, setRifas] = useState([])
  const [rifasVendo, setRifasVendo] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) { router.replace('/login?redirect=' + encodeURIComponent('/rifa/dashboard')); return }
      if (!s.perfil) { router.replace('/registro?redirect=' + encodeURIComponent('/rifa/dashboard')); return }
      setSessionState(s)
    })
  }, [router])

  useEffect(() => {
    if (!session?.telefono) return
    const key = phoneKey(session.telefono)

    const q = query(dbRef(rtdb, 'rifas'), orderByChild('creador_key'), equalTo(key))
    const unsub = onValue(q, (snap) => {
      const out = []
      snap.forEach((child) => {
        const data = child.val() || {}
        out.push({ id: child.key, ...data })
      })
      out.sort((a, b) => (b.creado_en || 0) - (a.creado_en || 0))
      setRifas(out)
      setLoading(false)
    }, () => setLoading(false))

    const unsubVendo = onValue(dbRef(rtdb, `vendedor_index/${key}`), async (snap) => {
      const ids = snap.exists() ? Object.keys(snap.val() || {}) : []
      if (!ids.length) { setRifasVendo([]); return }
      const results = await Promise.all(ids.map(async (rid) => {
        const s = await get(dbRef(rtdb, `rifas/${rid}`))
        return s.exists() ? { id: rid, ...s.val() } : null
      }))
      setRifasVendo(results.filter(Boolean))
    })

    return () => { unsub(); unsubVendo() }
  }, [session])

  function salir() {
    clearSession()
    router.replace('/rifa')
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50">
      <nav className="bg-gray-900 h-14 flex items-center justify-between px-4 shadow-lg sticky top-0 z-40">
        <Link href="/rifa/dashboard" className="flex items-center gap-2">
          <Image src="/iconorm.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="text-white font-bold font-brand">Mis Rifas</span>
        </Link>
        <div className="flex items-center gap-3">
          {session.perfil?.foto_url ? (
            <Image src={session.perfil.foto_url} alt="" width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover border border-gray-700" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-white font-brand">
              {(session.perfil?.nombre || '').trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).filter(Boolean).join('') || '?'}
            </div>
          )}
          <button onClick={salir} className="text-gray-400 hover:text-white text-sm">Salir</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-brand text-gray-900">Hola, {session.perfil?.nombre?.split(' ')[0]} 👋</h1>
            <p className="text-sm text-gray-500">Administra tus rifas y vendedores.</p>
          </div>
          <Link href="/rifa/crear" className="btn-brand">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Nueva rifa
          </Link>
        </div>

        {rifasVendo.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Vendes en</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rifasVendo.map((r) => (
                <Link key={r.id} href={`/rifa/${r.id}/vender`} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 hover:shadow-md transition-all flex items-center gap-3">
                  {r.foto_url ? (
                    <Image src={r.foto_url} alt="" width={48} height={48} unoptimized className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-400 to-emerald-500 flex items-center justify-center text-xl">🎁</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{r.titulo}</div>
                    <div className="text-xs text-gray-600 truncate">Vender números →</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : rifas.length === 0 ? (
          <div className="text-center bg-white rounded-3xl p-10 shadow-sm border border-gray-100">
            <div className="text-5xl mb-3">🎟️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Aún no tienes rifas</h3>
            <p className="text-sm text-gray-500 mb-5">Crea tu primera rifa en menos de un minuto.</p>
            <Link href="/rifa/crear" className="btn-brand inline-flex">Crear mi primera rifa</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rifas.map((r) => (
              <Link key={r.id} href={`/rifa/${r.id}`} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 overflow-hidden flex flex-col">
                {r.foto_url ? (
                  <div className="h-32 bg-gray-100 overflow-hidden">
                    <Image src={r.foto_url} alt={r.titulo} width={640} height={256} unoptimized className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-yellow-400 to-emerald-500 flex items-center justify-center text-5xl">🎁</div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 mb-1">{r.titulo}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{r.premio}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-auto">
                    <span>{r.numeros_vendidos || 0} / 100 vendidos</span>
                    <span>{formatFecha(r.fecha_sorteo)}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(Number(r.numeros_vendidos || 0))}%` }} />
                  </div>
                  <div className="text-sm font-bold text-yellow-600 mt-2">Bs. {formatVES(r.precio_numero)} por número</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
