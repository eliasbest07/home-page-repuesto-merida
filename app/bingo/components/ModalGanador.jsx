'use client';

import { useEffect, useRef } from 'react';

/** Partícula de confeti individual */
function Confeti({ style }) {
  return <div className="absolute rounded-sm opacity-80 animate-bounce" style={style} />;
}

/** Genera N partículas con posición/color/tamaño aleatorio */
function generarConfetis(n = 40) {
  const colores = ['#FFD700', '#22C55E', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C'];
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    style: {
      left:             `${Math.random() * 100}%`,
      top:              `${Math.random() * 60}%`,
      width:            `${6 + Math.random() * 10}px`,
      height:           `${8 + Math.random() * 14}px`,
      backgroundColor:  colores[Math.floor(Math.random() * colores.length)],
      transform:        `rotate(${Math.random() * 360}deg)`,
      animationDuration:`${0.6 + Math.random() * 1.2}s`,
      animationDelay:   `${Math.random() * 0.5}s`,
    },
  }));
}

/**
 * Modal de celebración cuando alguien gana.
 *
 * Props:
 *   ganador    : { nombre } | null
 *   esTu       : bool   — si el usuario actual ganó
 *   esHost     : bool
 *   onCerrar   : () => void
 *   onNuevaPartida : () => void  (solo host)
 */
export default function ModalGanador({ ganador, esTu = false, esHost = false, onCerrar, onNuevaPartida }) {
  const confetis   = useRef(generarConfetis(50)).current;
  const audioRef   = useRef(null);

  useEffect(() => {
    // Reproducir sonido (si el navegador lo permite)
    if (audioRef.current) {
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  if (!ganador) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      {/* Confeti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetis.map((c) => <Confeti key={c.id} style={c.style} />)}
      </div>

      {/* Card central */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center z-10 animate-slide-up">

        {/* Trofeo */}
        <div className="text-7xl mb-4 animate-bounce">🏆</div>

        {/* Título */}
        {esTu ? (
          <>
            <h2 className="font-brand text-4xl font-extrabold text-brand-yellow leading-tight mb-1">
              ¡BINGO!
            </h2>
            <p className="text-white text-lg font-semibold mb-4">¡Ganaste tú!</p>
          </>
        ) : (
          <>
            <h2 className="font-brand text-3xl font-extrabold text-brand-yellow leading-tight mb-2">
              ¡BINGO!
            </h2>
            <p className="text-white text-lg font-semibold mb-1">Ganó</p>
            <p className="text-2xl font-brand font-bold text-brand-green mb-4">
              {ganador.nombre}
            </p>
          </>
        )}

        {/* Confetti texto */}
        <div className="flex justify-center gap-1 text-xl mb-6">
          {'🎉🎊✨🎈🎊🎉'.split('').map((e, i) => (
            <span key={i} style={{ animationDelay: `${i * 0.1}s` }} className="animate-bounce inline-block">{e}</span>
          ))}
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-3">
          {esHost && (
            <button
              onClick={onNuevaPartida}
              className="w-full bg-brand-green text-white font-bold py-3.5 rounded-xl hover:bg-green-400 active:scale-95 transition"
            >
              🔄 Nueva partida
            </button>
          )}
          <button
            onClick={onCerrar}
            className="w-full border border-gray-700 text-gray-400 hover:text-white py-3 rounded-xl transition text-sm"
          >
            Ver cartón
          </button>
        </div>
      </div>

      {/* Sonido (sin src visible, navegador puede bloquearlo) */}
      <audio ref={audioRef} src="/bingo-win.mp3" preload="auto" />
    </div>
  );
}
