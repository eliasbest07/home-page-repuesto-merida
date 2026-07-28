import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    // Next 16/React 19 habilita comprobaciones nuevas sobre patrones heredados.
    // Se mantienen visibles como advertencias para migrarlos gradualmente sin
    // convertir esta actualización de dependencias en un refactor funcional.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'build/**',
    'coverage/**',
    'out/**',
    'output/**',
    'next-env.d.ts',
  ]),
])
