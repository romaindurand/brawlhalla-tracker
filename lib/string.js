function removeAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeName(name) {
  return removeAccents(name.toLowerCase())
}

function getName(identity) {
  const identityChunks = identity
    .split('\n')
    .filter(
      (line) =>
        line.trim() !== '' && !line.startsWith('<') && !line.endsWith('>')
    )
    .map((line) => line.replace(/\s+/g, ' ').trim())
  return identityChunks.pop()
}

module.exports = {
  removeAccents,
  normalizeName,
  getName,
}
