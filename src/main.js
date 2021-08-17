/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs/promises')
const path = require('path')
// const os = require('node:os')

const express = require('express')
const { app, BrowserWindow } = require('electron')
const electronReload = require('electron-reload')
const jimp = require('jimp')
const watch = require('node-watch')
const jsonFile = require('jsonfile')

const { saveGame, gameExists, getSavedGames } = require('../lib/save')
const {
  hasWon,
  getScreenshotDate,
  getNames,
  getIndividualElos,
  getTeamElo,
  trackedPlayers,
} = require('../lib/parsing')
const { convertToPng } = require('../lib/image')

// const tmpDir = os.tmpdir()

electronReload('**/*.{js,svelte}')

const server = express()

server.get('/games', async (req, res, next) => {
  const games = await getSavedGames()
  trackedPlayers.reduce((memo, trackedPlayer) => {
    memo[trackedPlayer] = games.filter(savedGame => {
      return savedGame.names.includes(trackedPlayer)
    }).sort((a, b) => +Date(a.date) - +Date(b.date))
    return memo
  }, {})
  console.log({ games })
  res.send(games)
  // games.filter(game => {
  //   game.names.
  ////})
  next()
})

server.listen(5555, () => {
  console.log('Server listening on http://localhost:5555')
})

function createWindow() {
  const mainWindow = new BrowserWindow()
  mainWindow.loadFile(path.join(__dirname, '../public/index.html'))
  mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()
})

watch('./screenshots', { recursive: false }, async function (evt, name) {
  if (evt === 'remove') return console.log('File deleted : %s', name)

  console.log('New file detected : %s.', name)

  if (name.endsWith('.jpg')) {
    return convertToPng(name)
  }

  if (name.endsWith('.png')) {
    const date = getScreenshotDate(name)
    if (await gameExists(date)) {
      console.log('game already exists')
      return
    }
    try {
      const screenshot = await analyzeScreenshot(name)
      await saveGame({ ...screenshot, date })
      return
    } catch (ex) {
      console.dir({ ex }, { depth: 10 })
      jsonFile.writeFile('tesseract.log', {
        message: ex.message,
        stack: ex.stack.split('\n'),
      })
      console.log('Error while parsing screenshot, please retry.')
      await fs.rm('eng.traineddata').catch(() => null)
      console.log('Deleted eng.traineddata')
    }
  }
})

async function analyzeScreenshot(filePath) {
  const fileName = filePath
    .replace('screenshots/', '')
    .replace('screenshots\\', '')
  console.log('Analyzing screenshot ...')
  // const tempDir = await fs.mkdtemp(`${tmpDir}${sep}`)
  const tempDir = await fs.mkdtemp('temp_' + fileName.replace(/\.png$/, ''))
  const imageOriginal = await jimp.read(filePath)

  const names = await getNames(imageOriginal, tempDir, fileName)
  const individualElos = await getIndividualElos(
    imageOriginal,
    tempDir,
    fileName
  )
  const win = hasWon(names)
  const teamElo = await getTeamElo(imageOriginal, tempDir, fileName)

  console.log({ win, teamElo, names, individualElos })
  return { win, teamElo, names, individualElos }
}
