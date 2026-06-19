'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { clearSession, ensureSession, saveSession } from '@/lib/rifaSession'

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

const TEAM_IMAGES = Array.from({ length: 8 }).map((_, index) => ({
  id: index + 1,
  title: `Imagen ${index + 1}`,
  image: `https://picsum.photos/800/600?random=${index + 1}`,
}))

const CAR_BRANDS = [
  { name: 'Audi', icon: '/catalog-assets/car-brands/audi.png' },
  { name: 'BMW', icon: '/catalog-assets/car-brands/bmw.png' },
  { name: 'Chevrolet', icon: '/mobile-catalog/brands/chevrolet.png' },
  { name: 'Chevy', icon: '/catalog-assets/car-brands/chevy.png' },
  { name: 'Daihatsu', icon: '/mobile-catalog/brands/Daihatsu.png' },
  { name: 'Daewoo', icon: '/catalog-assets/car-brands/daewoo.png' },
  { name: 'Dodge', icon: '/catalog-assets/car-brands/dodge.png' },
  { name: 'Dongfeng', icon: '/catalog-assets/car-brands/dongfeng.png' },
  { name: 'Fiat', icon: '/catalog-assets/car-brands/fiat.png' },
  { name: 'Ford', icon: '/mobile-catalog/brands/ford.png' },
  { name: 'Honda', icon: '/catalog-assets/car-brands/honda.png' },
  { name: 'Hyundai', icon: '/mobile-catalog/brands/hyundai.png' },
  { name: 'Jeep', icon: '/catalog-assets/car-brands/jeep.png' },
  { name: 'Kia', icon: '/catalog-assets/car-brands/kia.png' },
  { name: 'Mazda', icon: '/mobile-catalog/brands/mazda.png' },
  { name: 'Mercedes-Benz', icon: '/catalog-assets/car-brands/mercedesbenz.png' },
  { name: 'Mitsubishi', icon: '/mobile-catalog/brands/mitsubishi.png' },
  { name: 'Nissan', icon: '/catalog-assets/car-brands/nissan.png' },
  { name: 'Peugeot', icon: '/catalog-assets/car-brands/peugeot.png' },
  { name: 'Renault', icon: '/mobile-catalog/brands/renault.png' },
  { name: 'Subaru', icon: '/catalog-assets/car-brands/subaru.png' },
  { name: 'Suzuki', icon: '/mobile-catalog/brands/suzuki.png' },
  { name: 'Toyota', icon: '/mobile-catalog/brands/toyota.png' },
  { name: 'Volkswagen', icon: '/mobile-catalog/brands/volkswagen.png' },
]
const MOTO_BRANDS = [
  { name: 'AVA', icon: '/catalog-assets/moto-brands/ava.png' },
  { name: 'Bajaj', icon: '/catalog-assets/moto-brands/bajaj.png' },
  { name: 'Bera', icon: '/catalog-assets/moto-brands/bera.png' },
  { name: 'CFMoto', icon: '/catalog-assets/moto-brands/cfmoto.png' },
  { name: 'Ducati', icon: '/catalog-assets/moto-brands/ducati.png' },
  { name: 'Empire', icon: '/catalog-assets/moto-brands/empire.png' },
  { name: 'Forza', icon: '/catalog-assets/moto-brands/forza.png' },
  { name: 'Haojue', icon: '/catalog-assets/moto-brands/haojue.png' },
  { name: 'Harley-Davidson', icon: '/catalog-assets/moto-brands/harley-davidson.png' },
  { name: 'Honda', icon: '/catalog-assets/moto-brands/honda.png' },
  { name: 'Kawasaki', icon: '/catalog-assets/moto-brands/kawasaki.png' },
  { name: 'Keeway', icon: '/catalog-assets/moto-brands/keeway.png' },
  { name: 'KTM', icon: '/catalog-assets/moto-brands/ktm.png' },
  { name: 'Kymco', icon: '/catalog-assets/moto-brands/kymco.png' },
  { name: 'Loncin', icon: '/catalog-assets/moto-brands/loncin.png' },
  { name: 'Skygo', icon: '/catalog-assets/moto-brands/skygo.png' },
  { name: 'Suzuki', icon: '/catalog-assets/moto-brands/suzuki.png' },
  { name: 'UM', icon: '/catalog-assets/moto-brands/um.png' },
  { name: 'Vespa', icon: '/catalog-assets/moto-brands/vespa.png' },
  { name: 'Yamaha', icon: '/catalog-assets/moto-brands/yamaha.png' },
]

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

export default function UsuarioOpcionesPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const maxIndex = Math.max(0, TEAM_IMAGES.length - 1)
  const currentImage = TEAM_IMAGES[currentIndex] || TEAM_IMAGES[0]
  const nextImage = TEAM_IMAGES[currentIndex >= maxIndex ? 0 : currentIndex + 1] || TEAM_IMAGES[0]
  const nextSlide = () => setCurrentIndex((index) => (index >= maxIndex ? 0 : index + 1))
  const prevSlide = () => setCurrentIndex((index) => (index <= 0 ? maxIndex : index - 1))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((index) => (index >= maxIndex ? 0 : index + 1))
    }, 8000)
    return () => clearInterval(timer)
  }, [maxIndex])

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

  const perfil = session?.perfil || session?.prefill || {}
  const nombre = perfil?.nombre || 'Usuario'
  const foto = perfil?.foto_url || ''
  const cedulaActual = perfil?.cedula || ''
  const notificationCount = Number(perfil?.notificaciones_nuevas || perfil?.notificacionesNuevas || 0)
  const brandOptions = vehicle.tipo_vehiculo === 'moto' ? MOTO_BRANDS : CAR_BRANDS
  const selectedBrand = useMemo(
    () => brandOptions.find((brand) => normalize(brand.name) === normalize(vehicle.marca))?.name || '',
    [brandOptions, vehicle.marca],
  )
  const locationLabel = vehicle.ubicacion_texto || [perfil?.zona, perfil?.ciudad].filter(Boolean).join(', ') || 'Ubicación pendiente'

  function logout() {
    clearSession()
    router.replace('/')
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
        <button type="button" onClick={logout} className="text-sm font-semibold text-gray-300 hover:text-white">Salir</button>
      </nav>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        <section className="overflow-hidden rounded-[8px] border border-gray-300 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-[#5a5252] p-2 sm:p-4">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-45 blur-sm scale-105"
              style={{ backgroundImage: `url(${currentImage.image})` }}
            />
            <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-black/50 backdrop-blur-sm">
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Imágenes anteriores"
                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-3xl leading-none text-white hover:bg-black/55"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Imágenes siguientes"
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-3xl leading-none text-white hover:bg-black/55"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setSelectedImage(currentImage.image)}
                className="group relative block h-[190px] w-full overflow-hidden sm:h-[300px]"
              >
                <span
                  className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.02]"
                  style={{ backgroundImage: `url(${currentImage.image})` }}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden bg-[#d9d9d9] px-4 pb-5 pt-3 sm:px-6">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-35 blur-sm scale-110"
              style={{ backgroundImage: `url(${nextImage.image})` }}
            />
            <div className="absolute inset-0 bg-[#d9d9d9]/85" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                <div className="-mt-16 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg ring-1 ring-black/5 sm:-mt-20 sm:h-24 sm:w-24">
                  {foto ? (
                    <Image src={foto} alt={nombre} width={96} height={96} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-gray-400">{initials(nombre)}</span>
                  )}
                </div>

                <div className="min-w-0 pb-0.5">
                  <h1 className="truncate text-xl font-extrabold text-gray-950 sm:text-2xl">{nombre}</h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
                    <LocationIcon className="h-4 w-4 shrink-0 text-yellow-600" />
                    <span className="truncate">{locationLabel}</span>
                  </p>
                  {cedulaActual ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                      <CheckIcon className="h-3.5 w-3.5" />
                      Edad verificada · Cédula {cedulaActual}
                    </span>
                  ) : (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      Edad sin verificar
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={scrollToVehiculo}
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-yellow-400 shadow-sm transition hover:bg-gray-800"
                >
                  {vehicle.tipo_vehiculo === 'moto' ? <MotoIcon className="h-5 w-5" /> : <CarIcon className="h-5 w-5" />}
                  <span>{vehicle.tipo_vehiculo === 'moto' ? 'Mi moto' : 'Mi carro'}</span>
                  <ChevronDownIcon className="h-4 w-4 transition group-hover:translate-y-0.5" />
                </button>
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

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1fr)]">
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
                  onChange={(event) => setCedulaFoto(event.target.files?.[0] || null)}
                />
                <PhotoInput
                  label="Selfie con la cédula"
                  preview={selfiePreview}
                  placeholder="/placeholder-selfie-cedula.png"
                  capture="user"
                  onChange={(event) => setSelfieCedula(event.target.files?.[0] || null)}
                />
              </div>

              {error && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              {message && <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{message}</p>}

              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-gray-950 px-4 text-sm font-extrabold text-yellow-400 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? 'Verificando fotos...' : 'Enviar fotos para verificar edad'}
              </button>
            </form>
          </section>

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

function PhotoInput({ label, preview, placeholder, onChange, capture }) {
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
      <input type="file" accept="image/jpeg,image/png,image/webp" capture={capture} onChange={onChange} className="hidden" />
    </label>
  )
}
