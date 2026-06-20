'use client'

export const MAX_SOURCE_IMAGE_SIZE = 20 * 1024 * 1024
export const TARGET_UPLOADED_IMAGE_SIZE = 450 * 1024
export const MAX_UPLOADED_IMAGE_SIZE = 550 * 1024

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function prepareImageForUpload(file) {
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
