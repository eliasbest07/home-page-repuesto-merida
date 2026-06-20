'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ensureSession } from '@/lib/rifaSession'
import { MAX_SOURCE_IMAGE_SIZE, MAX_UPLOADED_IMAGE_SIZE, prepareImageForUpload } from '@/lib/imageCompression'

function safeRedirect(value) {
  if (!value || typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/verificacion')) return '/'
  return value
}

export default function VerificacionEdadPage() {
  return (
    <Suspense fallback={<Shell texto="Cargando…" />}>
      <VerificacionEdadInner />
    </Suspense>
  )
}

function VerificacionEdadInner() {
  const router = useRouter()
  const params = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const required = params.get('required') === '1'
  const [session, setSession] = useState(null)
  const [cedula, setCedula] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [cedulaPreview, setCedulaPreview] = useState('')
  const [selfiePreview, setSelfiePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [preparingImage, setPreparingImage] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ensureSession().then((current) => {
      if (cancelled) return
      if (!current?.telefono) {
        router.replace(`/login?redirect=${encodeURIComponent(`/verificacion/edad?redirect=${redirect}`)}`)
        return
      }
      setSession(current)
    })
    return () => { cancelled = true }
  }, [redirect, router])

  useEffect(() => {
    if (!cedula) { setCedulaPreview(''); return }
    const url = URL.createObjectURL(cedula)
    setCedulaPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [cedula])

  useEffect(() => {
    if (!selfie) { setSelfiePreview(''); return }
    const url = URL.createObjectURL(selfie)
    setSelfiePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selfie])

  function pickFile(setter) {
    return async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      setError('')
      setMessage('')
      if (!file) {
        setter(null)
        return
      }
      if (!file.type.startsWith('image/') || file.size > MAX_SOURCE_IMAGE_SIZE) {
        setError('Selecciona una imagen válida de hasta 20 MB.')
        return
      }

      setPreparingImage(true)
      try {
        const prepared = await prepareImageForUpload(file)
        if (prepared.size > MAX_UPLOADED_IMAGE_SIZE) {
          throw new Error('La foto no pudo reducirse por debajo de 550 KB.')
        }
        setter(prepared)
      } catch (compressionError) {
        setError(compressionError?.message || 'No se pudo preparar la imagen.')
      } finally {
        setPreparingImage(false)
      }
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!session?.token) { setError('Sesión inválida.'); return }
    if (!cedula || !selfie) { setError('Sube las dos fotos para enviar la verificación.'); return }

    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('cedula', cedula)
      form.append('selfie', selfie)

      const res = await fetch('/api/verificacion/edad', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo enviar la verificación.')

      setMessage('Documentos enviados. Tu verificación quedó en revisión.')
      window.setTimeout(() => {
        router.replace(`/verificacion?redirect=${encodeURIComponent(redirect)}${required ? '&required=1' : ''}`)
      }, 900)
    } catch (err) {
      setError(err.message || 'No se pudo enviar la verificación.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!session) return <Shell texto="Verificando sesión…" />

  return (
    <div className="min-h-screen bg-[#f5f7f9] text-gray-900">
      <nav className="flex h-14 items-center justify-between bg-gray-950 px-4 text-white shadow-lg">
        <Link href={`/verificacion?redirect=${encodeURIComponent(redirect)}${required ? '&required=1' : ''}`} className="text-sm font-semibold text-gray-300 hover:text-white">
          Atrás
        </Link>
        <span className="text-xs font-semibold text-gray-400">{session.telefono}</span>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-7">
        <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Verificación privada</p>
            <h1 className="mt-2 font-brand text-2xl leading-tight text-gray-950">Sube tus documentos</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Las fotos se guardan en una carpeta privada de Storage y no se publican como URL visible.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoInput
              label="Foto de la cédula"
              hint="Cédula completa, legible y sin reflejos."
              preview={cedulaPreview}
              onChange={pickFile(setCedula)}
            />
            <PhotoInput
              label="Selfie con la cédula"
              hint="Tu cara y la cédula deben verse en la misma foto."
              preview={selfiePreview}
              onChange={pickFile(setSelfie)}
            />
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            Esta información se usa solo para revisión de edad. No la subas en comentarios ni publicaciones públicas.
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
          {message && <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}

          <button
            type="submit"
            disabled={submitting || preparingImage}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-yellow-400 px-4 text-sm font-extrabold text-gray-950 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {preparingImage ? 'Preparando fotos...' : submitting ? 'Enviando...' : 'Enviar verificación'}
          </button>
        </form>
      </main>
    </div>
  )
}

function PhotoInput({ label, hint, preview, onChange }) {
  return (
    <label className="block rounded-xl border border-gray-200 bg-gray-50 p-3">
      <span className="block text-sm font-extrabold text-gray-950">{label}</span>
      <span className="mt-1 block min-h-8 text-xs leading-relaxed text-gray-500">{hint}</span>
      <span className="mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white">
        {preview ? (
          <Image src={preview} alt="" width={480} height={360} unoptimized className="h-full w-full object-cover" />
        ) : (
          <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.38a2 2 0 0 0 1.66-.9l.42-.62A2 2 0 0 1 10.62 3.6h2.76a2 2 0 0 1 1.66.88l.42.62a2 2 0 0 0 1.66.9h1.38A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
          </svg>
        )}
      </span>
      <span className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700">
        Seleccionar foto
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        className="hidden"
      />
    </label>
  )
}

function Shell({ texto }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7f9] p-4">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm font-semibold text-gray-600 shadow-sm">
        {texto}
      </div>
    </div>
  )
}
