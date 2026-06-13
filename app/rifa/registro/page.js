'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RifaRegistroRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/registro?redirect=' + encodeURIComponent('/rifa/dashboard'))
  }, [router])
  return <div className="min-h-screen flex items-center justify-center text-gray-500">Redirigiendo…</div>
}
