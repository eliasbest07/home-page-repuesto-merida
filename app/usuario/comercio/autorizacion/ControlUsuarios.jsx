'use client'

import { useEffect, useState } from 'react'

// Control de usuarios nuevos: buscar por teléfono, ver la cédula que subieron
// y aprobarlos para publicar en la app (escribe `cedula` en /users).

function formatDate(ms) {
  if (!ms) return ''
  try {
    return new Date(ms).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

function Foto({ label, src }) {
  if (!src) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-500">
        Sin {label.toLowerCase()}
      </div>
    )
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-slate-100 object-contain" />
      <span className="mt-1 block text-[11px] font-bold text-slate-500">{label} · abrir</span>
    </a>
  )
}

export default function ControlUsuarios({ token }) {
  const [telefono, setTelefono] = useState('')
  const [result, setResult] = useState(null)
  const [cedula, setCedula] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pendientes, setPendientes] = useState([])
  const [pendientesLoading, setPendientesLoading] = useState(false)

  async function loadPendientes() {
    if (!token) return
    setPendientesLoading(true)
    try {
      const res = await fetch('/api/usuario/comercio/usuarios', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok && body.ok) setPendientes(body.pendientes || [])
    } finally {
      setPendientesLoading(false)
    }
  }

  useEffect(() => {
    loadPendientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function buscar(rawPhone = telefono) {
    const phone = String(rawPhone || '').trim()
    if (!phone) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/usuario/comercio/usuarios?telefono=${encodeURIComponent(phone)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo buscar el usuario.')
      setResult(body)
      setCedula(body.cedula_sugerida || '')
    } catch (err) {
      setResult(null)
      setError(err.message || 'No se pudo buscar el usuario.')
    } finally {
      setLoading(false)
    }
  }

  async function actualizar(accion) {
    if (!result) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/usuario/comercio/usuarios', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: result.telefono, cedula, accion }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) throw new Error(body.error || 'No se pudo actualizar el usuario.')
      await buscar(result.telefono)
      setMessage(accion === 'aprobar'
        ? 'Usuario aprobado: ya puede publicar en la app.'
        : 'Aprobación quitada: ya no puede publicar en la app.')
      loadPendientes()
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el usuario.')
    } finally {
      setSaving(false)
    }
  }

  function seleccionarPendiente(item) {
    const phone = item.telefono_busqueda || item.whatsapp || item.telefono
    if (!phone) {
      setError(`La cuenta ${item.uid} subió su cédula pero no tiene teléfono registrado.`)
      return
    }
    setTelefono(phone)
    buscar(phone)
  }

  const aprobado = result?.puede_publicar_app === true

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-extrabold uppercase text-amber-600">Usuarios nuevos</p>
      <h2 className="text-xl font-extrabold">Control de usuarios</h2>
      <p className="mt-1 text-sm text-slate-500">
        Busca por teléfono, revisa la cédula y aprueba para que pueda publicar en la app.
      </p>

      <form
        onSubmit={(event) => { event.preventDefault(); buscar() }}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="tel"
          inputMode="tel"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          placeholder="Ej: 04141234567"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={loading || !telefono.trim()}
          className="rounded-lg bg-[#20263a] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {message && <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-slate-950">{result.telefono}</p>
            {!result.encontrado ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">No registrado</span>
            ) : aprobado ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-700">Aprobado para publicar en la app</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">Sin aprobar</span>
            )}
          </div>

          {!result.encontrado && (
            <p className="mt-2 text-sm text-slate-500">No hay ninguna cuenta con ese teléfono en /users.</p>
          )}

          {result.cuentas?.length > 0 && (
            <div className="mt-3 grid gap-2">
              {result.cuentas.map((cuenta) => (
                <div key={cuenta.uid} className="flex items-start gap-3 rounded-lg bg-slate-50 p-2.5">
                  {cuenta.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cuenta.foto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
                  )}
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="break-words text-sm font-extrabold text-slate-950">
                      {cuenta.nombre || cuenta.nombre_comercio || 'Sin nombre'}
                    </p>
                    <p className="break-all font-semibold text-slate-500">
                      {cuenta.real_account ? 'Cuenta de la app' : 'Ficha del panel'} · {cuenta.uid}
                    </p>
                    <p className="mt-1 font-semibold text-slate-600">
                      WhatsApp: {cuenta.whatsapp || '—'} · Cédula: {cuenta.cedula || '—'}
                      {cuenta.cedula_estado ? ` (${cuenta.cedula_estado})` : ''}
                    </p>
                    {cuenta.cedula_actualizada_en && (
                      <p className="font-semibold text-slate-500">
                        Actualizada {formatDate(cuenta.cedula_actualizada_en)}
                        {cuenta.cedula_aprobada_por ? ` por ${cuenta.cedula_aprobada_por}` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    cuenta.puede_publicar_app ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cuenta.puede_publicar_app ? 'Publica' : 'No publica'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.verificacion_web && (
            <p className="mt-3 text-xs font-semibold text-slate-600">
              Verificación web ({result.verificacion_web.estado || 'sin estado'}):{' '}
              {[result.verificacion_web.nombres, result.verificacion_web.apellidos].filter(Boolean).join(' ') || '—'}
              {result.verificacion_web.fecha_nacimiento ? ` · nac. ${result.verificacion_web.fecha_nacimiento}` : ''}
            </p>
          )}

          <div className="mt-3">
            <p className="text-xs font-extrabold uppercase text-slate-500">Fotos de la cédula</p>
            {result.fotos?.length > 0 ? (
              <div className="mt-2 grid gap-3">
                {result.fotos.map((foto) => (
                  <div key={`${foto.origen}_${foto.uid || foto.id}`} className="grid grid-cols-2 gap-2">
                    <Foto label={`Cédula (${foto.origen})`} src={foto.cedula} />
                    <Foto label={`Selfie con cédula (${foto.origen})`} src={foto.selfie} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                Este usuario no ha subido fotos de la cédula.
              </p>
            )}
          </div>

          {result.encontrado && (
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="text-xs font-extrabold uppercase text-slate-500">Número de cédula</span>
                <input
                  value={cedula}
                  onChange={(event) => setCedula(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  inputMode="numeric"
                  placeholder="Ej: 12345678"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
              </label>
              <button
                type="button"
                onClick={() => actualizar('aprobar')}
                disabled={saving || cedula.length < 6}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {saving ? 'Guardando...' : aprobado ? 'Actualizar cédula' : 'Aprobar para publicar'}
              </button>
              {aprobado && (
                <button
                  type="button"
                  onClick={() => actualizar('revocar')}
                  disabled={saving}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-700 disabled:opacity-50"
                >
                  Quitar aprobación
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-dashed border-slate-300 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Subieron cédula en la app y esperan aprobación ({pendientes.length})
          </p>
          <button
            type="button"
            onClick={loadPendientes}
            disabled={pendientesLoading}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-extrabold text-slate-600 hover:border-amber-300"
          >
            {pendientesLoading ? '...' : 'Actualizar'}
          </button>
        </div>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{pendientesLoading ? 'Cargando...' : 'No hay pendientes.'}</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pendientes.map((item) => (
              <button
                key={item.uid}
                type="button"
                onClick={() => seleccionarPendiente(item)}
                className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-amber-300"
              >
                <span className="block break-words text-sm font-extrabold text-slate-950">
                  {item.nombre || item.nombre_comercio || 'Sin nombre'}
                </span>
                <span className="block break-all text-xs font-semibold text-slate-500">
                  {item.whatsapp || item.telefono || `Sin teléfono · ${item.uid}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
