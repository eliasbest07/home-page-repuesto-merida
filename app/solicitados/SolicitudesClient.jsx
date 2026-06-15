'use client'

import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { firestore, storage } from '@/lib/firebase'
import { ensureSession } from '@/lib/rifaSession'
import AdSenseBlock from '@/app/components/AdSenseBlock'

const COMMENT_COLLECTION = 'solicitudes_comentarios'
const CONTACT_COLLECTION = 'solicitudes_contactos'
const REQUEST_COLLECTION = 'solicitudes_repuestos'
const LOGIN_URL = '/login?redirect=%2Fsolicitados'
const MAX_COMMENT_IMAGES = 6
const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024
const TARGET_UPLOADED_IMAGE_SIZE = 450 * 1024
const MAX_UPLOADED_IMAGE_SIZE = 550 * 1024
const MapPicker = dynamic(() => import('@/app/components/MapPicker'), { ssr: false })

const BRAND_ICONS = {
  chevrolet: '/mobile-catalog/brands/chevrolet.png',
  daihatsu: '/mobile-catalog/brands/Daihatsu.png',
  ford: '/mobile-catalog/brands/ford.png',
  hyundai: '/mobile-catalog/brands/hyundai.png',
  mazda: '/mobile-catalog/brands/mazda.png',
  mitsubishi: '/mobile-catalog/brands/mitsubishi.png',
  renault: '/mobile-catalog/brands/renault.png',
  suzuki: '/mobile-catalog/brands/suzuki.png',
  toyota: '/mobile-catalog/brands/toyota.png',
  volkswagen: '/mobile-catalog/brands/volkswagen.png',
}

const STATUS = {
  solicitado: {
    label: 'Buscando',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-400',
  },
  cotizado: {
    label: 'Cotizado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
}

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function titleCase(value = '') {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (/^[A-ZÁÉÍÓÚÜÑ0-9.-]{2,5}$/.test(word) && /[A-ZÁÉÍÓÚÜÑ]/.test(word)) {
        return word
      }
      return word.charAt(0).toLocaleUpperCase('es-VE') + word.slice(1).toLocaleLowerCase('es-VE')
    })
    .join(' ')
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatCommentDate(value) {
  const milliseconds =
    value?.toMillis?.() ||
    (typeof value === 'number' ? value : 0)

  if (!milliseconds) return 'Ahora'

  return new Intl.DateTimeFormat('es-VE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(milliseconds))
}

function commenterWhatsappUrl(comment, request) {
  const number = String(comment.whatsapp || '').replace(/\D/g, '')
  const message = `Hola ${comment.autor || ''}, vi tu comentario sobre la solicitud de ${request.repuesto} en Repuestos Mérida.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

function participantId(comment) {
  return String(comment.propietario_id || comment.whatsapp || '').replace(/\D/g, '')
}

function sessionParticipantId(session) {
  return String(session?.telefono || '').replace(/\D/g, '')
}

function contactPermissionId(requestId, ownerId, granteeId) {
  return `${requestId}_${ownerId}_${granteeId}`
}

function commentImageUrls(comment) {
  const urls = Array.isArray(comment.imagenes_urls) ? comment.imagenes_urls : []
  if (comment.imagen_url && !urls.includes(comment.imagen_url)) return [comment.imagen_url, ...urls]
  return urls
}

function commentMapUrl(location) {
  if (!location) return ''
  const lat = Number(location.lat)
  const lng = Number(location.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function prepareImageForUpload(file) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new window.Image()
    image.decoding = 'async'
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = objectUrl
    })

    const maxWidth = 1280
    const maxHeight = 720
    let scale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    )
    let width = Math.max(1, Math.round(image.naturalWidth * scale))
    let height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return file

    let blob = null
    let quality = 0.85

    for (let attempt = 0; attempt < 12; attempt += 1) {
      canvas.width = width
      canvas.height = height
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob || blob.size <= TARGET_UPLOADED_IMAGE_SIZE) break

      if (quality > 0.46) {
        quality -= 0.07
      } else {
        scale *= 0.85
        width = Math.max(1, Math.round(image.naturalWidth * scale))
        height = Math.max(1, Math.round(image.naturalHeight * scale))
        quality = 0.72
      }
    }

    if (!blob || blob.size > MAX_UPLOADED_IMAGE_SIZE) {
      throw new Error('No se pudo comprimir la imagen a 550 KB.')
    }

    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-') || 'foto'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function uploadImageDirect(path, file) {
  const bucket = storage.app.options.storageBucket
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 90000)

  try {
    const response = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
        signal: controller.signal,
      }
    )
    const result = await response.json()
    if (!response.ok) throw new Error(result?.error?.message || 'Falló la subida directa.')

    const token = String(result.downloadTokens || '').split(',')[0]
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : ''
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media${tokenQuery}`
  } finally {
    window.clearTimeout(timeout)
  }
}

async function uploadImageWithRetry(path, file) {
  let lastError
  const mobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  if (mobileBrowser) {
    try {
      return await uploadImageDirect(path, file)
    } catch (error) {
      lastError = error
    }
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const uploaded = await uploadBytes(storageRef(storage, path), file, {
        contentType: file.type,
      })
      return getDownloadURL(uploaded.ref)
    } catch (error) {
      lastError = error
      const retryable = ['storage/retry-limit-exceeded', 'storage/unknown', 'storage/server-file-wrong-size']
        .includes(String(error?.code))
      if (!retryable || attempt === 3) throw error

      if (String(error?.code) === 'storage/retry-limit-exceeded') {
        try {
          return await uploadImageDirect(path, file)
        } catch {
          // Continúa con el siguiente intento del SDK.
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, attempt * 1500))
    }
  }

  throw lastError
}

function BrandMark({ brand }) {
  const normalized = normalize(brand)
  const icon = BRAND_ICONS[normalized]

  if (icon) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
        <Image src={icon} alt={titleCase(brand)} width={38} height={38} className="h-9 w-9 object-contain" />
      </span>
    )
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-lg font-extrabold uppercase text-yellow-400">
      {brand ? String(brand).charAt(0) : 'R'}
    </span>
  )
}

function CommentSection({
  request,
  comments,
  contacts,
  onCommentAdded,
  onCommentUpdated,
  onContactUpdated,
  open,
  onToggle,
  session,
  sessionLoading,
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [contactBusy, setContactBusy] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [compressingImages, setCompressingImages] = useState(false)
  const [imagePreviews, setImagePreviews] = useState([])
  const [location, setLocation] = useState(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const textRef = useRef(null)
  const fileRef = useRef(null)
  const currentParticipantId = sessionParticipantId(session)

  const contactMap = useMemo(() => {
    const map = new Map()
    contacts.forEach((contact) => {
      map.set(`${contact.propietario_id}:${contact.autorizado_id}`, contact)
    })
    return map
  }, [contacts])

  useEffect(() => {
    if (open && session) textRef.current?.focus()
  }, [open, session])

  useEffect(() => {
    if (imageFiles.length === 0) {
      setImagePreviews([])
      return
    }

    const previewUrls = imageFiles.map((file) => URL.createObjectURL(file))
    setImagePreviews(previewUrls)
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url))
  }, [imageFiles])

  useEffect(() => {
    if (!expandedImage) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setExpandedImage(null)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [expandedImage])

  async function selectImages(event) {
    const selectedFiles = [...(event.target.files || [])]
    event.target.value = ''
    setError('')

    if (selectedFiles.length === 0) return
    const availableSlots = MAX_COMMENT_IMAGES - imageFiles.length
    if (availableSlots <= 0) {
      setError(`Puedes subir un máximo de ${MAX_COMMENT_IMAGES} fotos por conversación.`)
      return
    }

    const validFiles = selectedFiles.filter((file) => (
      file.type.startsWith('image/') && file.size <= MAX_SOURCE_IMAGE_SIZE
    ))
    if (validFiles.length !== selectedFiles.length) {
      setError('Solo se agregaron imágenes válidas de hasta 20 MB cada una.')
    }
    if (selectedFiles.length > availableSlots) {
      setError(`Solo puedes adjuntar ${MAX_COMMENT_IMAGES} fotos por conversación.`)
    }
    if (validFiles.length === 0) return

    setCompressingImages(true)
    try {
      const preparedFiles = []
      for (const [index, file] of validFiles.slice(0, availableSlots).entries()) {
        const preparedFile = await prepareImageForUpload(file)
        if (preparedFile.size > MAX_UPLOADED_IMAGE_SIZE) {
          throw new Error(`La foto ${index + 1} no pudo reducirse por debajo de 550 KB.`)
        }
        preparedFiles.push(preparedFile)
      }
      setImageFiles((current) => [...current, ...preparedFiles].slice(0, MAX_COMMENT_IMAGES))
    } catch (compressionError) {
      setError(compressionError?.message || 'No se pudieron preparar las imágenes.')
    } finally {
      setCompressingImages(false)
    }
  }

  async function submit(event) {
    event.preventDefault()

    if (!session?.telefono) {
      window.location.href = LOGIN_URL
      return
    }

    const cleanAuthor = String(session.perfil?.nombre || 'Usuario').trim().slice(0, 50)
    const cleanText = text.trim().slice(0, 500)
    const cleanWhatsapp = String(session.telefono).replace(/\D/g, '').slice(0, 18)

    if (!cleanText && imageFiles.length === 0 && !location) return

    setSubmitting(true)
    setError('')

    let publishPhase = 'upload'

    try {
      const imageUrls = []
      for (const [index, imageFile] of imageFiles.entries()) {
        if (imageFile.size > MAX_UPLOADED_IMAGE_SIZE) {
          throw new Error(`La foto ${index + 1} no pudo reducirse por debajo de 550 KB.`)
        }
        const extension = imageFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
        const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
        const uniqueName = `${Date.now()}-${index}-${randomId}.${extension}`
        const path = `solicitudes-debate/${request.id}/${cleanWhatsapp}/${uniqueName}`
        imageUrls.push(await uploadImageWithRetry(path, imageFile))
      }

      publishPhase = 'comment'
      const optimistic = {
        id: `local-${Date.now()}`,
        solicitud_id: request.id,
        autor: cleanAuthor || 'Anónimo',
        texto: cleanText,
        imagen_url: imageUrls[0] || '',
        imagenes_urls: imageUrls,
        ...(location ? { ubicacion: location } : {}),
        propietario_id: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        creado_en: Date.now(),
      }

      const commentData = {
        solicitud_id: request.id,
        autor: optimistic.autor,
        texto: cleanText,
        imagen_url: imageUrls[0] || '',
        imagenes_urls: imageUrls,
        propietario_id: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        creado_en: serverTimestamp(),
      }
      if (location) commentData.ubicacion = location

      const document = await addDoc(collection(firestore, COMMENT_COLLECTION), commentData)

      onCommentAdded({ ...optimistic, id: document.id })
      setText('')
      setImageFiles([])
      setLocation(null)
    } catch (uploadError) {
      console.error('Error al publicar en el debate:', uploadError)
      const code = String(uploadError?.code || 'error-desconocido')

      if (publishPhase === 'upload') {
        const storageMessages = {
          'storage/unauthorized': 'Firebase Storage rechazó la foto por permisos.',
          'storage/quota-exceeded': 'Firebase Storage no tiene cuota disponible. Revisa el plan y la facturación del proyecto.',
          'storage/bucket-not-found': 'No se encontró el bucket configurado en Firebase Storage.',
          'storage/retry-limit-exceeded': 'La subida agotó el tiempo de espera. Revisa la conexión e intenta nuevamente.',
        }
        const detail = uploadError?.message && code === 'error-desconocido'
          ? uploadError.message
          : storageMessages[code] || 'No se pudo subir la imagen.'
        setError(`${detail} (${code})`)
      } else {
        setError(`La foto se subió, pero Firestore no pudo publicar la conversación. (${code})`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function saveEdit(comment) {
    const cleanText = editingText.trim().slice(0, 500)
    if (!cleanText || participantId(comment) !== currentParticipantId) return

    setSavingId(comment.id)
    setError('')
    try {
      await updateDoc(doc(firestore, COMMENT_COLLECTION, comment.id), {
        texto: cleanText,
        propietario_id: currentParticipantId,
        editado_en: serverTimestamp(),
      })
      onCommentUpdated(request.id, comment.id, {
        texto: cleanText,
        propietario_id: currentParticipantId,
        editado_en: Date.now(),
      })
      setEditingId(null)
      setEditingText('')
    } catch {
      setError('No se pudo editar el mensaje.')
    } finally {
      setSavingId(null)
    }
  }

  async function removeComment(comment) {
    if (participantId(comment) !== currentParticipantId) return
    if (!window.confirm('¿Quieres borrar este mensaje? Quedará el registro de que fue eliminado.')) return

    setSavingId(comment.id)
    setError('')
    try {
      await updateDoc(doc(firestore, COMMENT_COLLECTION, comment.id), {
        texto: '',
        propietario_id: currentParticipantId,
        eliminado: true,
        eliminado_en: serverTimestamp(),
      })
      onCommentUpdated(request.id, comment.id, {
        texto: '',
        propietario_id: currentParticipantId,
        eliminado: true,
        eliminado_en: Date.now(),
      })
      if (editingId === comment.id) {
        setEditingId(null)
        setEditingText('')
      }
    } catch {
      setError('No se pudo borrar el mensaje.')
    } finally {
      setSavingId(null)
    }
  }

  async function setContactPermission(ownerId, granteeId, estado) {
    if (!currentParticipantId || !ownerId || !granteeId || ownerId === granteeId) return
    const permissionId = contactPermissionId(request.id, ownerId, granteeId)
    setContactBusy(permissionId)
    setError('')

    try {
      const existing = contactMap.get(`${ownerId}:${granteeId}`)
      const contact = {
        solicitud_id: request.id,
        propietario_id: ownerId,
        autorizado_id: granteeId,
        estado,
        creado_en: existing?.creado_en || serverTimestamp(),
        actualizado_en: serverTimestamp(),
      }
      await setDoc(doc(firestore, CONTACT_COLLECTION, permissionId), contact)
      onContactUpdated({
        ...contact,
        id: permissionId,
        creado_en: existing?.creado_en || Date.now(),
        actualizado_en: Date.now(),
      })
    } catch {
      setError('No se pudo actualizar el permiso de contacto.')
    } finally {
      setContactBusy('')
    }
  }

  return (
    <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m8-2a9 9 0 1 1-4.36-7.72L21 3v5h-5l1.8-1.8A7 7 0 1 0 19 12" />
          </svg>
          Debate
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {comments.length} conversación{comments.length === 1 ? '' : 'es'}
          </span>
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          {comments.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">
              Sé el primero en responder esta solicitud.
            </p>
          ) : (
            <div className="mb-4 space-y-2">
              {comments.map((comment) => {
                const commentOwnerId = participantId(comment)
                const permissionToMe = contactMap.get(`${commentOwnerId}:${currentParticipantId}`)
                const permissionFromMe = contactMap.get(`${currentParticipantId}:${commentOwnerId}`)
                const outgoingId = contactPermissionId(request.id, commentOwnerId, currentParticipantId)

                return (
                <article key={comment.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800">{comment.autor || 'Anónimo'}</p>
                      {comment.eliminado ? (
                        <p className="mt-1 text-sm italic text-gray-400">Mensaje eliminado por su autor.</p>
                      ) : editingId === comment.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            maxLength={500}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(comment)}
                              disabled={!editingText.trim() || savingId === comment.id}
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-yellow-400 disabled:opacity-50"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                                setEditingText('')
                              }}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-600"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {comment.texto && (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">{comment.texto}</p>
                          )}
                          {commentImageUrls(comment).length > 0 && (
                            <div className={`mt-2 grid max-w-lg gap-1.5 ${
                              commentImageUrls(comment).length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                            }`}>
                              {commentImageUrls(comment).map((imageUrl, imageIndex) => (
                                <button
                                  key={`${imageUrl}-${imageIndex}`}
                                  type="button"
                                  onClick={() => setExpandedImage({
                                    url: imageUrl,
                                    alt: `Imagen ${imageIndex + 1} compartida por ${comment.autor || 'usuario'}`,
                                  })}
                                  className="relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                                  aria-label={`Ampliar imagen ${imageIndex + 1}`}
                                >
                                  <Image
                                    src={imageUrl}
                                    alt={`Imagen ${imageIndex + 1} compartida por ${comment.autor || 'usuario'}`}
                                    fill
                                    unoptimized
                                    sizes="(max-width: 640px) 45vw, 240px"
                                    className="object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          {commentMapUrl(comment.ubicacion) && (
                            <a
                              href={commentMapUrl(comment.ubicacion)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 transition hover:bg-emerald-100"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-13a7 7 0 1 0-14 0c0 6.9 7 13 7 13Z" />
                                  <circle cx="12" cy="8" r="2.5" />
                                </svg>
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-bold text-emerald-900">Ubicación compartida</span>
                                <span className="mt-0.5 block font-mono text-[10px] text-emerald-700">
                                  {Number(comment.ubicacion.lat).toFixed(6)}, {Number(comment.ubicacion.lng).toFixed(6)}
                                </span>
                              </span>
                              <span className="ml-auto text-xs font-bold text-emerald-700">Ver mapa</span>
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
                    <span>{formatCommentDate(comment.creado_en)}</span>
                    {comment.editado_en && !comment.eliminado && <span>· Editado</span>}
                    {participantId(comment) === currentParticipantId && !comment.eliminado && editingId !== comment.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(comment.id)
                            setEditingText(comment.texto || '')
                          }}
                          className="font-bold text-blue-600 hover:text-blue-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeComment(comment)}
                          disabled={savingId === comment.id}
                          className="font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Borrar
                        </button>
                      </>
                    )}
                  </div>
                  {commentOwnerId && commentOwnerId !== currentParticipantId && !comment.eliminado && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2.5">
                      {permissionToMe?.estado === 'aprobado' ? (
                        <a
                          href={commenterWhatsappUrl(comment, request)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Contactar por WhatsApp
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setContactPermission(commentOwnerId, currentParticipantId, 'pendiente')}
                          disabled={permissionToMe?.estado === 'pendiente' || contactBusy === outgoingId}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-60"
                        >
                          {permissionToMe?.estado === 'pendiente' ? 'Solicitud de contacto enviada' : 'Solicitar contacto'}
                        </button>
                      )}
                      {permissionFromMe?.estado === 'pendiente' && (
                        <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                          Te solicitó contacto. Responde en la campana.
                        </span>
                      )}
                    </div>
                  )}
                </article>
                )
              })}
            </div>
          )}

          {session ? (
            <form onSubmit={submit} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-500">
                Participas como <strong className="text-gray-700">{session.perfil?.nombre || session.telefono}</strong>
              </p>
              <textarea
                ref={textRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Ej: Lo tengo disponible, necesito más información o puedo conseguirlo..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
              />
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {imagePreviews.map((previewUrl, index) => (
                    <div key={previewUrl} className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                      <div className="relative aspect-video">
                        <Image
                          src={previewUrl}
                          alt={`Vista previa ${index + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                        disabled={submitting}
                        className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Quitar
                      </button>
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                        Lista para subir: {formatFileSize(imageFiles[index]?.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {location && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-900">Ubicación seleccionada</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-emerald-700">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    disabled={submitting}
                    className="shrink-0 text-xs font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Quitar
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={selectImages}
                className="hidden"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={submitting || compressingImages || imageFiles.length >= MAX_COMMENT_IMAGES}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-yellow-400 hover:bg-yellow-50 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 0 1 2-2h2l1.5-2h5L16 5h2a2 2 0 0 1 2 2v11H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    </svg>
                    {compressingImages
                      ? 'Comprimiendo fotos...'
                      : `Fotos ${imageFiles.length > 0 ? `${imageFiles.length}/${MAX_COMMENT_IMAGES}` : ''}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationPickerOpen(true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.1 7-13a7 7 0 1 0-14 0c0 6.9 7 13 7 13Z" />
                      <circle cx="12" cy="8" r="2.5" />
                    </svg>
                    {location ? 'Cambiar ubicación' : 'Ubicación'}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={(!text.trim() && imageFiles.length === 0 && !location) || submitting || compressingImages}
                  className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-yellow-400 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Subiendo y publicando...' : 'Publicar conversación'}
                </button>
              </div>
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </form>
          ) : (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center">
              <p className="text-sm text-gray-700">
                Escribe al Oso por WhatsApp para iniciar sesión y participar en el debate.
              </p>
              {sessionLoading ? (
                <span className="mt-3 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-yellow-400 opacity-60">
                  Verificando sesión...
                </span>
              ) : (
                <a
                  href={LOGIN_URL}
                  className="mt-3 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-yellow-400"
                >
                  Iniciar sesión
                </a>
              )}
            </div>
          )}
        </div>
      )}
      {locationPickerOpen && (
        <MapPicker
          initialLat={location?.lat}
          initialLng={location?.lng}
          onConfirm={(coordinates) => {
            setLocation(coordinates)
            setLocationPickerOpen(false)
          }}
          onClose={() => setLocationPickerOpen(false)}
        />
      )}
      {expandedImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/95 px-3 pb-24 pt-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setExpandedImage(null)
            }}
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[2147483647] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-gray-950 shadow-2xl sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:h-12 sm:w-12 sm:translate-x-0"
            aria-label="Cerrar imagen"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div
            className="flex h-full w-full max-w-6xl items-center justify-center"
          >
            <Image
              src={expandedImage.url}
              alt={expandedImage.alt}
              width={1600}
              height={1200}
              unoptimized
              priority
              sizes="100vw"
              className="h-auto max-h-full w-auto max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function RequestCard({
  request,
  comments,
  contacts,
  onCommentAdded,
  onCommentUpdated,
  onContactUpdated,
  session,
  sessionLoading,
  autoOpen,
  cardRef,
  adminSecret,
  onPhotoDeleted,
}) {
  const status = STATUS[request.estado] || STATUS.solicitado
  const vehicle = [request.marca, request.modelo, request.anio].filter(Boolean)
  const vehiclePhotos = Array.isArray(request.fotos_vehiculo)
    ? request.fotos_vehiculo.filter((url) => typeof url === 'string' && url)
    : []
  const [debateOpen, setDebateOpen] = useState(Boolean(autoOpen))
  const [zoomPhoto, setZoomPhoto] = useState(null)
  const [deletingPhoto, setDeletingPhoto] = useState('')

  async function handleDeletePhoto(url) {
    if (!adminSecret || deletingPhoto) return
    if (!window.confirm('¿Eliminar esta foto? Se borrará también de Firebase y de las demás solicitudes del mismo vehículo.')) return
    setDeletingPhoto(url)
    try {
      const res = await fetch('/api/solicitados/eliminar-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      onPhotoDeleted?.(url)
    } catch (error) {
      window.alert('No se pudo eliminar la foto: ' + (error?.message || 'error'))
    } finally {
      setDeletingPhoto('')
    }
  }

  return (
    <article
      ref={cardRef}
      id={`solicitud-${request.id}`}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
      autoOpen
        ? 'border-emerald-400 ring-2 ring-emerald-200'
        : request.destacada
        ? 'border-yellow-400 ring-2 ring-yellow-200'
        : 'border-gray-200'
    }`}>
      {request.destacada && (
        <div className="flex items-center justify-center gap-1.5 bg-yellow-400 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-950">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m12 2.5 2.83 5.73 6.32.92-4.58 4.46 1.08 6.3L12 16.94l-5.65 2.97 1.08-6.3-4.58-4.46 6.32-.92L12 2.5Z" />
          </svg>
          Solicitud destacada
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <BrandMark brand={request.marca} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  Solicitud #{request.id}
                </p>
                <h2 className="mt-1 text-lg font-extrabold leading-tight text-gray-950">
                  {titleCase(request.repuesto)}
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {request.tipo_vehiculo && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {request.tipo_vehiculo === 'moto' ? 'Moto' : 'Carro'}
                </span>
              )}
              {vehicle.map((value, index) => (
                <span key={`${value}-${index}`} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {titleCase(value)}
                </span>
              ))}
              {request.cantidad && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  Cantidad: {request.cantidad}
                </span>
              )}
            </div>
          </div>
        </div>

        {request.falta_info && (
          <div className="mt-4 flex gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.3 2.7 16.5A2 2 0 0 0 4.4 19.5h15.2a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Información pendiente</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-900">{request.falta_info}</p>
            </div>
          </div>
        )}

        {request.notas && (
          <p className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">{request.notas}</p>
        )}

        {vehiclePhotos.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Referencia del vehículo
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {vehiclePhotos.map((url, index) => (
                <div key={`${url}-${index}`} className="relative h-20 w-28 flex-none">
                  <button
                    type="button"
                    onClick={() => setZoomPhoto({ url, index })}
                    className="relative block h-full w-full cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                    aria-label={`Ampliar foto ${index + 1} del vehículo`}
                  >
                    <Image
                      src={url}
                      alt={`${vehicle.join(' ') || 'Vehículo'} — foto ${index + 1}`}
                      fill
                      unoptimized
                      sizes="112px"
                      className="object-cover"
                    />
                  </button>
                  {adminSecret && (
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(url)}
                      disabled={Boolean(deletingPhoto)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-gray-900/85 text-sm leading-none text-white shadow transition hover:bg-red-600 disabled:opacity-50"
                      aria-label={`Eliminar foto ${index + 1}`}
                      title="Eliminar foto (también de Firebase)"
                    >
                      {deletingPhoto === url ? '…' : '✕'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Foto referencial del modelo, no de la pieza.</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Publicado</p>
            <p className="text-xs font-semibold text-gray-600">{formatDate(request.creado_en)}</p>
          </div>
          {sessionLoading ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-3.5 py-2.5 text-xs font-bold text-gray-950 opacity-60"
            >
              Verificando sesión...
            </button>
          ) : session ? (
            <button
              type="button"
              onClick={() => setDebateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-3.5 py-2.5 text-xs font-bold text-gray-950 transition hover:bg-yellow-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m8-2a9 9 0 1 1-4.36-7.72L21 3v5h-5" />
              </svg>
              Iniciar debate
            </button>
          ) : (
            <a
              href={LOGIN_URL}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-[#1fb95a]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.59 5.96L0 24l6.3-1.65a11.9 11.9 0 0 0 5.77 1.48h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.47-8.44ZM12.08 21.8h-.01a9.88 9.88 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.38a9.86 9.86 0 0 1-1.52-5.25c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.14 1.03 7.01 2.91a9.86 9.86 0 0 1 2.9 7c0 5.46-4.45 9.9-9.91 9.9Zm5.44-7.42c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.68-2.1-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.71.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
              </svg>
              Iniciar sesión
            </a>
          )}
        </div>
      </div>

      <CommentSection
        request={request}
        comments={comments}
        contacts={contacts}
        onCommentAdded={onCommentAdded}
        onCommentUpdated={onCommentUpdated}
        onContactUpdated={onContactUpdated}
        open={debateOpen}
        onToggle={() => setDebateOpen((current) => !current)}
        session={session}
        sessionLoading={sessionLoading}
      />

      {zoomPhoto && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[2147483647] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/95 px-3 pb-24 pt-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Foto del vehículo ampliada"
          onClick={() => setZoomPhoto(null)}
        >
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setZoomPhoto(null) }}
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[2147483647] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-2 border-gray-900 bg-white text-gray-950 shadow-2xl sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:h-12 sm:w-12 sm:translate-x-0"
            aria-label="Cerrar foto"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="flex h-full w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <Image
              src={zoomPhoto.url}
              alt={`${vehicle.join(' ') || 'Vehículo'} — referencia`}
              width={1600}
              height={1200}
              unoptimized
              sizes="100vw"
              className="max-h-full w-auto rounded-xl object-contain"
            />
          </div>
        </div>,
        document.body,
      )}
    </article>
  )
}

export default function SolicitudesClient() {
  const [firebaseRequests, setFirebaseRequests] = useState([])
  const [adminSecret, setAdminSecret] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [brandFilter, setBrandFilter] = useState('todas')
  const [commentsByRequest, setCommentsByRequest] = useState({})
  const [contactsByRequest, setContactsByRequest] = useState({})
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationBusy, setNotificationBusy] = useState('')
  const [notificationError, setNotificationError] = useState('')
  const initialContactsSnapshot = useRef(true)
  const previousPendingIds = useRef(new Set())

  // Modo admin: con ?admin=<secreto> se guarda el secreto y se muestran los
  // botones para eliminar fotos. El secreto se envía a /api/solicitados/eliminar-foto.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const fromUrl = sp.get('admin')
      if (fromUrl) {
        window.localStorage.setItem('solicitudesAdminSecret', fromUrl)
        sp.delete('admin')
        const qs = sp.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
      }
      setAdminSecret(window.localStorage.getItem('solicitudesAdminSecret') || '')
    } catch {
      /* noop */
    }
  }, [])

  // Quita una foto de TODAS las solicitudes que la usaban (el vehículo es compartido).
  const handlePhotoDeleted = useCallback((url) => {
    setFirebaseRequests((current) =>
      current.map((request) =>
        Array.isArray(request.fotos_vehiculo) && request.fotos_vehiculo.includes(url)
          ? { ...request, fotos_vehiculo: request.fotos_vehiculo.filter((u) => u !== url) }
          : request
      )
    )
  }, [])

  const requests = useMemo(() => {
    const uniqueIds = new Set()

    return firebaseRequests
      .filter((request) => {
        const id = String(request.id)
        if (uniqueIds.has(id)) return false
        uniqueIds.add(id)
        return true
      })
      .sort((a, b) => Number(b.creado_en || 0) - Number(a.creado_en || 0))
  }, [firebaseRequests])

  // Solicitud destacada por enlace (/solicitados?solicitud=161): se abre su
  // debate y se hace scroll hasta su tarjeta.
  const [focusId, setFocusId] = useState(null)
  const focusRef = useRef(null)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const sid = sp.get('solicitud')
    if (sid) setFocusId(String(sid))
  }, [])

  useEffect(() => {
    initialContactsSnapshot.current = true
    previousPendingIds.current = new Set()

    const unsubscribe = onSnapshot(
      collection(firestore, CONTACT_COLLECTION),
      (snapshot) => {
        const grouped = {}
        snapshot.docs.forEach((document) => {
          const contact = { id: document.id, ...document.data() }
          const key = String(contact.solicitud_id)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(contact)
        })
        setContactsByRequest(grouped)

        const currentId = sessionParticipantId(session)
        const pendingIds = new Set(
          snapshot.docs
            .map((document) => ({ id: document.id, ...document.data() }))
            .filter((contact) => contact.propietario_id === currentId && contact.estado === 'pendiente')
            .map((contact) => contact.id)
        )

        if (!initialContactsSnapshot.current) {
          const hasNewRequest = [...pendingIds].some((id) => !previousPendingIds.current.has(id))
          if (hasNewRequest) {
            try {
              const AudioContext = window.AudioContext || window.webkitAudioContext
              const audioContext = new AudioContext()
              const oscillator = audioContext.createOscillator()
              const gain = audioContext.createGain()
              oscillator.frequency.value = 880
              gain.gain.setValueAtTime(0.08, audioContext.currentTime)
              gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35)
              oscillator.connect(gain)
              gain.connect(audioContext.destination)
              oscillator.start()
              oscillator.stop(audioContext.currentTime + 0.35)
            } catch {}
          }
        }

        initialContactsSnapshot.current = false
        previousPendingIds.current = pendingIds
      },
      () => setContactsByRequest({})
    )

    return unsubscribe
  }, [session])

  const contactNotifications = useMemo(() => {
    const currentId = sessionParticipantId(session)
    if (!currentId) return []

    return Object.values(contactsByRequest)
      .flat()
      .filter((contact) => (
        contact.propietario_id === currentId
        && ['pendiente', 'aprobado'].includes(contact.estado)
      ))
      .map((contact) => {
        const request = requests.find((item) => String(item.id) === String(contact.solicitud_id))
        const comments = commentsByRequest[String(contact.solicitud_id)] || []
        const requester = comments.find((comment) => participantId(comment) === contact.autorizado_id)
        return {
          ...contact,
          request,
          requesterName: requester?.autor || `Usuario ${String(contact.autorizado_id).slice(-4)}`,
        }
      })
  }, [commentsByRequest, contactsByRequest, requests, session])
  const pendingContactCount = contactNotifications.filter((contact) => contact.estado === 'pendiente').length

  async function answerContactNotification(notification, estado) {
    setNotificationBusy(notification.id)
    setNotificationError('')
    try {
      await updateDoc(doc(firestore, CONTACT_COLLECTION, notification.id), {
        estado,
        actualizado_en: serverTimestamp(),
      })
    } catch {
      setNotificationError('No se pudo responder la solicitud de contacto.')
    } finally {
      setNotificationBusy('')
    }
  }
  useEffect(() => {
    if (focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusId, commentsLoading])

  useEffect(() => {
    let cancelled = false

    ensureSession()
      .then((currentSession) => {
        if (!cancelled) setSession(currentSession)
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    getDocs(collection(firestore, REQUEST_COLLECTION))
      .then((snapshot) => {
        if (cancelled) return
        const rows = snapshot.docs.map((document) => {
          const request = document.data()
          return {
            ...request,
            id: request.id || document.id,
            creado_en: request.creado_en?.toMillis?.() || request.creado_en || Date.now(),
          }
        })
        setFirebaseRequests(rows)
      })
      .catch(() => {
        if (!cancelled) setFirebaseRequests([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    getDocs(collection(firestore, COMMENT_COLLECTION))
      .then((snapshot) => {
        if (cancelled) return

        const grouped = {}
        snapshot.docs.forEach((document) => {
          const comment = { id: document.id, ...document.data() }
          const key = String(comment.solicitud_id)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(comment)
        })

        Object.values(grouped).forEach((comments) => {
          comments.sort((a, b) => {
            const aTime = a.creado_en?.toMillis?.() || a.creado_en || 0
            const bTime = b.creado_en?.toMillis?.() || b.creado_en || 0
            return aTime - bTime
          })
        })

        setCommentsByRequest(grouped)
      })
      .catch(() => {
        if (!cancelled) setCommentsByRequest({})
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const brands = useMemo(() => (
    [...new Set(requests.map((request) => normalize(request.marca)).filter(Boolean))].sort()
  ), [requests])

  const filteredRequests = useMemo(() => {
    const query = normalize(search)

    return requests.filter((request) => {
      const matchesStatus = statusFilter === 'todos' || request.estado === statusFilter
      const matchesBrand = brandFilter === 'todas' || normalize(request.marca) === brandFilter
      const haystack = normalize([
        request.repuesto,
        request.marca,
        request.modelo,
        request.anio,
        request.tipo_vehiculo,
        request.falta_info,
      ].filter(Boolean).join(' '))
      const matchesSearch = !query || haystack.includes(query)
      return matchesStatus && matchesBrand && matchesSearch
    })
  }, [brandFilter, requests, search, statusFilter])

  const requestedCount = requests.filter((request) => request.estado === 'solicitado').length
  const quotedCount = requests.filter((request) => request.estado === 'cotizado').length
  const commentCount = Object.values(commentsByRequest).reduce((total, comments) => total + comments.length, 0)

  function addComment(comment) {
    const key = String(comment.solicitud_id)
    setCommentsByRequest((current) => ({
      ...current,
      [key]: [...(current[key] || []), comment],
    }))
  }

  function updateComment(requestId, commentId, changes) {
    const key = String(requestId)
    setCommentsByRequest((current) => ({
      ...current,
      [key]: (current[key] || []).map((comment) => (
        comment.id === commentId ? { ...comment, ...changes } : comment
      )),
    }))
  }

  function updateContact(contact) {
    const key = String(contact.solicitud_id)
    setContactsByRequest((current) => {
      const existing = current[key] || []
      const found = existing.some((item) => item.id === contact.id)
      return {
        ...current,
        [key]: found
          ? existing.map((item) => item.id === contact.id ? contact : item)
          : [...existing, contact],
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#f5f7f9] text-gray-900">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950 text-white shadow-lg">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:h-16 sm:gap-3 sm:px-4 sm:py-0">
          <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={38} height={38} className="h-9 w-9 shrink-0 rounded-lg" />
            <span className="flex min-w-0 flex-col font-brand text-sm leading-tight sm:block sm:text-base">
              <span>Repuestos</span>
              <span>
                <span className="text-yellow-400 sm:ml-1">Mérida</span>
                <span className="ml-1 text-white">App</span>
              </span>
            </span>
          </Link>
          <nav className="relative flex shrink-0 items-center gap-2">
            <Link href="/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 hover:text-white sm:inline-flex">
              Inicio
            </Link>
            {session && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-gray-200 transition hover:border-yellow-400 hover:text-yellow-400"
                  aria-label="Notificaciones"
                  aria-expanded={notificationsOpen}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-2V11a6 6 0 1 0-12 0v4l-2 2h16l-2-2Zm-8 5h4" />
                  </svg>
                  {pendingContactCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                      {pendingContactCount > 9 ? '9+' : pendingContactCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="fixed left-1/2 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+0.65rem)] sm:w-[360px] sm:translate-x-0">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-extrabold">Notificaciones</p>
                        <p className="text-[11px] text-gray-500">Solicitudes de contacto en tiempo real</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Cerrar notificaciones"
                      >
                        ×
                      </button>
                    </div>

                    <div className="max-h-[65vh] overflow-y-auto p-3">
                      {contactNotifications.length === 0 ? (
                        <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
                          No tienes solicitudes ni autorizaciones activas.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {contactNotifications.map((notification) => (
                            <article
                              key={notification.id}
                              className={`rounded-xl border p-3 ${
                                notification.estado === 'pendiente'
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-emerald-200 bg-emerald-50'
                              }`}
                            >
                              <p className="text-sm font-bold text-gray-900">
                                {notification.estado === 'pendiente'
                                  ? `${notification.requesterName} quiere contactarte`
                                  : `${notification.requesterName} tiene autorización`}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-gray-600">
                                Solicitud: {notification.request?.repuesto || notification.solicitud_id}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {notification.estado === 'pendiente' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => answerContactNotification(notification, 'aprobado')}
                                      disabled={notificationBusy === notification.id}
                                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                    >
                                      Aceptar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => answerContactNotification(notification, 'rechazado')}
                                      disabled={notificationBusy === notification.id}
                                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => answerContactNotification(notification, 'rechazado')}
                                    disabled={notificationBusy === notification.id}
                                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
                                  >
                                    Revocar autorización
                                  </button>
                                )}
                                <Link
                                  href={`/solicitados?solicitud=${encodeURIComponent(String(notification.solicitud_id))}`}
                                  onClick={() => setNotificationsOpen(false)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600"
                                >
                                  Ver solicitud
                                </Link>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                      {notificationError && (
                        <p className="mt-2 text-xs font-semibold text-red-600">{notificationError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Link href="/plaza/solicitar" className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold leading-tight text-gray-950 hover:bg-yellow-300 sm:text-sm">
              Solicitar repuesto
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-gray-950 px-4 pb-10 pt-9 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Solicitudes publicadas en Firebase
            </span>
            <h1 className="mt-5 font-brand text-3xl leading-tight sm:text-5xl">
              Repuestos que están <span className="text-yellow-400">buscando ahora</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
              Revisa solicitudes reales y participa en el debate para pedir información, ofrecer una pieza o proponer alternativas.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3">
            {[
              { value: requests.length, label: 'Solicitudes' },
              { value: requestedCount, label: 'Buscando' },
              { value: quotedCount, label: 'Cotizadas' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-3">
                <p className="font-brand text-xl text-yellow-400 sm:text-2xl">{item.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-gray-400 sm:text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                </svg>
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar repuesto, marca, modelo o año..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-100"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 outline-none focus:border-yellow-400"
            >
              <option value="todos">Todos los estados</option>
              <option value="solicitado">Buscando</option>
              <option value="cotizado">Cotizado</option>
            </select>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Filtrar por marca</p>
              {brandFilter !== 'todas' && (
                <button
                  type="button"
                  onClick={() => setBrandFilter('todas')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Marcas de vehículos">
              <button
                type="button"
                onClick={() => setBrandFilter('todas')}
                aria-pressed={brandFilter === 'todas'}
                className={`flex min-w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 transition
                  ${brandFilter === 'todas'
                    ? 'border-gray-900 bg-gray-900 text-yellow-400 shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-extrabold
                  ${brandFilter === 'todas' ? 'bg-yellow-400 text-gray-950' : 'bg-gray-100 text-gray-700'}`}>
                  +
                </span>
                <span className="text-[10px] font-bold">Todas</span>
              </button>

              {brands.map((brand) => {
                const selected = brandFilter === brand
                return (
                  <button
                    type="button"
                    key={brand}
                    onClick={() => setBrandFilter(brand)}
                    aria-pressed={selected}
                    className={`flex min-w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 transition
                      ${selected
                        ? 'border-yellow-400 bg-yellow-50 text-gray-950 shadow-md ring-1 ring-yellow-300'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-white">
                      <Image
                        src={BRAND_ICONS[brand]}
                        alt=""
                        width={40}
                        height={40}
                        className="h-9 w-9 object-contain"
                      />
                    </span>
                    <span className="max-w-[68px] overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-bold">
                      {titleCase(brand)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-gray-700">
            {filteredRequests.length} resultado{filteredRequests.length === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-gray-400">
            {commentsLoading ? 'Cargando conversaciones...' : `${commentCount} conversación${commentCount === 1 ? '' : 'es'}`}
          </p>
        </div>

        <AdSenseBlock
          slot="9388951189"
          className="requests-adsense-placement"
        />

        {filteredRequests.length > 0 ? (
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            {filteredRequests.map((request) => {
              const isFocus = focusId && String(request.id) === focusId
              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  comments={commentsByRequest[String(request.id)] || []}
                  contacts={contactsByRequest[String(request.id)] || []}
                  onCommentAdded={addComment}
                  onCommentUpdated={updateComment}
                  onContactUpdated={updateContact}
                  session={session}
                  sessionLoading={sessionLoading}
                  autoOpen={isFocus}
                  cardRef={isFocus ? focusRef : null}
                  adminSecret={adminSecret}
                  onPhotoDeleted={handlePhotoDeleted}
                />
              )
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">
            <p className="text-lg font-bold text-gray-800">No encontramos solicitudes</p>
            <p className="mt-1 text-sm text-gray-500">Prueba con otro término o limpia los filtros.</p>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('todos')
                setBrandFilter('todas')
              }}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-yellow-400"
            >
              Mostrar todas
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 bg-gray-950 px-4 py-7 text-center text-xs text-gray-500">
        <p>Repuestos Mérida · Solicitudes de compradores en Mérida y Los Andes</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/" className="text-gray-300 hover:text-yellow-400">Inicio</Link>
          <Link href="/plaza" className="text-gray-300 hover:text-yellow-400">Plaza</Link>
          <Link href="/politica-privacidad" className="text-gray-300 hover:text-yellow-400">Privacidad</Link>
        </div>
      </footer>
    </div>
  )
}
