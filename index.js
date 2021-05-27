import fs from 'fs-extra'
import Edgy from './edgy.js'

const processor = new Edgy({
  build_directory: './build/',
  elements_directory: './src/elements/',
})

processor.buildElements()

fs.copyFileSync('./src/pack.mcmeta', './build/pack.mcmeta')
fs.copyFileSync('./src/pack.png', './build/pack.png')
