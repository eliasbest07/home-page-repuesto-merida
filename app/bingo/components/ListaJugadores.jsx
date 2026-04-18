'use client';

/**
 * Lista de jugadores en la sala.
 *
 * Props:
 *   jugadores     : { id, nombre, gano }[]
 *   hostNombre    : string
 *   miJugadorId   : string   (para resaltar "tú")
 */
export default function ListaJugadores({ jugadores = [], hostNombre = '', miJugadorId = '' }) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse inline-block" />
        Jugadores ({jugadores.length})
      </h3>

      {jugadores.length === 0 ? (
        <div className="text-center py-6 text-gray-600 text-sm">
          <span className="block text-2xl mb-1">👥</span>
          Aún no hay jugadores
        </div>
      ) : (
        <ul className="space-y-2">
          {jugadores.map((j) => {
            const esTu = j.id === miJugadorId;
            return (
              <li
                key={j.id}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                  j.gano
                    ? 'bg-yellow-500/20 border border-yellow-500/40'
                    : esTu
                    ? 'bg-gray-700/60 border border-gray-600'
                    : 'bg-gray-800/60',
                ].join(' ')}
              >
                {/* Avatar inicial */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  j.gano ? 'bg-brand-yellow text-gray-900' : 'bg-gray-700 text-white'
                }`}>
                  {j.nombre?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Nombre */}
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${j.gano ? 'text-brand-yellow' : 'text-white'}`}>
                    {j.nombre}
                    {esTu && <span className="ml-1.5 text-xs text-gray-400 font-normal">(tú)</span>}
                  </p>
                </div>

                {/* Badge estado */}
                {j.gano && (
                  <span className="text-xs font-bold bg-brand-yellow text-gray-900 px-2 py-0.5 rounded-full shrink-0">
                    🏆 BINGO
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Host siempre visible */}
      {hostNombre && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-yellow shrink-0" />
          <span className="text-xs text-gray-500">
            Anfitrión: <span className="text-gray-300 font-medium">{hostNombre}</span>
          </span>
        </div>
      )}
    </div>
  );
}
