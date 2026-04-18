'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import StepSelector from './components/StepSelector'

const CarCanvas = dynamic(() => import('./components/CarCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#111827' }}>
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-full border-2 border-t-transparent animate-spin"
          style={{ width: 44, height: 44, borderColor: '#FFD700', borderTopColor: 'transparent' }}
        />
        <p style={{ color: '#FFD700', fontSize: 13 }}>Cargando escena 3D…</p>
      </div>
    </div>
  ),
})

const STEP_NEXT = {
  idle:    'brand',
  brand:   'year',
  year:    'model',
  model:   'version',
  version: 'complete',
}
const WA_NUMBER = '+584123375417'

function buildWaText(sel) {
  return `Hola! Busco repuestos para mi ${sel.brand?.label ?? ''} ${sel.model ?? ''} ${sel.year ?? ''} ${sel.version ?? ''}`.replace(/\s+/g, ' ').trim()
}

export default function ConfiguradorPage() {
  const [step, setStep] = useState('idle')
  const [selection, setSelection] = useState({ brand: null, year: null, model: null, version: null })

  const handleSelect = (field, value) => {
    setSelection(prev => ({ ...prev, [field]: value }))
    setStep(prev => STEP_NEXT[prev] ?? 'complete')
  }

  const handleReset = () => {
    setStep('idle')
    setSelection({ brand: null, year: null, model: null, version: null })
  }

  const waHref = `https://wa.me/${WA_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent(buildWaText(selection))}`

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#111827' }}>

      {/* 3D Scene — fills entire background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CarCanvas step={step} selection={selection} />
      </div>

      {/* UI layer */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', pointerEvents: 'auto',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 13, textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            Inicio
          </Link>

          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#FFD700', fontWeight: 700, fontSize: 13, letterSpacing: 2, margin: 0 }}>CONFIGURADOR</p>
            <p style={{ color: '#4b5563', fontSize: 11, margin: 0 }}>Repuestos Mérida</p>
          </div>

          {step !== 'idle' && step !== 'complete' ? (
            <button onClick={handleReset} style={{ color: '#6b7280', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
              Reiniciar
            </button>
          ) : (
            <div style={{ width: 64 }} />
          )}
        </div>

        {/* Center content — only when idle */}
        {step === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, pointerEvents: 'auto' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ color: '#ffffff', fontSize: 26, fontWeight: 800, margin: '0 0 6px', letterSpacing: -0.5 }}>
                Configura tu vehículo
              </h1>
              <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
                Selecciona marca · año · modelo · versión
              </p>
            </div>
            <button
              onClick={() => setStep('brand')}
              style={{
                padding: '12px 32px',
                background: '#FFD700',
                color: '#111827',
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 14,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(255,215,0,0.25)',
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Comenzar configuración →
            </button>
          </div>
        )}

        {/* Spacer when step is in progress */}
        {(step !== 'idle' && step !== 'complete') && (
          <div style={{ flex: 1 }} />
        )}

        {/* Complete screen */}
        {step === 'complete' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'auto' }}>
            <div style={{
              background: 'rgba(17,24,39,0.94)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 20,
              padding: 24,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ color: '#22C55E', fontSize: 32, marginBottom: 8 }}>✓</div>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>¡Vehículo configurado!</h2>
              <div style={{ fontSize: 14, color: '#d1d5db', marginBottom: 20, lineHeight: 1.6 }}>
                <span style={{ color: selection.brand?.color ?? '#FFD700', fontWeight: 600 }}>{selection.brand?.label}</span>
                {' '}{selection.model}{' '}
                <span style={{ color: '#9ca3af' }}>{selection.year}</span>
                {' · '}{selection.version}
              </div>

              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  padding: '13px 0',
                  background: '#22C55E',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 13,
                  textDecoration: 'none',
                  marginBottom: 10,
                  transition: 'background 0.15s',
                }}
              >
                🔍 Buscar repuestos por WhatsApp
              </a>

              <button
                onClick={handleReset}
                style={{ color: '#6b7280', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Configurar otro vehículo
              </button>
            </div>
          </div>
        )}

        {/* Step selector panel */}
        <StepSelector step={step} selection={selection} onSelect={handleSelect} />
      </div>
    </div>
  )
}
