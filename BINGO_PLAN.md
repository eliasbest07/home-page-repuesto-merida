# Plan: Sistema de Bingo — `/bingo`

> Fecha: 2026-04-07  
> Stack: Next.js 14 (App Router) · Firebase Firestore (real-time) · Tailwind CSS 3  
> Paleta: brand.yellow #FFD700 · brand.green #22C55E · brand.dark #111827

---

## 1. Objetivo

Crear un sistema de bingo multijugador en tiempo real accesible desde `/bingo`. Permite:

- **Crear una sala** (anfitrión): genera código único, controla el juego, canta números.
- **Unirse a una sala** (jugador): ingresa con código + nombre, recibe cartón, marca números.

---

## 2. Estructura de archivos

```
app/bingo/
├── page.js                        # Landing: crear sala / unirse a sala
├── sala/
│   └── [id]/
│       └── page.js                # Sala de juego (host + jugadores comparten ruta)
└── components/
    ├── Carton.jsx                  # Tarjeta 5×5 interactiva
    ├── TableroCantadas.jsx         # Bolillas cantadas (1-75)
    ├── ControlesHost.jsx           # Panel del anfitrión (cantar, auto, reiniciar)
    ├── ListaJugadores.jsx          # Lista en tiempo real de jugadores
    └── ModalGanador.jsx            # Celebración al ganar

lib/
└── bingo.js                       # Helpers puros: generar cartón, código, verificar bingo
```

---

## 3. Estructura en Firestore

```
bingo_salas/{salaId}
  ├── codigo           : "ABC123"        # Código de 6 chars para unirse
  ├── nombre           : "Sala de Ana"   # Nombre descriptivo
  ├── host_session     : "uuid-v4"       # ID de sesión del anfitrión (localStorage)
  ├── estado           : "esperando" | "jugando" | "terminado"
  ├── numeros_cantados : [5, 32, 17, …]  # Array de enteros, en orden de canto
  ├── ultimo_numero    : 32              # Último número cantado (para animación)
  ├── modo_victoria    : "linea" | "L" | "T" | "lleno"
  ├── auto_cantar      : false           # Modo automático activado
  ├── intervalo_seg    : 5              # Segundos entre cantos automáticos
  ├── creado_en        : Timestamp
  └── jugadores/ (subcolección)
        {jugadorId}
          ├── nombre     : "María"
          ├── session_id : "uuid-v4"
          ├── carton     : [[n,n,n,n,n], …]  # 5×5 (centro = 0 = libre)
          ├── gano       : false
          └── unido_en   : Timestamp
```

---

## 4. Flujos de usuario

### 4.1 Crear sala (anfitrión)
1. En `/bingo`: formulario → nombre del anfitrión, nombre de sala, modo de victoria.
2. Click "Crear Sala":
   - Genera `salaId` (auto Firestore) y `codigo` (6 chars alfanumérico).
   - Guarda `host_session` en `localStorage`.
   - Crea doc en `bingo_salas`.
3. Redirige a `/bingo/sala/[id]`.
4. **Sala en espera**: ve jugadores unirse en tiempo real.
5. Con ≥1 jugador, botón "Iniciar Juego" disponible.
6. Durante el juego: panel de host con:
   - "Cantar siguiente" (manual).
   - Toggle "Auto cantar" con intervalo configurable.
   - Lista de números cantados.
   - Botón "Nueva partida" (reinicia estado sin borrar sala).

### 4.2 Unirse a sala (jugador)
1. En `/bingo`: formulario → código de sala + nombre del jugador.
2. Click "Unirse":
   - Busca sala por `codigo` en Firestore.
   - Genera cartón 5×5.
   - Crea doc en subcolección `jugadores`.
   - Guarda `session_id` y `jugadorId` en `localStorage`.
3. Redirige a `/bingo/sala/[id]`.
4. **Espera**: ve mensaje "Esperando al anfitrión…".
5. Al iniciar: cartón activo, marca números con click.
6. Al completar patrón: botón "¡BINGO!" → verifica en cliente → notifica a Firestore.

---

## 5. Lógica del cartón (`lib/bingo.js`)

```
B: 1–15  (col 0)
I: 16–30 (col 1)
N: 31–45 (col 2) → centro [2][2] = 0 (libre)
G: 46–60 (col 3)
O: 61–75 (col 4)
```

Cada columna: 5 números únicos aleatorios de su rango.  
`generateCarton()` → array 5×5.  
`checkBingo(carton, cantadas, modo)` → bool.  
`generateCode()` → string de 6 chars (A-Z0-9).

---

## 6. Modos de victoria

| Modo     | Descripción                                 |
|----------|---------------------------------------------|
| `linea`  | Cualquier fila, columna o diagonal completa |
| `L`      | Columna izquierda + fila inferior           |
| `T`      | Fila superior + columna central             |
| `lleno`  | Toda la tarjeta                             |

---

## 7. Tiempo real

- **`onSnapshot`** en `bingo_salas/{id}` → el jugador ve `numeros_cantados` y `estado` en vivo.
- **`onSnapshot`** en `jugadores/` → el host ve lista de jugadores en vivo.
- Sin polling. Sin RTDB (Firestore es suficiente para esta carga).

---

## 8. Gestión de identidad (sin login)

- Al crear/unirse: `crypto.randomUUID()` guardado en `localStorage` como `bingo_session`.
- El host compara su `session_id` con `host_session` del doc para mostrar controles.
- Los jugadores comparan su `session_id` con su propio doc de jugador.

---

## 9. UX / Diseño

- Paleta brand: fondo `#111827`, acentos `#FFD700` y `#22C55E`.
- Cartón: celda marcada → fondo amarillo, borde verde, transición suave.
- Último número cantado: animación de "bolilla" con pulse.
- Modal ganador: overlay con confeti CSS, nombre del ganador, botón "Nueva partida".
- Responsive: mobile-first (cartón ocupa pantalla completa en móvil).

---

## 10. Pasos de ejecución (en orden)

| # | Paso | Archivo(s) |
|---|------|------------|
| 1 | Helper de lógica de bingo | `lib/bingo.js` |
| 2 | Landing page (crear/unirse) | `app/bingo/page.js` |
| 3 | Componente Cartón | `app/bingo/components/Carton.jsx` |
| 4 | Componente Bolillas cantadas | `app/bingo/components/TableroCantadas.jsx` |
| 5 | Componente Lista de jugadores | `app/bingo/components/ListaJugadores.jsx` |
| 6 | Componente Controles del host | `app/bingo/components/ControlesHost.jsx` |
| 7 | Modal ganador | `app/bingo/components/ModalGanador.jsx` |
| 8 | Sala de juego principal | `app/bingo/sala/[id]/page.js` |
| 9 | Índices Firestore | `firestore.indexes.json` |
| 10 | Enlace en navbar (opcional) | `app/page.js` |

---

## 11. Firestore Security Rules (añadir)

```javascript
match /bingo_salas/{salaId} {
  allow read: if true;
  allow create: if request.resource.data.keys().hasAll(['codigo','host_session','estado']);
  allow update: if true; // simplificado para MVP
  
  match /jugadores/{jugadorId} {
    allow read: if true;
    allow create: if request.resource.data.keys().hasAll(['nombre','session_id','carton']);
    allow update: if true;
  }
}
```

---

## 12. Índices Firestore necesarios

```json
{
  "collectionGroup": "bingo_salas",
  "fields": [
    { "fieldPath": "codigo", "order": "ASCENDING" },
    { "fieldPath": "estado", "order": "ASCENDING" }
  ]
}
```

---

**¿Listo para ejecutar?** Confirma y procedemos paso a paso desde el Paso 1.
