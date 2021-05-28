import fs from 'fs-extra'
import Edgy from './edgy.js'

const processor = new Edgy({
  build_directory: './build/',
  elements_directory: './src/elements/',
})

processor.buildElements((_elements) => {
  // todo: overwrite block models support
  fs.copySync(
    './src/blocks/cactus.json',
    './build/assets/minecraft/models/block/cactus.json'
  )
})

fs.copySync('./src/pack.mcmeta', './build/pack.mcmeta')
fs.copySync('./src/pack.png', './build/pack.png')
