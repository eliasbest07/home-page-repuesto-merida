'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

// ════════════════════════════════════════════════
// RESPUESTAS PREDEFINIDAS — JSON
// ════════════════════════════════════════════════
const ANSWERS = {
  '¿Qué puedo publicar en Plaza?': {
    text: `En Plaza puedes publicar prácticamente cualquier cosa 🏪\n\n✔ **Objetos**: electrónica, electrodomésticos, muebles, ropa, herramientas…\n✔ **Servicios**: clases, reparaciones, diseño, plomería, mecánica…\n✔ **Cualquier otra cosa** que quieras vender u ofrecer en la región\n\nPlaza es el mercado local de Mérida y Los Andes.`,
    action: { label: '+ Publicar ahora', href: '/plaza/publicar' },
  },
  '¿Cómo publico en Plaza?': {
    text: `Publicar en Plaza es fácil y gratis:\n\n1️⃣ Toca **"+ Publicar"** en la parte superior\n2️⃣ Escribe el título, descripción, precio y categoría\n3️⃣ Agrega fotos del artículo o servicio\n4️⃣ Ingresa tu número de WhatsApp\n5️⃣ Envía — revisamos en menos de 24h ✅`,
    action: { label: '+ Publicar gratis', href: '/plaza/publicar' },
  },
  '¿Cómo funciona el proceso de aprobación?': {
    text: `El proceso es rápido y transparente:\n\n⏱ **Menos de 24 horas** de espera\n\nRevisamos que:\n✔ La información sea clara y real\n✔ El precio sea coherente\n✔ Las fotos sean del artículo o servicio real\n✔ El número de WhatsApp sea válido\n\nSi hay correcciones, te avisamos antes de publicar.`,
    action: null,
  },
  '¿Qué es Solicitar y cómo funciona?': {
    text: `**Solicitar** es para cuando no encuentras lo que buscas 🔍\n\nAsí funciona:\n• Describes el objeto o servicio que necesitas\n• Tu solicitud es visible para todos en Plaza\n• Los usuarios que puedan ayudar te contactan por WhatsApp\n• Tú decides con quién acordar\n\nIdeal para cosas específicas o difíciles de conseguir.`,
    action: { label: '🔍 Crear solicitud', href: '/plaza/solicitar' },
  },
}

// Acciones directas de navegación
const NAV_ACTIONS = [
  { label: '+ Publicar Servicio o Producto',  href: '/plaza/publicar',  style: 'bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-300' },
  { label: '🔍 Solicitar Producto o Servicio', href: '/plaza/solicitar', style: 'bg-gray-800 text-yellow-400 font-bold hover:bg-gray-700 border border-gray-700' },
]

// Preguntas frecuentes (orden clave del objeto ANSWERS)
const QUICK_QUESTIONS = Object.keys(ANSWERS).map((q) => ({ label: q, msg: q }))

const INITIAL_MSG = {
  id: 'initial-assistant',
  role: 'assistant',
  content: '¡Hola! Soy Oso Frontino Brain 🐻\n\nTu asistente de Plaza. Puedo ayudarte a publicar, buscar o solicitar repuestos. ¿Qué necesitas?',
}

const WA_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+584123375417').replace(/\D/g, '')
const buildOsoWhatsAppUrl = (context = '') =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    context
      ? `Hola Oso Frontino Brain, necesito ayuda con esto en Plaza: ${context}`
      : 'Hola Oso Frontino Brain, necesito ayuda en Plaza.'
  )}`

const randomWhatsappDelay = () => 3000 + Math.floor(Math.random() * 12001)

export default function PlazaChat() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([INITIAL_MSG])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [hasNew, setHasNew]     = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const timeoutsRef = useRef([])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 100)
      setHasNew(false)
    }
  }, [open, messages])

  useEffect(() => {
    const handleOpenPrompt = (event) => {
      const prompt = event.detail?.prompt?.trim()
      const selectedProduct = event.detail?.product || null
      if (!prompt) return
      setOpen(true)
      setTimeout(() => {
        sendMessage(prompt, { selectedProduct })
      }, 120)
    }

    window.addEventListener('plaza-chat:open-prompt', handleOpenPrompt)
    return () => window.removeEventListener('plaza-chat:open-prompt', handleOpenPrompt)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout)
    }
  }, [])

  const queueWhatsAppCta = (messageId) => {
    const timeoutId = setTimeout(() => {
      setMessages((prev) => prev.map((message) => ({
        ...message,
        showWhatsAppCta: message.id === messageId,
      })))
    }, randomWhatsappDelay())

    timeoutsRef.current.push(timeoutId)
  }

  const appendAssistantMessage = ({ content, action = null, whatsappContext = '', showWhatsappCta = false }) => {
    const id = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setMessages((prev) => [
      ...prev.map((message) => (
        message.role === 'assistant'
          ? { ...message, showWhatsAppCta: false }
          : message
      )),
      {
        id,
        role: 'assistant',
        content,
        action,
        showWhatsAppCta: showWhatsappCta,
        whatsappHref: buildOsoWhatsAppUrl(whatsappContext || content),
      },
    ])
    queueWhatsAppCta(id)
    if (!open) setHasNew(true)
  }

  const goToMenu = () => {
    setMessages([INITIAL_MSG])
    setInput('')
  }

  const handleActionClick = (action) => {
    if (!action) return

    if (action.type === 'product-details' && action.productId) {
      setOpen(false)
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('plaza-chat:open-product-details', {
            detail: { productId: action.productId },
          }))
        }, 120)
      })
      return
    }

    if (action.targetId) {
      setOpen(false)
      requestAnimationFrame(() => {
        setTimeout(() => {
          const target = document.getElementById(action.targetId)
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 120)
      })
      return
    }
  }

  const sendMessage = async (text, options = {}) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    const selectedProduct = options.selectedProduct || null

    setInput('')
    const userMessage  = { id: `user-${Date.now()}`, role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    // ── Respuesta predefinida ──
    const predefined = ANSWERS[msg]
    if (predefined) {
      setTimeout(() => {
        appendAssistantMessage({
          content: predefined.text,
          action: predefined.action,
          whatsappContext: msg,
        })
      }, 350) // pequeño delay para que se sienta natural
      return
    }

    if (msg.startsWith('Consulta repuesto:')) {
      setLoading(true)
      setTimeout(() => {
        appendAssistantMessage({
          content: 'Estoy revisando ese repuesto. ¿Lo quieres comprar o qué información quieres saber?',
          action: selectedProduct
            ? {
                label: 'Ver más información',
                href: `/#producto-${selectedProduct.id}`,
                targetId: `producto-${selectedProduct.id}`,
                type: 'product-details',
                productId: selectedProduct.id,
              }
            : null,
          whatsappContext: msg,
        })
        setLoading(false)
      }, 700)
      return
    }

    // ── Llamada al API para preguntas libres ──
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      appendAssistantMessage({
        content: data.content || data.error || 'Error al responder.',
        whatsappContext: msg,
      })
    } catch {
      appendAssistantMessage({
        content: 'Error de conexión. Verifica tu internet e intenta de nuevo.',
        whatsappContext: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isMenu = messages.length === 1

  return (
    <>
      {/* ── Floating button — siempre visible, z máximo ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir Oso Frontino Brain"
        style={{ zIndex: 9999 }}
        className={`fixed bottom-6 right-5 w-16 h-16 rounded-none shadow-2xl flex items-center justify-center overflow-visible
          transition-all duration-300 hover:scale-110 group bg-transparent border-0
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <span className="absolute -inset-[15%] rounded-full bg-yellow-400 scale-0 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
        <Image
          src="/chat_icono.png"
          alt="Oso Frontino Brain"
          width={64}
          height={64}
          className="relative z-10 w-full h-full object-contain"
        />
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
        {/* Tooltip */}
        <span className="absolute right-[76px] bg-gray-900 text-yellow-400 text-xs px-3 py-1.5 rounded-xl
          whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
          shadow-xl font-bold border border-gray-700">
          Oso Frontino Brain
        </span>
      </button>

      {/* ── Chat panel ── */}
      <div
        className={`fixed bottom-24 right-5 flex flex-col rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-300 origin-bottom-right bg-white
          w-[360px] max-w-[calc(100vw-2rem)]
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}
        aria-hidden={!open}
        style={{ height: '620px', zIndex: 9998 }}
      >
        {/* Header */}
        <div className="bg-yellow-400 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center overflow-hidden shrink-0">
              <Image src="/iconorm.png" alt="Oso" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-none">Oso Frontino Brain</p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1 text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                Asistente de Plaza
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Botón volver al menú — visible cuando hay conversación */}
            {!isMenu && (
              <button
                onClick={goToMenu}
                className="text-gray-700 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-yellow-300 transition-colors text-[11px] font-semibold"
                title="Volver al menú"
              >
                ← Menú
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-gray-700 hover:text-gray-900 p-1.5 rounded-lg hover:bg-yellow-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-end gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center overflow-hidden shrink-0">
                    <Image src="/iconorm.png" alt="Oso" width={28} height={28} className="object-cover" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line
                    ${m.role === 'user'
                      ? 'bg-gray-900 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                    }`}
                >
                  {m.content}
                </div>
              </div>

              {/* Botón de acción inline si la respuesta lo tiene */}
              {m.role === 'assistant' && m.action && (
                <div className="ml-8">
                  {m.action.targetId ? (
                    <button
                      type="button"
                      onClick={() => handleActionClick(m.action)}
                      className="inline-flex items-center gap-1.5 bg-yellow-400 text-gray-900 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-all"
                    >
                      {m.action.label} →
                    </button>
                  ) : (
                    <Link
                      href={m.action.href}
                      className="inline-flex items-center gap-1.5 bg-yellow-400 text-gray-900 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-all"
                    >
                      {m.action.label} →
                    </Link>
                  )}
                </div>
              )}

              {m.role === 'assistant' && m.showWhatsAppCta && m.whatsappHref && (
                <div className="ml-8">
                  <a
                    href={m.whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl hover:bg-green-600 transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.59 5.96L0 24l6.3-1.65a11.9 11.9 0 0 0 5.77 1.48h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.47-8.44ZM12.08 21.8h-.01a9.88 9.88 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.38a9.86 9.86 0 0 1-1.52-5.25c0-5.46 4.45-9.91 9.92-9.91 2.65 0 5.14 1.03 7.01 2.91a9.86 9.86 0 0 1 2.9 7c0 5.46-4.45 9.9-9.91 9.9Zm5.44-7.42c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.68-2.1-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.49 0 1.47 1.08 2.9 1.23 3.1.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.71.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
                    </svg>
                    Escribir al Oso
                  </a>
                </div>
              )}

              {/* Botón "Volver al menú" tras la última respuesta del bot */}
              {m.role === 'assistant' && i === messages.length - 1 && !isMenu && (
                <div className="ml-8">
                  <button
                    onClick={goToMenu}
                    className="text-[11px] text-gray-400 hover:text-yellow-600 hover:underline transition-colors"
                  >
                    ← Volver al menú
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Menú inicial — acciones + preguntas */}
          {isMenu && !loading && (
            <div className="space-y-2 pt-1">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide px-1">Acciones rápidas</p>
              <div className="flex flex-col gap-2">
                {NAV_ACTIONS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className={`w-full text-center text-sm rounded-xl px-3 py-2.5 transition-all ${a.style}`}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>

              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide px-1 pt-2">Preguntas frecuentes</p>
              {QUICK_QUESTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.msg)}
                  className="w-full text-left text-xs bg-white border border-gray-200 rounded-xl px-3 py-2.5
                    text-gray-600 hover:border-yellow-400 hover:bg-yellow-50 transition-all leading-snug"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-1.5">
              <div className="w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center overflow-hidden shrink-0">
                <Image src="/iconorm.png" alt="Oso" width={28} height={28} className="object-cover" />
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-100 px-3 py-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pregúntale al Oso…"
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100
                bg-gray-50 transition-all"
              style={{ minHeight: '42px', maxHeight: '96px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-yellow-400 text-gray-900 flex items-center justify-center
                shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-gray-400 text-[10px] mt-1.5 leading-none">
            Oso Frontino Brain · Solo respondo sobre Plaza
          </p>
        </div>
      </div>
    </>
  )
}
