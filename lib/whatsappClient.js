let cachedKey = null

export async function getWhatsAppClientKey() {
  if (cachedKey && Date.now() < cachedKey.expiresAt - 30_000) {
    return cachedKey.clientKey
  }

  const response = await fetch('/api/whatsapp/client-key', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.clientKey) {
    throw new Error(data.error || 'No se pudo iniciar la sesión segura de WhatsApp.')
  }
  cachedKey = data
  return data.clientKey
}

export async function buildWhatsAppRequest(payload) {
  return {
    ...payload,
    clientKey: await getWhatsAppClientKey(),
  }
}
