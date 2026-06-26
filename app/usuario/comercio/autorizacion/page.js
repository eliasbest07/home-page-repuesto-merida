'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { onValue, ref as dbRef } from 'firebase/database'
import { rtdb } from '@/lib/firebase'
import { ensureSession, phoneKey } from '@/lib/rifaSession'
import { MAX_SOURCE_IMAGE_SIZE, MAX_UPLOADED_IMAGE_SIZE, prepareImageForUpload } from '@/lib/imageCompression'
import { CAR_BRANDS, MOTO_BRANDS } from '@/lib/vehicleBrands'

const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

const DAYS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miercoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sabado' },
  { key: 'domingo', label: 'Domingo' },
]

const EMPTY_DAY = {
  comercio_id: '',
  nombre_comercio: '',
  whatsapp: '',
  comercio_foto_url: '',
  comercio_direccion: '',
  comercio_lat: null,
  comercio_lng: null,
  tipo_vehiculo: 'carro',
  lista_ventas_repuestos: [],
  marcas_carro: [],
  marcas_moto: [],
}

const EMPTY_REPUESTO = {
  marca: '',
  modelo: '',
  anio: '',
  nombre: '',
  nota: '',
  precio: '',
}

function canonPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('58') && d.length >= 12) d = d.slice(2)
  return d.replace(/^0+/, '')
}

function isAuthorized(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

// Precio en texto libre: antepone "$" solo si es puramente numérico.
function formatPrecio(value) {
  const s = String(value ?? '').trim()
  if (!s) return 'Consultar'
  return /^\d+(\.\d+)?$/.test(s) ? `$${s}` : s
}

function fieldReady(value) {
  if (Array.isArray(value)) return value.length > 0
  return String(value || '').trim().length > 0
}

function mergeDayData(value) {
  if (!value || typeof value !== 'object') return { ...EMPTY_DAY, lista_ventas_repuestos: [] }
  return {
    ...EMPTY_DAY,
    ...value,
    tipo_vehiculo: value.tipo_vehiculo === 'moto' ? 'moto' : 'carro',
    lista_ventas_repuestos: Array.isArray(value.lista_ventas_repuestos) ? value.lista_ventas_repuestos : [],
    marcas_carro: Array.isArray(value.marcas_carro) ? value.marcas_carro : [],
    marcas_moto: Array.isArray(value.marcas_moto) ? value.marcas_moto : [],
  }
}

function dayCommerceList(value, day) {
  if (!value || typeof value !== 'object') return []

  if (value.comercios && typeof value.comercios === 'object') {
    return Object.entries(value.comercios)
      .filter(([, commerce]) => commerce && typeof commerce === 'object')
      .map(([id, commerce]) => mergeDayData({ ...commerce, comercio_id: commerce.comercio_id || id, dia: day }))
  }

  if (Array.isArray(value)) {
    return value
      .filter((commerce) => commerce && typeof commerce === 'object')
      .map((commerce, index) => mergeDayData({ ...commerce, comercio_id: commerce.comercio_id || `legacy_${index}`, dia: day }))
  }

  if (value.nombre_comercio || value.whatsapp || value.comercio_foto_url || value.comercio_direccion) {
    return [mergeDayData({ ...value, comercio_id: value.comercio_id || 'principal', dia: day })]
  }

  return []
}

function StatusPill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-700',
    good: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-800',
  }
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-extrabold ${tones[tone]}`}>
      {children}
    </span>
  )
}

function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-[#20263a] px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function SoftButton({ children, active = false, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-extrabold transition ${active
          ? 'border-[#20263a] bg-[#20263a] text-white'
          : 'border-gray-200 bg-white text-gray-800 hover:border-amber-300 hover:bg-amber-50'
        } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// Fotos del repuesto: lista con scroll horizontal (2 a la vista) + agregar (máx 4).
function RepuestoFotos({ fotos = [], uploading = false, onPick }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex gap-2 overflow-x-auto">
        {fotos.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="relative aspect-[4/3] w-[calc(50%-4px)] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <Image src={url} alt="Foto del repuesto" fill unoptimized className="object-contain p-1" />
          </a>
        ))}
        {fotos.length < 4 && (
          <label
            className={`flex aspect-[4/3] w-[calc(50%-4px)] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-xs font-bold text-slate-500 hover:border-amber-400 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {uploading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
            ) : (
              <>
                <span className="text-lg leading-none">+</span>
                <span>Agregar foto</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                onPick(file)
              }}
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{fotos.length}/4 fotos</p>
    </div>
  )
}

function RepuestoFotosNuevo({ photos = [], onPick, onRemove }) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        Fotos del repuesto a publicar
      </p>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((photo, index) => (
          <div
            key={photo.url}
            className="relative aspect-[4/3] w-[calc(50%-4px)] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <Image src={photo.url} alt="Foto del repuesto" fill unoptimized className="object-contain p-1" />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm font-extrabold leading-none text-white shadow"
              aria-label="Quitar foto"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < 4 && (
          <label className="flex aspect-[4/3] w-[calc(50%-4px)] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2 text-center text-xs font-bold text-slate-500 hover:border-amber-400">
            <span className="text-lg leading-none">+</span>
            <span>Agregar foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                onPick(file)
              }}
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{photos.length}/4 fotos</p>
    </div>
  )
}

function MiniLocationMap({ lat, lng }) {
  if (lat == null || lng == null) return null

  const latNumber = Number(lat)
  const lngNumber = Number(lng)
  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) return null

  const query = `${latNumber},${lngNumber}`
  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&output=embed`
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-[16/9] w-full bg-slate-100">
        <iframe
          title="Ubicacion del comercio"
          src={embedSrc}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
        <span className="text-xs font-bold text-slate-600">Punto guardado</span>
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-extrabold text-amber-700 hover:text-amber-800"
        >
          Abrir mapa
        </a>
      </div>
    </div>
  )
}

export default function ComercioAutorizacionPage() {
  const router = useRouter()
  const repuestoFormRef = useRef(null)
  const commerceInfoRef = useRef(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [realtimeProfile, setRealtimeProfile] = useState(null)
  const [identityByPhone, setIdentityByPhone] = useState({})
  const [legacyIdentityByPhone, setLegacyIdentityByPhone] = useState({})
  const [globalComerciosPorDia, setGlobalComerciosPorDia] = useState({})
  const [selectedDay, setSelectedDay] = useState('lunes')
  const [selectedCommerceId, setSelectedCommerceId] = useState('')
  const [showNamedList, setShowNamedList] = useState(true)
  const [showBadWhatsappList, setShowBadWhatsappList] = useState(true)
  const [showNamelessList, setShowNamelessList] = useState(true)
  const [showSidebarLists, setShowSidebarLists] = useState(true)
  const [showAllRepuestos, setShowAllRepuestos] = useState(false)
  const [allRepuestosFilter, setAllRepuestosFilter] = useState('todos')
  const [activePanel, setActivePanel] = useState('comercios')
  const [selectedVenta, setSelectedVenta] = useState('')
  const [form, setForm] = useState(EMPTY_DAY)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [mapOpen, setMapOpen] = useState(false)
  const [draftItem, setDraftItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [repuestos, setRepuestos] = useState([])
  const [repuestosLoading, setRepuestosLoading] = useState(false)
  const [repuestoSaving, setRepuestoSaving] = useState(false)
  const [repuestoForm, setRepuestoForm] = useState(EMPTY_REPUESTO)
  const [uploadingPhotoId, setUploadingPhotoId] = useState('')
  const [pendingRepuestoPhotos, setPendingRepuestoPhotos] = useState([])

  useEffect(() => {
    let cancelled = false
    ensureSession().then((current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent('/usuario/comercio/autorizacion')}`)
        return
      }
      setSession(current)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const tel = session?.telefono
    if (!tel) return undefined

    const key = phoneKey(tel)
    const targetPhone = canonPhone(tel)
    const uid = session?.perfil?.uid || session?.prefill?.uid
    const offs = []
    const mergeProfile = (value) => {
      if (!value || typeof value !== 'object') return
      setRealtimeProfile((current) => ({ ...(current || {}), ...value }))
    }
    const watch = (path) => {
      const off = onValue(dbRef(rtdb, path), (snap) => mergeProfile(snap.val()))
      offs.push(off)
    }

    if (key) watch(`rifas_usuarios/${key}`)
    if (uid) watch(`users/${uid}`)
    const usersOff = onValue(dbRef(rtdb, 'users'), (snap) => {
      const data = snap.val() || {}
      const nextIdentity = {}
      for (const value of Object.values(data)) {
        if (!value || typeof value !== 'object') continue

        const phones = [
          value.whatsapp,
          value.telefono,
          value.phone,
          value.id,
        ].map(canonPhone).filter(Boolean)

        for (const phone of phones) {
          nextIdentity[phone] = {
            cedula: String(value.cedula || '').trim(),
            cedula_estado: String(value.cedula_estado || '').trim(),
            cedula_actualizada_en: value.cedula_actualizada_en || null,
          }
        }

        if (phones.includes(targetPhone)) {
          mergeProfile(value)
        }
      }
      setIdentityByPhone(nextIdentity)
    })
    offs.push(usersOff)

    const legacyUsersOff = onValue(dbRef(rtdb, 'rifas_usuarios'), (snap) => {
      const data = snap.val() || {}
      const nextIdentity = {}
      for (const [key, value] of Object.entries(data)) {
        if (!value || typeof value !== 'object') continue

        const phones = [
          key,
          value.whatsapp,
          value.telefono,
          value.phone,
          value.id,
        ].map(canonPhone).filter(Boolean)

        for (const phone of phones) {
          nextIdentity[phone] = {
            cedula: String(value.cedula || '').trim(),
            cedula_estado: String(value.cedula_estado || '').trim(),
            cedula_actualizada_en: value.cedula_actualizada_en || null,
          }
        }
      }
      setLegacyIdentityByPhone(nextIdentity)
    }, () => {
      setLegacyIdentityByPhone({})
    })
    offs.push(legacyUsersOff)

    return () => offs.forEach((off) => { try { off() } catch { } })
  }, [session?.telefono, session?.perfil?.uid, session?.prefill?.uid])

  const profile = useMemo(
    () => ({ ...(session?.perfil || session?.prefill || {}), ...(realtimeProfile || {}) }),
    [session?.perfil, session?.prefill, realtimeProfile],
  )
  const authorized = isAuthorized(profile.autorizado)
  const selectedSavedDay = globalComerciosPorDia?.[selectedDay] || profile.comercios_por_dia?.[selectedDay] || null
  const dayCommerces = useMemo(
    () => dayCommerceList(selectedSavedDay, selectedDay),
    [selectedSavedDay, selectedDay],
  )
  const allGlobalCommerces = useMemo(() => (
    Object.entries(globalComerciosPorDia || {}).flatMap(([day, value]) => dayCommerceList(value, day))
  ), [globalComerciosPorDia])
  const visibleCommerces = useMemo(() => {
    const byId = new Map(dayCommerces.map((commerce) => [commerce.comercio_id, commerce]))
    const knownPhones = new Set(dayCommerces.map((commerce) => canonPhone(commerce.whatsapp)).filter(Boolean))

    for (const item of repuestos) {
      if (item.aprobado) continue
      const phone = canonPhone(item.telefono)
      if (!phone || knownPhones.has(phone)) continue
      const id = `phone_${phone}`
      if (!byId.has(id)) {
        byId.set(id, mergeDayData({
          comercio_id: id,
          dia: selectedDay,
          nombre_comercio: item.comercio_nombre || 'Comercio pendiente',
          whatsapp: item.telefono,
          lista_ventas_repuestos: item.venta ? [item.venta] : ['Repuestos destacados'],
          tipo_vehiculo: item.tipo_vehiculo || 'carro',
        }))
      }
    }

    return Array.from(byId.values())
  }, [dayCommerces, repuestos, selectedDay])
  const isNamelessCommerce = (commerce) =>
    !fieldReady(commerce.nombre_comercio) || /sin\s*nombre/i.test(commerce.nombre_comercio)
  const hasValidWhatsapp = (commerce) => canonPhone(commerce.whatsapp).length >= 10
  const namedCommerces = visibleCommerces.filter((c) => !isNamelessCommerce(c) && hasValidWhatsapp(c))
  const badWhatsappCommerces = visibleCommerces.filter((c) => !isNamelessCommerce(c) && !hasValidWhatsapp(c))
  const namelessCommerces = visibleCommerces.filter((c) => isNamelessCommerce(c))
  const brands = form.tipo_vehiculo === 'moto' ? MOTO_BRANDS : CAR_BRANDS
  const selectedBrands = form.tipo_vehiculo === 'moto' ? form.marcas_moto : form.marcas_carro
  const allSelectedBrands = [
    ...form.marcas_carro.map((name) => ({ name, type: 'Carro' })),
    ...form.marcas_moto.map((name) => ({ name, type: 'Moto' })),
  ]
  const dayLabel = DAYS.find((day) => day.key === selectedDay)?.label || 'Lunes'
  const photoSrc = photoPreview || form.comercio_foto_url
  const locationReady = form.comercio_lat != null && form.comercio_lng != null
  const commercePhoneKey = canonPhone(form.whatsapp)
  const commerceIdentity = identityByPhone[commercePhoneKey] || legacyIdentityByPhone[commercePhoneKey] || {}
  const commerceCedulaVerified = Boolean(commerceIdentity.cedula) || commerceIdentity.cedula_estado === 'aprobado'
  const commerceCedulaPending = commerceIdentity.cedula_estado === 'pendiente'
  const currentVenta = selectedVenta || form.lista_ventas_repuestos[0] || ''
  const selectedFormPhone = canonPhone(form.whatsapp)
  const commerceRepuestos = repuestos.filter((item) => {
    if (item.comercio_id) return selectedCommerceId && item.comercio_id === selectedCommerceId
    if (selectedFormPhone && item.telefono) return canonPhone(item.telefono) === selectedFormPhone
    if (item.dia) return item.dia === selectedDay
    return false
  })
  const pendingApprovalCount = commerceRepuestos.filter((item) => !item.aprobado).length
  const repuestosForCommerce = (commerce) => {
    const commercePhone = canonPhone(commerce.whatsapp)
    return repuestos.filter((item) => {
      if (item.comercio_id) return item.comercio_id === commerce.comercio_id
      if (commercePhone && item.telefono) return canonPhone(item.telefono) === commercePhone
      return selectedCommerceId === commerce.comercio_id && (!item.dia || item.dia === selectedDay)
    })
  }
  const pendingCountForCommerce = (commerce) => repuestos.filter((item) => {
    if (item.aprobado) return false
    if (item.comercio_id) return item.comercio_id === commerce.comercio_id
    if (commerce.whatsapp && item.telefono) return canonPhone(item.telefono) === canonPhone(commerce.whatsapp)
    return selectedCommerceId === commerce.comercio_id && (!item.dia || item.dia === selectedDay)
  }).length
  const repuestosVisibles = commerceRepuestos.filter((item) => {
    if (currentVenta && item.venta && item.venta !== currentVenta) return false
    return true
  })
  const repuestosPendientes = commerceRepuestos.filter((item) => !item.aprobado)
  const commerceNameByPhone = useMemo(() => {
    const map = {}
    for (const commerce of allGlobalCommerces) {
      const phone = canonPhone(commerce.whatsapp)
      if (phone && !map[phone] && fieldReady(commerce.nombre_comercio)) map[phone] = commerce.nombre_comercio
    }
    return map
  }, [allGlobalCommerces])
  const commerceNameForItem = (item) =>
    commerceNameByPhone[canonPhone(item.telefono)] || 'Comercio sin nombre'
  const allRepuestosSorted = [...repuestos].sort((a, b) => (b.creado_en ?? 0) - (a.creado_en ?? 0))
  const allRepuestosFiltered = allRepuestosSorted.filter((item) => {
    if (allRepuestosFilter === 'pendiente') return !item.aprobado
    if (allRepuestosFilter === 'aprobado') return item.aprobado
    return true
  })
  const marcaSource = allSelectedBrands.length > 0
    ? allSelectedBrands.map((brand) => brand.name)
    : [...CAR_BRANDS, ...MOTO_BRANDS].map((brand) => brand.name)
  const marcaOptions = [...new Set(marcaSource)].map((name) => ({ name }))

  useEffect(() => {
    const commerceList = dayCommerceList(selectedSavedDay, selectedDay)
    const next = commerceList[0] || { ...EMPTY_DAY }
    setForm(next)
    setSelectedCommerceId(next.comercio_id || '')
    setSelectedVenta(next.lista_ventas_repuestos[0] || '')
    setPhotoFile(null)
    setPhotoPreview('')
    setError('')
    setMessage('')
    setActivePanel('comercios')
  }, [selectedDay, selectedSavedDay])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  useEffect(() => {
    if (!session?.token) return
    loadRepuestos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, selectedCommerceId, form.whatsapp])

  useEffect(() => {
    if (!session?.token || !authorized) return
    let cancelled = false
    fetch('/api/usuario/comercio/autorizacion', {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        if (body.ok) setGlobalComerciosPorDia(body.comercios_por_dia || {})
      })
      .catch(() => {
        if (!cancelled) setGlobalComerciosPorDia({})
      })
    return () => { cancelled = true }
  }, [session?.token, authorized])

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleBrand(name, vehicleType = form.tipo_vehiculo) {
    const key = vehicleType === 'moto' ? 'marcas_moto' : 'marcas_carro'
    setForm((current) => {
      const currentList = current[key] || []
      const nextList = currentList.includes(name)
        ? currentList.filter((item) => item !== name)
        : [...currentList, name]
      return { ...current, [key]: nextList }
    })
  }

  function selectCommerce(commerce) {
    const next = mergeDayData(commerce)
    setSelectedCommerceId(next.comercio_id || '')
    setForm(next)
    setSelectedVenta(next.lista_ventas_repuestos[0] || '')
    setPhotoFile(null)
    setPhotoPreview('')
    setError('')
    setMessage('')
    setActivePanel('comercio')
  }

  function renderCommerceButton(commerce) {
    const active = selectedCommerceId === commerce.comercio_id
    const pendingCount = pendingCountForCommerce(commerce)
    return (
      <button
        key={commerce.comercio_id}
        type="button"
        onClick={() => selectCommerce(commerce)}
        className={`rounded-lg border px-3 py-2 text-left transition ${
          active ? 'border-[#20263a] bg-slate-50 ring-2 ring-amber-200' : 'border-slate-200 bg-white hover:border-amber-300'
        }`}
      >
        <span className="block truncate text-sm font-extrabold text-slate-950">
          {commerce.nombre_comercio || 'Comercio sin nombre'}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-slate-500">
            {commerce.whatsapp || 'Sin WhatsApp'}
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {pendingCount}
          </span>
        </span>
      </button>
    )
  }

  function resetCurrentDay() {
    setForm({ ...EMPTY_DAY, tipo_vehiculo: form.tipo_vehiculo })
    setSelectedCommerceId('')
    setSelectedVenta('')
    setPhotoFile(null)
    setPhotoPreview('')
    setDraftItem('')
    setMessage('Formulario limpio para crear un comercio nuevo en este dia.')
    setError('')
    setActivePanel('comercio')
    window.setTimeout(() => {
      commerceInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function openPendingRepuestoForm() {
    if (!selectedCommerceId) {
      setError('Guarda este comercio antes de agregar repuestos.')
      setActivePanel('comercio')
      return
    }

    let venta = currentVenta
    if (!venta) {
      venta = 'Repuestos destacados'
      setForm((current) => ({
        ...current,
        lista_ventas_repuestos: Array.from(new Set([...current.lista_ventas_repuestos, venta])),
      }))
      setSelectedVenta(venta)
    }

    setRepuestoForm((current) => ({
      ...EMPTY_REPUESTO,
      marca: current.marca || selectedBrands[0] || '',
    }))
    clearPendingRepuestoPhotos()
    setError('')
    setMessage('Completa los datos para crear un repuesto pendiente.')
    setActivePanel('repuestos')
    window.setTimeout(() => {
      repuestoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function loadCommerceForWhatsapp(rawPhone = form.whatsapp) {
    const target = canonPhone(rawPhone)
    if (target.length < 10) return false
    const existing = visibleCommerces.find((commerce) => canonPhone(commerce.whatsapp) === target)
      || allGlobalCommerces.find((commerce) => canonPhone(commerce.whatsapp) === target)
    if (!existing || existing.comercio_id === selectedCommerceId) return false
    selectCommerce({ ...existing, dia: selectedDay })
    setMessage('Comercio cargado por WhatsApp para editar su informacion publica.')
    return true
  }

  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setMessage('')
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setError('Selecciona una imagen valida de hasta 20 MB.')
      return
    }
    setPreparingPhoto(true)
    try {
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) throw new Error('La foto no pudo reducirse lo suficiente.')
      setPhotoFile(prepared)
    } catch (err) {
      setError(err?.message || 'No se pudo preparar la imagen.')
    } finally {
      setPreparingPhoto(false)
    }
  }

  function addListItem() {
    const value = draftItem.trim()
    if (!value) return
    setForm((current) => ({
      ...current,
      lista_ventas_repuestos: Array.from(new Set([...current.lista_ventas_repuestos, value])).slice(0, 80),
    }))
    setSelectedVenta(value)
    setDraftItem('')
  }

  function removeListItem(index) {
    setForm((current) => {
      const next = current.lista_ventas_repuestos.filter((_, itemIndex) => itemIndex !== index)
      if (!next.includes(selectedVenta)) setSelectedVenta(next[0] || '')
      return { ...current, lista_ventas_repuestos: next }
    })
  }

  async function loadRepuestos() {
    setRepuestosLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', 'all')
      const res = await fetch(`/api/usuario/comercio/repuestos${params.toString() ? `?${params}` : ''}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudieron cargar los repuestos.')
      setRepuestos(body.items || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los repuestos.')
    } finally {
      setRepuestosLoading(false)
    }
  }

  async function saveCommerce() {
    setError('')
    setMessage('')
    if (!session?.token) {
      setError('Sesion invalida.')
      return
    }
    if (!authorized) {
      setError('Tu solicitud aun esta en espera de autorizacion.')
      return
    }
    if (!fieldReady(form.nombre_comercio)) {
      setError('Escribe el nombre del comercio.')
      setActivePanel('comercio')
      return
    }

    setSaving(true)
    try {
      const data = new FormData()
      data.append('dia', selectedDay)
      data.append('comercio_id', selectedCommerceId || form.comercio_id || '')
      data.append('nombre_comercio', form.nombre_comercio)
      data.append('whatsapp', form.whatsapp)
      data.append('direccion', form.comercio_direccion)
      data.append('tipo_vehiculo', form.tipo_vehiculo)
      data.append('foto_url', form.comercio_foto_url || '')
      data.append('lista_ventas_repuestos', form.lista_ventas_repuestos.join('\n'))
      data.append('marcas_carro', JSON.stringify(form.marcas_carro))
      data.append('marcas_moto', JSON.stringify(form.marcas_moto))
      if (form.comercio_lat != null && form.comercio_lng != null) {
        data.append('lat', String(form.comercio_lat))
        data.append('lng', String(form.comercio_lng))
      }
      if (photoFile) data.append('foto', photoFile, 'fachada.jpg')

      const res = await fetch('/api/usuario/comercio/autorizacion', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: data,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo guardar el comercio.')

      const savedCommerce = mergeDayData(body.comercio)
      const savedId = body.comercio_id || savedCommerce.comercio_id
      setGlobalComerciosPorDia((current) => ({
        ...(current || {}),
        [selectedDay]: {
          ...(current?.[selectedDay] || {}),
          dia: selectedDay,
          comercio_actual_id: savedId,
          comercios: {
            ...(current?.[selectedDay]?.comercios || {}),
            [savedId]: savedCommerce,
          },
        },
      }))
      setSelectedCommerceId(savedId)
      setForm(savedCommerce)
      setPhotoFile(null)
      setMessage(`Comercio guardado para ${dayLabel}.`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar el comercio.')
    } finally {
      setSaving(false)
    }
  }

  async function createRepuesto(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!currentVenta) {
      setError('Crea o selecciona una venta antes de cargar repuestos.')
      setActivePanel('ventas')
      return
    }
    if (!selectedCommerceId) {
      setError('Guarda este comercio antes de crear repuestos.')
      setActivePanel('comercio')
      return
    }
    if (!repuestoForm.marca || !repuestoForm.modelo.trim() || !repuestoForm.nombre.trim()) {
      setError('Completa marca, modelo y nombre del repuesto.')
      return
    }
    setRepuestoSaving(true)
    try {
      const res = await fetch('/api/usuario/comercio/repuestos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          ...repuestoForm,
          comercio_id: selectedCommerceId || form.comercio_id || '',
          telefono: form.whatsapp,
          dia: selectedDay,
          venta: currentVenta,
          tipo_vehiculo: form.tipo_vehiculo,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo guardar el repuesto.')

      let fotos = body.item.fotos || []
      if (pendingRepuestoPhotos.length > 0) {
        const newId = body.item.id
        for (const photo of pendingRepuestoPhotos) {
          try {
            const prepared = await prepareImageForUpload(photo.file)
            if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) continue
            const data = new FormData()
            data.append('id', newId)
            data.append('foto', prepared, 'repuesto.jpg')
            const fotoRes = await fetch('/api/usuario/comercio/repuestos/foto', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.token}` },
              body: data,
            })
            const fotoBody = await fotoRes.json().catch(() => ({}))
            if (fotoRes.ok && fotoBody.ok) fotos = fotoBody.fotos
          } catch {
            // Si una foto falla, continuamos con las demas.
          }
        }
      }

      setRepuestos((items) => [{ ...body.item, fotos }, ...items])
      clearPendingRepuestoPhotos()
      setRepuestoForm({ ...EMPTY_REPUESTO, marca: repuestoForm.marca })
      setMessage('Repuesto creado. Puedes aprobarlo para publicarlo en el catalogo.')
    } catch (err) {
      setError(err.message || 'No se pudo guardar el repuesto.')
    } finally {
      setRepuestoSaving(false)
    }
  }

  function addPendingRepuestoPhoto(file) {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setError('Selecciona una imagen valida de hasta 20 MB.')
      return
    }
    if (pendingRepuestoPhotos.length >= 4) {
      setError('Maximo 4 fotos por repuesto.')
      return
    }
    setPendingRepuestoPhotos((current) => [...current, { file, url: URL.createObjectURL(file) }])
  }

  function removePendingRepuestoPhoto(index) {
    setPendingRepuestoPhotos((current) => {
      const removed = current[index]
      if (removed) URL.revokeObjectURL(removed.url)
      return current.filter((_, i) => i !== index)
    })
  }

  function clearPendingRepuestoPhotos() {
    setPendingRepuestoPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url))
      return []
    })
  }

  async function uploadRepuestoPhoto(item, file) {
    setError('')
    setMessage('')
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
      setError('Selecciona una imagen valida de hasta 20 MB.')
      return
    }
    if ((item.fotos || []).length >= 4) {
      setError('Maximo 4 fotos por repuesto.')
      return
    }
    setUploadingPhotoId(item.id)
    try {
      // Misma reduccion de peso que la foto del comercio antes de subir a Firebase.
      const prepared = await prepareImageForUpload(file)
      if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) throw new Error('La foto no pudo reducirse lo suficiente.')
      const data = new FormData()
      data.append('id', item.id)
      data.append('foto', prepared, 'repuesto.jpg')
      const res = await fetch('/api/usuario/comercio/repuestos/foto', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: data,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo subir la foto.')
      setRepuestos((items) => items.map((it) => (it.id === item.id ? { ...it, fotos: body.fotos } : it)))
      setMessage('Foto agregada al repuesto.')
    } catch (err) {
      setError(err?.message || 'No se pudo subir la foto.')
    } finally {
      setUploadingPhotoId('')
    }
  }

  async function approveRepuesto(itemArg) {
    const target = typeof itemArg === 'object' && itemArg ? itemArg : repuestos.find((r) => r.id === itemArg)
    if (!target) return
    const id = target.id
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/usuario/comercio/repuestos', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          id,
          comercio_id: target.comercio_id || selectedCommerceId || form.comercio_id || '',
          dia: target.dia || selectedDay,
          venta: target.venta || currentVenta,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo aprobar el repuesto.')
      setRepuestos((items) => items.map((item) => (
        item.id === id
          ? {
            ...item,
            aprobado: true,
            comercio_id: item.comercio_id || selectedCommerceId || form.comercio_id || '',
            dia: item.dia || selectedDay,
            venta: item.venta || currentVenta,
            catalogo_id: body.catalogo_id || item.catalogo_id,
          }
          : item
      )))
      setMessage('Repuesto aprobado y publicado en el catalogo.')
    } catch (err) {
      setError(err.message || 'No se pudo aprobar el repuesto.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950">
        <nav className="border-b border-slate-200 bg-[#20263a] px-5 py-4 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <h1 className="text-xl font-extrabold">Comercio autorizado</h1>
            <Link href="/usuario/opciones" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Volver</Link>
          </div>
        </nav>
        <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-md items-center px-5">
          <section className="w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <StatusPill tone="warn">Solicitud enviada</StatusPill>
            <h2 className="mt-3 text-2xl font-extrabold">Espera autorizacion</h2>

          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <nav className="border-b border-slate-200 bg-[#20263a] px-4 py-3 text-white sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-amber-300 sm:text-xs">Panel de comercio</p>
            <h1 className="text-base font-extrabold leading-tight sm:text-xl">Ventas y repuestos autorizados</h1>
          </div>
          <Link href="/usuario/opciones" className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold">Volver</Link>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-extrabold uppercase text-slate-500">Dia de venta</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DAYS.map((day) => (
                <SoftButton
                  key={day.key}
                  active={selectedDay === day.key}
                  onClick={() => setSelectedDay(day.key)}
                  className="min-h-10 px-2"
                >
                  {day.label}
                </SoftButton>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-slate-500">Comercio activo</p>
                <h2 className="mt-1 text-lg font-extrabold">{form.nombre_comercio || 'Sin comercio'}</h2>
              </div>
              <StatusPill tone={pendingApprovalCount ? 'warn' : 'good'}>
                {pendingApprovalCount}
              </StatusPill>
            </div>
            <div className="mt-4 grid gap-2">
              <PrimaryButton onClick={resetCurrentDay}>+ Nuevo comercio</PrimaryButton>
              <SoftButton active={showSidebarLists} onClick={() => setShowSidebarLists((prev) => !prev)}>
                {showSidebarLists ? 'Ocultar listas de comercios' : 'Mostrar listas de comercios'}
              </SoftButton>
              <SoftButton active={showAllRepuestos} onClick={() => setShowAllRepuestos((prev) => !prev)}>
                {showAllRepuestos ? 'Ocultar repuestos' : 'Repuestos (todos)'}
              </SoftButton>
            </div>
            {showSidebarLists && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Seleccionar comercio ({namedCommerces.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowNamedList((prev) => !prev)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition hover:border-amber-300 hover:text-slate-900"
                >
                  {showNamedList ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showNamedList && (
                visibleCommerces.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No hay comercios para este dia.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {namedCommerces.map((commerce) => renderCommerceButton(commerce))}
                  </div>
                )
              )}

              {badWhatsappCommerces.length > 0 && (
                <div className="mt-5 border-t border-dashed border-slate-300 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-amber-600">
                      Sin WhatsApp correcto ({badWhatsappCommerces.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowBadWhatsappList((prev) => !prev)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition hover:border-amber-300 hover:text-slate-900"
                    >
                      {showBadWhatsappList ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {showBadWhatsappList && (
                    <div className="grid gap-2">
                      {badWhatsappCommerces.map((commerce) => renderCommerceButton(commerce))}
                    </div>
                  )}
                </div>
              )}

              {namelessCommerces.length > 0 && (
                <div className="mt-5 border-t border-dashed border-slate-300 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                      Comercios sin nombre ({namelessCommerces.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowNamelessList((prev) => !prev)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 transition hover:border-amber-300 hover:text-slate-900"
                    >
                      {showNamelessList ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {showNamelessList && (
                    <div className="grid gap-2">
                      {namelessCommerces.map((commerce) => renderCommerceButton(commerce))}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-5">
          {error && <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}

          {showAllRepuestos && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-amber-600">Todos los comercios</p>
                  <h2 className="text-xl font-extrabold">Repuestos por estado</h2>
                </div>
                <SoftButton onClick={loadRepuestos} disabled={repuestosLoading}>
                  {repuestosLoading ? 'Cargando...' : 'Actualizar'}
                </SoftButton>
              </div>

              <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[['todos', 'Todos'], ['pendiente', 'Pendientes'], ['aprobado', 'Aprobados']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAllRepuestosFilter(key)}
                    className={`h-9 rounded-md px-4 text-sm font-extrabold ${allRepuestosFilter === key ? 'bg-[#20263a] text-white' : 'text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {allRepuestosFiltered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No hay repuestos para mostrar.
                  </p>
                ) : allRepuestosFiltered.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-slate-900">{item.nombre}</h3>
                          <StatusPill tone={item.aprobado ? 'good' : 'warn'}>{item.aprobado ? 'Publicado' : 'Pendiente'}</StatusPill>
                        </div>
                        <p className="mt-1 text-xs font-bold text-amber-700">
                          {commerceNameForItem(item)} · {item.telefono || 'Sin WhatsApp'}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {[item.marca, item.modelo, item.anio].filter(Boolean).join(' · ') || 'Sin compatibilidad'}
                        </p>
                        {item.nota && <p className="mt-1 text-sm text-slate-500">{item.nota}</p>}
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-800">
                          {formatPrecio(item.precio)}
                        </span>
                        <PrimaryButton onClick={() => approveRepuesto(item)} disabled={item.aprobado} className="flex-1 sm:flex-none">
                          {item.aprobado ? 'Aprobado' : 'Aprobar publicacion'}
                        </PrimaryButton>
                      </div>
                    </div>

                    <RepuestoFotos
                      fotos={item.fotos || []}
                      uploading={uploadingPhotoId === item.id}
                      onPick={(file) => uploadRepuestoPhoto(item, file)}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}

          {activePanel === 'comercios' && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-amber-600">Comercios de {dayLabel}</p>
                  <h2 className="text-xl font-extrabold">Selecciona un comercio</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Usa la lista en “Comercio activo” para elegir el comercio que quieres editar.
                  </p>
                </div>
                <PrimaryButton onClick={resetCurrentDay}>Agregar comercio</PrimaryButton>
              </div>
            </section>
          )}

          <section ref={commerceInfoRef} className="scroll-mt-24 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-amber-600">Datos para {dayLabel}</p>
                  <h2 className="text-2xl font-extrabold">Informacion del comercio</h2>
                </div>
                <div className="flex gap-2">
                  <StatusPill tone={fieldReady(form.nombre_comercio) ? 'good' : 'warn'}>
                    {fieldReady(form.nombre_comercio) ? 'Completo' : 'Pendiente'}
                  </StatusPill>
                  <StatusPill tone={locationReady ? 'good' : 'neutral'}>{locationReady ? 'Ubicado' : 'Sin mapa'}</StatusPill>
                  <StatusPill tone={commerceCedulaVerified ? 'good' : commerceCedulaPending ? 'warn' : 'neutral'}>
                    {commerceCedulaVerified ? 'Cédula verificada' : commerceCedulaPending ? 'Cédula en revisión' : 'Cédula no verificada'}
                  </StatusPill>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <label className="block cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 hover:border-amber-400">
                <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-white">
                  {photoSrc ? (
                    <Image src={photoSrc} alt="Foto del comercio" fill unoptimized className="object-contain p-1" />
                  ) : (
                    <span className="text-sm font-bold text-slate-500">Agregar foto</span>
                  )}
                </span>
                <span className="mt-3 flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-slate-800">
                  {photoSrc ? 'Cambiar foto' : 'Subir foto'}
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} className="hidden" />
              </label>

              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-sm font-bold text-slate-700">Nombre del comercio</span>
                    <input
                      value={form.nombre_comercio}
                      onChange={(event) => setField('nombre_comercio', event.target.value.slice(0, 120))}
                      placeholder="Ej: Repuestos Merida"
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-sm font-bold text-slate-700">WhatsApp <span className="font-semibold text-slate-400">(opcional)</span></span>
                    <input
                      value={form.whatsapp}
                      onChange={(event) => setField('whatsapp', event.target.value.replace(/\D/g, '').slice(0, 15))}
                      onBlur={(event) => loadCommerceForWhatsapp(event.target.value)}
                      inputMode="tel"
                      placeholder="58412... (opcional)"
                      className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-400"
                    />
                  </label>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-slate-700">Referencia o direccion</span>
                  <textarea
                    value={form.comercio_direccion}
                    onChange={(event) => setField('comercio_direccion', event.target.value.slice(0, 220))}
                    placeholder={`Referencia para ${dayLabel}`}
                    rows={3}
                    className="resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </label>

                <div className="flex justify-end">
                  <SoftButton onClick={() => setMapOpen(true)} className="w-full sm:w-auto">
                    {locationReady ? 'Cambiar ubicacion' : 'Agregar ubicacion'}
                  </SoftButton>
                </div>

                {locationReady && (
                  <MiniLocationMap lat={form.comercio_lat} lng={form.comercio_lng} />
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-slate-800">Marcas que atiende</p>
                  <p className="text-xs text-slate-500">Usa el boton Carro/Moto arriba para cambiar la lista visible.</p>
                </div>
                <StatusPill>{allSelectedBrands.length} marcas</StatusPill>
              </div>

              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  {form.tipo_vehiculo === 'moto' ? 'Marcas de moto' : 'Marcas de carro'}
                </p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {selectedBrands.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {brands.map((brand) => {
                  const active = selectedBrands.includes(brand.name)
                  return (
                    <button
                      key={`${form.tipo_vehiculo}-${brand.name}`}
                      type="button"
                      onClick={() => toggleBrand(brand.name)}
                      title={brand.name}
                      className={`flex h-[86px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-white px-1 text-[10px] font-bold transition ${
                        active ? 'border-[#20263a] ring-2 ring-amber-300' : 'border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200">
                        <Image src={brand.icon} alt="" width={30} height={30} className="h-7 w-7 object-contain" />
                      </span>
                      <span className="w-full text-center leading-tight text-slate-600 line-clamp-2">{brand.name}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Seleccionadas</p>
                {allSelectedBrands.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Ninguna marca seleccionada.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allSelectedBrands.map((brand) => (
                      <button
                        key={`${brand.type}-${brand.name}`}
                        type="button"
                        onClick={() => toggleBrand(brand.name, brand.type === 'Moto' ? 'moto' : 'carro')}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700"
                        title="Quitar marca"
                      >
                        {brand.name} · {brand.type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Guarda el comercio despues de cambiar datos, ventas o marcas.</p>
              <PrimaryButton onClick={saveCommerce} disabled={saving || preparingPhoto} className="w-full sm:w-auto sm:min-w-64">
                {preparingPhoto ? 'Preparando foto...' : saving ? 'Guardando...' : `Guardar comercio para ${dayLabel}`}
              </PrimaryButton>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase text-amber-600">Pendientes del comercio</p>
                <h2 className="text-xl font-extrabold">Repuestos por aprobar</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                  {['carro', 'moto'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setField('tipo_vehiculo', type)}
                      className={`h-9 rounded-md px-4 text-sm font-extrabold capitalize ${form.tipo_vehiculo === type ? 'bg-[#20263a] text-white' : 'text-slate-600'
                        }`}
                    >
                      {type === 'carro' ? 'Carro' : 'Moto'}
                    </button>
                  ))}
                </div>
                <StatusPill tone={repuestosPendientes.length ? 'warn' : 'good'}>
                  {repuestosPendientes.length}
                </StatusPill>
                <button
                  type="button"
                  onClick={openPendingRepuestoForm}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#20263a] text-2xl font-extrabold leading-none text-white shadow-sm transition hover:bg-[#111827]"
                  title="Agregar repuesto pendiente"
                  aria-label="Agregar repuesto pendiente"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {repuestosPendientes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Este comercio no tiene repuestos pendientes por aprobar.
                </p>
              ) : repuestosPendientes.map((item) => (
                <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900">{item.nombre}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {[item.marca, item.modelo, item.anio].filter(Boolean).join(' · ') || 'Sin compatibilidad'}
                      </p>
                      {item.nota && <p className="mt-1 text-sm text-slate-500">{item.nota}</p>}
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-800">
                        {formatPrecio(item.precio)}
                      </span>
                      <PrimaryButton onClick={() => approveRepuesto(item.id)} className="flex-1 sm:flex-none">
                        Aprobar publicacion
                      </PrimaryButton>
                    </div>
                  </div>
                  <RepuestoFotos
                    fotos={item.fotos || []}
                    uploading={uploadingPhotoId === item.id}
                    onPick={(file) => uploadRepuestoPhoto(item, file)}
                  />
                </article>
              ))}
            </div>
          </section>

          {activePanel === 'ventas' && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-amber-600">Lista visible en esta pagina</p>
                  <h2 className="text-xl font-extrabold">Ventas de repuestos</h2>
                </div>
                <div className="flex gap-2 sm:w-auto">
                  <input
                    value={draftItem}
                    onChange={(event) => setDraftItem(event.target.value.slice(0, 80))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addListItem()
                      }
                    }}
                    placeholder="Ej: Frenos, filtros, motor"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-amber-400 sm:flex-none"
                  />
                  <PrimaryButton onClick={addListItem} className="shrink-0">Agregar</PrimaryButton>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {form.lista_ventas_repuestos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
                    Todavia no hay ventas para este dia.
                  </p>
                ) : form.lista_ventas_repuestos.map((item, index) => (
                  <div key={`${item}-${index}`} className={`rounded-lg border p-3 ${selectedVenta === item ? 'border-[#20263a] bg-slate-50' : 'border-slate-200'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVenta(item)
                        setActivePanel('repuestos')
                      }}
                      className="block w-full text-left text-sm font-extrabold text-slate-900"
                    >
                      {item}
                    </button>
                    <div className="mt-3 flex gap-2">
                      <SoftButton
                        onClick={() => {
                          setSelectedVenta(item)
                          setActivePanel('repuestos')
                        }}
                        className="min-h-9 flex-1 px-2 text-xs"
                      >
                        Ver repuestos
                      </SoftButton>
                      <button type="button" onClick={() => removeListItem(index)} className="rounded-lg px-3 text-xs font-extrabold text-red-600 hover:bg-red-50">
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activePanel === 'repuestos' && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-amber-600">Inventario por venta</p>
                  <h2 className="text-xl font-extrabold">Repuestos de {currentVenta || 'la venta seleccionada'}</h2>
                </div>
                <SoftButton onClick={loadRepuestos} disabled={repuestosLoading}>
                  {repuestosLoading ? 'Cargando...' : 'Actualizar'}
                </SoftButton>
              </div>

              <form ref={repuestoFormRef} onSubmit={createRepuesto} className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 scroll-mt-24">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={repuestoForm.marca}
                    onChange={(event) => setRepuestoForm((current) => ({ ...current, marca: event.target.value }))}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                  >
                    <option value="">Marca</option>
                    {marcaOptions.map((brand) => (
                      <option key={brand.name} value={brand.name}>{brand.name}</option>
                    ))}
                  </select>
                  <input
                    value={repuestoForm.modelo}
                    onChange={(event) => setRepuestoForm((current) => ({ ...current, modelo: event.target.value.slice(0, 80) }))}
                    placeholder="Modelo"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                  />
                  <input
                    value={repuestoForm.anio}
                    onChange={(event) => setRepuestoForm((current) => ({ ...current, anio: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="Ano"
                    inputMode="numeric"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <input
                    value={repuestoForm.nombre}
                    onChange={(event) => setRepuestoForm((current) => ({ ...current, nombre: event.target.value.slice(0, 120) }))}
                    placeholder="Nombre del repuesto"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                  />
                  <input
                    value={repuestoForm.precio}
                    onChange={(event) => setRepuestoForm((current) => ({ ...current, precio: event.target.value.slice(0, 40) }))}
                    placeholder="Precio"
                    type="text"
                    inputMode="text"
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-amber-400"
                  />
                </div>
                <textarea
                  value={repuestoForm.nota}
                  onChange={(event) => setRepuestoForm((current) => ({ ...current, nota: event.target.value.slice(0, 500) }))}
                  placeholder="Referencia, estado, compatibilidad o garantia"
                  rows={2}
                  className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <RepuestoFotosNuevo
                  photos={pendingRepuestoPhotos}
                  onPick={addPendingRepuestoPhoto}
                  onRemove={removePendingRepuestoPhoto}
                />
                <PrimaryButton disabled={repuestoSaving || !currentVenta} className="w-full sm:w-auto">
                  {repuestoSaving ? 'Guardando...' : 'Crear repuesto pendiente'}
                </PrimaryButton>
              </form>

              <div className="mt-4 grid gap-3">
                {repuestosVisibles.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No hay repuestos creados para esta venta.
                  </p>
                ) : repuestosVisibles.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-slate-900">{item.nombre}</h3>
                          <StatusPill tone={item.aprobado ? 'good' : 'warn'}>{item.aprobado ? 'Publicado' : 'Pendiente'}</StatusPill>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {[item.marca, item.modelo, item.anio].filter(Boolean).join(' · ') || 'Sin compatibilidad'}
                        </p>
                        {item.nota && <p className="mt-1 text-sm text-slate-500">{item.nota}</p>}
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-800">
                          {formatPrecio(item.precio)}
                        </span>
                        <PrimaryButton onClick={() => approveRepuesto(item.id)} disabled={item.aprobado} className="flex-1 sm:flex-none">
                          {item.aprobado ? 'Aprobado' : 'Aprobar publicacion'}
                        </PrimaryButton>
                      </div>
                    </div>

                    <RepuestoFotos
                      fotos={item.fotos || []}
                      uploading={uploadingPhotoId === item.id}
                      onPick={(file) => uploadRepuestoPhoto(item, file)}
                    />
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {mapOpen && (
        <MapPicker
          initialLat={form.comercio_lat}
          initialLng={form.comercio_lng}
          onClose={() => setMapOpen(false)}
          onConfirm={(coords) => {
            setForm((current) => ({ ...current, comercio_lat: coords.lat, comercio_lng: coords.lng }))
            setMapOpen(false)
          }}
        />
      )}
    </div>
  )
}
