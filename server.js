import fs from 'node:fs/promises'
import { sep } from 'node:path'
import { exec } from 'child_process'
import jsonFile from 'jsonfile'
// import os from 'node:os'

import express from 'express'
import watch from 'node-watch'
import jimp from 'jimp'
import Tesseract from 'tesseract.js'
import stringSimilarity from 'string-similarity'
import { differenceInSeconds } from 'date-fns'

const app = express()
// const tmpDir = os.tmpdir()

const trackedPlayers = ['Joné', 'Kaivel', 'Breaknuts'].map(normalizeName)
const nameMatchThreshold = 0.6

const cropSizes = {
  identity: [200, 47],
  teamElo: [280, 30],
  individualElos: [60, 25],
}
const cropCoords = {
  identity: [
    [309, 646],
    [703, 646],
    [1092, 735],
    [1483, 735],
  ],
  teamElo: [[914, 318]],
  individualElos: [
    [435, 854],
    [829, 854],
    [1219, 944],
    [1612, 944],
  ],
}

app.use('/list', (req, res) => {
  res.json([])
})

exec('npx kill-port 4545', () => {
  app.listen(4545, () => {
    console.log('server listening on http://localhost:4545')
  })
})

watch('./screenshots', { recursive: false }, async function (evt, name) {
  if (evt === 'remove') return console.log('File deleted : %s', name)

  console.log('New file detected : %s.', name)

  if (name.endsWith('.jpg')) {
    return convertToPng(name)
  }

  if (name.endsWith('.png')) {
    const screenshot = await analyzeScreenshot(name)
    await saveGame(screenshot)
    return
  }
})
const gamesFile = 'games.json'
async function saveGame(screenshot) {
  try {
    await fs.stat(gamesFile)
  } catch {
    await fs.writeFile(gamesFile, '[]')
  }
  const games = await jsonFile.readFile(gamesFile)
  const gameExists = games.find((game) => {
    console.log({
      gameDate: game.date,
      screenshotDate: screenshot.date.toJSON(),
    })
    const diff = differenceInSeconds(screenshot.date, new Date(game.date))
    return diff < 60
  })
  if (gameExists) {
    console.log('game already exists')
    return false
  }
  await jsonFile.writeFile('games.json', [...games, screenshot], { spaces: 2 })
}

async function convertToPng(fileName) {
  console.log('Converting screenshot to png ...')
  const image = await jimp.read(fileName)
  await image.write(fileName.replace(/\.jpg$/, '.png'))
  await fs.rm(fileName)
  console.log('Conversion done.')
}

async function analyzeScreenshot(filePath) {
  await fs.rm('eng.traineddata').catch(() => null)
  const fileName = filePath.replace('screenshots/', '')
  console.log('Analyzing screenshot ...')
  // const tempDir = await fs.mkdtemp(`${tmpDir}${sep}`)
  const tempDir = await fs.mkdtemp('temp_' + fileName.replace(/\.png$/, ''))
  const imageOriginal = await jimp.read(filePath)

  try {
    const names = await getNames(imageOriginal, tempDir, fileName)
    const individualElos = await getIndividualElos(
      imageOriginal,
      tempDir,
      fileName
    )
    const win = await hasWon(imageOriginal, tempDir, fileName, names)
    const teamElo = await getTeamElo(imageOriginal, tempDir, fileName)
    const date = getScreenshotDate(fileName)
    console.log({ win, teamElo, names, individualElos, date })
    return { win, teamElo, names, individualElos, date }
  } catch {
    console.log('Error while parsing screenshot, please retry.')
  }
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
    const names = extractedIdentities.map(getName).map(normalizeName)
    return names
  } catch {
    console.log('Error while parsing names')
  }
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
  }
}

async function getCropsPaths(cropKey, imageOriginal, tempDir, fileName) {
  return Promise.all(
    cropCoords[cropKey].map(async ([x, y], index) => {
      const image = imageOriginal.clone()
      const cropPath = tempDir + sep + `${cropKey}${index}_` + fileName
      await image
        .crop(x, y, ...cropSizes[cropKey])
        .greyscale()
        .invert()
        .normalize()
        .write(cropPath)
      return cropPath
    })
  )
}
//C:\Program Files (x86)\Steam\userdata\130364846\760\remote\291550\screenshots
function extractTexts(cropPaths) {
  return Promise.all(
    cropPaths.map(async (cropPath) => {
      const {
        data: { text },
      } = await Tesseract.recognize(
        cropPath,
        'eng'
        // { logger: m => console.log(m) },
      )
      return text
    })
  )
}

async function hasWon(imageOriginal, tempDir, fileName, names) {
  return trackedPlayers
    .map((trackedPlayer) => {
      const matchInfos = stringSimilarity.findBestMatch(trackedPlayer, names)
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

function removeAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeName(name) {
  return removeAccents(name.toLowerCase())
}
