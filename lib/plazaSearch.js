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
  if (indexedWord.includes(queryWord) || queryWord.includes(indexedWord)) return true
  return queryWord.length >= 5 && indexedWord.length >= 5 && isOneEditApart(queryWord, indexedWord)
}

export function matchesPlazaSearch(item, query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const indexedText = normalizeSearchText([
    item.titulo,
    item.descripcion,
    item.vendedor,
    item.categoria,
    item.tipo,
  ].filter(Boolean).join(' '))

  const indexedWords = indexedText.split(' ').filter(Boolean)
  return normalizedQuery.split(' ').every(queryWord =>
    indexedWords.some(indexedWord => wordMatches(queryWord, indexedWord))
  )
}
