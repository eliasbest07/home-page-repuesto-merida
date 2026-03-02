export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  const upstream = await fetch(url, {
    headers: { 'ngrok-skip-browser-warning': '1' },
  })

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  const buffer = await upstream.arrayBuffer()

  return new Response(buffer, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
