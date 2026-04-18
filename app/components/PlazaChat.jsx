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
  role: 'assistant',
  content: '¡Hola! Soy Oso Frontino Brain 🐻\n\nTu asistente de Plaza. Puedo ayudarte a publicar, buscar o solicitar repuestos. ¿Qué necesitas?',
}

export default function PlazaChat() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([INITIAL_MSG])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [hasNew, setHasNew]     = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

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
      if (!prompt) return
      setOpen(true)
      setTimeout(() => {
        sendMessage(prompt)
      }, 120)
    }

    window.addEventListener('plaza-chat:open-prompt', handleOpenPrompt)
    return () => window.removeEventListener('plaza-chat:open-prompt', handleOpenPrompt)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goToMenu = () => {
    setMessages([INITIAL_MSG])
    setInput('')
  }

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    const userMessage  = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)

    // ── Respuesta predefinida ──
    const predefined = ANSWERS[msg]
    if (predefined) {
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: predefined.text, action: predefined.action }])
        if (!open) setHasNew(true)
      }, 350) // pequeño delay para que se sienta natural
      return
    }

    if (msg.startsWith('Consulta repuesto:')) {
      setLoading(true)
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Estoy revisando ese repuesto. ¿Lo quieres comprar o qué información quieres saber?',
          },
        ])
        if (!open) setHasNew(true)
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
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.content || data.error || 'Error al responder.' },
      ])
      if (!open) setHasNew(true)
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error de conexión. Verifica tu internet e intenta de nuevo.' },
      ])
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
        className={`fixed bottom-6 right-5 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center
          transition-all duration-300 hover:scale-110 group bg-yellow-400 border-4 border-yellow-300
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <Image
          src="/iconorm.png"
          alt="Oso Frontino Brain"
          width={44}
          height={44}
          className="rounded-full object-cover"
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
                  <Link
                    href={m.action.href}
                    className="inline-flex items-center gap-1.5 bg-yellow-400 text-gray-900 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-all"
                  >
                    {m.action.label} →
                  </Link>
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
