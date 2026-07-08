import Link from 'next/link'

const WHATSAPP_NUMBER = '584123375417'
const SUPPORT_MESSAGE = 'Soporte necesito que me ayuden con esto'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.btmstudio.rep_merida'

export const metadata = {
  title: 'Soporte | Repuestos Mérida',
  description:
    'Obtén ayuda de Repuestos Mérida mediante nuestro WhatsApp oficial y consulta respuestas a las preguntas frecuentes.',
  alternates: {
    canonical: '/soporte',
  },
}

const faqs = [
  {
    question: '¿Cuál es la vía más rápida para recibir ayuda?',
    answer:
      'Nuestro WhatsApp oficial es la vía más rápida. Pulsa el botón de esta página, envía el mensaje preparado y cuéntanos con claridad qué necesitas.',
  },
  {
    question: 'Escribí por WhatsApp y todavía no me responden, ¿qué hago?',
    answer:
      'En momentos de alta demanda la respuesta puede tardar. No necesitas enviar el mismo mensaje varias veces: conserva el chat y espera hasta 24 horas. Revisamos las conversaciones pendientes y atenderemos tu solicitud.',
  },
  {
    question: '¿Qué pasa si han transcurrido más de 24 horas?',
    answer:
      'Escríbenos nuevamente en el mismo chat e indica que llevas más de 24 horas esperando. Tu caso recibirá seguimiento prioritario.',
  },
  {
    question: '¿Cómo puedo recibir una respuesta más precisa?',
    answer:
      'Incluye una explicación breve del problema, la página o servicio que estabas usando y, si aplica, una captura de pantalla. No compartas contraseñas, códigos de verificación ni datos bancarios.',
  },
  {
    question: '¿Este es el WhatsApp oficial?',
    answer:
      'Sí. El botón de esta página abre directamente el número oficial +58 412-3375417 con un mensaje de soporte preparado.',
  },
]

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M12.04 2a9.84 9.84 0 0 0-8.48 14.82L2 22l5.32-1.52A9.94 9.94 0 1 0 12.04 2Zm0 17.94a8 8 0 0 1-4.08-1.12l-.3-.18-3.16.9.92-3.08-.2-.32a7.91 7.91 0 1 1 6.82 3.8Zm4.34-5.94c-.24-.12-1.4-.68-1.62-.76-.22-.08-.38-.12-.54.12-.16.24-.62.76-.76.92-.14.16-.28.18-.52.06-1.4-.7-2.32-1.26-3.25-2.85-.24-.42.25-.39.7-1.3.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.19 1.1.16 1.52.1.46-.07 1.4-.58 1.6-1.13.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  )
}

export default function SoportePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <nav className="mb-8" aria-label="Navegación">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
            <span aria-hidden="true">←</span> Volver al inicio
          </Link>
        </nav>

        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-12 sm:py-14">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-300">
              Centro de soporte
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              ¿Necesitas ayuda?
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              La vía más rápida para recibir respuesta es nuestro WhatsApp oficial. Siempre estaremos atentos para mantener este canal disponible y responder tus solicitudes.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-500 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-300/40 sm:w-auto"
            >
              <WhatsAppIcon />
              Abrir WhatsApp oficial
            </a>
            <p className="mt-4 text-sm text-slate-400">
              Se abrirá el chat con +58 412-3375417 y el mensaje de soporte listo para enviar.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8" aria-labelledby="response-time-title">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xl" aria-hidden="true">⏱</span>
            <div>
              <h2 id="response-time-title" className="text-xl font-bold text-amber-950">Si aún no has recibido respuesta</h2>
              <p className="mt-2 leading-7 text-amber-900">
                Algunas solicitudes pueden tardar por el volumen de mensajes. Si no recibes respuesta en menos de 24 horas, vuelve a escribir en el mismo chat e indícanos cuánto tiempo llevas esperando; daremos seguimiento prioritario a tu caso.
              </p>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="faq-title">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">Primeros pasos</p>
            <h2 id="faq-title" className="mt-2 text-3xl font-black tracking-tight">Preguntas frecuentes</h2>
            <p className="mt-3 text-slate-600">Respuestas rápidas antes de contactar con soporte.</p>
          </div>

          <div className="mt-8 grid gap-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm open:border-emerald-300 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-900">
                  {faq.question}
                  <span className="text-2xl font-light text-emerald-700 transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-4 max-w-3xl leading-7 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="descargar-app"
          className="scroll-mt-6 rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-950 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-12"
          aria-labelledby="download-title"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-200">Repuestos Mérida en tu teléfono</p>
              <h2 id="download-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Instala nuestra app
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-50">
                Lleva nuestros servicios contigo y accede más rápido desde tu teléfono. La aplicación está disponible para Android y próximamente para iPhone.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={GOOGLE_PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-16 items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-left text-slate-950 shadow-lg transition hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/40"
                  aria-label="Instalar Repuestos Mérida desde Google Play"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-emerald-600">
                    <path d="M3.61 2.35a2.02 2.02 0 0 0-.48 1.4v16.5c0 .54.2 1.03.51 1.39l9.12-9.62L3.61 2.35Zm10.4 10.99-2.32 2.45-7.2 7.58c.22.08.46.13.72.13.39 0 .75-.11 1.07-.29l11.31-6.43-3.58-3.44Zm4.99-3.1-3.73-2.13-2.57 2.71 2.54 2.68L19 11.36c.34-.2.54-.41.54-.56 0-.16-.2-.37-.54-.56ZM4.45.65l7.25 7.64 2.28 2.4 3.58-3.42L6.27.85A2.13 2.13 0 0 0 5.2.56c-.27 0-.52.03-.75.09Z" />
                  </svg>
                  <span><span className="block text-xs">Disponible en</span><span className="block text-lg font-bold leading-5">Google Play</span></span>
                </a>

                <div
                  className="inline-flex min-h-16 items-center justify-center gap-3 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-left text-white"
                  aria-label="Aplicación para App Store próximamente"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-current">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.27-.07 2.15.7 2.89.76 1.1-.22 2.16-.85 3.34-.77 1.42.12 2.49.67 3.2 1.67-2.93 1.76-2.23 5.62.45 6.7-.54 1.42-1.25 2.83-1.88 4.61ZM12.03 7.25C11.88 5.14 13.6 3.4 15.57 3.23c.27 2.44-2.22 4.26-3.54 4.02Z" />
                  </svg>
                  <span><span className="block text-xs text-emerald-100">Próximamente en</span><span className="block text-lg font-bold leading-5">App Store</span></span>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[240px] rounded-2xl bg-white p-5 text-center text-slate-900 shadow-xl lg:mx-0">
              {/* El QR contiene la URL pública https://repuestosmerida.com/soporte#descargar-app */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=svg&data=https%3A%2F%2Frepuestosmerida.com%2Fsoporte%23descargar-app"
                alt="Código QR para ir a la sección de descarga de la app"
                width={200}
                height={200}
                className="mx-auto h-auto w-full"
              />
              <p className="mt-3 text-sm font-bold">Escanea para descargar</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Abre esta sección desde otro dispositivo.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
