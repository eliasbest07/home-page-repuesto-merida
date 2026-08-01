// Filtro rápido de moderación para anuncios de Plaza.
//
// No pretende ser exhaustivo: marca como sospechoso lo que necesita ojo humano
// y deja pasar el resto para que se publique sin espera. Todo lo que quede
// marcado aparece en /usuario/comercio/autorizacion para revisión manual.

// Sustituye leetspeak y separadores para que "p0rn0", "p-o-r-n" o "s3x0"
// no esquiven la lista.
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5\$/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cada regla: patrón sobre el texto normalizado + motivo legible.
const REGLAS = [
  // Contenido sexual / obsceno
  { motivo: 'Posible contenido sexual', peso: 3, patron: /\b(porno?|pornografi\w*|xxx|sexo|sexual(es)?|erotic\w*|nudes?|desnud\w+|prostitu\w+|escort|putas?|puto|webcam\s?girl|onlyfans|masturb\w+|orgia|trio\s+sexual|servicios?\s+sexual\w*|acompanantes?\s+(vip|intimo)|dama\s+de\s+compania)\b/ },
  { motivo: 'Lenguaje obsceno', peso: 2, patron: /\b(verga|coger|culo|culito|tetas|panocha|pene|vagina|semen|chupar\w*|mamada|follar|cojer)\b/ },
  { motivo: 'Insultos o lenguaje ofensivo', peso: 2, patron: /\b(mierda|carajo|coño|cono\s+e|marico|maricon|pendejo|imbecil|estupido|malparido|hijo\s+de\s+puta|hp\b)\b/ },

  // Sustancias y armas
  { motivo: 'Posible venta de drogas', peso: 3, patron: /\b(cocaina|marihuana|marijuana|cannabis|crip(y|i)|perico|mdma|extasis|lsd|heroina|metanfetamin\w*|cristal\s+droga|hongos\s+alucin\w*|pepas?\b|porros?\b)\b/ },
  { motivo: 'Posible venta de armas o explosivos', peso: 3, patron: /\b(pistola|revolver|escopeta|fusil|glock|municion(es)?|balas?\b|granad(a|as)|explosiv\w+|silenciador|arma\s+de\s+fuego)\b/ },
  { motivo: 'Medicamentos controlados', peso: 2, patron: /\b(misoprostol|cytotec|aborti\w+|anabolic\w+|esteroid\w+|testosterona|viagra|cialis|sildenafil|tramadol|clonazepam|alprazolam|rivotril)\b/ },

  // Fraude / actividad ilícita
  { motivo: 'Posible estafa o dinero fácil', peso: 3, patron: /\b(dinero\s+facil|gana\s+dinero\s+(rapido|desde\s+casa)|inversion\s+garantizada|duplic\w+\s+tu\s+dinero|multiniv\w+|piramide|forex|cripto\w*\s+garantiz\w+|prestamo\s+sin\s+aval|casa\s+de\s+apuestas)\b/ },
  { motivo: 'Documentos o identidades falsas', peso: 3, patron: /\b(cedula\s+falsa|pasaporte\s+falso|titulo\s+universitario\s+(express|rapido)|licencia\s+sin\s+examen|documentos?\s+falsific\w*|certificado\s+medico\s+sin)\b/ },
  { motivo: 'Cuentas o credenciales de terceros', peso: 2, patron: /\b(cuentas?\s+(netflix|spotify|disney|hbo|crunchyroll)|hackeo|hackear|cracke\w+|licencias?\s+piratas?|keys?\s+pirata\w*)\b/ },
  { motivo: 'Posible trata o explotación', peso: 3, patron: /\b(trata\s+de\s+personas|venta\s+de\s+bebe|donacion\s+de\s+organo|venta\s+de\s+rinon|adopcion\s+irregular)\b/ },
  { motivo: 'Fauna o especies protegidas', peso: 2, patron: /\b(oso\s+frontino|especie\s+protegid\w+|marfil|piel\s+de\s+jaguar|animal\s+silvestre)\b/ },

  // Calidad del anuncio
  { motivo: 'Enlaces externos en el texto', peso: 1, patron: /\b(https?|www\s|bit\s?ly|t\s?me\s|telegram\s+canal|chat\s?whatsapp\s?com)\b/ },
]

const MIN_DESCRIPCION = 15

export const PLAZA_MODERACION_UMBRAL = 2

/**
 * Revisa el texto de un anuncio y devuelve el veredicto del filtro rápido.
 * @returns {{ sospechoso: boolean, puntaje: number, motivos: string[] }}
 */
export function revisarTextoAnuncio({ titulo = '', descripcion = '', categoria = '', precio } = {}) {
  const crudo = [titulo, descripcion, categoria].filter(Boolean).join(' ')
  const texto = normalize(crudo)
  const motivos = []
  let puntaje = 0

  for (const regla of REGLAS) {
    if (regla.patron.test(texto)) {
      motivos.push(regla.motivo)
      puntaje += regla.peso
    }
  }

  // Señales de anuncio incompleto o de baja calidad: no bloquean solas, pero
  // sumadas a otra señal mandan el anuncio a revisión.
  const letras = String(titulo || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '')
  if (letras.length >= 8 && letras === letras.toUpperCase()) {
    motivos.push('Título todo en mayúsculas')
    puntaje += 1
  }
  if (normalize(descripcion).length < MIN_DESCRIPCION) {
    motivos.push('Descripción demasiado corta')
    puntaje += 1
  }
  if (Number.isFinite(Number(precio)) && Number(precio) > 100000) {
    motivos.push('Precio inusualmente alto')
    puntaje += 1
  }

  return {
    sospechoso: puntaje >= PLAZA_MODERACION_UMBRAL,
    puntaje,
    motivos: Array.from(new Set(motivos)),
  }
}

const GEMINI_INSTRUCCION = `Eres un moderador de un marketplace local venezolano (Mérida) donde se publican
repuestos, productos, servicios y ofertas de empleo. Revisa el anuncio y decide si necesita revisión humana.

Marca "sospechoso" solo si detectas: contenido sexual o desnudez, lenguaje obsceno u ofensivo,
drogas ilegales, armas o explosivos, medicamentos controlados, estafas evidentes, documentos falsos,
actividad ilegal, o contenido claramente fuera de lugar para un marketplace familiar.

NO marques como sospechoso los anuncios normales de repuestos, vehículos, herramientas, servicios,
comida, ropa, mudanzas, mascotas o empleos legítimos, aunque estén mal redactados.

Responde en español, con motivos breves.`

function geminiSchema() {
  return {
    type: 'object',
    properties: {
      sospechoso: { type: 'boolean' },
      motivos: { type: 'array', items: { type: 'string' } },
    },
    required: ['sospechoso', 'motivos'],
  }
}

/**
 * Segunda pasada opcional con Gemini (revisa también la imagen). Si no hay
 * API key o la llamada falla, devuelve null y se usa solo el filtro local.
 */
export async function revisarAnuncioConGemini({ titulo, descripcion, categoria, precio, imagen }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!apiKey) return null

  const model = process.env.GEMINI_MODERATION_MODEL || process.env.GEMINI_VERIFICATION_MODEL || 'gemini-3.5-flash'
  const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0)
  const parts = [{
    text: `${GEMINI_INSTRUCCION}\n\nAnuncio:\nTítulo: ${titulo}\nCategoría: ${categoria}\nPrecio: ${precio}\nDescripción: ${descripcion}`,
  }]
  if (imagen?.buffer && imagen?.mime) {
    parts.push({ inline_data: { mime_type: imagen.mime, data: imagen.buffer.toString('base64') } })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0,
            response_mime_type: 'application/json',
            response_schema: geminiSchema(),
            // Gemini 3.x razona por defecto y esos "thinking tokens" salen del
            // presupuesto de salida Y SE FACTURAN COMO SALIDA. Moderar contra un
            // schema fijo no los necesita. En el bot, la misma medida bajó una
            // imagen de ~1490 a 406 tokens de salida, y de paso quitó los
            // "JSON inválido" que aparecían al agotarse el presupuesto.
            // Un número > 0 lo reactiva; -1 lo deja a criterio del modelo.
            thinkingConfig: { thinkingBudget: THINKING_BUDGET },
          },
        }),
      },
    )
    if (!response.ok) return null
    const data = await response.json()
    const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('') || ''
    const parsed = JSON.parse(raw)
    return {
      sospechoso: Boolean(parsed.sospechoso),
      motivos: Array.isArray(parsed.motivos) ? parsed.motivos.map(String).slice(0, 6) : [],
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Filtro completo: heurística local + Gemini (si está disponible).
 * Cualquiera de los dos puede mandar el anuncio a revisión manual.
 */
export async function moderarAnuncio(anuncio) {
  const local = revisarTextoAnuncio(anuncio)
  const ia = await revisarAnuncioConGemini(anuncio).catch(() => null)

  const motivos = Array.from(new Set([
    ...local.motivos.filter(() => local.sospechoso),
    ...(ia?.sospechoso ? ia.motivos : []),
  ]))

  return {
    sospechoso: local.sospechoso || Boolean(ia?.sospechoso),
    motivos,
    puntaje: local.puntaje,
    motivos_locales: local.motivos,
    ia_revisado: Boolean(ia),
    ia_sospechoso: ia ? Boolean(ia.sospechoso) : null,
    revisado_en: new Date().toISOString(),
  }
}
