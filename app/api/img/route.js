const ALLOWED_HOST = 'uncandid-overmighty-jodie.ngrok-free.dev'
const TIMEOUT_MS   = 8000

// SVG gris como placeholder cuando la imagen no carga
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9ca3af">Sin imagen</text>
</svg>`

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) return new Response('Missing url', { status: 400 })

  // Validar que la URL sea del host permitido (evitar SSRF)
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return new Response('URL inválida', { status: 400 })
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return new Response('Host no permitido', { status: 403 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(url, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      signal: controller.signal,
    })

    clearTimeout(timer)

    const contentType = upstream.headers.get('content-type') || ''

    // Si ngrok devuelve HTML (interstitial) en vez de imagen → placeholder
    if (!upstream.ok || contentType.includes('text/html')) {
      return new Response(PLACEHOLDER, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
      })
    }

    // Streaming directo: retransmite el body sin acumularlo en memoria
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })

  } catch (err) {
    clearTimeout(timer)
    console.error('[api/img] Error al obtener imagen:', err.message)

    // Devolver placeholder SVG en lugar de 500
    return new Response(PLACEHOLDER, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    })
  }
}
