'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { onValue, ref as dbRef } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { ensureSession, phoneKey, saveSession } from '@/lib/rifaSession'
import { CAR_BRANDS, MOTO_BRANDS } from '@/lib/vehicleBrands'
import { MAX_SOURCE_IMAGE_SIZE, MAX_UPLOADED_IMAGE_SIZE, prepareImageForUpload } from '@/lib/imageCompression'

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

// Valor especial: el repuesto sirve para cualquier marca.
const ALL_BRANDS = 'Todas las marcas'

function canonPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

const EMPTY_REPUESTO = {
  tipo_vehiculo: 'carro',
  marca: '',
  modelo: '',
  anio: '',
  nombre: '',
  nota: '',
  precio: '',
}

export default function UsuarioComercioPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Configuración del comercio ──────────────────────────────────────────
  const [comercio, setComercio] = useState({ direccion: '', lat: null, lng: null, vender: false, foto_url: '' })
  const [comercioFoto, setComercioFoto] = useState(null)
  const [comercioPreview, setComercioPreview] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [comercioSaving, setComercioSaving] = useState(false)
  const [comercioMsg, setComercioMsg] = useState('')
  const [comercioErr, setComercioErr] = useState('')
  const [preparingPhoto, setPreparingPhoto] = useState(false)

  // ── Crear repuesto ──────────────────────────────────────────────────────
  const [repuesto, setRepuesto] = useState(EMPTY_REPUESTO)
  const [modelSuggestions, setModelSuggestions] = useState([])
  const [repuestoSaving, setRepuestoSaving] = useState(false)
  const [repuestoErr, setRepuestoErr] = useState('')

  // ── Inventario ──────────────────────────────────────────────────────────
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState('')

  // ── Cédula EN VIVO (el bot la escribe en Realtime DB tras verificarla) ────
  const [realtimeProfile, setRealtimeProfile] = useState(null)
  const [cedulaLive, setCedulaLive] = useState('')

  const perfilVivo = { ...(session?.perfil || session?.prefill || {}), ...(realtimeProfile || {}) }
  const cedulaActual = cedulaLive || perfilVivo?.cedula || ''
  const cedulaVerificada = Boolean(cedulaActual || perfilVivo?.cedula_estado === 'aprobado')
  const brandOptions = repuesto.tipo_vehiculo === 'moto' ? MOTO_BRANDS : CAR_BRANDS
  const isAllBrands = normalize(repuesto.marca) === normalize(ALL_BRANDS)
  const selectedBrand = useMemo(
    () => brandOptions.find((brand) => normalize(brand.name) === normalize(repuesto.marca))?.name || '',
    [brandOptions, repuesto.marca],
  )
  const filteredSuggestions = useMemo(() => {
    const term = normalize(repuesto.modelo)
    const list = term
      ? modelSuggestions.filter((s) => normalize(s.modelo).includes(term))
      : modelSuggestions
    return list.slice(0, 8)
  }, [modelSuggestions, repuesto.modelo])

  useEffect(() => {
    let cancelled = false
    ensureSession().then((current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent('/usuario/comercio')}`)
        return
      }
      const perfil = current.perfil || current.prefill || {}
      setSession(current)
      setComercio({
        direccion: perfil.comercio_direccion || '',
        lat: perfil.comercio_lat ?? null,
        lng: perfil.comercio_lng ?? null,
        vender: perfil.vender === true || perfil.vender === 'true',
        foto_url: perfil.comercio_foto_url || '',
      })
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [router])

  // Preview de la foto seleccionada.
  useEffect(() => {
    if (!comercioFoto) { setComercioPreview(''); return undefined }
    const url = URL.createObjectURL(comercioFoto)
    setComercioPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [comercioFoto])

  // Cargar inventario al tener sesión.
  useEffect(() => {
    if (!session?.token) return
    let cancelled = false
    setItemsLoading(true)
    setItemsError('')
    fetch('/api/usuario/comercio/repuestos', { headers: { Authorization: `Bearer ${session.token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data.ok) throw new Error(data.error || 'No se pudieron cargar los repuestos.')
        setItems(data.items || [])
      })
      .catch((err) => { if (!cancelled) setItemsError(err.message) })
      .finally(() => { if (!cancelled) setItemsLoading(false) })
    return () => { cancelled = true }
  }, [session?.token])

  // EN VIVO: escucha el nodo del usuario en Realtime DB para saber si la cédula
  // ya fue verificada (rifas_usuarios/{key} primario, users/{uid} respaldo).
  useEffect(() => {
    const tel = session?.telefono
    if (!tel) return undefined
    const key = phoneKey(tel)
    const targetPhone = canonPhone(tel)
    const uid = session?.perfil?.uid || session?.prefill?.uid
    const offs = []
    const watch = (path) => {
      const off = onValue(dbRef(rtdb, path), (snap) => {
        const v = snap.val()
        if (!v || typeof v !== 'object') return
        setRealtimeProfile((current) => ({ ...(current || {}), ...v }))
        if (v.cedula) setCedulaLive(String(v.cedula).trim())
      })
      offs.push(off)
    }
    if (key) watch(`rifas_usuarios/${key}`)
    if (uid) watch(`users/${uid}`)
    const usersOff = onValue(dbRef(rtdb, 'users'), (snap) => {
      const data = snap.val() || {}
      for (const value of Object.values(data)) {
        if (value && typeof value === 'object' && canonPhone(value.whatsapp) === targetPhone) {
          setRealtimeProfile((current) => ({ ...(current || {}), ...value }))
          if (value.cedula) setCedulaLive(String(value.cedula).trim())
          break
        }
      }
    })
    offs.push(usersOff)
    return () => offs.forEach((off) => { try { off() } catch { } })
  }, [session?.telefono, session?.perfil?.uid, session?.prefill?.uid])

  // Autocompletado: al elegir marca, traer modelos guardados.
  useEffect(() => {
    if (!session?.token || !selectedBrand) { setModelSuggestions([]); return undefined }
    let cancelled = false
    fetch(`/api/usuario/modelos?marca=${encodeURIComponent(selectedBrand)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.ok) setModelSuggestions(data.items || []) })
      .catch(() => { if (!cancelled) setModelSuggestions([]) })
    return () => { cancelled = true }
  }, [session?.token, selectedBrand])

  async function selectComercioPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setComercioErr('')
    setComercioMsg('')
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setComercioErr('Selecciona una imagen válida de hasta 20 MB.')
      return
    }
    setPreparingPhoto(true)
    try {
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) throw new Error('La foto no pudo reducirse lo suficiente.')
      setComercioFoto(prepared)
    } catch (err) {
      setComercioErr(err?.message || 'No se pudo preparar la imagen.')
    } finally {
      setPreparingPhoto(false)
    }
  }

  async function saveComercio(event) {
    event.preventDefault()
    setComercioErr('')
    setComercioMsg('')
    if (!session?.token) { setComercioErr('Sesión inválida.'); return }

    setComercioSaving(true)
    try {
      const form = new FormData()
      if (comercioFoto) form.append('foto', comercioFoto, 'comercio.jpg')
      form.append('foto_url', comercio.foto_url || '')
      form.append('direccion', comercio.direccion || '')
      // El permiso para vender ya no es un checkbox: depende de la cédula verificada.
      form.append('vender', cedulaVerificada ? 'true' : 'false')
      if (comercio.lat != null && comercio.lng != null) {
        form.append('lat', String(comercio.lat))
        form.append('lng', String(comercio.lng))
      }
      const res = await fetch('/api/usuario/comercio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el comercio.')

      const nextPerfil = { ...(session.perfil || session.prefill || {}), ...data.comercio }
      const nextSession = { ...session, perfil: nextPerfil, prefill: null }
      saveSession(nextSession)
      setSession(nextSession)
      setComercio((c) => ({ ...c, foto_url: data.comercio.comercio_foto_url || c.foto_url }))
      setComercioFoto(null)
      setComercioMsg('Comercio actualizado.')
    } catch (err) {
      setComercioErr(err.message || 'No se pudo guardar el comercio.')
    } finally {
      setComercioSaving(false)
    }
  }

  async function saveRepuesto(event) {
    event.preventDefault()
    setRepuestoErr('')
    if (!session?.token) { setRepuestoErr('Sesión inválida.'); return }
    if (!repuesto.marca) { setRepuestoErr('Selecciona la marca.'); return }
    if (!repuesto.modelo.trim()) { setRepuestoErr('Escribe el modelo.'); return }
    if (!repuesto.nombre.trim()) { setRepuestoErr('Escribe el nombre del repuesto.'); return }

    setRepuestoSaving(true)
    try {
      const res = await fetch('/api/usuario/comercio/repuestos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({
          marca: repuesto.marca,
          modelo: repuesto.modelo,
          anio: repuesto.anio,
          nombre: repuesto.nombre,
          nota: repuesto.nota,
          precio: repuesto.precio,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el repuesto.')

      setItems((prev) => [data.item, ...prev])
      setRepuesto((r) => ({ ...EMPTY_REPUESTO, tipo_vehiculo: r.tipo_vehiculo, marca: r.marca }))
    } catch (err) {
      setRepuestoErr(err.message || 'No se pudo guardar el repuesto.')
    } finally {
      setRepuestoSaving(false)
    }
  }

  async function deleteRepuesto(id) {
    if (!session?.token) return
    const prev = items
    setItems((current) => current.filter((item) => item.id !== id))
    try {
      const res = await fetch(`/api/usuario/comercio/repuestos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo borrar.')
    } catch {
      setItems(prev) // revertir
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-950">
      <nav className="sticky top-0 z-20 flex h-14 items-center justify-between bg-gray-950 px-4 text-white shadow-lg">
        <Link href="/usuario/opciones" className="text-sm font-semibold text-gray-300 hover:text-white">Opciones</Link>
        <span className="text-sm font-bold">Mi comercio</span>
        <span className="w-16" />
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        {/* ── Configuración del comercio ─────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">Mi comercio</p>
          <h1 className="mt-2 text-2xl font-extrabold">Configura tu comercio</h1>

          <form onSubmit={saveComercio} className="mt-5 grid gap-4">
            <label className="block rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="block text-sm font-extrabold text-gray-900">Foto del comercio</span>
              <span className="mt-3 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
                {comercioPreview || comercio.foto_url ? (
                  <Image
                    src={comercioPreview || comercio.foto_url}
                    alt=""
                    width={640}
                    height={360}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-gray-400">Sin foto</span>
                )}
              </span>
              <span className="mt-2 block text-center text-xs font-semibold text-gray-500">Toca para seleccionar foto</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectComercioPhoto} className="hidden" />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700">Dirección</span>
              <input
                value={comercio.direccion}
                onChange={(e) => setComercio((c) => ({ ...c, direccion: e.target.value.slice(0, 200) }))}
                placeholder="Ej: Mérida, Av. 6, local 12"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
              />
            </label>

            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100"
            >
              Seleccionar punto en el mapa
            </button>
            {comercio.lat != null && comercio.lng != null && (
              <p className="text-xs font-semibold text-gray-500">
                Punto seleccionado: {Number(comercio.lat).toFixed(6)}, {Number(comercio.lng).toFixed(6)}
              </p>
            )}

            {comercioErr && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{comercioErr}</p>}
            {comercioMsg && <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{comercioMsg}</p>}

            <button
              type="submit"
              disabled={comercioSaving || preparingPhoto}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preparingPhoto ? 'Preparando foto...' : comercioSaving ? 'Guardando...' : 'Guardar comercio'}
            </button>
          </form>
        </section>

        {/* ── Crear repuesto ─────────────────────────────────────────── */}
        {cedulaVerificada ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">Inventario</p>
            <h2 className="mt-2 text-2xl font-extrabold">Crear repuesto</h2>

            <form onSubmit={saveRepuesto} className="mt-5 grid gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                {['carro', 'moto'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRepuesto((r) => ({ ...r, tipo_vehiculo: type, marca: '', modelo: '', anio: '' }))}
                    className={`rounded-lg px-3 py-2 text-sm font-extrabold capitalize ${repuesto.tipo_vehiculo === type ? 'bg-gray-950 text-yellow-400' : 'text-gray-600'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="min-w-0">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Marca</span>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 catalog-scrollbar">
                  <button
                    type="button"
                    onClick={() => setRepuesto((r) => ({ ...r, marca: ALL_BRANDS, modelo: '', anio: '' }))}
                    className={`flex h-[82px] w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-bold transition ${isAllBrands ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300' : 'border-gray-200 bg-white hover:border-yellow-300'}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white">
                      <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />
                      </svg>
                    </span>
                    <span className="w-full text-center leading-tight text-gray-700">Todas</span>
                  </button>
                  {brandOptions.map((brand) => {
                    const active = normalize(repuesto.marca) === normalize(brand.name)
                    return (
                      <button
                        key={brand.name}
                        type="button"
                        onClick={() => setRepuesto((r) => ({ ...r, marca: brand.name }))}
                        className={`flex h-[82px] w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border bg-white px-2 text-[10px] font-bold transition ${active ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-gray-200 hover:border-yellow-300'}`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white">
                          <Image src={brand.icon} alt="" width={34} height={34} className="h-8 w-8 object-contain" />
                        </span>
                        <span className="w-full truncate text-center text-gray-700">{brand.name}</span>
                      </button>
                    )
                  })}
                </div>
                {(selectedBrand || isAllBrands) && (
                  <span className="mt-1.5 block text-xs font-bold text-green-700">
                    Marca seleccionada: {isAllBrands ? ALL_BRANDS : selectedBrand}
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <label className="relative block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700">Modelo</span>
                  <input
                    value={repuesto.modelo}
                    onChange={(e) => setRepuesto((r) => ({ ...r, modelo: e.target.value.slice(0, 80) }))}
                    placeholder="Ej: Corolla, Aveo"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={`${s.modelo}-${s.anio}`}
                          type="button"
                          onClick={() => setRepuesto((r) => ({ ...r, modelo: s.modelo, anio: s.anio || r.anio }))}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-yellow-300 hover:bg-yellow-50"
                        >
                          {s.modelo}{s.anio ? ` · ${s.anio}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700">Año</span>
                  <input
                    value={repuesto.anio}
                    onChange={(e) => setRepuesto((r) => ({ ...r, anio: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    inputMode="numeric"
                    placeholder="2012"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Nombre del repuesto</span>
                <input
                  value={repuesto.nombre}
                  onChange={(e) => setRepuesto((r) => ({ ...r, nombre: e.target.value.slice(0, 120) }))}
                  placeholder="Ej: Bomba de agua"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Nota <span className="font-semibold text-gray-400">(opcional)</span></span>
                <textarea
                  value={repuesto.nota}
                  onChange={(e) => setRepuesto((r) => ({ ...r, nota: e.target.value.slice(0, 500) }))}
                  rows={2}
                  placeholder="Detalles, estado, compatibilidad…"
                  className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Precio <span className="font-semibold text-gray-400">(opcional)</span></span>
                <input
                  value={repuesto.precio}
                  onChange={(e) => setRepuesto((r) => ({ ...r, precio: e.target.value.replace(/[^\d.]/g, '').slice(0, 10) }))}
                  inputMode="decimal"
                  placeholder="$"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                />
              </label>

              {repuestoErr && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{repuestoErr}</p>}

              <button
                type="submit"
                disabled={repuestoSaving}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-yellow-400 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {repuestoSaving ? 'Guardando...' : 'Agregar repuesto'}
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-gray-600">
              Verifica tu <span className="font-bold">cédula</span> para empezar a cargar tu inventario.
            </p>
            <Link
              href="/usuario/opciones"
              className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300"
            >
              Verificar cédula
            </Link>
          </section>
        )}

        {/* ── Inventario ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">Repuestos cargados</h2>

          {itemsLoading && (
            <div className="mt-4 flex justify-center py-6">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
            </div>
          )}
          {itemsError && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{itemsError}</p>}
          {!itemsLoading && !itemsError && items.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">Aún no has cargado repuestos.</p>
          )}

          {items.length > 0 && (
            <ul className="mt-4 grid gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-gray-950">{item.nombre}</p>
                    <p className="text-xs font-semibold text-gray-500">
                      {[item.marca, item.modelo, item.anio].filter(Boolean).join(' · ')}
                    </p>
                    {item.nota && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.nota}</p>}
                    {item.precio != null && <p className="mt-1 text-sm font-extrabold text-gray-950">${item.precio}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteRepuesto(item.id)}
                    className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {mapOpen && (
        <MapPicker
          initialLat={comercio.lat}
          initialLng={comercio.lng}
          onClose={() => setMapOpen(false)}
          onConfirm={(coords) => {
            setComercio((c) => ({ ...c, lat: coords.lat, lng: coords.lng }))
            setMapOpen(false)
          }}
        />
      )}
    </div>
  )
}
