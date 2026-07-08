'use client'

import { useMemo, useState } from 'react'

const WHATSAPP_NUMBER = '584123375417'

const initialForm = {
  tipo: 'carro',
  marca: '',
  modelo: '',
  anio: '',
  motor: '',
  repuesto: '',
  referencia: '',
  condicion: 'nuevo o usado en buen estado',
  zona: 'Merida',
}

function clean(value) {
  return String(value || '').trim()
}

export default function RequestChecklist() {
  const [form, setForm] = useState(initialForm)

  const missing = useMemo(() => {
    const required = [
      ['marca', 'Marca'],
      ['modelo', 'Modelo'],
      ['anio', 'Ano'],
      ['repuesto', 'Repuesto'],
    ]
    return required.filter(([key]) => !clean(form[key])).map(([, label]) => label)
  }, [form])

  const message = useMemo(() => {
    const lines = [
      'Hola, estoy buscando este repuesto en Repuestos Merida:',
      '',
      `Vehiculo: ${clean(form.tipo) || 'carro'}`,
      `Marca: ${clean(form.marca) || '[marca]'}`,
      `Modelo: ${clean(form.modelo) || '[modelo]'}`,
      `Ano: ${clean(form.anio) || '[ano]'}`,
      form.motor ? `Motor/version: ${clean(form.motor)}` : '',
      `Repuesto: ${clean(form.repuesto) || '[repuesto]'}`,
      form.referencia ? `Numero de parte o referencia: ${clean(form.referencia)}` : '',
      `Condicion aceptada: ${clean(form.condicion) || 'nuevo o usado en buen estado'}`,
      `Zona: ${clean(form.zona) || 'Merida'}`,
      '',
      'Puedo enviar fotos del repuesto, tablero o documento del vehiculo si hace falta.',
    ]
    return lines.filter((line) => line !== '').join('\n')
  }, [form])

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="bg-slate-950 px-4 py-12 text-white sm:px-6" aria-labelledby="checklist-title">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-yellow-300">Mensaje listo</p>
          <h2 id="checklist-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Prepara una solicitud completa
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Un comercio puede responder mejor cuando recibe el dato exacto del vehiculo, el nombre
            del repuesto y una referencia verificable. Esta plantilla ordena la informacion antes de
            escribir por WhatsApp.
          </p>

          <div className="mt-7 grid gap-3 text-sm text-slate-300">
            {[
              'Incluye una foto del repuesto viejo si lo tienes desmontado.',
              'Si el repuesto es electrico, agrega marca del sensor o numero grabado.',
              'Para motor y caja, confirma cilindrada, version y tipo de transmision.',
              'Pregunta por garantia, procedencia y disponibilidad antes de trasladarte.',
            ].map((item) => (
              <div key={item} className="flex gap-3 border-b border-white/10 pb-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-300" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-white/10 bg-white p-4 text-slate-950 shadow-2xl sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-bold">
              Vehiculo
              <select
                value={form.tipo}
                onChange={(event) => updateField('tipo', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-yellow-500"
              >
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
                <option value="camioneta">Camioneta</option>
                <option value="camion">Camion</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Ano
              <input
                value={form.anio}
                onChange={(event) => updateField('anio', event.target.value.replace(/\D/g, '').slice(0, 4))}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="2008"
                inputMode="numeric"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Marca
              <input
                value={form.marca}
                onChange={(event) => updateField('marca', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="Toyota"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Modelo
              <input
                value={form.modelo}
                onChange={(event) => updateField('modelo', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="Yaris"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Motor o version
              <input
                value={form.motor}
                onChange={(event) => updateField('motor', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="1.6 sincronico"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Repuesto
              <input
                value={form.repuesto}
                onChange={(event) => updateField('repuesto', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="Bomba de aceite"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Referencia
              <input
                value={form.referencia}
                onChange={(event) => updateField('referencia', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="Codigo grabado"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              Zona
              <input
                value={form.zona}
                onChange={(event) => updateField('zona', event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-yellow-500"
                placeholder="Merida"
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-bold">
            Condicion aceptada
            <select
              value={form.condicion}
              onChange={(event) => updateField('condicion', event.target.value)}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-yellow-500"
            >
              <option value="nuevo o usado en buen estado">Nuevo o usado en buen estado</option>
              <option value="solo nuevo">Solo nuevo</option>
              <option value="original preferiblemente">Original preferiblemente</option>
              <option value="usado probado">Usado probado</option>
            </select>
          </label>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">Mensaje generado</p>
              <span className={`text-xs font-bold ${missing.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                {missing.length ? `Falta: ${missing.join(', ')}` : 'Completo'}
              </span>
            </div>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {message}
            </pre>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700"
          >
            Enviar por WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}
