import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'

export default class Edgy {
  constructor(
    options = {
      build_directory,
      elements_directory,
    }
  ) {
    this.build_directory = path.normalize(options.build_directory)
    this.elements_directory = path.normalize(options.elements_directory)

    this.elements = this.getElements(this.elements_directory)
  }

  getElements = () => {
    return fs
      .readdirSync(this.elements_directory, {
        encoding: 'utf8',
        withFileTypes: true,
      })
      .map((element_file) => {
        if (element_file.isFile()) {
          const { base: file_name, name } = path.parse(element_file.name)
          const file_path = path.join(this.elements_directory, file_name)
          const file_json = fs.existsSync(file_path)
            ? fs.readJsonSync(file_path, { encoding: 'utf8' })
            : undefined
          const parents = file_json.parents
          delete file_json.parents

          return {
            name,
            file_name,
            file_path,
            parents,
            options: file_json.options,
            json: file_json,
          }
        }
      })
  }

  getParents = (element = {}) => {
    const parents = []

    try {
      element.parents.forEach((parent) => {
        const root_directory = path
          .dirname(element.file_path)
          .split(path.sep)[0]
        const parents_directory = path.join(root_directory, 'mods')
        const parent_block_path = path.normalize(parent.block)
        const file_path = path.format({
          dir: parents_directory,
          name: parent_block_path,
          ext: '.json',
        })
        const { base: file_name, name } = path.parse(file_path)
        const file_json = fs.existsSync(file_path)
          ? fs.readJsonSync(file_path, { encoding: 'utf8' })
          : undefined

        parents.push({
          mod_id: parent_block_path.split(path.sep)[0],
          name,
          file_name,
          file_path,
          json: file_json,
        })
      })
    } catch (error) {
      LOG.console(error)
    }

    return parents
  }

  buildElement = (element = {}) => {
    const json_options = {
      encoding: 'utf8',
      spaces: 2,
    }

    this.getParents(element).forEach((parent) => {
      try {
        const output_rootpath = path.join(
          this.build_directory,
          'assets',
          parent.mod_id
        )

        const output_filepath = path.join(
          output_rootpath,
          'models',
          'block',
          parent.file_name
        )

        // apply options
        if (element.options) {
          if (element.options.zFighting) {
            const size_modifier = 0.01 * Math.sign(element.options.zFighting)

            element.json.elements.forEach((element_part, part_i) => {
              // fix "from" coordinates
              element_part.from.forEach((_, coord_i) => {
                element.json.elements[part_i].from[coord_i] -= size_modifier
              })

              // fix "to" coordinates
              element_part.to.forEach((_, coord_i) => {
                element.json.elements[part_i].to[coord_i] += size_modifier
              })
            })
          }
        }

        const output_json = {
          parent: element.json.parent || parent.json.parent,
          ambientocclusion:
            element.json.ambientocclusion !== parent.json.ambientocclusion
              ? element.json.ambientocclusion
              : parent.json.ambientocclusion,
          display:
            element.json.display || element.json.display
              ? { ...parent.json.display, ...element.json.display }
              : undefined,
          textures: { ...parent.json.textures, ...element.json.textures },
          elements: [...parent.json.elements, ...element.json.elements],
        }

        // compile model file
        fs.outputJsonSync(output_filepath, output_json, json_options)

        // block states
        if (element.json.blockstates) {
          let blockstates_directory = path.join(output_rootpath, 'blockstates')

          const blockstates = element.json.blockstates

          if (!Array.isArray(blockstates)) {
            // single file block states
            fs.outputJsonSync(
              path.join(blockstates_directory, parent.file_name),
              { ...blockstates },
              json_options
            )
          } else {
            blockstates.forEach((blockstate) => {
              if (blockstate.options) {
                if (blockstate.options.variants) {
                  if (blockstate.options.variants.rotate === true) {
                    for (const variant_key in blockstate.json.variants) {
                      if (
                        Object.hasOwnProperty.call(
                          blockstate.json.variants,
                          variant_key
                        )
                      ) {
                        const variant = blockstate.json.variants[variant_key]

                        if (!Array.isArray(variant)) {
                          blockstate.json.variants[variant_key] = [variant]
                        }

                        if (blockstate.json.variants[variant_key].length > 1) {
                          LOG.console('ERROR! rotation allows only one variant')
                          break
                        }

                        const allowed_degrees = [0, 90, 180, 270]

                        // remove template variant
                        blockstate.json.variants[variant_key].shift()

                        for (let degrees_x = 0; degrees_x <= 270; degrees_x++) {
                          for (
                            let degrees_y = 0;
                            degrees_y <= 270;
                            degrees_y++
                          ) {
                            if (
                              allowed_degrees.includes(degrees_x) &&
                              allowed_degrees.includes(degrees_y)
                            ) {
                              blockstate.json.variants[variant_key].push({
                                model: variant.model,
                                x: degrees_x,
                                y: degrees_y,
                              })
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              blockstates_directory = path.join(
                path.join(
                  this.build_directory,
                  'assets',
                  blockstate.mod_id || parent.mod_id
                ),
                'blockstates'
              )

              fs.outputJsonSync(
                path.join(
                  blockstates_directory,
                  path.format({ name: blockstate.name, ext: '.json' })
                ),
                blockstate.json,
                json_options
              )
            })
          }
        }

        LOG.elementBuilt(element, parent, output_filepath)
      } catch (error) {
        return LOG.modelForElementNotFound({
          mod_id: parent.mod_id,
          model: parent.name,
          model_path: parent.file_path,
          element: element.name,
        })
      }
    })
  }

  buildElements = (callback) => {
    // clean build folder
    const clean_directory = path.join(this.build_directory, 'assets')

    fs.remove(clean_directory, (err) => {
      if (err) throw err

      LOG.buildCleaned(clean_directory)

      // build
      this.elements.forEach((element) => this.buildElement(element))

      // callback
      if (typeof callback === 'function') {
        callback(this.elements)
      }
    })
  }
}

// logging
const title = chalk.bgGreen(chalk.black(' Edgy Foliage '))
const LOG = {
  console: console.log,
  buildCleaned: (build_directory) => {
    console.log(
      title,
      `Build Directory ${chalk.green(`"${build_directory}"`)} all cleaned up`
    )
  },
  elementBuilt: (element, parent, output_filepath) => {
    try {
      console.log(
        title,
        `Built Element ${chalk.yellow(
          `"${element.name}"`
        )} using Mod ${chalk.magenta(`"${parent.mod_id}"`)} into ${chalk.green(
          `"${output_filepath}"`
        )}`
      )
    } catch (error) {
      throw error
    }
  },
  modelForElementNotFound: (data = {}, options = { skipping: true }) => {
    try {
      console.warn(
        title,
        options.skipping ? chalk.gray('WARNING:') : chalk.red('ERROR:'),
        `Model ${chalk.yellow(`"${data.model}"`)} from Mod ${chalk.magenta(
          `"${data.mod_id}"`
        )} in Element ${chalk.cyan(
          `"${data.element}"`
        )} not found in Path ${chalk.green(`"${data.model_path}"`)}`,
        options.skipping ? chalk.gray('(skipping)') : chalk.red('(aborting)')
      )
    } catch (error) {
      throw error
    }
  },
}
