#!/usr/bin/env node
// Verifica que `firestore.rules` sea identico en este repo (canonico) y en el
// de la app Flutter. Los dos declaran el archivo en su firebase.json, asi que
// el ultimo `firebase deploy` gana: cuando divergen, uno de los dos clientes
// se queda sin permisos y falla en silencio.
//
//   node scripts/check-rules-sync.mjs         -> comprueba (sale 1 si difieren)
//   node scripts/check-rules-sync.mjs --fix   -> copia el canonico sobre la copia
//
// La ruta del repo Flutter se puede cambiar con FLUTTER_REPO=/otra/ruta.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const flutterRepo = process.env.FLUTTER_REPO
  || resolve(repoRoot, '..', 'repuestos_merida')

const canonical = resolve(repoRoot, 'firestore.rules')
const copy = resolve(flutterRepo, 'firestore.rules')
const fix = process.argv.includes('--fix')

if (!existsSync(copy)) {
  console.error(`[reglas] no encuentro ${copy}. Define FLUTTER_REPO si el repo esta en otra ruta.`)
  process.exit(1)
}

const a = readFileSync(canonical, 'utf8')
const b = readFileSync(copy, 'utf8')

if (a === b) {
  console.log('[reglas] firestore.rules sincronizado en ambos repos.')
  process.exit(0)
}

if (fix) {
  writeFileSync(copy, a)
  console.log(`[reglas] copiado ${canonical} -> ${copy}`)
  process.exit(0)
}

console.error('[reglas] firestore.rules DIFIERE entre los repos.')
console.error(`  canonico: ${canonical}`)
console.error(`  copia:    ${copy}`)
console.error('  Ejecuta: node scripts/check-rules-sync.mjs --fix')
process.exit(1)
