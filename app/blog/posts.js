// Contenido de los artículos del blog. Fuente única para el índice (/blog) y
// las páginas de detalle (/blog/[slug]). Texto original y útil para mejorar la
// calidad del sitio y la experiencia del lector.

export const POSTS = [
  {
    slug: 'pastillas-de-freno-correctas',
    title: 'Cómo elegir las pastillas de freno correctas y no comprar la pieza equivocada',
    category: 'Frenos',
    date: '2026-06-26',
    readingMinutes: 6,
    excerpt:
      'Antes de cotizar, revisa modelo, año, sistema de freno, desgaste del disco y si la pieza lleva sensor. Una guía clara para pedir las pastillas correctas a la primera.',
    hero: {
      src: '/blog/pastillas-de-freno-correctas/hero.webp',
      alt: 'Carro sobre rampa de taller con la rueda delantera retirada para revisar los frenos',
    },
    keywords: ['pastillas de freno', 'frenos', 'discos de freno', 'repuestos Mérida', 'compatibilidad de frenos'],
    intro:
      'Las pastillas de freno son una de las piezas que más se piden mal. Parecen un repuesto sencillo, pero un mismo modelo de carro puede usar varias pastillas distintas según el motor, la versión o el año. Comprar la equivocada significa perder tiempo, dinero y, en el peor caso, manejar con un freno que no responde como debe. En esta guía te explicamos los datos que necesitas reunir antes de cotizar y cómo evitar los errores más comunes.',
    sections: [
      {
        heading: 'Por qué una misma línea usa pastillas diferentes',
        paragraphs: [
          'Los fabricantes cambian el sistema de freno con frecuencia: un carro del mismo modelo puede traer discos más grandes en su versión deportiva, otro tipo de pinza (caliper) según el motor, o un sensor de desgaste que la versión básica no tiene. Por eso, decir solo "necesito pastillas para mi carro" casi nunca alcanza.',
          'La clave está en describir el conjunto de freno, no solo el vehículo. Mientras más preciso seas, menos vueltas dará el vendedor para confirmar la pieza y más rápido tendrás una cotización confiable.',
        ],
      },
      {
        heading: 'Los 5 datos que definen tus pastillas',
        paragraphs: [
          'Reúne esta información antes de escribir a un comercio. Con estos cinco puntos, la mayoría de los repuestos se identifican sin margen de error:',
          '1. Marca, modelo y año exacto del vehículo. 2. Tipo de motor y versión (por ejemplo, 1.6, 2.0, turbo, full equipo). 3. Si las pastillas que buscas son delanteras o traseras. 4. Si el sistema lleva sensor de desgaste (un cablecito que avisa cuando la pastilla está gastada). 5. Una foto de la pastilla usada, vista de frente y de canto.',
          'Ese último punto es el que más ayuda. La forma de la pastilla, la posición de los seguros y la presencia de sensores se confirman de un vistazo con una buena foto.',
        ],
        image: {
          src: '/blog/pastillas-de-freno-correctas/disco.webp',
          alt: 'Primer plano de un disco y una pinza de freno en un vehículo dentro del taller',
          caption: 'Fotografiar el disco y la pinza ayuda al vendedor a confirmar la medida y el tipo de sistema.',
        },
      },
      {
        heading: 'Cerámico, semimetálico u orgánico: cuál te conviene',
        paragraphs: [
          'El compuesto de la pastilla cambia el comportamiento del freno. Las pastillas cerámicas son silenciosas, sueltan menos polvo y duran bastante; suelen ser la mejor opción para uso diario en ciudad. Las semimetálicas frenan muy bien en frío y aguantan más calor, ideales para carga o manejo exigente, pero pueden hacer algo más de ruido y desgastar un poco más el disco.',
          'Las orgánicas son las más económicas y suaves, aunque se gastan más rápido. Cuando pidas tu cotización, indica qué uso le das al vehículo: no es lo mismo un carro que sube y baja Mérida cargado todos los días que uno que solo se mueve en plano. El vendedor podrá recomendarte el compuesto adecuado.',
        ],
      },
      {
        heading: 'Señales de que ya toca cambiarlas',
        paragraphs: [
          'No esperes a quedarte sin freno. Cambia las pastillas cuando notes un chillido metálico constante al frenar, una vibración en el pedal, que el carro "jala" hacia un lado, o que el pedal se va más al fondo de lo normal. Si tu tablero tiene testigo de frenos y se enciende, atiéndelo de inmediato.',
          'Una pastilla muy gastada deja de tener material de fricción y empieza a rozar metal contra metal, lo que daña el disco y encarece la reparación. Revisar a tiempo es siempre más barato.',
        ],
        image: {
          src: '/blog/pastillas-de-freno-correctas/taller.webp',
          alt: 'Manos con guantes comparando dos pastillas de freno sobre un banco de trabajo ordenado',
          caption: 'Comparar la pastilla nueva con la usada confirma forma, medidas y posición de los seguros.',
        },
      },
      {
        heading: 'Revisa el disco antes de instalar',
        paragraphs: [
          'Montar pastillas nuevas sobre un disco rayado o "alabeado" (deformado) es la receta para el ruido y la vibración. Antes de instalar, pide que revisen el espesor del disco y si necesita rectificado o cambio. Muchas veces el comercio puede cotizarte el juego completo (pastillas y discos) para que resuelvas de una sola vez.',
          'Si vas a cambiar las pastillas, es buen momento para revisar también el líquido de frenos y el estado de las gomas de la pinza.',
        ],
      },
      {
        heading: 'Cómo pedir la cotización sin errores',
        paragraphs: [
          'Con los cinco datos y un par de fotos listos, escribir al comercio toma un minuto y la respuesta llega mucho más rápido. En Repuestos Mérida puedes publicar tu solicitud para que varios comercios la vean, o contactar directo por WhatsApp al que tenga la pieza disponible.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Puedo usar pastillas de otra marca compatible?',
        a: 'Sí. Existen marcas alternativas de buena calidad que cumplen las mismas medidas. Lo importante es que coincidan la forma, el grosor y la presencia o no de sensor. Pide al vendedor que confirme la equivalencia.',
      },
      {
        q: '¿Cada cuánto se cambian las pastillas de freno?',
        a: 'Depende del uso, pero en ciudad suele ser entre 20.000 y 40.000 km. El manejo en pendientes, como en Mérida, puede acortar ese intervalo. Revísalas en cada mantenimiento.',
      },
      {
        q: '¿Debo cambiar también los discos?',
        a: 'No siempre. Si el disco conserva su espesor mínimo y no está rayado ni deformado, puede rectificarse o reutilizarse. Si está por debajo del límite, lo recomendable es cambiarlo junto con las pastillas.',
      },
    ],
  },

  {
    slug: 'datos-para-ubicar-repuestos-merida',
    title: 'Qué datos enviar para ubicar el repuesto de tu carro en Mérida',
    category: 'Compatibilidad',
    date: '2026-06-25',
    readingMinutes: 6,
    excerpt:
      'Marca, modelo, año, motor, serial y una buena foto: la combinación que reduce errores y acelera la respuesta cuando buscas un repuesto.',
    hero: {
      src: '/blog/datos-para-ubicar-repuestos-merida/hero.webp',
      alt: 'Persona fotografiando el motor de un carro con el teléfono para identificar un repuesto',
    },
    keywords: ['compatibilidad de repuestos', 'cómo pedir repuestos', 'VIN', 'serial del vehículo', 'repuestos Mérida'],
    intro:
      'La diferencia entre recibir una cotización en minutos o pasar el día confirmando datos está en cómo pides el repuesto. Una misma línea de vehículo puede cambiar piezas según el motor, la transmisión, la versión y hasta el país de origen. Enviar datos completos desde el primer mensaje le ahorra trabajo al vendedor y te ahorra a ti compras equivocadas. Aquí tienes exactamente qué incluir.',
    sections: [
      {
        heading: 'El problema: una misma línea, muchas piezas',
        paragraphs: [
          'Pensar que "es un carro común, seguro tienen la pieza" es el error más frecuente. Justamente porque es común, existen muchas variantes: dos años de diferencia pueden cambiar el alternador, el tipo de inyección o la medida del rodamiento. Sin datos precisos, el vendedor tiene que adivinar, y adivinar lleva a errores.',
          'La buena noticia es que con cinco o seis datos bien dados, casi cualquier repuesto se identifica con seguridad.',
        ],
      },
      {
        heading: 'Los datos básicos que nunca deben faltar',
        paragraphs: [
          'Empieza siempre por lo esencial: marca, modelo, año, tipo de motor (cilindrada y si es gasolina o diésel) y la versión o nivel de equipamiento. Indica también la transmisión (sincrónica o automática) cuando la pieza pueda depender de ella.',
          'Por último, di con claridad qué pieza buscas y para qué zona del carro. "Bomba de agua", "rodamiento delantero derecho" o "foco de cruce" son descripciones que orientan mucho mejor que "una pieza del motor".',
        ],
        image: {
          src: '/blog/datos-para-ubicar-repuestos-merida/documentos.webp',
          alt: 'Escritorio con un teléfono, una libreta y un bolígrafo para anotar los datos del vehículo',
          caption: 'Tener a mano los datos del vehículo antes de escribir agiliza toda la cotización.',
        },
      },
      {
        heading: 'El serial (VIN) y dónde encontrarlo',
        paragraphs: [
          'El número de serial o VIN es la huella única de tu vehículo y permite confirmar la configuración exacta de fábrica. Suele estar en el parabrisas del lado del conductor, en el marco de la puerta del conductor, en los documentos de propiedad y, en muchos carros, grabado en el chasis.',
          'No siempre es necesario, pero cuando la pieza tiene muchas variantes, compartir el serial elimina dudas. Si prefieres no enviarlo completo por privacidad, al menos ten claros el motor y la versión.',
        ],
      },
      {
        heading: 'La foto que vale por mil palabras',
        paragraphs: [
          'Una foto nítida de la pieza usada resuelve lo que el texto no alcanza a describir. Toma la imagen con buena luz, de frente y de canto, e incluye los conectores, seguros o números grabados que tenga. Si la pieza es pequeña, ponla junto a una moneda o una regla para dar referencia de tamaño.',
          'Cuando la pieza ya no esté en el carro, una foto del espacio donde va también ayuda. El vendedor podrá confirmar el modelo correcto comparando formas y conexiones.',
        ],
        image: {
          src: '/blog/datos-para-ubicar-repuestos-merida/estanteria.webp',
          alt: 'Estantes de una tienda de repuestos con cajas de piezas organizadas',
          caption: 'Con datos claros, el comercio ubica más rápido la pieza correcta en su inventario.',
        },
      },
      {
        heading: 'Original, alternativo o usado: cómo decidir',
        paragraphs: [
          'Indica desde el principio qué tipo de repuesto buscas. El original (OEM) ofrece el mejor ajuste y suele tener garantía, a un precio más alto. El alternativo de buena marca da un equilibrio entre precio y calidad. El usado en buen estado es la opción más económica y a veces la única para modelos antiguos.',
          'Decir "busco original o alternativo, lo que esté disponible con garantía" le da al vendedor margen para ofrecerte la mejor opción según su inventario.',
        ],
      },
      {
        heading: 'Plantilla lista para copiar y pegar',
        paragraphs: [
          'Para que no se te escape nada, usa este formato al escribir tu solicitud: "Hola, busco [pieza] para [marca] [modelo] [año], motor [cilindrada / gasolina o diésel], versión [versión], transmisión [sincrónica/automática]. ¿Tienen disponible original o alternativo con garantía? Adjunto foto de la pieza."',
          'En Repuestos Mérida puedes publicar esa solicitud una sola vez y dejar que varios comercios de la ciudad respondan con su disponibilidad y precio.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Es obligatorio dar el serial del vehículo?',
        a: 'No siempre. Para piezas con muchas variantes ayuda mucho, pero en la mayoría de los casos basta con marca, modelo, año, motor y una buena foto.',
      },
      {
        q: '¿Cómo sé qué motor tiene mi carro?',
        a: 'Suele aparecer en los documentos del vehículo y en una etiqueta dentro del vano del motor. Si tienes dudas, indica la versión y el año: el vendedor puede orientarte.',
      },
      {
        q: '¿Conviene comprar repuesto usado?',
        a: 'Para modelos antiguos o piezas difíciles de conseguir, el usado en buen estado es una alternativa válida. Pide fotos, pregunta por prueba y condiciones de cambio antes de comprar.',
      },
    ],
  },

  {
    slug: 'fallas-electricas-alternador-bateria',
    title: 'Alternador, arranque o batería: cómo describir una falla eléctrica',
    category: 'Sistema eléctrico',
    date: '2026-06-24',
    readingMinutes: 7,
    excerpt:
      'Muchas fallas eléctricas se parecen entre sí. Aprende a distinguir los síntomas y qué medir para pedir el repuesto correcto sin adivinar.',
    hero: {
      src: '/blog/fallas-electricas-alternador-bateria/hero.webp',
      alt: 'Vano del motor enfocado en la batería con un multímetro al lado',
    },
    keywords: ['falla eléctrica', 'alternador', 'batería', 'motor de arranque', 'multímetro', 'repuestos Mérida'],
    intro:
      'Cuando un carro "no enciende" o "se queda sin corriente", el culpable suele ser uno de tres: la batería, el alternador o el motor de arranque. Los síntomas se confunden con facilidad y cambiar la pieza equivocada es un gasto evitable. Esta guía te ayuda a identificar de cuál se trata y a reunir la información correcta antes de cotizar el repuesto.',
    sections: [
      {
        heading: 'Tres culpables que se confunden',
        paragraphs: [
          'La batería almacena la energía; el alternador la genera mientras el motor trabaja y mantiene la batería cargada; el motor de arranque es el que hace girar el motor para que encienda. Como los tres están conectados en la misma cadena, una falla en uno produce síntomas que parecen de otro.',
          'La clave para no equivocarte es observar cuándo y cómo ocurre el problema: al intentar arrancar, después de un rato manejando, o solo cuando el carro estuvo parado varias horas.',
        ],
      },
      {
        heading: 'Síntomas típicos de batería',
        paragraphs: [
          'Si el carro arranca con dificultad por las mañanas, las luces se ven débiles antes de encender, o necesitó "auxilio" (puente) y luego funcionó bien, lo más probable es que el problema sea la batería. Una batería vieja (más de tres o cuatro años) o con bornes sulfatados pierde capacidad poco a poco.',
          'Una pista clara: si das puente y el carro enciende y se mantiene encendido sin problemas, la batería es la principal sospechosa.',
        ],
        image: {
          src: '/blog/fallas-electricas-alternador-bateria/multimetro.webp',
          alt: 'Manos con guantes midiendo una batería de carro con un multímetro digital',
          caption: 'Con un multímetro puedes medir el voltaje de la batería en reposo y con el motor encendido.',
        },
      },
      {
        heading: 'Síntomas típicos de alternador',
        paragraphs: [
          'Si el carro enciende bien pero el testigo de batería del tablero se mantiene encendido en marcha, las luces pierden intensidad mientras manejas, o el vehículo se apaga después de un rato (y la batería queda descargada), el alternador puede estar fallando.',
          'El alternador no carga: la batería se va vaciando mientras manejas hasta que el carro se queda sin energía. A veces también se escucha un chillido o un ruido de rodamiento proveniente de esa zona.',
        ],
      },
      {
        heading: 'Síntomas típicos del motor de arranque',
        paragraphs: [
          'Si al girar la llave escuchas un "clic" seco y el motor no gira, o se oye un ruido metálico sin que el motor llegue a arrancar, pero las luces y la radio funcionan con normalidad, la sospecha apunta al motor de arranque.',
          'En este caso la batería tiene energía (las luces encienden bien), pero el componente que pone en marcha el motor no responde. A veces falla de forma intermitente: arranca al segundo o tercer intento.',
        ],
        image: {
          src: '/blog/fallas-electricas-alternador-bateria/alternador.webp',
          alt: 'Alternador de carro sobre un banco de trabajo bajo una lámpara enfocada',
          caption: 'Describir bien el síntoma evita cambiar el alternador cuando el problema era otro.',
        },
      },
      {
        heading: 'Qué medir y reportar',
        paragraphs: [
          'Si tienes un multímetro, dos mediciones sencillas orientan mucho. Con el motor apagado, una batería sana marca alrededor de 12,4 a 12,7 voltios. Con el motor encendido, el sistema debería subir a unos 13,8 a 14,5 voltios: si no sube, el alternador podría no estar cargando.',
          'Anota esos valores y, si puedes, toma una foto del conector o de la pieza. Reportar voltajes medidos convierte un "creo que es el alternador" en un diagnóstico que el vendedor puede respaldar.',
        ],
      },
      {
        heading: 'Cómo describirlo al pedir el repuesto',
        paragraphs: [
          'Reúne: marca, modelo, año y motor del vehículo; el síntoma exacto (cuándo ocurre y qué escuchas o ves); los voltajes si los mediste; y una foto de la pieza o del conector. Indica también si buscas la pieza nueva, reconstruida o usada, y si te interesa garantía o prueba en banco.',
          'Con esa descripción, en Repuestos Mérida puedes publicar tu solicitud o escribir directo al comercio que tenga el repuesto, y recibir una respuesta precisa sin tener que ir probando piezas.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Cómo sé si es la batería o el alternador?',
        a: 'Si el carro enciende con puente y se mantiene encendido, suele ser la batería. Si enciende pero el testigo de batería queda prendido y luego se descarga en marcha, apunta al alternador. Medir voltajes confirma el diagnóstico.',
      },
      {
        q: '¿Sirve un alternador reconstruido?',
        a: 'Sí, un alternador reconstruido por un taller serio y con garantía es una opción común y económica. Pregunta por la prueba en banco y las condiciones de cambio.',
      },
      {
        q: '¿Cuánto dura una batería de carro?',
        a: 'Por lo general entre tres y cinco años, según el uso, el clima y el mantenimiento de los bornes. Si la tuya tiene más de tres años y notas arranques lentos, conviene revisarla.',
      },
    ],
  },

  {
    slug: 'como-usar-plaza-repuestos-merida',
    title: 'Cómo usar Plaza en Repuestos Mérida: guía paso a paso',
    category: 'Guía de la app',
    date: '2026-06-26',
    readingMinutes: 7,
    excerpt:
      'Plaza es el tablón de la comunidad de Repuestos Mérida: vende, ofrece servicios, publica empleos o solicita lo que buscas, y contacta por WhatsApp. Te explicamos cómo funciona hoy, paso a paso.',
    hero: {
      src: '/blog/como-usar-plaza-repuestos-merida/hero.webp',
      alt: 'Persona usando un teléfono con una cuadrícula de anuncios tipo clasificados',
    },
    keywords: ['Plaza', 'cómo usar Plaza', 'clasificados Mérida', 'vender repuestos', 'publicar anuncio', 'Repuestos Mérida'],
    intro:
      'Plaza es el espacio de clasificados de la comunidad de Repuestos Mérida. Funciona como un tablón local donde cualquier usuario verificado puede vender algo, ofrecer un servicio, publicar una oferta de empleo o solicitar lo que está buscando. Todo el contacto se cierra de forma directa por WhatsApp, sin intermediarios. En esta guía recorremos, paso a paso, cómo está funcionando Plaza hoy: desde explorar el feed hasta publicar y administrar tus propios anuncios.',
    sections: [
      {
        heading: '¿Qué es Plaza y para qué sirve?',
        paragraphs: [
          'Mientras el catálogo principal y el mapa de comercios se centran en repuestos y tiendas, Plaza es más amplio: es el tablón abierto de la comunidad. Ahí conviven cuatro tipos de publicaciones: "Se vende" (vendes un artículo), "Se ofrece" (ofreces un servicio, como mecánica, latonería o electricidad automotriz), "Empleo" (ofreces un puesto de trabajo) y "Se solicita" (buscas algo puntual y pides que te contacten).',
          'La utilidad para Mérida es directa: conecta a vecinos, talleres, técnicos y comercios de la ciudad en un mismo lugar. Si tienes un repuesto usado en buen estado, un servicio que ofrecer o necesitas conseguir una pieza difícil, Plaza te da visibilidad local sin pagar comisiones por venta.',
        ],
      },
      {
        heading: 'Paso 1: Explora el feed',
        paragraphs: [
          'Al entrar a Plaza verás un muro con todas las publicaciones recientes en forma de tarjetas. Cada tarjeta muestra una foto, el título, el precio, la categoría (con su emoji) y una etiqueta de color que indica el tipo: "Se vende", "Busca", "Solicita" o "Empleo". Si un anuncio ya no está activo, aparece marcado como "No disponible".',
          'Arriba tienes filtros rápidos por tipo (Empleo, Se vende, Se solicita) y por categorías como Transporte, Oficios, Comercio/Productos, Hogar, Salud o Gastronomía, además de un buscador para encontrar algo por palabra clave. Así puedes pasar de "ver todo" a enfocarte solo en lo que te interesa.',
        ],
      },
      {
        heading: 'Paso 2: Contacta al anunciante',
        paragraphs: [
          'Cuando un anuncio te interese, toca su botón de WhatsApp. Plaza abre el chat con un mensaje ya redactado, del estilo "Hola, vi el anuncio: [título] en Plaza – Repuestos Mérida. ¿Está disponible?", para que solo tengas que enviarlo. La conversación sigue directamente entre tú y el anunciante; Repuestos Mérida no se mete en la negociación ni cobra comisión.',
          'Algunas publicaciones también permiten dejar un comentario público, útil para preguntas rápidas que pueden interesar a otros. Para cerrar la compra o el servicio, lo recomendable es siempre el WhatsApp directo.',
        ],
        image: {
          src: '/blog/como-usar-plaza-repuestos-merida/contacto.webp',
          alt: 'Manos sosteniendo un teléfono en una conversación de mensajería',
          caption: 'El contacto se cierra por WhatsApp, con un mensaje ya preparado para el anuncio.',
        },
      },
      {
        heading: 'Paso 3: Prepárate para publicar',
        paragraphs: [
          'Para publicar necesitas una cuenta y estar verificado. La primera vez, Plaza te pedirá iniciar sesión con tu número de teléfono (recibes un código por WhatsApp), completar tu registro y pasar la verificación de cédula. Este paso existe para mantener la comunidad seria y reducir anuncios falsos: quien publica está identificado.',
          'Es un trámite que haces una sola vez. Después, publicar te tomará apenas un par de minutos.',
        ],
      },
      {
        heading: 'Paso 4: Crea tu publicación (formulario en 2 pasos)',
        paragraphs: [
          'El formulario de publicación está dividido en dos pasos sencillos. En el Paso 1 eliges el tipo de publicación (Vendo algo, Ofrezco un servicio, Ofrezco empleo o Busco algo / solicito) y completas los datos: título, descripción, precio y categoría. Estos campos son obligatorios para poder continuar, así que conviene ser claro y específico.',
          'En el Paso 2 agregas las fotos: puedes subir hasta tres imágenes. Una buena foto, con luz y desde un ángulo claro, marca la diferencia entre un anuncio que se ignora y uno que recibe mensajes. Cuando confirmas, tu publicación queda creada y visible en el feed de Plaza al instante.',
        ],
        image: {
          src: '/blog/como-usar-plaza-repuestos-merida/publicar.webp',
          alt: 'Manos fotografiando un objeto con el teléfono para publicar un anuncio',
          caption: 'En el segundo paso puedes subir hasta tres fotos del artículo o servicio.',
        },
      },
      {
        heading: 'Paso 5: Administra tus anuncios',
        paragraphs: [
          'Desde la sección "Mis anuncios" puedes ver todo lo que has publicado y mantenerlo al día. Cuando algo ya se vendió o el puesto se cubrió, márcalo como no disponible para que la tarjeta deje de aparecer como activa. Mantener tus publicaciones actualizadas evita mensajes por cosas que ya no ofreces y mejora la experiencia de toda la comunidad.',
        ],
      },
      {
        heading: 'Consejos para que tu anuncio funcione',
        paragraphs: [
          'Usa un título concreto ("Alternador usado para Aveo 1.6" funciona mejor que "vendo repuesto"). Escribe una descripción honesta con el estado real del artículo o los detalles del servicio. Pon un precio: los anuncios sin precio generan menos confianza. Elige bien la categoría para que te encuentren los filtros. Y sube fotos reales y nítidas.',
          'Cuanta más claridad des desde el anuncio, menos preguntas básicas recibirás y más rápido llegarás a un acuerdo.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Cuánto cuesta publicar en Plaza?',
        a: 'Publicar en Plaza es gratuito. Repuestos Mérida no cobra comisión por las ventas: el trato se cierra directamente entre las partes por WhatsApp.',
      },
      {
        q: '¿Por qué me piden verificar mi identidad para publicar?',
        a: 'La verificación con teléfono y cédula mantiene la comunidad seria y reduce los anuncios falsos. Es un paso que se hace una sola vez; luego publicar toma un par de minutos.',
      },
      {
        q: '¿Solo se pueden publicar repuestos?',
        a: 'No. Además de artículos, en Plaza puedes ofrecer servicios (mecánica, latonería, electricidad), publicar ofertas de empleo o solicitar algo que estés buscando.',
      },
      {
        q: '¿Cómo retiro un anuncio que ya se vendió?',
        a: 'Entra a "Mis anuncios" y marca la publicación como no disponible. Así dejará de mostrarse como activa en el feed.',
      },
    ],
  },
]

export function getPost(slug) {
  return POSTS.find((p) => p.slug === slug) || null
}

export function getAllSlugs() {
  return POSTS.map((p) => p.slug)
}
