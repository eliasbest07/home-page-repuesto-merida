'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { rtdb, storage } from '@/lib/firebase'
import { ref as dbRef, push, set, serverTimestamp, update } from 'firebase/database'
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { phoneKey, ensureSession } from '@/lib/rifaSession'

const FIELD = 'border border-gray-200 rounded-xl px-4 py-3 text-base w-full focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all bg-white'

export default function RifaCrearPage() {
  const router = useRouter()
  const [session, setSessionState] = useState(null)
  const [titulo, setTitulo]         = useState('')
  const [premio, setPremio]         = useState('')
  const [precio, setPrecio]         = useState('')
  const [fechaSorteo, setFecha]     = useState('')
  const [descripcion, setDesc]      = useState('')
  const [fotoFile, setFotoFile]     = useState(null)
  const [fotoPreview, setPreview]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) { router.replace('/login?redirect=' + encodeURIComponent('/rifa/crear')); return }
      if (!s.perfil) { router.replace('/registro?redirect=' + encodeURIComponent('/rifa/crear')); return }
      setSessionState(s)
    })
  }, [router])

  function onFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFotoFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function crear() {
    setError(null); setLoading(true)
    try {
      if (!titulo.trim()) throw new Error('Ingresa el título de la rifa')
      if (!premio.trim()) throw new Error('Describe el premio')
      const precioNum = Number(precio)
      if (!precioNum || precioNum <= 0) throw new Error('Precio por número inválido')
      if (!fechaSorteo) throw new Error('Indica la fecha del sorteo')

      const key = phoneKey(session.telefono)
      const nuevaRef = push(dbRef(rtdb, 'rifas'))
      const rifaId = nuevaRef.key

      let foto_url = null
      if (fotoFile) {
        const ext = (fotoFile.name.split('.').pop() || 'jpg').toLowerCase()
        const snap = await uploadBytes(stRef(storage, `rifas/${rifaId}/portada.${ext}`), fotoFile)
        foto_url = await getDownloadURL(snap.ref)
      }

      const baseRifa = {
        titulo: titulo.trim(),
        premio: premio.trim(),
        descripcion: descripcion.trim(),
        precio_numero: precioNum,
        fecha_sorteo: new Date(fechaSorteo).getTime(),
        foto_url,
        creador: session.telefono,
        creador_key: key,
        creador_nombre: session.perfil?.nombre || '',
        numeros_vendidos: 0,
        creado_en: serverTimestamp(),
      }

      const numeros = {}
      for (let i = 0; i < 100; i++) {
        numeros[String(i).padStart(2, '0')] = { estado: 'disponible' }
      }
      // `numeros` va DENTRO del nodo de la rifa: Firebase rechaza un update
      // multi-path donde un path (rifas/{id}) es ancestro de otro
      // (rifas/{id}/numeros).
      baseRifa.numeros = numeros

      await update(dbRef(rtdb), {
        [`rifas/${rifaId}`]: baseRifa,
        [`creador_index/${key}/${rifaId}`]: true,
      })

      router.replace(`/rifa/${rifaId}`)
    } catch (e) {
      setError(e.message || 'No se pudo crear la rifa')
    } finally {
      setLoading(false)
    }
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-emerald-50">
      <nav className="bg-gray-900 h-14 flex items-center px-4 shadow-lg sticky top-0 z-40">
        <Link href="/rifa/dashboard" className="text-gray-400 hover:text-white flex items-center gap-1.5 text-sm">
          ← Mis rifas
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-brand text-gray-900 mb-1">Nueva rifa</h1>
        <p className="text-sm text-gray-500 mb-6">100 números (00–99). Configura los datos básicos.</p>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-6 space-y-4">
          <div>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Foto del premio</span>
              <label className="cursor-pointer block">
                <div className="aspect-video bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden hover:border-yellow-400 transition-colors">
                  {fotoPreview ? (
                    <Image src={fotoPreview} alt="" width={720} height={405} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-gray-400 text-sm">Toca para subir imagen</div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              </label>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Título *</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={FIELD} placeholder="Ej. Gran rifa de moto" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Premio *</span>
            <input value={premio} onChange={(e) => setPremio(e.target.value)} className={FIELD} placeholder="Ej. Moto Bera 150cc 0km" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Precio por número (Bs) *</span>
              <input type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className={FIELD} placeholder="10" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Fecha del sorteo *</span>
              <input type="date" value={fechaSorteo} onChange={(e) => setFecha(e.target.value)} className={FIELD} />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-1.5 block">Descripción</span>
            <textarea value={descripcion} onChange={(e) => setDesc(e.target.value)} className={`${FIELD} resize-none`} rows={3} placeholder="Reglas, lotería que define, contacto..." />
          </label>

          <button onClick={crear} disabled={loading} className="btn-brand w-full justify-center">
            {loading ? 'Creando rifa...' : 'Crear rifa'}
          </button>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 border border-red-100">{error}</div>}
        </div>
      </main>
    </div>
  )
}
