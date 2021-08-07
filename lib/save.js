/* eslint-disable @typescript-eslint/no-var-requires */
const { differenceInSeconds } = require('date-fns')
const fs = require('fs/promises')
const jsonFile = require('jsonfile')

const gamesFile = 'games.json'

async function saveGame(screenshot) {
  console.log('Saving game ...')
  const savedGames = await getSavedGames()
  await jsonFile.writeFile('games.json', [...savedGames, screenshot], {
    spaces: 2,
  })
  console.log('Saved !')
}

async function initSaveFile() {
  try {
    await fs.stat(gamesFile)
  } catch {
    console.log('No games file found, creating a new one ...')
    await fs.writeFile(gamesFile, '[]')
  }
}

async function getSavedGames() {
  return jsonFile.readFile(gamesFile)
}

async function gameExists(screenshotDate) {
  await initSaveFile()
  const savedGames = await getSavedGames()
  const foundGame = savedGames.find((savedGame) => {
    const diff = differenceInSeconds(screenshotDate, new Date(savedGame.date))
    return diff < 60
  })
  return Boolean(foundGame)
}

module.exports = {
  saveGame,
  getSavedGames,
  gameExists,
  initSaveFile,
}
