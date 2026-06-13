# API cifrada de WhatsApp

La URL externa se configura únicamente en `WA_BOT_SEND_URL`. El navegador nunca
recibe esa URL ni `WA_ENCRYPTION_MASTER_KEY`.

## Flujo

1. El navegador solicita una credencial efímera en `GET /api/whatsapp/client-key`.
2. Envía a `POST /api/rifa/enviar-codigo` el teléfono, una intención permitida y
   la credencial.
3. Next.js valida origen, cookie, firma, expiración, permisos y límites.
4. Next.js genera el código y el mensaje. El navegador no puede suministrar
   instrucciones o mensajes arbitrarios.
5. El JSON se cifra con AES-256-GCM usando la implementación integrada desde
   `cifrandojson`.
6. El sobre cifrado se envía a `WA_BOT_SEND_URL`.

## Intenciones permitidas

- `login`
- `rifa_vendedor`

El servidor receptor debe rechazar cualquier otra intención, paquetes expirados
y `requestId` ya procesados.

## Descifrado en el servidor receptor

El receptor debe usar la misma `WA_ENCRYPTION_MASTER_KEY`:

```js
import { decryptJson } from './secure-json.js'

app.post('/api/wa/send', express.json({ limit: '8kb' }), async (req, res) => {
  const payload = decryptJson(req.body, process.env.WA_ENCRYPTION_MASTER_KEY)

  if (!['login', 'rifa_vendedor'].includes(payload.intencion)) {
    return res.status(400).json({ error: 'Intención no permitida' })
  }
  if (Date.now() >= Date.parse(payload.expiresAt)) {
    return res.status(410).json({ error: 'Solicitud expirada' })
  }

  // Guardar requestId como usado para impedir reenvíos.
  await enviarWhatsApp(payload.numero, payload.mensaje)
  return res.json({ ok: true })
})
```

HTTPS, autenticación con `WA_BOT_AUTH`, límites en el receptor y protección
contra repetición siguen siendo obligatorios. El cifrado del cuerpo no sustituye
TLS ni la autorización entre servidores.
