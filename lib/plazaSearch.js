function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isOneEditApart(left, right) {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false

  let i = 0
  let j = 0
  let edits = 0

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1
      j += 1
      continue
    }

    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) i += 1
    else if (right.length > left.length) j += 1
    else {
      i += 1
      j += 1
    }
  }

  return edits + Number(i < left.length || j < right.length) <= 1
}

function wordMatches(queryWord, indexedWord) {
  if (indexedWord.includes(queryWord)) return true
  // Palabras indexadas muy cortas ("a", "el", "45") coinciden dentro de casi
  // cualquier consulta larga; exigir un mínimo evita esos falsos positivos.
  if (indexedWord.length >= 3 && queryWord.includes(indexedWord)) return true
  return queryWord.length >= 5 && indexedWord.length >= 5 && isOneEditApart(queryWord, indexedWord)
}

// Mismo criterio que el backend: quita prefijo 58 y ceros iniciales para que
// "+584123477457", "04123477457" y "412-347.74.57" sean el mismo número.
function canonPhoneDigits(digits) {
  let d = String(digits || '')
  if (d.startsWith('58') && d.length >= 11) d = d.slice(2)
  return d.replace(/^0+/, '')
}

// Agrupa dígitos separados por espacios/guiones/puntos como un solo número:
// "58 424-784947" → "58424784947". Sin esto, "424" quedaría como token suelto
// y coincidiría dentro de cualquier búsqueda de teléfono.
function phoneDigitGroups(value) {
  const groups = String(value || '').match(/\d(?:[\s().+-]*\d)+/g) || []
  return groups.map(group => group.replace(/\D/g, ''))
}

function matchesPhone(item, canonQuery) {
  return [item.telefono, item.whatsapp, item.vendedor, item.descripcion]
    .flatMap(phoneDigitGroups)
    .some(group => group.includes(canonQuery) || canonPhoneDigits(group).includes(canonQuery))
}

function matchesEmail(item, rawQuery) {
  const query = rawQuery.toLowerCase()
  return [item.correo, item.email, item.descripcion, item.titulo, item.vendedor]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query)
}

export function matchesPlazaSearch(item, query) {
  const rawQuery = String(query || '').trim()
  if (!rawQuery) return true

  if (rawQuery.includes('@') && matchesEmail(item, rawQuery)) return true

  // Consulta numérica (solo dígitos y separadores + - . ( ) espacios)
  const isPhoneQuery = !/[^\d\s()+\-.]/.test(rawQuery)
  const canonQuery = isPhoneQuery ? canonPhoneDigits(rawQuery.replace(/\D/g, '')) : ''
  if (canonQuery.length >= 4 && matchesPhone(item, canonQuery)) return true
  // Un teléfono completo (7+ dígitos) solo debe coincidir como teléfono;
  // si cayera a la búsqueda por palabras daría falsos positivos.
  if (canonQuery.length >= 7) return false

  const normalizedQuery = normalizeSearchText(rawQuery)
  if (!normalizedQuery) return false

  const indexedText = normalizeSearchText([
    item.titulo,
    item.descripcion,
    item.vendedor,
    item.categoria,
    item.tipo,
    item.telefono,
    item.whatsapp,
    item.correo,
    item.email,
  ].filter(Boolean).join(' '))

  const indexedWords = indexedText.split(' ').filter(Boolean)
  return normalizedQuery.split(' ').every(queryWord =>
    indexedWords.some(indexedWord => wordMatches(queryWord, indexedWord))
  )
}
