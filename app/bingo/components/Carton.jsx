'use client';

import { normalizeCarton } from '@/lib/bingo';

const HEADERS = ['B', 'I', 'N', 'G', 'O'];

/**
 * Cartón de bingo 5×5 interactivo.
 *
 * Props:
 *   carton      : number[][] | { values: number[] }[] — 5 filas × 5 cols, 0 = casilla libre
 *   cantadas    : number[]     — números cantados hasta ahora
 *   onMarca     : (num) => void — callback al marcar (solo jugador)
 *   soloVer     : bool          — sin interacción (vista del host)
 *   ultimoNum   : number|null   — resalta el último número cantado
 */
export default function Carton({
  carton = [],
  cantadas = [],
  onMarca,
  soloVer = false,
  ultimoNum = null,
  compact = false,
}) {
  const matriz = normalizeCarton(carton);
  if (!matriz.length) return null;

  const headerClass = compact
    ? 'flex items-center justify-center h-6 rounded-md bg-brand-yellow text-gray-900 font-brand font-extrabold text-xs tracking-[0.25em]'
    : 'flex items-center justify-center h-9 rounded-lg bg-brand-yellow text-gray-900 font-brand font-extrabold text-lg tracking-widest';

  const cellClass = compact
    ? 'relative flex items-center justify-center h-7 rounded-md font-bold text-[11px] transition-all duration-200'
    : 'relative flex items-center justify-center h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg transition-all duration-200';

  function handleClick(num) {
    if (soloVer || num === 0) return;
    if (cantadas.includes(num) && onMarca) onMarca(num);
  }

  return (
    <div className={`w-full mx-auto select-none ${compact ? 'max-w-[180px]' : 'max-w-xs'}`}>
      {/* Header B-I-N-G-O */}
      <div className="grid grid-cols-5 gap-1 mb-1">
        {HEADERS.map((h) => (
          <div
            key={h}
            className={headerClass}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-5 gap-1">
        {matriz.map((fila, r) =>
          fila.map((num, c) => {
            const libre      = num === 0;
            const cantada    = cantadas.includes(num);
            const esUltima   = num === ultimoNum;
            const interactiva = cantada && !soloVer && !libre;

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleClick(num)}
                disabled={soloVer || libre || !cantada}
                aria-label={libre ? 'Casilla libre' : String(num)}
                className={[
                  cellClass,
                  // Base
                  libre
                    ? 'bg-brand-green text-white cursor-default shadow-sm shadow-green-500/40'
                    : cantada
                    ? 'bg-brand-yellow text-gray-900 shadow shadow-yellow-400/40 scale-105'
                    : 'bg-gray-800 text-gray-300 border border-gray-700',
                  // Hover solo en interactivas no marcadas aún
                  interactiva && !cantada ? 'hover:bg-gray-700 cursor-pointer' : '',
                  // Pulse en último número
                  esUltima ? 'ring-2 ring-yellow-300 animate-pulse-slow' : '',
                ].join(' ')}
              >
                {libre ? (
                  <span className="text-xs font-extrabold tracking-widest">FREE</span>
                ) : (
                  <>
                    <span>{num}</span>
                    {/* Tilde si fue cantada */}
                    {cantada && (
                      <span className="absolute top-0.5 right-1 text-[10px] text-green-800 font-black">✓</span>
                    )}
                  </>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
