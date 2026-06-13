'use client'

import { useEffect, useRef, useState } from 'react'

// Mérida, Venezuela (fallback inicial)
const DEFAULT_LAT = 8.5908
const DEFAULT_LNG = -71.1456

export default function MapPicker({ initialLat, initialLng, onConfirm, onClose }) {
  const mapElRef    = useRef(null)
  const mapRef      = useRef(null)
  const [coords, setCoords]       = useState({
    lat: initialLat ?? DEFAULT_LAT,
    lng: initialLng ?? DEFAULT_LNG,
  })
  const [locating, setLocating]   = useState(false)
  const [error, setError]         = useState(null)

  // Inicializa Leaflet (dynamic import — solo cliente)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapElRef.current) return

      const startLat = initialLat ?? DEFAULT_LAT
      const startLng = initialLng ?? DEFAULT_LNG

      const map = L.map(mapElRef.current, {
        center: [startLat, startLng],
        zoom: initialLat ? 17 : 13,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map)

      map.on('move', () => {
        const c = map.getCenter()
        setCoords({ lat: c.lat, lng: c.lng })
      })

      mapRef.current = map

      // Auto-centrar en ubicación actual si no se pasó una inicial
      if (initialLat == null && navigator.geolocation) {
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled || !mapRef.current) return
            mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 17)
            setLocating(false)
          },
          () => { setLocating(false) },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        )
      }
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [initialLat, initialLng])

  function mover() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Tu dispositivo no soporta geolocalización')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 18)
        }
        setLocating(false)
      },
      (err) => {
        setError(
          err.code === 1 ? 'Permite el acceso a la ubicación'
          : err.code === 2 ? 'Activa el GPS'
          : 'Tiempo agotado obteniendo tu ubicación'
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  function confirmar() {
    onConfirm?.({ lat: coords.lat, lng: coords.lng })
  }

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <button onClick={onClose} className="text-gray-300 hover:text-white text-sm">✕ Cancelar</button>
        <div className="text-sm font-bold font-brand">Elige tu ubicación</div>
        <button
          onClick={mover}
          disabled={locating}
          className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold disabled:opacity-50"
        >
          {locating ? 'Buscando…' : '📍 Mi ubicación'}
        </button>
      </div>

      {/* Mapa con pin fijo al centro */}
      <div className="flex-1 relative">
        <div ref={mapElRef} className="absolute inset-0 z-0" />

        {/* Pin central fijo */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10">
          <svg className="w-10 h-10 drop-shadow-lg" viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
          </svg>
          <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 mx-auto" />
        </div>

        {/* Hint flotante */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur rounded-full px-3 py-1.5 text-xs text-gray-700 shadow-lg z-10 pointer-events-none">
          Arrastra el mapa para mover el pin
        </div>

        {error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-1.5 border border-red-200 shadow z-10">
            {error}
          </div>
        )}
      </div>

      {/* Footer con coords y confirmar */}
      <div className="bg-white px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">Latitud / Longitud</div>
          <div className="font-mono text-sm font-bold text-gray-900">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </div>
        </div>
        <button onClick={confirmar} className="btn-brand w-full justify-center">
          Confirmar punto
        </button>
      </div>
    </div>
  )
}
