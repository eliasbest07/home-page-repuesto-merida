'use client'
import { BRANDS, CATALOG } from '../../../lib/vehicleCatalog'

const STEPS = ['brand', 'year', 'model', 'version']
const STEP_LABEL = {
  brand:   'Selecciona la marca',
  year:    'Selecciona el año',
  model:   'Selecciona el modelo',
  version: 'Selecciona la versión',
}
const STEP_FIELD = { brand: 'brand', year: 'year', model: 'model', version: 'version' }

export default function StepSelector({ step, selection, onSelect }) {
  if (!STEPS.includes(step)) return null

  let options = []

  if (step === 'brand') {
    options = BRANDS.map(b => ({ id: b.id, label: b.label, value: b, accent: b.color }))
  } else if (step === 'year' && selection.brand) {
    const years = CATALOG[selection.brand.id]?.years ?? []
    options = [...years].reverse().map(y => ({ id: String(y), label: String(y), value: y }))
  } else if (step === 'model' && selection.brand) {
    const models = CATALOG[selection.brand.id]?.models ?? {}
    options = Object.keys(models).map(m => ({ id: m, label: m, value: m }))
  } else if (step === 'version' && selection.brand && selection.model) {
    const versions = CATALOG[selection.brand.id]?.models[selection.model]?.versions ?? []
    options = versions.map(v => ({ id: v, label: v, value: v }))
  }

  const stepIdx = STEPS.indexOf(step)

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
      {/* Progress dots */}
      <div className="flex justify-center items-center gap-2 mb-2 px-4">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="transition-all duration-500 rounded-full"
            style={{
              height: 6,
              width: i === stepIdx ? 32 : 14,
              background: i < stepIdx ? '#22C55E' : i === stepIdx ? '#FFD700' : '#374151',
            }}
          />
        ))}
      </div>

      {/* Panel */}
      <div
        className="border-t border-gray-700/60 rounded-t-2xl"
        style={{ background: 'rgba(17,24,39,0.96)', backdropFilter: 'blur(12px)', padding: '16px 16px 24px' }}
      >
        {/* Header */}
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
          {STEP_LABEL[step]}
        </p>

        {/* Breadcrumb */}
        {(selection.brand || selection.year || selection.model) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selection.brand && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: '#1f2937', color: selection.brand.color ?? '#FFD700' }}>
                {selection.brand.label}
              </span>
            )}
            {selection.year && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: '#1f2937', color: '#22C55E' }}>
                {selection.year}
              </span>
            )}
            {selection.model && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: '#1f2937', color: '#60a5fa' }}>
                {selection.model}
              </span>
            )}
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => onSelect(STEP_FIELD[step], opt.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95"
              style={{
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #374151',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = opt.accent ?? '#FFD700'
                e.currentTarget.style.color = '#111827'
                e.currentTarget.style.borderColor = opt.accent ?? '#FFD700'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#1f2937'
                e.currentTarget.style.color = '#e5e7eb'
                e.currentTarget.style.borderColor = '#374151'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
