'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Mérida, Venezuela (centro por defecto)
const DEFAULT_CENTER = [8.5908, -71.1456]

// Paleta tierra: arena, arcilla, salvia. Calma y frescura.
const CLAY = '#A9714B'
const CLAY_DARK = '#8A5A39'
const SAGE = '#7C8F6B'
const SAND = '#EFE7DA'
// Verde de marca para los acentos dentro del mapa (ubicación, distancias).
const BLUE = '#22C55E'
const BLUE_DARK = '#16A34A'

// Un número válido tiene entre 10 y 15 dígitos (local 0XXXXXXXXXX o internacional 58…).
function waValido(whatsapp) {
  const phone = String(whatsapp || '').replace(/[^\d]/g, '')
  return phone.length >= 10 && phone.length <= 15
}

function waLink(whatsapp, mensaje) {
  const phone = String(whatsapp || '').replace(/[^\d]/g, '')
  if (!waValido(phone)) return ''
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`
}

// Distancia en km entre dos coordenadas (haversine).
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function distanciaLabel(km) {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function precioLabel(value) {
  if (!value) return 'Consultar'
  const s = String(value).trim()
  return /^\d+(\.\d+)?$/.test(s) ? `$${s}` : s
}

// Pin tipo gota con la foto del comercio dentro.
function pinHtml(comercio, selected) {
  const ring = selected ? SAGE : CLAY
  const size = selected ? 54 : 46
  const img = comercio.foto_url
    ? `<img src="${comercio.foto_url}" alt="" />`
    : `<div class="cm-pin-fallback">🏪</div>`
  return `
    <div class="cm-pin ${selected ? 'cm-pin--active' : ''}" style="--cm-ring:${ring};--cm-size:${size}px">
      <div class="cm-pin-body">${img}</div>
    </div>`
}

export default function ComerciosMap({ large = false }) {
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const LRef = useRef(null)
  const markersRef = useRef(new Map())
  const comerciosRef = useRef([])
  const userMarkerRef = useRef(null)
  const userPosRef = useRef(null)

  const [comercios, setComercios] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | empty | error
  const [selectedId, setSelectedId] = useState(null)
  const [userPos, setUserPos] = useState(null) // [lat, lng] del usuario
  const [geoStatus, setGeoStatus] = useState('idle') // idle | locating | ok | denied | unsupported

  const selected = comercios.find((c) => c.id === selectedId) || null
  const distSelected =
    selected && userPos
      ? distanciaKm(userPos[0], userPos[1], selected.lat, selected.lng)
      : null

  // Lista de comercios: ordenada por cercanía si ya hay ubicación del usuario.
  const comerciosListados = userPos
    ? comercios
        .map((c) => ({ ...c, _dist: distanciaKm(userPos[0], userPos[1], c.lat, c.lng) }))
        .sort((a, b) => a._dist - b._dist)
    : comercios.map((c) => ({ ...c, _dist: null }))

  // Carga de datos
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/comercios', { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        const list = Array.isArray(data?.comercios) ? data.comercios : []
        comerciosRef.current = list
        setComercios(list)
        setStatus(list.length ? 'ready' : 'empty')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Selección de marcador (estable)
  const selectComercio = useCallback((id) => {
    setSelectedId(id)
    const L = LRef.current
    const map = mapRef.current
    const comercio = comerciosRef.current.find((c) => c.id === id)
    if (L && map && comercio) {
      map.flyTo([comercio.lat, comercio.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
    }
  }, [])

  // "Estoy aquí": obtiene la ubicación del usuario y muestra los comercios cercanos.
  const locateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const ll = [latitude, longitude]
        userPosRef.current = ll
        setUserPos(ll)
        setGeoStatus('ok')

        const L = LRef.current
        const map = mapRef.current
        if (!L || !map) return

        // Marcador azul del usuario (punto con halo pulsante).
        const icon = L.divIcon({
          className: 'cm-me-wrap',
          html: '<div class="cm-me"><span class="cm-me-halo"></span><span class="cm-me-dot"></span></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(ll)
        } else {
          userMarkerRef.current = L.marker(ll, { icon, zIndexOffset: 2000, title: 'Tu ubicación' }).addTo(map)
        }

        // Ajusta el mapa al usuario + comercio más cercano y lo selecciona.
        const ordenados = comerciosRef.current
          .map((c) => ({ c, d: distanciaKm(latitude, longitude, c.lat, c.lng) }))
          .sort((a, b) => a.d - b.d)

        if (ordenados.length) {
          const cercano = ordenados[0].c
          map.fitBounds([ll, [cercano.lat, cercano.lng]], { padding: [60, 60], maxZoom: 15 })
          selectComercio(cercano.id)
        } else {
          map.flyTo(ll, 15, { duration: 0.6 })
        }
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [selectComercio])

  // Inicializa Leaflet cuando hay datos
  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapElRef.current || mapRef.current) return
      LRef.current = L

      const map = L.map(mapElRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapRef.current = map

      // Tiles CartoDB Voyager: tono cálido y suave, sin API key.
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map)

      const bounds = []
      comerciosRef.current.forEach((c) => {
        const icon = L.divIcon({
          className: 'cm-pin-wrap',
          html: pinHtml(c, false),
          iconSize: [46, 46],
          iconAnchor: [23, 46],
        })
        const marker = L.marker([c.lat, c.lng], { icon, title: c.nombre }).addTo(map)
        marker.on('click', () => selectComercio(c.id))
        markersRef.current.set(c.id, marker)
        bounds.push([c.lat, c.lng])
      })

      if (bounds.length === 1) {
        map.setView(bounds[0], 15)
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
      }

      // Reajuste por si el contenedor cambió de tamaño tras montar
      setTimeout(() => map.invalidateSize(), 200)
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markersRef.current = new Map()
        userMarkerRef.current = null
      }
    }
  }, [status, selectComercio])

  // Actualiza el estilo del pin seleccionado
  useEffect(() => {
    const L = LRef.current
    if (!L) return
    markersRef.current.forEach((marker, id) => {
      const comercio = comerciosRef.current.find((c) => c.id === id)
      if (!comercio) return
      const isSel = id === selectedId
      marker.setIcon(
        L.divIcon({
          className: 'cm-pin-wrap',
          html: pinHtml(comercio, isSel),
          iconSize: [isSel ? 54 : 46, isSel ? 54 : 46],
          iconAnchor: [isSel ? 27 : 23, isSel ? 54 : 46],
        }),
      )
      if (isSel) marker.setZIndexOffset(1000)
      else marker.setZIndexOffset(0)
    })
  }, [selectedId])

  return (
    <div className="cm-shell">
      <style jsx global>{`
        .cm-pin-wrap { background: transparent; border: none; }
        .cm-pin {
          width: var(--cm-size, 46px);
          height: var(--cm-size, 46px);
          position: relative;
          transition: transform 0.18s ease;
        }
        .cm-pin-body {
          width: 100%;
          height: 100%;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          overflow: hidden;
          background: var(--cm-ring, ${CLAY});
          border: 3px solid #fff;
          box-shadow: 0 6px 16px rgba(86, 62, 40, 0.35);
        }
        .cm-pin-body img,
        .cm-pin-fallback {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: rotate(45deg) scale(1.42);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          background: ${SAND};
        }
        .cm-pin--active { animation: cm-bounce 0.5s ease; z-index: 1000; }
        @keyframes cm-bounce {
          0% { transform: translateY(-8px); }
          60% { transform: translateY(2px); }
          100% { transform: translateY(0); }
        }
        .cm-shell .leaflet-control-zoom a {
          color: ${CLAY_DARK};
          border-color: #e3d8c7;
        }
        .cm-me-wrap { background: transparent; border: none; }
        .cm-me {
          position: relative;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cm-me-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${BLUE};
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.5);
          z-index: 2;
        }
        .cm-me-halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: ${BLUE};
          opacity: 0.35;
          animation: cm-pulse 1.8s ease-out infinite;
        }
        @keyframes cm-pulse {
          0% { transform: scale(0.5); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .cm-scroll::-webkit-scrollbar { height: 6px; }
        .cm-scroll::-webkit-scrollbar-thumb { background: #d8c7af; border-radius: 999px; }
      `}</style>

      <div className="relative overflow-hidden rounded-3xl border border-[#e3d8c7] bg-[#f6f1e8] shadow-[0_10px_40px_rgba(120,90,60,0.12)]">
        {/* Mapa */}
        <div
          ref={mapElRef}
          className={large
            ? 'z-0 h-[58vh] min-h-[460px] w-full sm:h-[68vh] sm:min-h-[560px]'
            : 'z-0 h-[420px] w-full sm:h-[520px]'}
        />

        {/* Botón "Estoy aquí" — ubica al usuario y muestra lo más cercano */}
        {status === 'ready' && (
          <button
            type="button"
            onClick={locateMe}
            disabled={geoStatus === 'locating'}
            className="absolute right-3 top-3 z-[1100] inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-70"
            style={{ background: BLUE }}
            onMouseEnter={(e) => (e.currentTarget.style.background = BLUE_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = BLUE)}
          >
            {geoStatus === 'locating' ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
              </svg>
            )}
            {geoStatus === 'locating' ? 'Buscando…' : 'Estoy aquí'}
          </button>
        )}

        {/* Aviso de permiso denegado / no soportado */}
        {(geoStatus === 'denied' || geoStatus === 'unsupported') && (
          <div className="absolute left-3 right-3 top-14 z-[1100] mx-auto max-w-xs rounded-xl bg-white/95 px-3 py-2 text-center text-[11px] font-medium text-[#16A34A] shadow-lg backdrop-blur sm:left-auto sm:right-3">
            {geoStatus === 'denied'
              ? 'Activa el permiso de ubicación para ver comercios cerca de ti.'
              : 'Tu navegador no permite obtener la ubicación.'}
          </div>
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#f6f1e8] text-[#8A5A39]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8c7af] border-t-[#A9714B]" />
            <p className="text-sm font-medium">Cargando comercios…</p>
          </div>
        )}

        {(status === 'empty' || status === 'error') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f6f1e8] px-6 text-center text-[#6b5b4d]">
            <span className="text-4xl">🗺️</span>
            <p className="text-sm font-semibold">
              {status === 'error'
                ? 'No pudimos cargar el mapa por ahora.'
                : 'Aún no hay comercios con su ficha completa.'}
            </p>
          </div>
        )}

        {/* Panel de detalle del comercio seleccionado */}
        {selected && (
          <ComercioPanel
            comercio={selected}
            distanciaKm={distSelected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Pie con conteo */}
      {status === 'ready' && (
        <p className="mt-3 text-center text-xs text-[#8a7a66]">
          {geoStatus === 'ok' ? (
            <span className="font-semibold" style={{ color: BLUE_DARK }}>
              Mostrando comercios cerca de ti
            </span>
          ) : (
            <>Toca un pin para ver el comercio y sus repuestos</>
          )}{' '}
          · {comercios.length}{' '}
          {comercios.length === 1 ? 'comercio' : 'comercios'} en el mapa
        </p>
      )}

      {/* Lista de comercios (ordenada por cercanía cuando hay ubicación) */}
      {status === 'ready' && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <h4 className="font-brand text-sm font-bold text-[#3f352b]">
              {userPos ? 'Comercios más cercanos' : 'Comercios en el mapa'}
            </h4>
            {!userPos && (
              <button
                type="button"
                onClick={locateMe}
                className="text-[11px] font-bold"
                style={{ color: BLUE_DARK }}
              >
                Ordenar por cercanía
              </button>
            )}
          </div>
          <ul className="cm-scroll flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory]">
            {comerciosListados.map((c) => {
              const isSel = c.id === selectedId
              return (
                <li key={c.id} className="shrink-0 [scroll-snap-align:start]">
                  <button
                    type="button"
                    onClick={() => selectComercio(c.id)}
                    className={`flex w-44 flex-col overflow-hidden rounded-2xl border bg-white text-left transition hover:bg-[#faf6ef] ${
                      isSel ? 'border-[#A9714B] ring-1 ring-[#A9714B]' : 'border-[#ece3d4]'
                    }`}
                  >
                    <div className="relative h-24 w-full bg-[#efe7da]">
                      {c.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.foto_url} alt={c.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🏪</div>
                      )}
                      {c._dist != null && (
                        <span
                          className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow"
                          style={{ background: BLUE }}
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
                          </svg>
                          {distanciaLabel(c._dist)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-2.5">
                      <p className="line-clamp-2 text-sm font-bold leading-snug text-[#3f352b]">{c.nombre}</p>
                      {c.direccion && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#9a8a76]">{c.direccion}</p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#8A5A39]">
                        Ver repuestos
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function ComercioPanel({ comercio, distanciaKm, onClose }) {
  const repuestos = Array.isArray(comercio.repuestos) ? comercio.repuestos : []
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${comercio.lat},${comercio.lng}`
  const [minimized, setMinimized] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  // Barra compacta cuando el usuario oculta la ficha (sigue resaltado el pin).
  if (minimized) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:inset-y-auto sm:bottom-3 sm:right-3 sm:left-auto sm:w-[420px] sm:p-0">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex w-full items-center gap-2.5 rounded-2xl border border-[#e3d8c7] bg-white/95 p-2 text-left shadow-[0_12px_40px_rgba(86,62,40,0.22)] backdrop-blur hover:bg-white"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#efe7da]">
            {comercio.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={comercio.foto_url} alt={comercio.nombre} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-lg">🏪</div>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#3f352b]">{comercio.nombre}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8A5A39]">
            Ver
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </span>
          <span
            role="button"
            tabIndex={0}
            aria-label="Cerrar"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClose() } }}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efe7da] text-[#8A5A39] hover:bg-[#e3d8c7]"
          >
            ✕
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:p-4">
      <div className="flex max-h-[82%] flex-col overflow-hidden rounded-2xl border border-[#e3d8c7] bg-white/95 shadow-[0_12px_40px_rgba(86,62,40,0.22)] backdrop-blur sm:max-h-full">
        {/* Cabecera del comercio */}
        <div className="relative">
          {comercio.foto_url ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              aria-label="Ver foto más grande"
              className="group block h-32 w-full overflow-hidden bg-[#efe7da] sm:h-40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={comercio.foto_url} alt={comercio.nombre} className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="pointer-events-none absolute left-2 bottom-[60px] flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 sm:bottom-[72px]">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z" />
                </svg>
              </span>
            </button>
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-[#efe7da] text-4xl sm:h-40">🏪</div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-t from-black/55 to-transparent sm:h-40" />
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Ocultar"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur hover:bg-black/60"
            >
              ✕
            </button>
          </div>
          {distanciaKm != null && (
            <span
              className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow"
              style={{ background: BLUE }}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
              </svg>
              {distanciaLabel(distanciaKm)}
            </span>
          )}
          <div className="absolute bottom-2 left-3 right-3 text-white">
            <h3 className="truncate font-brand text-lg font-bold leading-tight drop-shadow">{comercio.nombre}</h3>
            {comercio.direccion && (
              <p className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug text-white/90">
                <svg className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                </svg>
                <span className="line-clamp-2">{comercio.direccion}</span>
              </p>
            )}
          </div>
        </div>

        {/* Cuerpo: carrusel de repuestos */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between">
            {repuestos.length > 0 ? (
              <span className="text-xs font-bold uppercase tracking-wide text-[#8A5A39]">
                Repuestos ({repuestos.length})
              </span>
            ) : (
              <span />
            )}
            {waValido(comercio.whatsapp) && (
              <a
                href={waLink(comercio.whatsapp, `Hola ${comercio.nombre}, vi su comercio en el mapa de Repuestos Mérida.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#1da851]"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.554-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z" />
                </svg>
                Escribir
              </a>
            )}
          </div>

          {repuestos.length > 0 && (
            <div className="cm-scroll flex gap-3 overflow-x-auto pb-1 [scroll-snap-type:x_mandatory]">
              {repuestos.map((r) => (
                <RepuestoCard key={r.id} repuesto={r} comercio={comercio} />
              ))}
            </div>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#e3d8c7] bg-[#f6f1e8] px-4 py-2 text-xs font-bold text-[#8A5A39] hover:bg-[#efe7da]"
          >
            Cómo llegar
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>

      {/* Lightbox: foto del comercio en grande */}
      {lightbox && comercio.foto_url && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur hover:bg-white/25"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comercio.foto_url}
            alt={comercio.nombre}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
          <p className="absolute bottom-5 left-0 right-0 text-center text-sm font-bold text-white drop-shadow">
            {comercio.nombre}
          </p>
        </div>
      )}
    </div>
  )
}

function RepuestoCard({ repuesto, comercio }) {
  const compat = [repuesto.marca, repuesto.modelo, repuesto.anio].filter(Boolean).join(' ')
  const mensaje = `Hola ${comercio.nombre}, me interesa el repuesto *${repuesto.nombre}*${compat ? ` (${compat})` : ''}. ¿Está disponible y cuál es el precio?`
  const wa = waLink(comercio.whatsapp, mensaje)

  return (
    <article className="flex w-44 shrink-0 flex-col overflow-hidden rounded-xl border border-[#ece3d4] bg-white shadow-sm [scroll-snap-align:start] sm:w-48">
      <div className="relative aspect-square w-full bg-[#efe7da]">
        {repuesto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={repuesto.foto_url} alt={repuesto.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-[#c9b89f]">📦</div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-[#A9714B] px-2 py-0.5 text-[10px] font-bold text-white shadow">
          {precioLabel(repuesto.precio)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <h4 className="line-clamp-2 text-xs font-bold leading-snug text-[#3f352b]">{repuesto.nombre}</h4>
        {compat && <p className="mt-0.5 line-clamp-1 text-[10px] text-[#9a8a76]">{compat}</p>}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg bg-[#25D366] px-2 py-1.5 pt-2 text-[11px] font-bold text-white hover:bg-[#1da851]"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.554-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z" />
            </svg>
            Pedir
          </a>
        )}
      </div>
    </article>
  )
}
