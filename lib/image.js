/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs/promises')
const { sep } = require('path')

const Tesseract = require('tesseract.js')
const jimp = require('jimp')

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

async function convertToPng(fileName) {
  console.log('Converting screenshot to png ...')
  const image = await jimp.read(fileName)
  await image.write(fileName.replace(/\.jpg$/, '.png'))
  await fs.rm(fileName)
  console.log('Conversion done.')
}

module.exports = {
  getCropsPaths,
  extractTexts,
  convertToPng,
}
