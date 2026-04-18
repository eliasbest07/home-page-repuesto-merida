'use client';

import { letraDeNumero } from '@/lib/bingo';

/**
 * Tablero compacto con los 75 números (1-75).
 * - Cantados: fondo verde
 * - Último cantado: anillo amarillo + pulse
 * - No cantados: gris oscuro
 *
 * Props:
 *   cantadas   : number[]
 *   ultimoNum  : number|null
 */
export default function TableroCantadas({ cantadas = [], ultimoNum = null }) {
  const grupos = {
    B: { rango: [1, 15],  color: 'text-yellow-400' },
    I: { rango: [16, 30], color: 'text-blue-400' },
    N: { rango: [31, 45], color: 'text-purple-400' },
    G: { rango: [46, 60], color: 'text-green-400' },
    O: { rango: [61, 75], color: 'text-red-400' },
  };

  return (
    <div className="w-full">
      {/* Último número cantado — hero */}
      <div className="flex items-center justify-center mb-4">
        {ultimoNum ? (
          <div className="flex flex-col items-center gap-1 animate-fade-in">
            <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">
              Último número
            </span>
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-brand-yellow shadow-lg shadow-yellow-500/40 animate-pulse-slow">
              <span className="font-brand font-extrabold text-4xl text-gray-900 leading-none">
                {ultimoNum}
              </span>
              <span className="absolute -top-1 -right-1 bg-gray-900 text-brand-yellow text-xs font-bold px-1.5 py-0.5 rounded-full border border-yellow-500/40">
                {letraDeNumero(ultimoNum)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-gray-600 tracking-widest uppercase">
              Esperando primer número
            </span>
            <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center">
              <span className="text-gray-600 text-2xl">🎱</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid por columnas */}
      <div className="space-y-2">
        {Object.entries(grupos).map(([letra, { rango, color }]) => {
          const nums = Array.from({ length: rango[1] - rango[0] + 1 }, (_, i) => rango[0] + i);
          return (
            <div key={letra} className="flex items-center gap-1.5">
              {/* Etiqueta columna */}
              <span className={`w-5 text-center font-brand font-extrabold text-sm ${color} shrink-0`}>
                {letra}
              </span>
              {/* Bolillas */}
              <div className="flex gap-1 flex-wrap">
                {nums.map((n) => {
                  const cantado  = cantadas.includes(n);
                  const esUltimo = n === ultimoNum;
                  return (
                    <div
                      key={n}
                      className={[
                        'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300',
                        esUltimo
                          ? 'bg-brand-yellow text-gray-900 ring-2 ring-white scale-110 animate-pulse-slow'
                          : cantado
                          ? 'bg-brand-green text-white'
                          : 'bg-gray-800 text-gray-600',
                      ].join(' ')}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contador */}
      <p className="text-center text-xs text-gray-500 mt-3">
        {cantadas.length} / 75 números cantados
      </p>
    </div>
  );
}
