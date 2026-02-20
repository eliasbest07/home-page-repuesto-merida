'use client'

import { useState, useRef, useEffect } from 'react'

const QUICK_ACTIONS = [
  { label: '¿Cómo publico un repuesto?',    msg: '¿Cómo publico un repuesto en Plaza?' },
  { label: '¿Qué es el Solicitar?',         msg: '¿Qué es la función Solicitar / Encontrar?' },
  { label: '¿Cómo funciona la aprobación?', msg: '¿Cómo funciona el proceso de aprobación de publicaciones?' },
  { label: 'Ayuda para buscar repuestos',   msg: '¿Cómo puedo buscar un repuesto específico en Plaza?' },
]

const INITIAL_MSG = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de Plaza 🤖\n\nPuedo ayudarte a publicar repuestos, buscar lo que necesitas o crear una solicitud. ¿En qué te ayudo?',
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

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    const userMessage  = { role: 'user', content: msg }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
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
      const reply = { role: 'assistant', content: data.content || data.error || 'Error al responder.' }
      setMessages((prev) => [...prev, reply])
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

  const showQuick = messages.length === 1

  return (
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente Plaza AI"
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gray-900 shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group
          ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
      >
        <span className="text-2xl">🤖</span>
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
        <span className="absolute right-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Plaza AI
        </span>
      </button>

      {/* ── Chat panel ── */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right bg-white
          w-[360px] max-w-[calc(100vw-2rem)]
          ${open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'}`}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Plaza AI</p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1 text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Asistente virtual
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-1.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-xs shrink-0">
                  🤖
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
          ))}

          {/* Quick actions */}
          {showQuick && !loading && (
            <div className="space-y-1.5 pt-1">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.msg)}
                  className="w-full text-left text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 hover:border-yellow-400 hover:bg-yellow-50 transition-all"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-xs shrink-0">
                🤖
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
              placeholder="Escribe tu consulta…"
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 bg-gray-50 transition-all"
              style={{ minHeight: '42px', maxHeight: '96px' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl bg-gray-900 text-yellow-400 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-gray-400 text-[10px] mt-1.5 leading-none">
            Plaza AI · Solo respondo sobre la plataforma
          </p>
        </div>
      </div>
    </>
  )
}
