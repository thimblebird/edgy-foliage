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

          return { name, file_name, file_path, parents, json: file_json }
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
    this.getParents(element).forEach((parent) => {
      try {
        const outputFilePath = path.join(
          this.build_directory,
          'assets',
          parent.mod_id,
          'models',
          'block',
          parent.file_name
        )

        fs.outputJsonSync(
          outputFilePath,
          {
            ...parent.json,
            elements: [...parent.json.elements, ...element.json.elements],
          },
          { encoding: 'utf8' }
        )

        LOG.elementBuilt(element, parent, outputFilePath)
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

  buildElements = () => {
    this.elements.forEach((element) => this.buildElement(element))
  }
}

// logging
const title = chalk.bgGreen(chalk.black(' Edgy Foliage '))
const LOG = {
  console: console.log,
  elementBuilt: (element, parent, outputFilePath) => {
    try {
      console.log(
        title,
        `Built Element ${chalk.yellow(
          `"${element.name}"`
        )} using Mod ${chalk.magenta(`"${parent.mod_id}"`)} into ${chalk.green(
          `"${outputFilePath}"`
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
