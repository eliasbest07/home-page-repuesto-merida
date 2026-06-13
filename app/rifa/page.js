'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ensureSession } from '@/lib/rifaSession'

export default function RifaEntry() {
  const router = useRouter()
  useEffect(() => {
    ensureSession().then((s) => {
      if (!s?.telefono) {
        router.replace('/login?redirect=' + encodeURIComponent('/rifa/dashboard'))
      } else if (!s.perfil) {
        router.replace('/registro?redirect=' + encodeURIComponent('/rifa/dashboard'))
      } else {
        router.replace('/rifa/dashboard')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Cargando…
    </div>
  )
}
