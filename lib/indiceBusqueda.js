// Motor de búsqueda local del catálogo de repuestos.
//
// Port a JS de `lib/helpers/indice_busqueda.dart` de la app (repuestos_merida).
// Mantener los dos alineados: la app tiene el banco de pruebas
// (test/busqueda/, 456 búsquedas reales y coloquiales contra la foto real de
// `merida`) y `scripts/medir-busqueda.mjs` corre ese mismo banco contra este
// archivo.
//
// El índice es invertido: `raíz de palabra -> {documento: peso}`. El peso sale
// del campo donde apareció la palabra (la descripción vale más que el modelo),
// y al puntuar se multiplica por el IDF de esa palabra, así una palabra rara
// pesa mucho más que "carro", que está en media colección.

// ─────────────────────────── Normalización ───────────────────────────

const EQUIVALENCIAS = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a', å: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c',
}

/// Minúsculas, sin acentos ni signos. "1.6" y "4,6" quedan como una sola
/// palabra ("1p6") igual en el catálogo y en la consulta.
export function normalizarTexto(texto = '') {
  const s = String(texto ?? '').replace(/(\d)[.,](\d)/g, '$1p$2').toLowerCase()
  let out = ''
  for (const c of s) {
    const eq = EQUIVALENCIAS[c]
    if (eq) out += eq
    else out += /[a-z0-9]/.test(c) ? c : ' '
  }
  return out
}

/// Palabras que no aportan al buscar repuestos. Solo se descartan si la
/// consulta tiene además alguna palabra útil.
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'para',
  'con', 'sin', 'por', 'que', 'y', 'o', 'en', 'al', 'su', 'mi', 'tu', 'es',
  'the', 'of',
  // Muletillas de quien escribe como habla.
  'busco', 'buscando', 'necesito', 'quiero', 'tienen', 'tiene', 'tienes',
  'hay', 'pa', 'pal', 'donde', 'consigo', 'consiguen', 'precio', 'cuanto',
  'alguien', 'vende', 'venden', 'me', 'se', 'le', 'lo', 'porfa', 'favor',
  'repuesto', 'respuesto',
  // Solo en la web (aún no en la app): saludos y frases de cómo escriben por
  // WhatsApp, p. ej. "Hola buenas, quisiera saber si tienen pila de gasolina".
  'quisiera', 'queria', 'saber', 'si', 'tendran', 'tendra', 'tendras', 'hola',
  'buenas', 'buenos', 'noches', 'dias', 'tardes', 'ahorita', 'disponible',
  'disponibilidad', 'gracias', 'ustedes', 'algun', 'alguna',
])

/// Raíz simple para que singular y plural caigan juntos: cauchos -> caucho.
export function raiz(palabra) {
  if (palabra.length > 5 && palabra.endsWith('es')) return palabra.slice(0, -2)
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1)
  return palabra
}

export function tokenizar(texto) {
  return normalizarTexto(texto).split(/\s+/).filter((t) => t.length >= 2)
}

// ─────────────────────────── Sinónimos ───────────────────────────

/// Vocabulario del taller venezolano. Cada grupo es intercambiable entre sí.
const GRUPOS_SINONIMOS = [
  ['caucho', 'neumatico', 'goma', 'llanta'],
  ['balinera', 'rolinera', 'rodamiento', 'ruliman', 'ruleman'],
  ['empacadura', 'junta', 'empaquetadura'],
  ['guaya', 'cable'],
  ['corneta', 'bocina', 'pito', 'claxon'],
  ['zapata', 'banda'],
  ['farol', 'faro', 'luz', 'optica'],
  ['retrovisor', 'espejo'],
  ['amortiguador', 'shock', 'suspension'],
  ['bujia', 'chispa'],
  ['aceite', 'lubricante'],
  // "Pila" NO va aquí: en Mérida la pila es la bomba de gasolina.
  ['bateria', 'acumulador'],
  ['manilla', 'manubrio', 'manillar'],
  ['parrilla', 'portaequipaje'],
  ['tanque', 'deposito'],
  ['motor', 'maquina'],
  ['carburador', 'carbu'],
  ['tacometro', 'velocimetro', 'tablero', 'odometro'],
  ['switche', 'switch', 'interruptor'],
  ['tapiceria', 'asiento', 'cojin'],
  ['parachoque', 'paragolpe', 'bumper', 'bomper'],
  ['bomba', 'bombin'],
  ['cauchito', 'bushing', 'goma', 'buje'],
  ['clutch', 'croche', 'cloche', 'cluch', 'embrague'],
  ['direccional', 'cruce', 'intermitente'],
  ['pare', 'stop'],
  ['moto', 'motocicleta'],
  ['carro', 'auto', 'automovil', 'vehiculo'],
  ['camara', 'culata', 'cabezote'],
  ['tripoide', 'tripode', 'homocinetica'],
  ['plumilla', 'limpiaparabrisa', 'escobilla'],
  ['tijera', 'basculante'],
  ['electroventilador', 'electro', 'ventilador', 'fan'],
  ['ckp', 'ciguenal'],
  ['arranque', 'burro'],
  ['delantero', 'delantera', 'delt', 'delant'],
  ['trasero', 'trasera', 'tras'],
  ['izquierdo', 'izquierda', 'izq', 'lh'],
  ['derecho', 'derecha', 'der', 'rh'],
  ['superior', 'sup'],
  ['inferior', 'inf'],
  ['hidromatico', 'hidromatica', 'automatico', 'automatica'],
]

const SINONIMOS = (() => {
  const mapa = new Map()
  for (const grupo of GRUPOS_SINONIMOS) {
    const raices = [...new Set(grupo.map(raiz))]
    for (const r of raices) {
      if (!mapa.has(r)) mapa.set(r, [])
      mapa.get(r).push(...raices.filter((o) => o !== r))
    }
  }
  return mapa
})()

// ─────────────────────────── Distancia y fonética ───────────────────────────

/// Damerau-Levenshtein con corte temprano: pasado `maximo` devuelve maximo+1.
function distancia(a, b, maximo) {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1
  if (a === b) return 0
  const m = b.length
  let dosAtras = new Array(m + 1).fill(0)
  let anterior = Array.from({ length: m + 1 }, (_, i) => i)
  let actual = new Array(m + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    actual[0] = i
    let mejorFila = actual[0]
    for (let j = 1; j <= m; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      let valor = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, dosAtras[j - 2] + 1)
      }
      actual[j] = valor
      if (valor < mejorFila) mejorFila = valor
    }
    if (mejorFila > maximo) return maximo + 1
    const reciclada = dosAtras
    dosAtras = anterior
    anterior = actual
    actual = reciclada
  }
  return anterior[m]
}

/// Cómo SUENA la palabra en Venezuela: b/v, ll/y, s/z/c(e,i), g(e,i)/j,
/// k/qu/c, h muda y letras dobles colapsan.
export function fonetica(palabra) {
  let s = palabra
    .replaceAll('ch', '#')
    .replaceAll('h', '')
    .replaceAll('#', 'ch')
    .replaceAll('qu', 'k')
    .replaceAll('ll', 'y')
    .replaceAll('v', 'b')
    .replaceAll('z', 's')
  s = s.replace(/c([ei])/g, 's$1')
  s = s.replace(/g([ei])/g, 'j$1')
  s = s.replaceAll('k', 'c')
  return s.replace(/(.)\1+/g, '$1')
}

// ─────────────────────────── Índice ───────────────────────────

/// Pesos por campo: la descripción manda sobre el modelo o el vehículo.
const PESOS = {
  descripcion: 5.0,
  marca: 3.0,
  categoria: 2.0,
  modelos: 2.0,
  vehiculo: 1.0,
  // `buscar` lo llena el bot con jerga pero también con ruido: suma sin mandar.
  buscar: 1.0,
  // La gente busca tiendas por su nombre.
  comercio: 1.5,
}

/// Construye el índice sobre `items`. `campos(item)` devuelve el texto de cada
/// campo: { descripcion, marca, categoria, modelos, vehiculo, buscar, comercio }.
export function construirIndice(items, campos) {
  const invertido = new Map()
  const conteoFormas = new Map()
  const descripciones = new Array(items.length)

  const indexar = (doc, texto, peso) => {
    if (!texto) return
    for (const token of tokenizar(texto)) {
      const r = raiz(token)
      let docs = invertido.get(r)
      if (!docs) invertido.set(r, (docs = new Map()))
      // Si sale en varios campos se queda con el mayor peso, sin sumar.
      if (peso > (docs.get(doc) || 0)) docs.set(doc, peso)
      let variantes = conteoFormas.get(r)
      if (!variantes) conteoFormas.set(r, (variantes = new Map()))
      variantes.set(token, (variantes.get(token) || 0) + 1)
    }
  }

  items.forEach((item, i) => {
    const c = campos(item) || {}
    descripciones[i] = normalizarTexto(c.descripcion || '')
    for (const campo of Object.keys(PESOS)) {
      const valor = Array.isArray(c[campo]) ? c[campo].join(' ') : c[campo]
      indexar(i, valor, PESOS[campo])
    }
  })

  const total = Math.max(items.length, 1)
  const idf = new Map()
  const frecuencias = new Map()
  for (const [r, docs] of invertido) {
    frecuencias.set(r, docs.size)
    // IDF suavizado, con piso para que la palabra más común no quede en cero.
    idf.set(r, Math.max(0.25, Math.log(total / (1 + docs.size)) + 1.0))
  }
  const formas = new Map()
  for (const [r, variantes] of conteoFormas) {
    let mejor = r
    let maximo = -1
    for (const [forma, veces] of variantes) {
      if (veces > maximo) { maximo = veces; mejor = forma }
    }
    formas.set(r, mejor)
  }

  let foneticas = null
  const obtenerFoneticas = () => {
    if (!foneticas) {
      foneticas = new Map()
      for (const clave of invertido.keys()) foneticas.set(clave, fonetica(clave))
    }
    return foneticas
  }

  /// Candidatos del vocabulario para una palabra, con la calidad de cada
  /// coincidencia (1 = exacta). Primero lo barato (exacta, sinónimo, prefijo)
  /// y solo si nada dio, el fuzzy por sonido.
  function candidatosDe(token) {
    const r = raiz(token)
    const candidatos = new Map()
    const proponer = (clave, calidad) => {
      if (!invertido.has(clave)) return
      if (calidad > (candidatos.get(clave) || 0)) candidatos.set(clave, calidad)
    }

    proponer(r, 1.0)
    for (const sinonimo of SINONIMOS.get(r) || []) proponer(sinonimo, 0.8)

    // Prefijo: mientras se escribe, "amorti" ya trae "amortiguador".
    if (r.length >= 3) {
      const porPrefijo = []
      for (const clave of invertido.keys()) {
        if (clave.length > r.length && clave.startsWith(r)) porPrefijo.push(clave)
      }
      porPrefijo.sort((a, b) => (frecuencias.get(b) || 0) - (frecuencias.get(a) || 0))
      for (const clave of porPrefijo.slice(0, 12)) proponer(clave, 0.72)
    }

    // Errores de tipeo por cómo suena la palabra ("vovina" -> bobina).
    const sonido = fonetica(r)
    if (candidatos.size === 0 && sonido.length >= 4) {
      const maximo = sonido.length <= 6 ? 1 : 2
      const cercanas = new Map()
      for (const [clave, sonidoClave] of obtenerFoneticas()) {
        if (clave.length < 3) continue
        const d = distancia(sonido, sonidoClave, maximo)
        if (d <= maximo) cercanas.set(clave, d)
      }
      // Si alguna SUENA igual, esa es: las que solo se parecen sobran.
      const suenaIgual = [...cercanas.values()].includes(0)
      for (const [clave, d] of cercanas) {
        if (suenaIgual && d > 0) continue
        proponer(clave, d === 0 ? 0.7 : d === 1 ? 0.62 : 0.48)
      }
      // Lo corregido arrastra sus sinónimos: "kloche" -> cloche -> clutch.
      for (const [clave, calidad] of [...candidatos]) {
        for (const sinonimo of SINONIMOS.get(clave) || []) proponer(sinonimo, calidad * 0.8)
      }
    }
    return candidatos
  }

  /// Busca y devuelve `{ resultados, sugerencias }` ordenados por relevancia.
  /// `resultados` responden a TODAS las palabras útiles; si no hay ninguno, lo
  /// parcial va en `sugerencias` para no dejar la pantalla vacía.
  /// `ambito(item)` acota ANTES de ordenar (tipo de vehículo, marca…), para
  /// que el ranking se calcule dentro de lo elegido.
  function buscar(consulta, { ambito = null, maxSugerencias = 8, todasLasParciales = false } = {}) {
    const nula = { resultados: [], sugerencias: [] }
    const crudos = tokenizar(consulta)
    if (!crudos.length || !items.length) return nula

    let tokens = crudos.filter((t) => !VACIAS.has(t))
    if (!tokens.length) tokens = crudos

    const puntajes = new Map()
    const aciertos = new Map()

    for (const token of tokens) {
      const candidatos = candidatosDe(token)
      if (!candidatos.size) continue
      // Mejor aporte de ESTA palabra a cada documento (los sinónimos no suman
      // entre sí). Un sinónimo nunca pesa más que la palabra escrita.
      const aporte = new Map()
      const idfPropio = idf.get(raiz(token))
      for (const [clave, calidad] of candidatos) {
        let peso = idf.get(clave) ?? 1.0
        if (idfPropio !== undefined && peso > idfPropio) peso = idfPropio
        for (const [doc, pesoCampo] of invertido.get(clave)) {
          const valor = calidad * peso * pesoCampo
          if (valor > (aporte.get(doc) || 0)) aporte.set(doc, valor)
        }
      }
      for (const [doc, valor] of aporte) {
        puntajes.set(doc, (puntajes.get(doc) || 0) + valor)
        aciertos.set(doc, (aciertos.get(doc) || 0) + 1)
      }
    }
    if (!puntajes.size) return nula

    const frase = normalizarTexto(consulta).trim()
    const total = tokens.length
    const evaluados = []
    for (const [doc, base] of puntajes) {
      if (ambito && !ambito(items[doc])) continue
      const cobertura = (aciertos.get(doc) || 0) / total
      // La cobertura manda: responder a las 3 palabras vale más que responder
      // muy bien a una sola.
      let puntaje = base * (0.25 + 0.75 * Math.pow(cobertura, 1.6))
      if (total > 1 && frase.length >= 5 && descripciones[doc].includes(frase)) puntaje *= 1.6
      evaluados.push({ doc, puntaje, cobertura })
    }
    // Empates: el orden del catálogo, igual que el sort estable de Dart.
    evaluados.sort((a, b) => b.puntaje - a.puntaje || a.doc - b.doc)

    const fuertes = evaluados.filter((e) => e.cobertura >= 0.999)
    const parciales = evaluados.filter((e) => e.cobertura < 0.999)
    const aItems = (lista) => lista.map((e) => items[e.doc])

    if (fuertes.length) {
      const sugerencias = todasLasParciales
        ? aItems(parciales)
        : fuertes.length >= 4 ? [] : aItems(parciales.slice(0, maxSugerencias))
      return { resultados: aItems(fuertes), sugerencias }
    }
    return {
      resultados: [],
      sugerencias: aItems(todasLasParciales ? evaluados : evaluados.slice(0, maxSugerencias)),
    }
  }

  /// Autocompletado por prefijo sobre el vocabulario real del catálogo.
  function completar(parcial, limite = 6) {
    const tokens = tokenizar(parcial)
    if (!tokens.length) return []
    const ultimo = raiz(tokens[tokens.length - 1])
    if (ultimo.length < 2) return []
    const candidatos = [...invertido.keys()].filter((c) => c.startsWith(ultimo))
    candidatos.sort((a, b) => (frecuencias.get(b) || 0) - (frecuencias.get(a) || 0))
    const prefijo = tokens.length > 1 ? `${tokens.slice(0, -1).join(' ')} ` : ''
    return candidatos.slice(0, limite).map((c) => `${prefijo}${formas.get(c) || c}`)
  }

  return { buscar, completar, cantidad: items.length }
}
