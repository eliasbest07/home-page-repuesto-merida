'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import CarPart from './CarPart'

const STEPS = ['idle', 'brand', 'year', 'model', 'version', 'complete']
function reached(current, target) {
  return STEPS.indexOf(current) >= STEPS.indexOf(target)
}

export default function CarModel({ step, brandColor = '#FFD700' }) {
  const groupRef = useRef()

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.28
    }
  })

  const chassis  = reached(step, 'brand')
  const body     = reached(step, 'year')
  const details  = reached(step, 'model')
  const wheels   = reached(step, 'version')

  return (
    <group ref={groupRef} position={[0, 0.1, 0]}>

      {/* ── CHASSIS (Step: brand) ────────────────────────── */}
      <CarPart name="chassis"      type="box" args={[4.1, 0.18, 1.92]}
        position={[0, -0.38, 0]} color="#4a4a5a" assembled={chassis} delay={0}
        roughness={0.6} metalness={0.3} />
      <CarPart name="undercarriage" type="box" args={[3.5, 0.1, 1.6]}
        position={[0, -0.48, 0]} color="#333342" assembled={chassis} delay={120}
        roughness={0.7} metalness={0.2} />
      <CarPart name="axle_front"   type="cylinder" args={[0.07, 0.07, 2.3, 8]}
        position={[1.28, -0.38, 0]} rotation={[Math.PI/2, 0, 0]}
        color="#222230" assembled={chassis} delay={200} roughness={0.5} metalness={0.5} />
      <CarPart name="axle_rear"    type="cylinder" args={[0.07, 0.07, 2.3, 8]}
        position={[-1.28, -0.38, 0]} rotation={[Math.PI/2, 0, 0]}
        color="#222230" assembled={chassis} delay={240} roughness={0.5} metalness={0.5} />

      {/* ── BODY SHELL (Step: year) ──────────────────────── */}
      <CarPart name="body_main"   type="box" args={[3.9, 0.72, 1.88]}
        position={[0, 0.12, 0]} color={brandColor} assembled={body} delay={0}
        roughness={0.3} metalness={0.25} />
      <CarPart name="hood"        type="box" args={[1.25, 0.09, 1.84]}
        position={[1.45, 0.545, 0]} color={brandColor} assembled={body} delay={130}
        roughness={0.3} metalness={0.25} />
      <CarPart name="trunk_lid"   type="box" args={[0.95, 0.12, 1.84]}
        position={[-1.5, 0.45, 0]} color={brandColor} assembled={body} delay={200}
        roughness={0.3} metalness={0.25} />
      <CarPart name="bumper_front" type="box" args={[0.15, 0.35, 1.88]}
        position={[2.03, -0.1, 0]} color="#e0e0e0" assembled={body} delay={280}
        roughness={0.5} metalness={0.1} />
      <CarPart name="bumper_rear"  type="box" args={[0.12, 0.28, 1.88]}
        position={[-2.02, -0.08, 0]} color="#e0e0e0" assembled={body} delay={320}
        roughness={0.5} metalness={0.1} />

      {/* ── DETAILS / CABIN (Step: model) ───────────────── */}
      <CarPart name="roof"        type="box" args={[2.15, 0.52, 1.8]}
        position={[-0.22, 0.83, 0]} color={brandColor} assembled={details} delay={0}
        roughness={0.28} metalness={0.3} />
      <CarPart name="pillar_a_l"  type="box" args={[0.08, 0.62, 0.08]}
        position={[0.72, 0.7, 0.88]} rotation={[0, 0, -0.45]}
        color={brandColor} assembled={details} delay={80}
        roughness={0.3} metalness={0.2} />
      <CarPart name="pillar_a_r"  type="box" args={[0.08, 0.62, 0.08]}
        position={[0.72, 0.7, -0.88]} rotation={[0, 0, -0.45]}
        color={brandColor} assembled={details} delay={80}
        roughness={0.3} metalness={0.2} />
      <CarPart name="windshield_f" type="box" args={[0.07, 0.58, 1.74]}
        position={[0.77, 0.7, 0]} rotation={[0, 0, -0.42]}
        color="#99bbee" assembled={details} delay={150}
        transparent opacity={0.35} roughness={0.05} metalness={0.0} />
      <CarPart name="windshield_r" type="box" args={[0.07, 0.48, 1.74]}
        position={[-1.19, 0.74, 0]} rotation={[0, 0, 0.38]}
        color="#99bbee" assembled={details} delay={200}
        transparent opacity={0.35} roughness={0.05} metalness={0.0} />
      <CarPart name="window_l"     type="box" args={[1.45, 0.38, 0.06]}
        position={[-0.22, 0.78, 0.92]}
        color="#88aadd" assembled={details} delay={240}
        transparent opacity={0.3} roughness={0.05} metalness={0.0} />
      <CarPart name="window_r"     type="box" args={[1.45, 0.38, 0.06]}
        position={[-0.22, 0.78, -0.92]}
        color="#88aadd" assembled={details} delay={240}
        transparent opacity={0.3} roughness={0.05} metalness={0.0} />
      <CarPart name="headlight_l"  type="box" args={[0.18, 0.14, 0.42]}
        position={[1.97, 0.22, 0.66]} color="#fffff0" assembled={details} delay={300}
        roughness={0.1} metalness={0.1} />
      <CarPart name="headlight_r"  type="box" args={[0.18, 0.14, 0.42]}
        position={[1.97, 0.22, -0.66]} color="#fffff0" assembled={details} delay={340}
        roughness={0.1} metalness={0.1} />

      {/* ── WHEELS & TRIM (Step: version) ────────────────── */}
      <CarPart name="wheel_fl"    type="cylinder" args={[0.36, 0.36, 0.24, 20]}
        position={[1.28, -0.38, 1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#1a1a28" assembled={wheels} delay={0} roughness={0.8} metalness={0.05} />
      <CarPart name="wheel_fr"    type="cylinder" args={[0.36, 0.36, 0.24, 20]}
        position={[1.28, -0.38, -1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#1a1a28" assembled={wheels} delay={80} roughness={0.8} metalness={0.05} />
      <CarPart name="wheel_rl"    type="cylinder" args={[0.36, 0.36, 0.24, 20]}
        position={[-1.28, -0.38, 1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#1a1a28" assembled={wheels} delay={160} roughness={0.8} metalness={0.05} />
      <CarPart name="wheel_rr"    type="cylinder" args={[0.36, 0.36, 0.24, 20]}
        position={[-1.28, -0.38, -1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#1a1a28" assembled={wheels} delay={240} roughness={0.8} metalness={0.05} />
      {/* Wheel rims */}
      <CarPart name="rim_fl"      type="cylinder" args={[0.22, 0.22, 0.26, 12]}
        position={[1.28, -0.38, 1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#aaaacc" assembled={wheels} delay={60} roughness={0.2} metalness={0.8} />
      <CarPart name="rim_fr"      type="cylinder" args={[0.22, 0.22, 0.26, 12]}
        position={[1.28, -0.38, -1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#aaaacc" assembled={wheels} delay={140} roughness={0.2} metalness={0.8} />
      <CarPart name="rim_rl"      type="cylinder" args={[0.22, 0.22, 0.26, 12]}
        position={[-1.28, -0.38, 1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#aaaacc" assembled={wheels} delay={220} roughness={0.2} metalness={0.8} />
      <CarPart name="rim_rr"      type="cylinder" args={[0.22, 0.22, 0.26, 12]}
        position={[-1.28, -0.38, -1.07]} rotation={[Math.PI/2, 0, 0]}
        color="#aaaacc" assembled={wheels} delay={300} roughness={0.2} metalness={0.8} />
      <CarPart name="grille"      type="box" args={[0.09, 0.28, 1.18]}
        position={[2.0, 0.02, 0]} color="#2a2a2a" assembled={wheels} delay={100}
        roughness={0.6} metalness={0.4} />
      <CarPart name="taillight_l" type="box" args={[0.12, 0.12, 0.42]}
        position={[-1.98, 0.22, 0.66]} color="#cc2200" assembled={wheels} delay={120}
        roughness={0.2} metalness={0.1} />
      <CarPart name="taillight_r" type="box" args={[0.12, 0.12, 0.42]}
        position={[-1.98, 0.22, -0.66]} color="#cc2200" assembled={wheels} delay={160}
        roughness={0.2} metalness={0.1} />
      <CarPart name="exhaust"     type="cylinder" args={[0.06, 0.06, 0.3, 8]}
        position={[-2.08, -0.38, 0.5]} rotation={[0, 0, Math.PI/2]}
        color="#888899" assembled={wheels} delay={200} roughness={0.4} metalness={0.7} />
    </group>
  )
}
