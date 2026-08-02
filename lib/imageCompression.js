'use client'

// Peso de ENTRADA que se acepta del usuario. Alto a propósito: la cámara de un
// teléfono moderno saca 3-8 MB sin esfuerzo, y quien manda su cédula no tiene
// por qué saber comprimirla. Lo que importa es el peso de SALIDA, y de eso se
// encarga prepareImageForUpload().
export const MAX_SOURCE_IMAGE_SIZE = 50 * 1024 * 1024
// A lo que se APUNTA al comprimir. El bucle baja calidad y tamaño buscando este
// peso, que es el que deja las subidas rápidas con datos móviles.
export const TARGET_UPLOADED_IMAGE_SIZE = 450 * 1024
// Techo con el que se ACEPTA la subida. No es lo mismo que el objetivo: si la
// foto quedó en 600 KB no tiene sentido rechazarla y dejar al usuario sin poder
// verificarse — se sube igual. Antes este techo era 550 KB y una foto de 3,5 MB
// de la cámara de un teléfono se quedaba afuera (1-ago-2026).
export const MAX_UPLOADED_IMAGE_SIZE = 1024 * 1024

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

    // El bucle anterior no convergía: al bajar el tamaño volvía a subir la
    // calidad a 0.72, así que gastaba los 12 intentos y solo alcanzaba a reducir
    // las dimensiones DOS veces. Una foto de 3,5 MB de una cámara de teléfono se
    // quedaba por encima del límite y el usuario recibía "La foto no pudo
    // reducirse por debajo de 550 KB" sin poder hacer nada (1-ago-2026).
    //
    // Ahora la calidad NO vuelve a subir después de reducir el tamaño, y cada
    // reducción recorta el área a un 64% (0.8 × 0.8). Con eso la convergencia
    // está garantizada para cualquier peso de entrada: a los 6 recortes el área
    // es el 7% de la original y no hay foto que siga pesando 550 KB.
    for (let attempt = 0; attempt < 24; attempt += 1) {
      canvas.width = width
      canvas.height = height
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)

      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob || blob.size <= TARGET_UPLOADED_IMAGE_SIZE) break

      if (quality > 0.42) {
        quality -= 0.08
      } else {
        // Se recorta el tamaño y se retoma la calidad en un valor MODERADO, no
        // alto: reencodear en grande y con calidad alta era lo que estancaba.
        scale *= 0.8
        width = Math.max(1, Math.round(image.naturalWidth * scale))
        height = Math.max(1, Math.round(image.naturalHeight * scale))
        quality = 0.6
      }
    }

    // Se devuelve lo MEJOR que se logró, aunque no haya llegado al objetivo. Un
    // error acá dejaba al usuario trabado sin alternativa: si su foto terminó en
    // 600 KB, que se suba en 600 KB. Solo se devuelve el archivo original cuando
    // no hubo forma de reencodearlo (formato que el navegador no decodifica).
    if (!blob) return file
    if (blob.size >= file.size) return file

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
