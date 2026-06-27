'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { onValue, ref as dbRef } from 'firebase/database'
import { signOut } from 'firebase/auth'
import { auth, rtdb } from '@/lib/firebase'
import { clearSession, ensureSession, phoneKey, saveSession } from '@/lib/rifaSession'
import { CAR_BRANDS, MOTO_BRANDS } from '@/lib/vehicleBrands'
import { MAX_SOURCE_IMAGE_SIZE, MAX_UPLOADED_IMAGE_SIZE, prepareImageForUpload } from '@/lib/imageCompression'

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

function filePreview(file, setter) {
  if (!file) {
    setter('')
    return undefined
  }
  const url = URL.createObjectURL(file)
  setter(url)
  return () => URL.revokeObjectURL(url)
}

function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).filter(Boolean).join('') || '?'
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function firstCommercePhoto(value) {
  if (!value || typeof value !== 'object') return ''
  for (const dayValue of Object.values(value)) {
    if (!dayValue || typeof dayValue !== 'object') continue
    if (dayValue.comercios && typeof dayValue.comercios === 'object') {
      for (const commerce of Object.values(dayValue.comercios)) {
        if (commerce?.comercio_foto_url) return commerce.comercio_foto_url
      }
    }
    if (dayValue.comercio_foto_url) return dayValue.comercio_foto_url
  }
  return ''
}

function canonPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

export default function UsuarioOpcionesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [fotoUploading, setFotoUploading] = useState(false)
  const [fotoError, setFotoError] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [vehicleSaving, setVehicleSaving] = useState(false)
  const [vehicleMessage, setVehicleMessage] = useState('')
  const [vehicleError, setVehicleError] = useState('')
  const [vehicle, setVehicle] = useState({
    tipo_vehiculo: 'carro',
    marca: '',
    modelo: '',
    anio: '',
    ubicacion_texto: '',
    lat: null,
    lng: null,
  })
  const [cedulaFoto, setCedulaFoto] = useState(null)
  const [selfieCedula, setSelfieCedula] = useState(null)
  const [cedulaPreview, setCedulaPreview] = useState('')
  const [selfiePreview, setSelfiePreview] = useState('')
  const [sending, setSending] = useState(false)
  const [preparingCedulaImage, setPreparingCedulaImage] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Cédula EN VIVO: el bot puede verificar y escribir la cédula en Realtime DB
  // mientras esta página está abierta; con onValue se refleja sin recargar.
  const [cedulaLive, setCedulaLive] = useState('')
  const [realtimeProfile, setRealtimeProfile] = useState(null)
  // El acceso a la tienda solo aparece si el WhatsApp ya está dentro de
  // comercios_autorizados (Firestore).
  const [esComercioAutorizado, setEsComercioAutorizado] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureSession().then((current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent('/usuario/opciones')}`)
        return
      }
      const profile = current.perfil || current.prefill || {}
      setSession(current)
      setVehicle({
        tipo_vehiculo: profile.tipo_vehiculo || profile.vehiculo_tipo || 'carro',
        marca: profile.marca || profile.vehiculo_marca || '',
        modelo: profile.modelo || profile.vehiculo_modelo || '',
        anio: profile.anio || profile.vehiculo_anio || '',
        ubicacion_texto: profile.ubicacion_texto || profile.zona || profile.ciudad || '',
        lat: profile.lat ?? null,
        lng: profile.lng ?? null,
      })
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => filePreview(cedulaFoto, setCedulaPreview), [cedulaFoto])
  useEffect(() => filePreview(selfieCedula, setSelfiePreview), [selfieCedula])

  // EN VIVO: escucha el nodo del usuario en Realtime DB (donde el bot escribe la
  // cédula tras verificarla). rifas_usuarios/{key} es la fuente primaria; users/{uid}
  // el respaldo, igual que perfilUsuario.js.
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

  // ¿El WhatsApp de la sesión ya es un comercio autorizado? Define si se muestra
  // el acceso a "Mi tienda".
  useEffect(() => {
    const token = session?.token
    if (!token) { setEsComercioAutorizado(false); return undefined }
    let cancelled = false
    fetch('/api/usuario/comercio/membresia', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setEsComercioAutorizado(Boolean(data?.autorizado)) })
      .catch(() => { if (!cancelled) setEsComercioAutorizado(false) })
    return () => { cancelled = true }
  }, [session?.token])

  const perfil = { ...(session?.perfil || session?.prefill || {}), ...(realtimeProfile || {}) }
  const nombre = perfil?.nombre || 'Usuario'
  const foto = perfil?.foto_url || perfil?.foto || ''
  const comercioFoto = perfil?.comercio_foto_url || perfil?.comercio_autorizado?.comercio_foto_url || firstCommercePhoto(perfil?.comercios_por_dia)
  const cedulaActual = cedulaLive || perfil?.cedula || ''
  const edadVerificada = Boolean(cedulaActual || perfil?.cedula_estado === 'aprobado')
  const notificationCount = Number(perfil?.notificaciones_nuevas || perfil?.notificacionesNuevas || 0)
  const brandOptions = vehicle.tipo_vehiculo === 'moto' ? MOTO_BRANDS : CAR_BRANDS
  const selectedBrand = useMemo(
    () => brandOptions.find((brand) => normalize(brand.name) === normalize(vehicle.marca))?.name || '',
    [brandOptions, vehicle.marca],
  )
  const locationLabel = vehicle.ubicacion_texto || [perfil?.zona, perfil?.ciudad].filter(Boolean).join(', ') || 'Ubicación pendiente'

  async function logout() {
    clearSession()
    // Cierra también la sesión de Firebase Auth (Google) para que el próximo
    // inicio cargue los datos frescos desde Firebase y no reuse la sesión previa.
    try { await signOut(auth) } catch {}
    setSession(null)
    router.replace('/')
  }

  async function selectProfilePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setFotoError('')
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setFotoError('Selecciona una imagen válida de hasta 20 MB.')
      return
    }
    if (!session?.token) { setFotoError('Sesión inválida.'); return }

    setFotoUploading(true)
    try {
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) throw new Error('La foto no pudo reducirse lo suficiente.')
      const form = new FormData()
      form.append('foto', prepared, 'perfil.jpg')
      const res = await fetch('/api/usuario/foto', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo subir la foto.')

      const nextPerfil = { ...(session.perfil || session.prefill || {}), foto_url: data.foto_url, foto: data.foto_url }
      const nextSession = { ...session, perfil: nextPerfil }
      saveSession(nextSession)
      setSession(nextSession)
    } catch (err) {
      setFotoError(err?.message || 'No se pudo subir la foto.')
    } finally {
      setFotoUploading(false)
    }
  }

  function scrollToVehiculo() {
    document.getElementById('seccion-vehiculo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function saveVehicle(event) {
    event.preventDefault()
    setVehicleError('')
    setVehicleMessage('')

    if (!session?.token) {
      setVehicleError('Sesión inválida.')
      return
    }

    setVehicleSaving(true)
    try {
      const res = await fetch('/api/usuario/perfil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify(vehicle),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar.')

      const nextProfile = {
        ...(session.perfil || session.prefill || {}),
        ...data.perfil,
      }
      const nextSession = { ...session, perfil: nextProfile, prefill: null }
      saveSession(nextSession)
      setSession(nextSession)
      setVehicleMessage('Información guardada.')
    } catch (err) {
      setVehicleError(err.message || 'No se pudo guardar.')
    } finally {
      setVehicleSaving(false)
    }
  }

  async function submitCedula(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!session?.token) {
      setError('Sesión inválida.')
      return
    }
    if (!cedulaFoto || !selfieCedula) {
      setError('Sube la foto de la cédula y una selfie con la cédula.')
      return
    }

    setSending(true)
    try {
      const form = new FormData()
      form.append('cedula_foto', cedulaFoto)
      form.append('selfie_cedula', selfieCedula)

      const res = await fetch('/api/usuario/verificacion-cedula', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo verificar la cédula.')

      const nextSession = {
        ...session,
        perfil: {
          ...(session.perfil || session.prefill || {}),
          cedula: data.cedula,
          cedula_estado: data.estado,
        },
        prefill: null,
      }
      saveSession(nextSession)
      setSession(nextSession)
      setCedulaFoto(null)
      setSelfieCedula(null)
      setMessage(`Edad verificada. Cédula detectada: ${data.cedula}.`)
    } catch (err) {
      setError(err.message || 'No se pudo verificar la cédula.')
    } finally {
      setSending(false)
    }
  }

  async function selectCedulaImage(event, setter) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setMessage('')
    if (!file) {
      setter(null)
      return
    }
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setError('Selecciona una imagen válida de hasta 20 MB.')
      return
    }

    setPreparingCedulaImage(true)
    try {
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) {
        throw new Error('La foto no pudo reducirse por debajo de 550 KB.')
      }
      setter(prepared)
    } catch (compressionError) {
      setError(compressionError?.message || 'No se pudo preparar la imagen.')
    } finally {
      setPreparingCedulaImage(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900">
      <nav className="sticky top-0 z-20 flex h-14 items-center justify-between bg-gray-950 px-4 text-white shadow-lg">
        <Link href="/" className="text-sm font-semibold text-gray-300 hover:text-white">Inicio</Link>
        <span className="text-sm font-bold">Opciones de usuario</span>
        <button type="button" onClick={() => setConfirmLogout(true)} className="text-sm font-semibold text-gray-300 hover:text-white">Salir</button>
      </nav>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <section className="overflow-hidden rounded-[8px] border border-gray-300 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-200 via-gray-100 to-zinc-300 p-2 sm:p-4">
            {comercioFoto && (
              <div
                className="absolute inset-0 scale-105 bg-cover bg-center opacity-40 blur-sm"
                style={{ backgroundImage: `url(${comercioFoto})` }}
              />
            )}
            <div className="relative overflow-hidden rounded-[8px] border border-white/40 bg-white/35 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => comercioFoto && setSelectedImage(comercioFoto)}
                className="group relative block h-[190px] w-full overflow-hidden sm:h-[300px]"
              >
                {comercioFoto ? (
                  <span
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.02]"
                    style={{ backgroundImage: `url(${comercioFoto})` }}
                  />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-200 to-zinc-300" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden bg-[#d9d9d9] px-4 pb-5 pt-3 sm:px-6">
            {comercioFoto && (
              <div
                className="absolute inset-0 -scale-y-100 bg-cover bg-bottom opacity-40"
                style={{ backgroundImage: `url(${comercioFoto})` }}
              />
            )}
            <div className="absolute inset-0 bg-[#d9d9d9]/70" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <label
                  title="Cambiar foto de perfil"
                  className="group relative -mt-16 block h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg ring-1 ring-black/5 sm:-mt-20 sm:h-24 sm:w-24"
                >
                  {foto ? (
                    <Image src={foto} alt={nombre} width={96} height={96} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400">{initials(nombre)}</span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                    <CameraIcon className="h-4 w-4" />
                  </span>
                  {fotoUploading && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={selectProfilePhoto}
                    disabled={fotoUploading}
                    className="hidden"
                  />
                </label>

                <div className="min-w-0 pb-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-extrabold text-gray-950 sm:text-2xl">{nombre}</h1>
                    <button
                      type="button"
                      onClick={scrollToVehiculo}
                      className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gray-950 px-3 text-xs font-extrabold text-yellow-400 shadow-sm transition hover:bg-gray-800"
                    >
                      {vehicle.tipo_vehiculo === 'moto' ? <MotoIcon className="h-4 w-4" /> : <CarIcon className="h-4 w-4" />}
                      <span>{vehicle.tipo_vehiculo === 'moto' ? 'Mi moto' : 'Mi carro'}</span>
                      <ChevronDownIcon className="h-3.5 w-3.5 transition group-hover:translate-y-0.5" />
                    </button>
                    {esComercioAutorizado && (
                      <Link
                        href="/usuario/comercio"
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-yellow-400 px-3 text-xs font-extrabold text-gray-950 shadow-sm transition hover:bg-yellow-300"
                      >
                        <StoreIcon className="h-4 w-4" />
                        <span>Mi tienda</span>
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                    <LocationIcon className="h-4 w-4 shrink-0 text-yellow-600" />
                    <span className="truncate">{locationLabel}</span>
                  </p>
                  {fotoError && <p className="mt-1 text-xs font-semibold text-red-600">{fotoError}</p>}
                  {cedulaActual ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      Edad sin verificar
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  title="Notificaciones"
                  aria-label="Notificaciones"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-900 transition hover:bg-gray-100"
                >
                  <BellIcon className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {selectedImage && (
          <div
            className="fixed inset-0 z-[70] flex items-start justify-center bg-black/90 p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="mt-16 h-[75vh] w-full max-w-5xl rounded-lg bg-contain bg-center bg-no-repeat shadow-lg"
              style={{ backgroundImage: `url(${selectedImage})` }}
            />
          </div>
        )}

        <div className={`mt-5 grid gap-5 ${edadVerificada ? '' : 'lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1fr)]'}`}>
          {!edadVerificada && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Verificación de edad</p>
              <h2 className="mt-2 text-2xl font-extrabold">Verificación con Cédula</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Para verificar tu edad debes tomar una foto a tu cédula y otra sosteniendo la cédula donde se vea tu cara.
              </p>
            </div>

            <form onSubmit={submitCedula} className="grid gap-4">
              <div className="grid gap-4">
                <PhotoInput
                  label="Foto de la cédula"
                  preview={cedulaPreview}
                  placeholder="/placeholder-cedula.png"
                  onChange={(event) => selectCedulaImage(event, setCedulaFoto)}
                />
                <PhotoInput
                  label="Selfie con la cédula"
                  preview={selfiePreview}
                  placeholder="/placeholder-selfie-cedula.png"
                  onChange={(event) => selectCedulaImage(event, setSelfieCedula)}
                />
              </div>

              {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              {message && <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{message}</p>}

              <button
                type="submit"
                disabled={sending || preparingCedulaImage}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-yellow-400 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {preparingCedulaImage ? 'Preparando fotos...' : sending ? 'Verificando fotos...' : 'Enviar fotos para verificar edad'}
              </button>
            </form>
          </section>
          )}

          <section id="seccion-vehiculo" className="scroll-mt-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600">Mi vehículo y ubicación</p>
              <h2 className="mt-2 text-2xl font-extrabold">Información del usuario</h2>
            </div>

            <form onSubmit={saveVehicle} className="grid gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                {['carro', 'moto'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setVehicle((current) => ({ ...current, tipo_vehiculo: type, marca: '' }))}
                    className={`rounded-lg px-3 py-2 text-sm font-extrabold capitalize ${vehicle.tipo_vehiculo === type ? 'bg-gray-950 text-yellow-400' : 'text-gray-600'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="min-w-0">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Marca</span>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 catalog-scrollbar">
                  {brandOptions.map((brand) => {
                    const active = normalize(vehicle.marca) === normalize(brand.name)
                    return (
                      <button
                        key={brand.name}
                        type="button"
                        onClick={() => setVehicle((current) => ({ ...current, marca: brand.name }))}
                        className={`flex h-[82px] w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border bg-white px-2 text-[10px] font-bold transition ${active ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-gray-200 hover:border-yellow-300'}`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white">
                          <Image src={brand.icon} alt="" width={34} height={34} className="h-8 w-8 object-contain" />
                        </span>
                        <span className="w-full truncate text-center text-gray-700">{brand.name}</span>
                      </button>
                    )
                  })}
                  <label className="flex h-[82px] w-[180px] shrink-0 flex-col justify-center rounded-xl border border-dashed border-yellow-400 bg-yellow-50 px-3">
                    <span className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-yellow-700">Otra marca</span>
                    <input
                      value={selectedBrand ? '' : vehicle.marca}
                      onChange={(event) => setVehicle((current) => ({ ...current, marca: event.target.value.slice(0, 40) }))}
                      placeholder="Escribir"
                      className="h-9 rounded-lg border border-yellow-200 bg-white px-2 text-sm font-semibold outline-none focus:border-yellow-400"
                    />
                  </label>
                </div>
                {selectedBrand && <span className="mt-1.5 block text-xs font-bold text-green-700">Marca seleccionada: {selectedBrand}</span>}
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700">Modelo</span>
                  <input
                    value={vehicle.modelo}
                    onChange={(event) => setVehicle((current) => ({ ...current, modelo: event.target.value.slice(0, 80) }))}
                    placeholder="Ej: Corolla, Aveo, Horse"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700">Año</span>
                  <input
                    value={vehicle.anio}
                    onChange={(event) => setVehicle((current) => ({ ...current, anio: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    inputMode="numeric"
                    placeholder="2012"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition focus:border-yellow-400 focus:ring-4 focus:ring-yellow-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Ubicación escrita</span>
                <input
                  value={vehicle.ubicacion_texto}
                  onChange={(event) => setVehicle((current) => ({ ...current, ubicacion_texto: event.target.value.slice(0, 180) }))}
                  placeholder="Ej: Mérida, centro, Av. 6"
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
              {vehicle.lat != null && vehicle.lng != null && (
                <div className="grid gap-2">
                  <p className="text-xs font-semibold text-gray-500">
                    Punto seleccionado: {Number(vehicle.lat).toFixed(6)}, {Number(vehicle.lng).toFixed(6)}
                  </p>
                  <button
                    type="submit"
                    disabled={vehicleSaving}
                    className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {vehicleSaving ? 'Guardando punto...' : 'Guardar punto en el mapa'}
                  </button>
                </div>
              )}

              {vehicleError && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{vehicleError}</p>}
              {vehicleMessage && <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{vehicleMessage}</p>}

              <button
                type="submit"
                disabled={vehicleSaving}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {vehicleSaving ? 'Guardando...' : 'Guardar información'}
              </button>
            </form>
          </section>
        </div>
      </main>

      {mapOpen && (
        <MapPicker
          initialLat={vehicle.lat}
          initialLng={vehicle.lng}
          onClose={() => setMapOpen(false)}
          onConfirm={(coords) => {
            setVehicle((current) => ({ ...current, lat: coords.lat, lng: coords.lng }))
            setMapOpen(false)
          }}
        />
      )}

      {confirmLogout && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-gray-950">¿Cerrar sesión?</h2>
            <p className="mt-2 text-sm text-gray-600">Tendrás que volver a iniciar sesión para acceder a tus opciones.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-extrabold text-yellow-400 hover:bg-gray-800"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LocationIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function CameraIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function CheckIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

function CarIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
      <path d="M4 17h16v-3a1 1 0 0 0-.7-1l-1.3-.4a40 40 0 0 0-12 0L4.7 13a1 1 0 0 0-.7 1v3Z" />
      <circle cx="7.5" cy="17" r="1.4" />
      <circle cx="16.5" cy="17" r="1.4" />
    </svg>
  )
}

function MotoIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M8 17h6l3-5h-3l-2-2H7" />
      <path d="M14 12l-2-2" />
    </svg>
  )
}

function ChevronDownIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function BellIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function StoreIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h16" />
      <path d="M5 10l1-6h12l1 6" />
      <path d="M6 10v10h12V10" />
      <path d="M9 20v-5h6v5" />
      <path d="M6 10a3 3 0 0 0 6 0" />
      <path d="M12 10a3 3 0 0 0 6 0" />
    </svg>
  )
}

function PhotoInput({ label, preview, placeholder, onChange }) {
  return (
    <label className="block rounded-xl border border-gray-200 bg-gray-50 p-3">
      <span className="block text-sm font-extrabold text-gray-900">{label}</span>
      <span className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
        <Image
          src={preview || placeholder}
          alt=""
          width={480}
          height={360}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
      <span className="mt-2 block text-center text-xs font-semibold text-gray-500">
        Toca para seleccionar foto
      </span>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} className="hidden" />
    </label>
  )
}
