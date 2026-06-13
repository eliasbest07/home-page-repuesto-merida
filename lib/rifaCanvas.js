'use client'

const COLORS = {
  disponible: { bg: '#ffffff', text: '#111827', border: '#e5e7eb' },
  reservado:  { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  vendido:    { bg: '#22c55e', text: '#ffffff', border: '#15803d' },
}

function formatVES(n) {
  const v = Number(n || 0)
  return v.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function formatFecha(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return '—' }
}
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generarPngEstadoRifa({ rifa, numeros, logoUrl = '/iconorm.png' }) {
  const W = 1080
  const H = 1440

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#fef9c3')
  grad.addColorStop(1, '#ecfdf5')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Header strip
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, W, 180)

  // Logo
  const logo = await loadImage(logoUrl)
  if (logo) {
    const size = 110
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(40, 35, size, size, 22)
    ctx.clip()
    ctx.drawImage(logo, 40, 35, size, size)
    ctx.restore()
  }

  ctx.fillStyle = '#FFD700'
  ctx.font = 'bold 42px Montserrat, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText('RIFA REPUESTOS MÉRIDA', 175, 50)
  ctx.fillStyle = '#ffffff'
  ctx.font = '24px Inter, system-ui, sans-serif'
  ctx.fillText('Tu repuesto, disponible ahora', 175, 105)

  // Title block
  let y = 220
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 48px Montserrat, system-ui, sans-serif'
  wrapText(ctx, rifa?.titulo || 'Rifa', 50, y, W - 100, 56)
  y += 70

  ctx.fillStyle = '#4b5563'
  ctx.font = '28px Inter, system-ui, sans-serif'
  ctx.fillText(`🎁 ${rifa?.premio || ''}`, 50, y)
  y += 44
  ctx.fillText(`📅 Sorteo: ${formatFecha(rifa?.fecha_sorteo)}`, 50, y)
  y += 44
  ctx.fillStyle = '#ca8a04'
  ctx.font = 'bold 32px Inter, system-ui, sans-serif'
  ctx.fillText(`💰 Bs. ${formatVES(rifa?.precio_numero)} por número`, 50, y)
  y += 60

  // Grid
  const gridCols = 10
  const gridRows = 10
  const gridPadding = 50
  const gridSize = W - gridPadding * 2
  const cell = gridSize / gridCols
  const gridY = y

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const idx = r * gridCols + c
      const key = String(idx).padStart(2, '0')
      const estado = numeros?.[key]?.estado || 'disponible'
      const col = COLORS[estado] || COLORS.disponible

      const x = gridPadding + c * cell
      const yy = gridY + r * cell

      ctx.fillStyle = col.bg
      ctx.strokeStyle = col.border
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x + 4, yy + 4, cell - 8, cell - 8, 12)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = col.text
      ctx.font = `bold ${Math.floor(cell * 0.42)}px Montserrat, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key, x + cell / 2, yy + cell / 2 + 2)
    }
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // Legend
  const legendY = gridY + gridSize + 30
  const items = [
    { label: 'Disponible', color: COLORS.disponible },
    { label: 'Reservado',  color: COLORS.reservado },
    { label: 'Vendido',    color: COLORS.vendido },
  ]
  let lx = gridPadding
  ctx.font = '22px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#111827'
  for (const it of items) {
    ctx.fillStyle = it.color.bg
    ctx.strokeStyle = it.color.border
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(lx, legendY, 32, 32, 8)
    ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#111827'
    ctx.fillText(it.label, lx + 42, legendY + 4)
    lx += ctx.measureText(it.label).width + 100
  }

  // Stats
  const vendidos = Object.values(numeros || {}).filter((n) => n?.estado === 'vendido').length
  const reservados = Object.values(numeros || {}).filter((n) => n?.estado === 'reservado').length
  const disponibles = 100 - vendidos - reservados

  const statY = legendY + 70
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 28px Montserrat, system-ui, sans-serif'
  ctx.fillText(`Vendidos: ${vendidos}/100  ·  Disponibles: ${disponibles}  ·  Reservados: ${reservados}`, gridPadding, statY)

  // Footer
  const footY = H - 70
  ctx.fillStyle = '#6b7280'
  ctx.font = '20px Inter, system-ui, sans-serif'
  const fecha = new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
  ctx.fillText(`Estado actualizado: ${fecha}`, gridPadding, footY)

  return canvas
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || '').split(' ')
  let line = ''
  let yy = y
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, yy)
      line = words[n] + ' '
      yy += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, yy)
}

export async function descargarPngEstadoRifa(args) {
  const canvas = await generarPngEstadoRifa(args)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeTitle = String(args?.rifa?.titulo || 'rifa').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
  a.download = `rifa-${safeTitle}-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
