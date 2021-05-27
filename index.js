import fs from 'fs-extra'
import Edgy from './edgy.js'

const processor = new Edgy({
  build_directory: './build/',
  elements_directory: './src/elements/',
})

processor.buildElements((_elements) => {
  // todo: overwrite block models support
  fs.copyFileSync(
    './src/blocks/cactus.json',
    './build/assets/minecraft/models/block/cactus.json'
  )
})

fs.copyFileSync('./src/pack.mcmeta', './build/pack.mcmeta')
fs.copyFileSync('./src/pack.png', './build/pack.png')
