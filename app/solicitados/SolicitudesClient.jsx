'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
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
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [expandedImage, setExpandedImage] = useState(null)
  const textRef = useRef(null)
  const fileRef = useRef(null)
  const currentParticipantId = sessionParticipantId(session)
  const participants = useMemo(() => {
    const unique = new Map()
    comments.forEach((comment) => {
      const id = participantId(comment)
      if (!id) return
      if (!unique.has(id)) {
        unique.set(id, {
          id,
          autor: comment.autor || 'Usuario',
          whatsapp: comment.whatsapp || '',
        })
      }
    })
    return [...unique.values()]
  }, [comments])

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
    if (!imageFile) {
      setImagePreview('')
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

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

  function selectImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')

    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5 MB.')
      return
    }

    setImageFile(file)
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

    if (!cleanText && !imageFile) return

    setSubmitting(true)
    setError('')

    let publishPhase = 'upload'

    try {
      let imageUrl = ''
      if (imageFile) {
        const extension = imageFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
        const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
        const uniqueName = `${Date.now()}-${randomId}.${extension}`
        const path = `solicitudes-debate/${request.id}/${cleanWhatsapp}/${uniqueName}`
        const uploaded = await uploadBytes(storageRef(storage, path), imageFile, {
          contentType: imageFile.type,
        })
        imageUrl = await getDownloadURL(uploaded.ref)
      }

      publishPhase = 'comment'
      const optimistic = {
        id: `local-${Date.now()}`,
        solicitud_id: request.id,
        autor: cleanAuthor || 'Anónimo',
        texto: cleanText,
        imagen_url: imageUrl,
        propietario_id: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        creado_en: Date.now(),
      }

      const document = await addDoc(collection(firestore, COMMENT_COLLECTION), {
        solicitud_id: request.id,
        autor: optimistic.autor,
        texto: cleanText,
        imagen_url: imageUrl,
        propietario_id: cleanWhatsapp,
        whatsapp: cleanWhatsapp,
        creado_en: serverTimestamp(),
      })

      onCommentAdded({ ...optimistic, id: document.id })
      setText('')
      setImageFile(null)
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
        setError(`${storageMessages[code] || 'No se pudo subir la imagen.'} (${code})`)
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
              {comments.map((comment) => (
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
                          {comment.imagen_url && (
                            <button
                              type="button"
                              onClick={() => setExpandedImage({
                                url: comment.imagen_url,
                                alt: `Imagen compartida por ${comment.autor || 'usuario'}`,
                              })}
                              className="relative mt-2 block aspect-video w-full max-w-sm cursor-zoom-in overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                              aria-label="Ampliar imagen"
                            >
                              <Image
                                src={comment.imagen_url}
                                alt={`Imagen compartida por ${comment.autor || 'usuario'}`}
                                fill
                                unoptimized
                                sizes="(max-width: 640px) 90vw, 384px"
                                className="object-contain"
                              />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {comment.whatsapp &&
                      participantId(comment) !== currentParticipantId &&
                      contactMap.get(`${participantId(comment)}:${currentParticipantId}`)?.estado === 'aprobado' && (
                      <a
                        href={commenterWhatsappUrl(comment, request)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700 hover:bg-green-200"
                      >
                        Contactar
                      </a>
                    )}
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
                </article>
              ))}
            </div>
          )}

          {session && participants.length > 1 && (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-bold text-gray-800">Permisos para contactar</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                El botón de WhatsApp solo se habilita cuando el dueño del número autoriza al otro participante.
              </p>
              <div className="mt-3 space-y-2">
                {participants
                  .filter((participant) => participant.id !== currentParticipantId)
                  .map((participant) => {
                    const permissionToMe = contactMap.get(`${participant.id}:${currentParticipantId}`)
                    const permissionFromMe = contactMap.get(`${currentParticipantId}:${participant.id}`)
                    const outgoingId = contactPermissionId(request.id, participant.id, currentParticipantId)
                    const incomingId = contactPermissionId(request.id, currentParticipantId, participant.id)

                    return (
                      <div key={participant.id} className="rounded-lg border border-emerald-100 bg-white p-2.5">
                        <p className="text-xs font-bold text-gray-800">{participant.autor}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {permissionToMe?.estado === 'aprobado' ? (
                            <a
                              href={commenterWhatsappUrl(participant, request)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-bold text-white"
                            >
                              Contactar
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setContactPermission(participant.id, currentParticipantId, 'pendiente')}
                              disabled={permissionToMe?.estado === 'pendiente' || contactBusy === outgoingId}
                              className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-[11px] font-bold text-green-700 disabled:opacity-60"
                            >
                              {permissionToMe?.estado === 'pendiente' ? 'Solicitud enviada' : 'Solicitar contacto'}
                            </button>
                          )}

                          {permissionFromMe?.estado === 'pendiente' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setContactPermission(currentParticipantId, participant.id, 'aprobado')}
                                disabled={contactBusy === incomingId}
                                className="rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-yellow-400 disabled:opacity-60"
                              >
                                Autorizarle
                              </button>
                              <button
                                type="button"
                                onClick={() => setContactPermission(currentParticipantId, participant.id, 'rechazado')}
                                disabled={contactBusy === incomingId}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-500 disabled:opacity-60"
                              >
                                Rechazar
                              </button>
                            </>
                          ) : permissionFromMe?.estado === 'aprobado' ? (
                            <button
                              type="button"
                              onClick={() => setContactPermission(currentParticipantId, participant.id, 'rechazado')}
                              disabled={contactBusy === incomingId}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-500 disabled:opacity-60"
                            >
                              Revocar autorización
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setContactPermission(currentParticipantId, participant.id, 'aprobado')}
                              disabled={contactBusy === incomingId}
                              className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-[11px] font-bold text-gray-800 disabled:opacity-60"
                            >
                              Autorizarle contacto
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
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
              {imagePreview && (
                <div className="relative w-40 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  <div className="relative aspect-video">
                    <Image src={imagePreview} alt="Vista previa" fill unoptimized className="object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white"
                  >
                    Quitar
                  </button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={selectImage}
                className="hidden"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-yellow-400 hover:bg-yellow-50 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 0 1 2-2h2l1.5-2h5L16 5h2a2 2 0 0 1 2 2v11H4V7Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  </svg>
                  Subir foto
                </button>
                <button
                  type="submit"
                  disabled={(!text.trim() && !imageFile) || submitting}
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
      {expandedImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl font-bold leading-none text-gray-900 shadow-lg sm:right-6 sm:top-6"
            aria-label="Cerrar imagen"
          >
            ×
          </button>
          <div
            className="relative h-full max-h-[90vh] w-full max-w-6xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={expandedImage.url}
              alt={expandedImage.alt}
              fill
              unoptimized
              priority
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
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
}) {
  const status = STATUS[request.estado] || STATUS.solicitado
  const vehicle = [request.marca, request.modelo, request.anio].filter(Boolean)
  const [debateOpen, setDebateOpen] = useState(Boolean(autoOpen))

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
    </article>
  )
}

export default function SolicitudesClient() {
  const [firebaseRequests, setFirebaseRequests] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [brandFilter, setBrandFilter] = useState('todas')
  const [commentsByRequest, setCommentsByRequest] = useState({})
  const [contactsByRequest, setContactsByRequest] = useState({})
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
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
    let cancelled = false

    getDocs(collection(firestore, CONTACT_COLLECTION))
      .then((snapshot) => {
        if (cancelled) return
        const grouped = {}
        snapshot.docs.forEach((document) => {
          const contact = { id: document.id, ...document.data() }
          const key = String(contact.solicitud_id)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(contact)
        })
        setContactsByRequest(grouped)
      })
      .catch(() => {
        if (!cancelled) setContactsByRequest({})
      })

    return () => {
      cancelled = true
    }
  }, [])
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image src="/iconorm.png" alt="Repuestos Mérida" width={38} height={38} className="h-9 w-9 shrink-0 rounded-lg" />
            <span className="truncate font-brand text-base">
              Repuestos <span className="text-yellow-400">Mérida</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 hover:text-white sm:inline-flex">
              Inicio
            </Link>
            <Link href="/plaza/solicitar" className="rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-gray-950 hover:bg-yellow-300 sm:text-sm">
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
