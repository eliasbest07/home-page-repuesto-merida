# Pruebas de reglas

Prueban `../firestore.rules`, `../storage.rules` y `../database.rules.json`
contra los emuladores de Firebase, con las escrituras exactas que hace la app
(servicios, chat moderado por el oso, solicitudes, opiniones, reportes, Mis
vehículos y el candado de `users/{uid}/taller`).

```bash
npm install
npm test
```

Correrlas antes de cada `firebase deploy` de reglas. Necesita Java 17+; el CLI
descarga los emuladores la primera vez. El script usa el Node de npm
(`$npm_node_execpath`) porque el `firebase` instalado como binario trae su
propio Node 18 y con ese `node --test` no funciona.
