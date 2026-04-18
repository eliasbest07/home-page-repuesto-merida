'use client';

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconDrum = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    className="w-5 h-5" strokeLinecap="round">
    <ellipse cx="12" cy="6" rx="9" ry="3" />
    <path d="M3 6v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    className="w-4 h-4" strokeLinecap="round">
    <path d="M1 4v6h6" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.66L1 10" />
  </svg>
);
const IconStop = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.121 1.526 5.849L.057 23.486a.75.75 0 0 0 .914.914l5.637-1.469A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.952 9.952 0 0 1-5.126-1.42l-.367-.217-3.793.989.992-3.681-.24-.383A9.952 9.952 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
  </svg>
);

/**
 * Panel de control exclusivo del anfitrión.
 *
 * Props:
 *   sala           : objeto sala de Firestore
 *   jugadores      : array de jugadores
 *   onIniciar      : () => void
 *   onCantarNum    : () => void
 *   onToggleAuto   : () => void
 *   onNuevaPartida : () => void
 *   cantando       : bool (loading cantar)
 */
export default function ControlesHost({
  sala = {},
  jugadores = [],
  onIniciar,
  onCantarNum,
  onToggleAuto,
  onNuevaPartida,
  cantando = false,
}) {
  const {
    estado,
    numerosCantados = sala.numeros_cantados || [],
    codigo,
    autoCantar = sala.auto_cantar,
    intervaloSeg = sala.intervalo_seg,
  } = sala;
  const totalCantados = numerosCantados.length;
  const quedanNums    = 75 - totalCantados;

  function compartirWhatsApp() {
    if (!codigo) return;
    const texto = encodeURIComponent(
      `¡Te invito a jugar Bingo! 🎱\nÚnete a mi sala con el código: *${codigo}*\nEntra en: ${window.location.origin}/bingo`
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  }

  return (
    <div className="w-full space-y-4">

      {/* Código de sala */}
      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Código de sala</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-extrabold text-2xl text-brand-yellow tracking-[0.3em]">
            {codigo}
          </span>
          <button
            onClick={compartirWhatsApp}
            className="flex items-center gap-1.5 text-xs text-white font-semibold transition bg-[#25D366] hover:bg-[#128C7E] px-3 py-1.5 rounded-lg"
          >
            <IconWhatsApp /> Invitar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Comparte este código con tus jugadores</p>
      </div>

      {/* Estado: en espera */}
      {estado === 'esperando' && (
        <button
          onClick={onIniciar}
          disabled={jugadores.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-bold py-4 rounded-xl hover:bg-green-400 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <IconPlay />
          {jugadores.length === 0 ? 'Esperando jugadores…' : `Iniciar juego (${jugadores.length} jugador${jugadores.length > 1 ? 'es' : ''})`}
        </button>
      )}

      {/* Estado: jugando */}
      {estado === 'jugando' && (
        <>
          {/* Progreso */}
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Cantados: <b className="text-white">{totalCantados}</b></span>
              <span>Quedan: <b className="text-white">{quedanNums}</b></span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-brand-yellow h-2 rounded-full transition-all duration-500"
                style={{ width: `${(totalCantados / 75) * 100}%` }}
              />
            </div>
          </div>

          {/* Cantar número manual */}
          <button
            onClick={onCantarNum}
            disabled={cantando || autoCantar || quedanNums === 0}
            className="w-full flex items-center justify-center gap-2 bg-brand-yellow text-gray-900 font-bold py-4 rounded-xl hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {cantando ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : <IconDrum />}
            {quedanNums === 0 ? 'Sin más números' : 'Cantar número'}
          </button>

          {/* Auto-cantar toggle */}
          <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Auto-cantar</p>
              <p className="text-xs text-gray-500">Cada {intervaloSeg}s automáticamente</p>
            </div>
            <button
              onClick={onToggleAuto}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoCantar ? 'bg-brand-green' : 'bg-gray-600'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                autoCantar ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Nueva partida */}
          <button
            onClick={onNuevaPartida}
            className="w-full flex items-center justify-center gap-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 py-3 rounded-xl transition text-sm"
          >
            <IconRefresh /> Nueva partida
          </button>
        </>
      )}

      {/* Estado: terminado */}
      {estado === 'terminado' && (
        <button
          onClick={onNuevaPartida}
          className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-bold py-4 rounded-xl hover:bg-green-400 active:scale-95 transition"
        >
          <IconRefresh /> Nueva partida
        </button>
      )}
    </div>
  );
}
