export function isPlazaAdApproved(item) {
  if (item?.aprobado === false) return false
  // Los anuncios importados desde fuentes confiables son publicaciones legacy
  // aprobadas. Solo los creados por usuarios en la web requieren moderación.
  return item?.fuente !== 'web_usuario' || item?.aprobado === true
}

export function plazaApprovalStatus(item) {
  if (item?.estado_aprobacion === 'retirado') return 'retirado'
  if (item?.aprobado === false) {
    return item?.estado_aprobacion === 'rechazado' ? 'rechazado' : 'pendiente'
  }
  if (item?.fuente !== 'web_usuario') return 'aprobado'
  if (item?.aprobado === true) return 'aprobado'
  if (item?.estado_aprobacion === 'rechazado') return 'rechazado'
  return 'pendiente'
}
