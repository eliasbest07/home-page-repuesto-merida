// Genera una "guía rápida" útil para la ficha de un repuesto a partir de su
// categoría y descripción. Detecta el tipo de pieza y devuelve qué es, qué
// confirmar para que sea compatible con el modelo, preguntas para el vendedor y
// un artículo del blog relacionado. Pensado para enriquecer cada ficha con
// contenido original y útil, sin llamadas a IA en tiempo de ejecución.

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Artículos del blog para enlazar según el tipo de pieza.
const ART_FRENOS = { slug: 'pastillas-de-freno-correctas', titulo: 'Cómo elegir las pastillas de freno correctas' }
const ART_ELECTRICO = { slug: 'fallas-electricas-alternador-bateria', titulo: 'Alternador, arranque o batería: cómo describir una falla eléctrica' }
const ART_DATOS = { slug: 'datos-para-ubicar-repuestos-merida', titulo: 'Qué datos enviar para ubicar el repuesto de tu carro' }

// Tipos de pieza, en orden de prioridad de detección. Cada uno aporta texto
// específico. `match` son palabras clave que se buscan en categoría+descripción.
const TIPOS = [
  {
    id: 'frenos',
    titulo: 'sistema de frenos',
    match: ['freno', 'pastilla', 'disco de freno', 'caliper', 'pinza', 'bomba de freno', 'tambor', 'banda'],
    queEs:
      'Las piezas de freno son críticas para la seguridad: su medida y diseño cambian según la versión y el año del vehículo. Un mismo modelo puede traer discos de distinto diámetro o pastillas con o sin sensor de desgaste.',
    confirmar: [
      'Si la pieza es delantera o trasera.',
      'Diámetro del disco o medida de la pastilla.',
      'Si el sistema lleva sensor de desgaste.',
      'Tipo de pinza (caliper) según el motor o la versión.',
    ],
    preguntas: [
      '¿Es para el eje delantero o trasero?',
      '¿Incluye sensor de desgaste si mi carro lo usa?',
      '¿Tiene garantía y de qué marca es?',
    ],
    articulo: ART_FRENOS,
  },
  {
    id: 'electrico',
    titulo: 'sistema eléctrico',
    match: ['alternador', 'arranque', 'bateria', 'bobina', 'sensor', 'bujia', 'cableado', 'rele', 'regulador', 'electric', 'distribuidor', 'fusible'],
    queEs:
      'En el sistema eléctrico, una pieza correcta depende del voltaje, los conectores y la posición de montaje. Componentes parecidos pueden tener distinto número de pines o sentido de giro.',
    confirmar: [
      'Voltaje y amperaje (especialmente en alternador y batería).',
      'Cantidad y forma de los conectores o pines.',
      'Lado de montaje y sentido de giro cuando aplique.',
      'Si buscas pieza nueva, reconstruida o usada.',
    ],
    preguntas: [
      '¿Coincide el conector con el de mi vehículo?',
      '¿Es nuevo, reconstruido o usado?',
      '¿Ofrecen prueba en banco o garantía?',
    ],
    articulo: ART_ELECTRICO,
  },
  {
    id: 'caja',
    titulo: 'caja, transmisión o embrague',
    match: ['caja', 'transmision', 'piñon', 'pinon', 'sincronico', 'cloche', 'embrague', 'clutch', 'cardan', 'tripoide', 'homocinetica', 'velocidad', 'engrane'],
    queEs:
      'Las piezas de caja y transmisión exigen una compatibilidad muy precisa: el número de velocidades, la relación de engranajes y el tipo de transmisión (sincrónica o automática) determinan si la pieza encaja.',
    confirmar: [
      'Transmisión sincrónica o automática.',
      'Número de velocidades de la caja.',
      'Relación o número de dientes si es un engranaje/piñón.',
      'Motor y año exactos del vehículo.',
    ],
    preguntas: [
      '¿Sirve para caja sincrónica o automática?',
      '¿Coincide la relación de dientes con mi caja?',
      '¿Puedo confirmar con una foto de mi pieza?',
    ],
    articulo: ART_DATOS,
  },
  {
    id: 'motor',
    titulo: 'motor',
    match: ['motor', 'anillo', 'valvula', 'piston', 'biela', 'junta', 'empacadura', 'polea', 'damper', 'ciguenal', 'cigueñal', 'arbol de leva', 'culata', 'cadena de tiempo', 'correa', 'kit de tiempo', 'bomba de aceite', 'metal'],
    queEs:
      'Las piezas internas del motor se fabrican en medidas precisas. La cilindrada, la generación del motor y a veces la medida de rectificado definen cuál corresponde, aunque el modelo del carro sea el mismo.',
    confirmar: [
      'Cilindrada y código o generación del motor.',
      'Medida estándar o de rectificado (en anillos, metales, pistones).',
      'Número de válvulas (8V, 16V) cuando aplique.',
      'Año del vehículo, porque el motor pudo cambiar entre años.',
    ],
    preguntas: [
      '¿Para qué cilindrada y motor exacto es?',
      '¿Qué medida es (estándar o rectificado)?',
      '¿Tienen el juego completo o pieza por pieza?',
    ],
    articulo: ART_DATOS,
  },
  {
    id: 'suspension',
    titulo: 'suspensión y dirección',
    match: ['amortiguador', 'rotula', 'mesa', 'brazo', 'terminal', 'muelle', 'espiral', 'bujes', 'tijera', 'direccion', 'cremallera', 'hidraulica', 'rodamiento', 'maza', 'bieleta'],
    queEs:
      'En suspensión y dirección, el lado (derecho o izquierdo), la posición y la versión del vehículo cambian la pieza. Una pieza muy parecida puede no calzar por milímetros.',
    confirmar: [
      'Lado: derecho o izquierdo, delantero o trasero.',
      'Versión del vehículo (a veces cambia entre full y básica).',
      'Si es para dirección hidráulica o asistida eléctricamente.',
      'Año y motor del vehículo.',
    ],
    preguntas: [
      '¿Es del lado que necesito (der./izq., del./tras.)?',
      '¿Sirve para mi versión exacta?',
      '¿Es nueva o usada y tiene garantía?',
    ],
    articulo: ART_DATOS,
  },
  {
    id: 'enfriamiento',
    titulo: 'sistema de enfriamiento',
    match: ['radiador', 'termostato', 'bomba de agua', 'refrigerante', 'ventilador', 'manguera', 'tapa de radiador', 'electroventilador'],
    queEs:
      'Las piezas de enfriamiento varían según el motor, el tipo de aire acondicionado y la transmisión. Un radiador puede cambiar de medida o de conexiones entre versiones del mismo modelo.',
    confirmar: [
      'Motor y si el vehículo tiene aire acondicionado.',
      'Transmisión sincrónica o automática (cambia el radiador).',
      'Medidas y ubicación de las conexiones.',
      'Año del vehículo.',
    ],
    preguntas: [
      '¿Es para motor con o sin aire acondicionado?',
      '¿Sirve para caja sincrónica o automática?',
      '¿Coinciden las medidas y conexiones?',
    ],
    articulo: ART_DATOS,
  },
  {
    id: 'liquidos',
    titulo: 'líquidos y lubricantes',
    match: ['liquido', 'aceite', 'lubricante', 'silicone', 'silicona', 'grasa', 'refrigerante', 'aditivo', 'filtro'],
    queEs:
      'Para líquidos, lubricantes y filtros, lo importante es la especificación correcta: viscosidad, tipo y cantidad recomendada para tu motor. Usar la especificación adecuada protege el motor y la garantía.',
    confirmar: [
      'Viscosidad o especificación recomendada por el fabricante.',
      'Tipo de motor (gasolina o diésel) y cilindrada.',
      'Cantidad necesaria para el servicio.',
      'Para filtros: modelo, año y motor exactos.',
    ],
    preguntas: [
      '¿Cumple la especificación que pide mi motor?',
      '¿Cuánta cantidad necesito para el cambio?',
      '¿Tienen la marca que prefiero?',
    ],
    articulo: ART_DATOS,
  },
  {
    id: 'carroceria',
    titulo: 'carrocería e iluminación',
    match: ['parachoque', 'capot', 'puerta', 'faro', 'foco', 'stop', 'retrovisor', 'espejo', 'guardafango', 'mascara', 'cocuyo', 'bombillo', 'optica', 'emblema'],
    queEs:
      'Las piezas de carrocería e iluminación cambian con el año del modelo y los rediseños ("facelift"). Una pieza de un año distinto puede no calzar aunque parezca igual.',
    confirmar: [
      'Año exacto del vehículo (los rediseños cambian la pieza).',
      'Lado: derecho o izquierdo.',
      'Si es importado u original, por las diferencias de ajuste.',
      'Color o acabado cuando aplique.',
    ],
    preguntas: [
      '¿Es para mi año exacto de modelo?',
      '¿Es del lado correcto (der./izq.)?',
      '¿Tienen fotos del estado real de la pieza?',
    ],
    articulo: ART_DATOS,
  },
]

// Tipo por defecto cuando no se reconoce la categoría.
const TIPO_GENERAL = {
  id: 'general',
  titulo: 'repuesto automotriz',
  queEs:
    'Para confirmar que este repuesto sirve para tu vehículo conviene dar datos precisos. Una misma línea puede usar piezas distintas según el motor, la versión y el año.',
  confirmar: [
    'Marca, modelo y año exacto del vehículo.',
    'Tipo de motor (cilindrada y si es gasolina o diésel).',
    'Versión o nivel de equipamiento.',
    'Una foto de la pieza usada cuando sea posible.',
  ],
  preguntas: [
    '¿Sirve para mi modelo, año y motor exactos?',
    '¿Es nuevo, alternativo o usado?',
    '¿Tiene garantía o condiciones de cambio?',
  ],
  articulo: ART_DATOS,
}

export function detectarTipo({ categoria, descripcion } = {}) {
  const texto = `${norm(categoria)} ${norm(descripcion)}`
  for (const tipo of TIPOS) {
    if (tipo.match.some((kw) => texto.includes(norm(kw)))) return tipo
  }
  return TIPO_GENERAL
}

// Construye una etiqueta legible del vehículo a partir de los campos disponibles.
export function vehiculoLabel({ marca, modelos, vehiculo } = {}) {
  const partes = []
  if (marca && norm(marca) !== 'todos' && norm(marca) !== 'todas') partes.push(String(marca).trim())
  const modelo = modelos || (vehiculo && norm(vehiculo) !== 'carro' && norm(vehiculo) !== 'moto' ? vehiculo : '')
  if (modelo) partes.push(String(modelo).trim())
  return partes.join(' · ').slice(0, 80)
}

export function getRepuestoGuia(data = {}) {
  const tipo = detectarTipo(data)
  return {
    tipoId: tipo.id,
    titulo: tipo.titulo,
    queEs: tipo.queEs,
    confirmar: tipo.confirmar,
    preguntas: tipo.preguntas,
    articulo: tipo.articulo,
    vehiculo: vehiculoLabel(data),
  }
}
