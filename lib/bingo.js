// ─── Bingo helpers (pure, no Firebase) ────────────────────────────────────────

/** Rangos por columna: B=1-15, I=16-30, N=31-45, G=46-60, O=61-75 */
const COLUMN_RANGES = [
  { min: 1,  max: 15 },  // B
  { min: 16, max: 30 },  // I
  { min: 31, max: 45 },  // N
  { min: 46, max: 60 },  // G
  { min: 61, max: 75 },  // O
];

const HEADERS = ['B', 'I', 'N', 'G', 'O'];

/** Genera N números únicos aleatorios dentro de [min, max] */
function randomUnique(min, max, count) {
  const pool = [];
  for (let i = min; i <= max; i++) pool.push(i);
  // Fisher-Yates shuffle parcial
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Normaliza el cartón a una matriz 5×5.
 * Soporta formato legado `number[][]` y formato Firestore-friendly
 * `[{ values: number[] }]`.
 */
export function normalizeCarton(carton) {
  if (!Array.isArray(carton)) return [];
  if (carton.every((fila) => Array.isArray(fila))) return carton;
  return carton.map((fila) => (Array.isArray(fila?.values) ? fila.values : []));
}

/**
 * Genera un cartón de bingo 5×5 en un formato compatible con Firestore.
 * Retorna array de filas, donde cada fila es un objeto con `values`.
 * El centro [2][2] es 0 (casilla libre).
 */
export function generateCarton() {
  // Generamos por columnas, luego transponemos a filas
  const cols = COLUMN_RANGES.map(({ min, max }) => randomUnique(min, max, 5));
  // Centro libre
  cols[2][2] = 0;

  // Transponer: rows[fila][col]
  const rows = [];
  for (let r = 0; r < 5; r++) {
    rows.push(cols.map((col) => col[r]));
  }
  return rows.map((values) => ({ values }));
}

/**
 * Genera un código de sala de 6 caracteres alfanumérico en mayúsculas.
 */
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I,O,0,1 para evitar confusión
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Retorna el encabezado de columna (B/I/N/G/O) dado el índice de columna.
 */
export function getHeader(colIndex) {
  return HEADERS[colIndex];
}

/**
 * Verifica si un número en el cartón está cantado o es casilla libre (0).
 */
function isMarcado(num, cantadas) {
  if (num === 0) return true; // libre
  return cantadas.includes(num);
}

/**
 * Verifica si el jugador ganó según el modo de victoria.
 * @param {number[][] | { values: number[] }[]} carton  - Cartón 5×5
 * @param {number[]}   cantadas - Números cantados hasta ahora
 * @param {string}     modo - 'linea' | 'L' | 'T' | 'lleno'
 * @returns {boolean}
 */
export function checkBingo(carton, cantadas, modo = 'linea') {
  const matriz = normalizeCarton(carton);
  const m = (r, c) => isMarcado(matriz[r]?.[c], cantadas);

  const filaCompleta = (r) => [0, 1, 2, 3, 4].every((c) => m(r, c));
  const colCompleta  = (c) => [0, 1, 2, 3, 4].every((r) => m(r, c));
  const diagPpal     = () => [0, 1, 2, 3, 4].every((i) => m(i, i));
  const diagAnti     = () => [0, 1, 2, 3, 4].every((i) => m(i, 4 - i));

  switch (modo) {
    case 'linea':
      return (
        [0, 1, 2, 3, 4].some(filaCompleta) ||
        [0, 1, 2, 3, 4].some(colCompleta)  ||
        diagPpal() || diagAnti()
      );

    case 'L':
      // Columna izquierda (col 0) + fila inferior (fila 4)
      return colCompleta(0) && filaCompleta(4);

    case 'T':
      // Fila superior (fila 0) + columna central (col 2)
      return filaCompleta(0) && colCompleta(2);

    case 'lleno':
      return matriz.every((fila, r) =>
        fila.every((_, c) => m(r, c))
      );

    default:
      return false;
  }
}

/**
 * Devuelve todos los números del 1 al 75 en orden aleatorio (bombo).
 */
export function generarBombo() {
  const nums = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

/**
 * Dado un número (1-75) retorna su letra de columna (B/I/N/G/O).
 */
export function letraDeNumero(num) {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}
