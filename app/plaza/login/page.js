'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PlazaLoginRedirect() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Redirigiendo…</div>}>
      <Inner />
    </Suspense>
  )
}

function Inner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/plaza/publicar'
  useEffect(() => {
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
  }, [router, redirect])
  return <div className="min-h-screen flex items-center justify-center text-gray-500">Redirigiendo…</div>
}
