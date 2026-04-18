'use client'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import CarModel from './CarModel'

function FloorGrid() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(22, 22, '#22C55E', '#1f2937')
    g.material.transparent = true
    g.material.opacity = 0.55
    return g
  }, [])
  return <primitive object={grid} position={[0, -0.57, 0]} />
}

export default function CarCanvas({ step, selection }) {
  const brandColor = selection?.brand?.color ?? '#FFD700'

  return (
    <Canvas
      camera={{ position: [6.5, 3.2, 6.5], fov: 42 }}
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%', background: '#111827' }}
    >
      <color attach="background" args={['#111827']} />
      <fog attach="fog" args={['#111827', 18, 38]} />

      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 9, 5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      {/* Brand accent light — changes color per brand */}
      <pointLight position={[-4, 4, -4]} intensity={1.2} color={brandColor} />
      <pointLight position={[3, 0, 4]}   intensity={0.4} color="#ffffff" />
      <pointLight position={[0, -1, 0]}  intensity={0.2} color={brandColor} />

      {/* Shadow receiver floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      <FloorGrid />

      <CarModel step={step} brandColor={brandColor} />

      <OrbitControls
        enablePan={false}
        minDistance={3.5}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={step === 'idle'}
        autoRotateSpeed={1.2}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
