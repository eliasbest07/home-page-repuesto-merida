'use client'
import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Stable random start positions — cached across renders so parts always fly from same direction
const START_CACHE = {}
function getStartPos(name) {
  if (!START_CACHE[name]) {
    const angle = Math.random() * Math.PI * 2
    const dist = 12 + Math.random() * 10
    START_CACHE[name] = [
      Math.cos(angle) * dist,
      (Math.random() - 0.3) * 18,
      Math.sin(angle) * dist - 18,
    ]
  }
  return START_CACHE[name]
}

export default function CarPart({
  name,
  type = 'box',
  args,
  position,
  rotation = [0, 0, 0],
  color = '#cccccc',
  assembled = false,
  delay = 0,
  transparent = false,
  opacity: targetOp = 0.38,
  roughness,
  metalness,
}) {
  const meshRef = useRef()
  const posRef = useRef(null)
  const opRef = useRef(0)
  const [active, setActive] = useState(false)

  const startPos = useMemo(() => getStartPos(name), [name])
  const finalOp = transparent ? targetOp : 1
  const mat = { roughness: roughness ?? (transparent ? 0.05 : 0.4), metalness: metalness ?? 0.15 }

  useEffect(() => {
    let timer
    if (assembled) {
      timer = setTimeout(() => setActive(true), delay)
    } else {
      setActive(false)
      posRef.current = null
      opRef.current = 0
    }
    return () => clearTimeout(timer)
  }, [assembled, delay])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const material = meshRef.current.material

    if (!active) {
      meshRef.current.position.set(...startPos)
      material.opacity = 0
      opRef.current = 0
      return
    }

    if (!posRef.current) {
      posRef.current = [...startPos]
    }

    // Lerp toward target — faster at the start, eases in
    const spd = delta * 2.6
    posRef.current[0] += (position[0] - posRef.current[0]) * spd
    posRef.current[1] += (position[1] - posRef.current[1]) * spd
    posRef.current[2] += (position[2] - posRef.current[2]) * spd
    meshRef.current.position.set(...posRef.current)

    // Fade in
    opRef.current += (finalOp - opRef.current) * delta * 3.5
    material.opacity = opRef.current
  })

  return (
    <mesh
      ref={meshRef}
      position={startPos}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      {type === 'box'      && <boxGeometry args={args} />}
      {type === 'cylinder' && <cylinderGeometry args={args} />}
      {type === 'sphere'   && <sphereGeometry args={args} />}
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0}
        roughness={mat.roughness}
        metalness={mat.metalness}
        side={transparent ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  )
}
