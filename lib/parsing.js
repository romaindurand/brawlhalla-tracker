/* eslint-disable @typescript-eslint/no-var-requires */
const stringSimilarity = require('string-similarity')
const { normalizeName, getName } = require('./string')
const { getCropsPaths, extractTexts } = require('./image')

const nameMatchThreshold = 0.6
const trackedPlayers = ['Joné', 'Kaivel', 'Breaknuts']

function hasWon(names) {
  return trackedPlayers
    .map(normalizeName)
    .map((trackedPlayer) => {
      const matchInfos = stringSimilarity.findBestMatch(
        trackedPlayer,
        names.map(normalizeName)
      )
      return {
        trackedPlayer,
        matchInfos,
      }
    })
    .filter(
      ({ matchInfos }) => matchInfos.bestMatch.rating > nameMatchThreshold
    )
    .some(({ matchInfos }) => {
      return matchInfos.bestMatchIndex < 2
    })
}

function getScreenshotDate(fileName) {
  const [, year, month, day, hour, minutes, seconds] = fileName
    .split('_')[0]
    .match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
    .map(Number)
  const date = new Date(year, month - 1, day, hour, minutes, seconds)
  return date
}

async function getIndividualElos(imageOriginal, tempDir, fileName) {
  const elosCropPaths = await getCropsPaths(
    'individualElos',
    imageOriginal,
    tempDir,
    fileName
  )
  try {
    const extractedElos = await extractTexts(elosCropPaths)
    return extractedElos.map((text) => Number(text.replaceAll('\n', '')))
  } catch {
    console.log('Error while parsing individual elos')
    throw new Error('IndividualElosParsing')
  }
}
async function getNames(imageOriginal, tempDir, fileName) {
  const identityCropPaths = await getCropsPaths(
    'identity',
    imageOriginal,
    tempDir,
    fileName
    )
    try {
      const extractedIdentities = await extractTexts(identityCropPaths)
      const names = extractedIdentities
      .map(getName)
      .map(normalizeName)
      .map(replaceByTrackedNames)
      return names
    } catch {
      console.log('Error while parsing names')
      throw new Error('NamesParsing')
  }
}

function replaceByTrackedNames(name) {
  const match = stringSimilarity.findBestMatch(
    name,
    trackedPlayers.map(normalizeName)
  )
  if (match.bestMatch.rating >= nameMatchThreshold) {
    return trackedPlayers[match.bestMatchIndex]
  }
  return name
}

async function getTeamElo(imageOriginal, tempDir, fileName) {
  const teamEloCropPath = await getCropsPaths(
    'teamElo',
    imageOriginal,
    tempDir,
    fileName
  )
  try {
    const [teamEloText] = await extractTexts(teamEloCropPath)
    const matches = teamEloText.match(/\d{3,4}/g).map(Number)
    return matches.pop()
  } catch {
    console.log('Error while parsing team elo')
    throw new Error('TeamEloParsing')
  }
}

module.exports = {
  hasWon,
  getScreenshotDate,
  getIndividualElos,
  getNames,
  getTeamElo,
  trackedPlayers,
}
