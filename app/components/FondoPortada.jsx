'use client'

import { useEffect, useRef } from 'react'

// Fondo de la portada: pasa fotos de Mérida en un orden al azar distinto en
// cada visita y en bucle cerrado. Cuando terminan de bajar las de Firebase
// (GIF, WebP o video), el bucle sigue solo con esas.
//
// Pensado para teléfonos de gama baja:
//  - La primera foto la elige un guion dentro del HTML, así empieza a bajar
//    antes de que cargue React.
//  - Solo hay dos capas. Los cambios (barrido con filo de luz, subida,
//    acercamiento o esfera que crece, al azar), la foto que entra iluminada y luego
//    se oscurece y el movimiento 3D de cada foto solo animan transform y
//    opacity: los hace la GPU sin repintar. Con 2 GB de memoria o menos se
//    quedan en un fundido simple.
//  - Lo de Firebase se baja de uno en uno, después de que la página cargó,
//    y no se baja con ahorro de datos, red lenta o poca memoria.
//  - Se detiene cuando la portada no se ve o la pestaña está en segundo plano.
//  - Con «reducir movimiento» se queda en la primera foto.

const DURACION_IMAGEN = 7000
const DURACION_MAXIMA_VIDEO = 30000
const TRANSICION = 1400
const LADO_BRILLO = 160
const SUAVE = 'cubic-bezier(0.77, 0, 0.175, 1)'
const CLASE_MEDIO = 'h-full w-full object-cover'
// Capa oscura de cada foto, para que el texto blanco se lea sobre cualquiera.
const CLASE_VELO =
  'absolute inset-0 bg-gradient-to-b from-gray-950/75 via-gray-950/60 to-gray-950/80 md:bg-gradient-to-r md:from-gray-950/85 md:via-gray-950/60 md:to-gray-950/30'
// La foto que entra llega iluminada y, cuando ya se asentó, se oscurece. No
// llega del todo sin capa: probado en el teléfono, con una foto de mucho cielo
// el título blanco desaparecía.
const ILUMINADA = 1900
const OSCURECE = 1300
const VELO_AL_ENTRAR = 0.35

// Filo de luz amarilla que va al frente del barrido. Está por encima de la capa
// oscura (si no, el amarillo se apagaría), en un marco del tamaño del fondo que
// se mueve igual que la foto que entra.
function crearDestello(raiz, vertical) {
  const marco = document.createElement('div')
  marco.className = 'pointer-events-none absolute inset-0'
  const luz = document.createElement('div')
  luz.className = vertical
    ? 'absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-yellow/80 via-brand-yellow/25 to-transparent'
    : 'absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-brand-yellow/80 via-brand-yellow/25 to-transparent sm:w-44'
  // Línea blanca con resplandor justo en el borde: se pinta una vez y luego solo se mueve.
  const filo = document.createElement('div')
  filo.className = vertical
    ? 'absolute inset-x-0 top-0 h-[3px] bg-white shadow-[0_0_28px_8px_rgba(255,215,0,0.85)]'
    : 'absolute inset-y-0 left-0 w-[3px] bg-white shadow-[0_0_28px_8px_rgba(255,215,0,0.85)]'
  marco.append(luz, filo)
  raiz.append(marco)
  return marco
}

function barrido(vertical) {
  const eje = vertical ? 'translateY' : 'translateX'
  return (entra, interior, sale, raiz) => {
    const t = { duration: TRANSICION, easing: SUAVE, fill: 'both' }
    const destello = crearDestello(raiz, vertical)
    const luz = destello.animate(
      [
        { transform: `${eje}(100%)`, opacity: 1 },
        { transform: `${eje}(12%)`, opacity: 1, offset: 0.8 },
        { transform: `${eje}(0)`, opacity: 0 },
      ],
      t,
    )
    luz.finished.finally(() => destello.remove()).catch(() => {})
    return [
      // La capa que entra se desliza y la foto de adentro va al revés: se
      // descubre quieta, como si se corriera una cortina.
      entra.animate([{ transform: `${eje}(100%)` }, { transform: `${eje}(0)` }], t),
      interior.animate([{ transform: `${eje}(-100%)` }, { transform: `${eje}(0)` }], t),
      sale.animate([{ transform: `${eje}(0)` }, { transform: `${eje}(-18%)` }], t),
      luz,
    ]
  }
}

const EFECTOS = {
  barrido: barrido(false),
  subida: barrido(true),
  // La foto nueva aparece en el centro como una esfera pequeña (con brillo y
  // sombra de bola, y la foto adentro girando como un globo) y crece hasta
  // cubrir todo. El círculo es un recorte redondo que solo se escala: sigue
  // siendo transform, sin repintar.
  esfera: (entra, interior, sale, raiz) => {
    const t = { duration: TRANSICION + 200, easing: SUAVE, fill: 'both' }
    const ancho = raiz.clientWidth
    const alto = raiz.clientHeight
    const diametro = Math.ceil(Math.hypot(ancho, alto))
    const bola = document.createElement('div')
    bola.className = 'absolute overflow-hidden rounded-full'
    Object.assign(bola.style, {
      width: `${diametro}px`,
      height: `${diametro}px`,
      left: `${(ancho - diametro) / 2}px`,
      top: `${(alto - diametro) / 2}px`,
    })
    Object.assign(interior.style, {
      inset: 'auto',
      left: `${(diametro - ancho) / 2}px`,
      top: `${(diametro - alto) / 2}px`,
      width: `${ancho}px`,
      height: `${alto}px`,
    })
    // El brillo se pinta chico (LADO_BRILLO px) y la GPU lo estira al tamaño de la
    // bola: un degradado borroso no pierde nada, y así no se rasteriza una capa
    // del tamaño de la diagonal (en el Motorola, ~2600 px por lado), que era lo
    // que daba un tirón de hasta 400 ms.
    const brillo = document.createElement('div')
    brillo.className =
      'pointer-events-none absolute left-0 top-0 origin-top-left rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.6),rgba(255,255,255,0.1)_30%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.6)_100%)]'
    Object.assign(brillo.style, {
      width: `${LADO_BRILLO}px`,
      height: `${LADO_BRILLO}px`,
      transform: `scale(${diametro / LADO_BRILLO})`,
      willChange: 'transform',
      opacity: '0',
    })
    entra.insertBefore(bola, interior)
    bola.append(interior, brillo)
    const crece = bola.animate([{ transform: 'scale(0.06) rotate(-35deg)' }, { transform: 'scale(1) rotate(0deg)' }], t)
    crece.finished.then(() => {
      // Ya cubre todo: fuera el brillo y el recorte redondo, que solo cuesta mientras crece.
      brillo.remove()
      bola.classList.remove('rounded-full')
    }, () => {})
    return [
      crece,
      // Giro en 2D: un rotateY con perspectiva dentro del recorte redondo obligaba
      // a Chrome a armar un contexto 3D enmascarado, y daba tirones en el teléfono.
      interior.animate([{ transform: 'rotate(25deg) scale(1.15)' }, { transform: 'rotate(0deg) scale(1)' }], t),
      brillo.animate([{ opacity: 1 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], t),
      sale.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }], t),
    ]
  },
  acercamiento: (entra, interior, sale) => {
    const t = { duration: TRANSICION, easing: SUAVE, fill: 'both' }
    return [
      entra.animate([{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(1)' }], t),
      sale.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.12)' }], t),
    ]
  },
  fundido: (entra) => [entra.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200, easing: 'ease-out', fill: 'both' })],
}

// Movimiento 3D lento mientras se ve la foto: gira unos grados en perspectiva,
// como una cámara que flota frente al paisaje, cada vez hacia otro lado. La
// escala tapa los bordes que el giro dejaría a la vista. La primera foto arranca
// quieta (es como la pintó el HTML) para que no dé un salto al cargar React.
function movimiento3d(medio, duracion, desdeQuieta) {
  const signo = () => (Math.random() < 0.5 ? -1 : 1)
  const giroY = signo() * (3 + Math.random() * 3)
  const giroX = signo() * (1.5 + Math.random() * 2)
  const dx = (Math.random() * 4 - 2).toFixed(1)
  const dy = (Math.random() * 3 - 1.5).toFixed(1)
  const desde = desdeQuieta ? 'scale(1) rotateY(0deg) rotateX(0deg)' : `scale(1.16) rotateY(${-giroY}deg) rotateX(${giroX}deg)`
  return medio.animate(
    [{ transform: desde }, { transform: `scale(1.24) rotateY(${giroY}deg) rotateX(${-giroX}deg) translate3d(${dx}%, ${dy}%, 0)` }],
    { duration: duracion, easing: 'ease-in-out', fill: 'both' },
  )
}
const EVENTOS_INTERACCION = ['pointerdown', 'keydown', 'scroll', 'wheel']

function barajar(n) {
  const orden = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[orden[i], orden[j]] = [orden[j], orden[i]]
  }
  return orden
}

// Corre mientras el navegador lee el HTML: baraja las fotos y pone la primera.
function guionPrimeraFoto(lista) {
  const datos = JSON.stringify(lista.map((f) => [f.src, f.srcMovil, f.nombre])).replace(/</g, '\\u003c')
  return `(function(){try{var l=${datos},o=[],i,j,t;for(i=0;i<l.length;i++)o.push(i);for(i=o.length-1;i>0;i--){j=Math.floor(Math.random()*(i+1));t=o[i];o[i]=o[j];o[j]=t}
var f=l[o[0]],m=window.matchMedia('(max-width: 767px)').matches,img=document.getElementById('fondo-portada-primera');
img.src=m?f[1]:f[0];var n=document.getElementById('fondo-portada-nombre');if(n)n.setAttribute('data-nombre',f[2]);
window.__fondoPortada={orden:o};}catch(e){}})()`
}

function conexionPermiteMedios() {
  const c = navigator.connection
  if (c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ''))) return false
  if (navigator.deviceMemory && navigator.deviceMemory < 2) return false
  return true
}

function crearMedio(item, movil) {
  if (item.tipo === 'video') {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.setAttribute('aria-hidden', 'true')
    v.className = CLASE_MEDIO
    v.src = movil && item.srcMovil ? item.srcMovil : item.src
    return v
  }
  const img = new Image()
  img.alt = ''
  img.decoding = 'async'
  img.className = CLASE_MEDIO
  img.src = movil && item.srcMovil ? item.srcMovil : item.src
  return img
}

// Espera a que el medio pueda pintarse sin saltos; si tarda demasiado, lo da por perdido.
function esperarListo(medio, limite) {
  return new Promise((ok) => {
    const reloj = setTimeout(() => ok(false), limite)
    const listo = (valor) => {
      clearTimeout(reloj)
      ok(valor)
    }
    if (medio instanceof HTMLVideoElement) {
      medio.addEventListener('canplaythrough', () => listo(true), { once: true })
      medio.addEventListener('error', () => listo(false), { once: true })
      medio.load()
    } else {
      medio.decode().then(() => listo(true), () => listo(medio.complete && medio.naturalWidth > 0))
    }
  })
}

export default function FondoPortada({ porDefecto, remotos }) {
  const raiz = useRef(null)
  const capaA = useRef(null)
  const capaB = useRef(null)
  const nombre = useRef(null)

  useEffect(() => {
    const capas = [capaA.current, capaB.current]
    const movil = window.matchMedia('(max-width: 767px)').matches
    const ordenPorDefecto = window.__fondoPortada?.orden ?? barajar(porDefecto.length)
    const primera = document.getElementById('fondo-portada-primera')
    if (primera && !primera.getAttribute('src')) {
      // El guion del HTML no corrió (bloqueado o con error): se pone aquí.
      const f = porDefecto[ordenPorDefecto[0]]
      primera.src = movil ? f.srcMovil : f.src
      nombre.current.dataset.nombre = f.nombre
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ligero = (navigator.deviceMemory && navigator.deviceMemory <= 2) || navigator.hardwareConcurrency <= 2
    // La esfera es la transición más pesada (un recorte redondo del tamaño de la
    // diagonal): en el Motorola con la CPU 3× más lenta daba un tirón de ~240 ms.
    // Solo con 4 GB o más; si el navegador no lo dice (iPhone, Firefox), se usa.
    const conEsfera = !navigator.deviceMemory || navigator.deviceMemory >= 4
    const efectosVistosos = ['barrido', 'subida', 'acercamiento', ...(conEsfera ? ['esfera'] : [])]
    let ultimoEfecto = ''
    const elegirEfecto = () => {
      if (ligero) return 'fundido'
      const opciones = efectosVistosos.filter((e) => e !== ultimoEfecto)
      ultimoEfecto = opciones[Math.floor(Math.random() * opciones.length)]
      return ultimoEfecto
    }
    const zoomLento = (medio, desdeQuieta = false) => {
      if (ligero) return
      for (const a of medio.getAnimations()) a.cancel()
      movimiento3d(medio, (medio instanceof HTMLVideoElement ? DURACION_MAXIMA_VIDEO : DURACION_IMAGEN) + TRANSICION, desdeQuieta)
    }
    if (primera) zoomLento(primera, true)

    let desmontado = false
    let visible = 0
    let pasoPorDefecto = 0
    const ordenRemoto = barajar(remotos.length)
    let pasoRemoto = -1
    const listos = new Map() // índice de `remotos` → elemento ya bajado
    let reloj = null
    let pausado = false
    let pendiente = false
    let actual = null

    // Lo de Firebase se baja apenas carga la página, pero solo se muestra después
    // del primer toque, tecla o scroll. Chrome mide el LCP hasta ese momento y un
    // GIF o video con más píxeles que la primera foto lo volvería a marcar a los
    // 10 s o más, y eso lo ve Google. Por lo mismo todas las fotos de Mérida tienen
    // el mismo tamaño exacto.
    let interactuo = false
    const alInteractuar = () => {
      interactuo = true
      for (const ev of EVENTOS_INTERACCION) window.removeEventListener(ev, alInteractuar)
    }
    for (const ev of EVENTOS_INTERACCION) window.addEventListener(ev, alInteractuar, { passive: true })

    function siguiente() {
      if (interactuo && listos.size > 0) {
        // Bucle cerrado sobre el orden barajado de Firebase, saltando lo que aún baja.
        for (let k = 0; k < ordenRemoto.length; k++) {
          pasoRemoto = (pasoRemoto + 1) % ordenRemoto.length
          const i = ordenRemoto[pasoRemoto]
          if (listos.has(i)) return { item: remotos[i], medio: listos.get(i) }
        }
      }
      pasoPorDefecto = (pasoPorDefecto + 1) % ordenPorDefecto.length
      const item = porDefecto[ordenPorDefecto[pasoPorDefecto]]
      return { item, medio: crearMedio(item, movil) }
    }

    function programar(item, medio) {
      clearTimeout(reloj)
      if (medio instanceof HTMLVideoElement) {
        medio.currentTime = 0
        medio.play().catch(() => {})
        medio.onended = avanzar
        reloj = setTimeout(avanzar, DURACION_MAXIMA_VIDEO)
      } else {
        reloj = setTimeout(avanzar, DURACION_IMAGEN)
      }
    }

    async function avanzar() {
      clearTimeout(reloj)
      if (desmontado) return
      if (pausado) {
        pendiente = true
        return
      }
      const { item, medio } = siguiente()
      if (medio === actual) {
        // Solo hay uno listo de Firebase: se queda y vuelve a empezar, sin transición.
        zoomLento(medio)
        programar(item, medio)
        return
      }
      const yaListo = listos.has(remotos.indexOf(item))
      if (!yaListo && !(await esperarListo(medio, 15000))) {
        reloj = setTimeout(avanzar, 1000)
        return
      }
      if (desmontado) return
      const entra = capas[1 - visible]
      const sale = capas[visible]
      const interior = document.createElement('div')
      interior.className = 'absolute inset-0 overflow-hidden [perspective:1000px]'
      interior.append(medio)
      const velo = document.createElement('div')
      velo.className = CLASE_VELO
      entra.replaceChildren(interior, velo)
      velo.animate([{ opacity: VELO_AL_ENTRAR }, { opacity: VELO_AL_ENTRAR, offset: ILUMINADA / (ILUMINADA + OSCURECE) }, { opacity: 1 }], {
        duration: ILUMINADA + OSCURECE,
        easing: 'ease-in-out',
        fill: 'both',
      })
      entra.style.zIndex = '1'
      sale.style.zIndex = '0'
      nombre.current.dataset.nombre = item.nombre || ''
      nombre.current.parentElement.style.visibility = item.nombre ? 'visible' : 'hidden'
      const anterior = actual
      actual = medio
      visible = 1 - visible
      // Primero la transición (la esfera mueve `interior` dentro de la bola) y
      // después el movimiento 3D de la foto.
      const transicion = EFECTOS[elegirEfecto()](entra, interior, sale, raiz.current)
      zoomLento(medio)
      programar(item, medio)
      // Al terminar, la capa que salió se vacía y se quitan las animaciones ya
      // cumplidas (todas acaban sin transformar). Vaciarla también quita la
      // primera foto que pintó React: este componente no se vuelve a renderizar.
      Promise.all(transicion.map((a) => a.finished))
        .catch(() => {})
        .then(() => {
          if (desmontado) return
          if (anterior instanceof HTMLVideoElement) anterior.pause()
          for (const a of sale.getAnimations({ subtree: true })) a.cancel()
          sale.replaceChildren()
          for (const a of transicion) a.cancel()
        })
    }

    function pausar(valor) {
      pausado = valor
      for (const a of raiz.current.getAnimations({ subtree: true })) {
        if (valor && a.playState === 'running') a.pause()
        else if (!valor && a.playState === 'paused') a.play()
      }
      if (actual instanceof HTMLVideoElement) {
        if (valor) actual.pause()
        else actual.play().catch(() => {})
      }
      if (!valor && pendiente) {
        pendiente = false
        avanzar()
      }
    }

    const observador = new IntersectionObserver(([e]) => pausar(!e.isIntersecting || document.hidden))
    observador.observe(raiz.current)
    const alCambiarPestana = () => pausar(document.hidden)
    document.addEventListener('visibilitychange', alCambiarPestana)

    reloj = setTimeout(avanzar, DURACION_IMAGEN)

    // Lo de Firebase se baja de uno en uno cuando la página ya terminó de cargar.
    async function bajarRemotos() {
      if (!remotos.length || !conexionPermiteMedios()) return
      for (const i of ordenRemoto) {
        if (desmontado) return
        const medio = crearMedio(remotos[i], movil)
        if (await esperarListo(medio, 60000)) listos.set(i, medio)
      }
    }
    let idle = null
    const empezarDescarga = () => {
      idle = 'requestIdleCallback' in window ? requestIdleCallback(bajarRemotos, { timeout: 4000 }) : setTimeout(bajarRemotos, 2000)
    }
    if (document.readyState === 'complete') empezarDescarga()
    else window.addEventListener('load', empezarDescarga, { once: true })

    return () => {
      desmontado = true
      clearTimeout(reloj)
      for (const ev of EVENTOS_INTERACCION) window.removeEventListener(ev, alInteractuar)
      observador.disconnect()
      document.removeEventListener('visibilitychange', alCambiarPestana)
      window.removeEventListener('load', empezarDescarga)
      if (idle !== null) ('cancelIdleCallback' in window ? cancelIdleCallback : clearTimeout)(idle)
    }
  }, [porDefecto, remotos])

  return (
    <div ref={raiz} aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-gray-900 [perspective:1400px]">
      <div ref={capaA} className="absolute inset-0 overflow-hidden [perspective:1000px]">
        {/* Sin src: lo pone el guion de abajo con una foto al azar (de ahí suppressHydrationWarning). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- la elige el guion antes de React */}
        <img id="fondo-portada-primera" alt="" fetchPriority="high" decoding="async" className={CLASE_MEDIO} suppressHydrationWarning />
        <div className={CLASE_VELO} />
      </div>
      <div ref={capaB} className="absolute inset-0 overflow-hidden" />
      <p className="absolute bottom-3 left-4 flex items-center gap-1.5 text-xs font-semibold text-white/80 sm:left-6">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M10 1.5a6 6 0 0 0-6 6c0 4.4 6 11 6 11s6-6.6 6-11a6 6 0 0 0-6-6Zm0 8.2a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Z" />
        </svg>
        {/* El nombre va en data-nombre y lo muestra el CSS: si el guion del HTML le
            metiera texto, React no lo esperaría y volvería a dibujar toda la portada. */}
        <span id="fondo-portada-nombre" ref={nombre} className="after:content-[attr(data-nombre)]" suppressHydrationWarning />
      </p>
      <script dangerouslySetInnerHTML={{ __html: guionPrimeraFoto(porDefecto) }} />
    </div>
  )
}
