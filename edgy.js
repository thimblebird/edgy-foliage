import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import zipLocal from "zip-local";

export default class Edgy {
  constructor(
    options = {
      build_directory,
      elements_directory,
    }
  ) {
    this.build_directory = path.normalize(options.build_directory);
    this.build_pack_directory = path.normalize(options.build_pack_directory);
    this.elements_directory = path.normalize(options.elements_directory);
    this.elements = this.getElements(this.elements_directory);
  }

  getPackDir = (join_path = "") => {
    return path.join(this.build_pack_directory, join_path);
  };

  getAssetsDir = (join_path = "") => {
    return path.join(this.build_pack_directory, "assets", join_path);
  };

  getElements = () => {
    return fs
      .readdirSync(this.elements_directory, {
        encoding: "utf8",
        withFileTypes: true,
      })
      .map((element_file) => {
        if (element_file.isFile()) {
          const { base: file_name, name } = path.parse(element_file.name);
          const file_path = path.join(this.elements_directory, file_name);
          const file_json = fs.existsSync(file_path)
            ? fs.readJsonSync(file_path, { encoding: "utf8" })
            : undefined;
          const parents = file_json.parents;
          delete file_json.parents;

          return {
            name,
            file_name,
            file_path,
            parents,
            options: file_json.options,
            json: file_json,
          };
        }
      });
  };

  getParents = (element = {}) => {
    const parents = [];

    try {
      element.parents.forEach((parent) => {
        const root_directory = path
          .dirname(element.file_path)
          .split(path.sep)[0];
        const parents_directory = path.join(root_directory, "mods");
        const parent_block_path = path.normalize(parent.block);
        const file_path = path.format({
          dir: parents_directory,
          name: parent_block_path,
          ext: ".json",
        });
        const { base: file_name, name } = path.parse(file_path);
        const file_json = fs.existsSync(file_path)
          ? fs.readJsonSync(file_path, { encoding: "utf8" })
          : undefined;

        parents.push({
          mod_id: parent_block_path.split(path.sep)[0],
          name,
          file_name,
          file_path,
          json: file_json,
        });
      });
    } catch (error) {
      LOG.console(error);
    }

    return parents;
  };

  buildElement = (element = {}) => {
    const json_options = {
      encoding: "utf8",
      spaces: 2,
    };

    let options_applied = false;

    this.getParents(element).forEach((parent, _parent_i) => {
      try {
        const output_rootpath = this.getAssetsDir(parent.mod_id);
        const output_filepath = path.join(
          output_rootpath,
          "models",
          "block",
          parent.file_name
        );

        // apply options
        if (element.options && !options_applied) {
          if (element.options.zFighting) {
            const size_modifier = 0.01 * Math.sign(element.options.zFighting);

            element.json.elements.forEach((element_part, part_i) => {
              element.json.elements[part_i].from.forEach((coord, coord_i) => {
                let from_size = coord - size_modifier;
                if (from_size < -32) return;
                element.json.elements[part_i].from[coord_i] = from_size;
              });

              element.json.elements[part_i].to.forEach((coord, coord_i) => {
                let to_size = coord + size_modifier;
                if (to_size > 32) return;
                element.json.elements[part_i].to[coord_i] = to_size;
              });
            });
          }

          options_applied = true;
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
        };

        if (parent.json.render_type) {
          output_json.render_type = parent.json.render_type;
        }

        // compile model file
        fs.outputJsonSync(output_filepath, output_json, json_options);

        // block states
        if (element.json.blockstates) {
          let blockstates_directory = path.join(output_rootpath, "blockstates");

          const blockstates = element.json.blockstates;

          if (!Array.isArray(blockstates)) {
            // single file block states
            fs.outputJsonSync(
              path.join(blockstates_directory, parent.file_name),
              { ...blockstates },
              json_options
            );
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
                        const variant = blockstate.json.variants[variant_key];

                        if (!Array.isArray(variant)) {
                          blockstate.json.variants[variant_key] = [variant];
                        }

                        if (blockstate.json.variants[variant_key].length > 1) {
                          LOG.console(
                            "ERROR! rotation allows only one variant"
                          );
                          break;
                        }

                        const allowed_degrees = [0, 90, 180, 270];

                        // remove template variant
                        blockstate.json.variants[variant_key].shift();

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
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              blockstates_directory = path.join(
                this.getAssetsDir(blockstate.mod_id || parent.mod_id),
                "blockstates"
              );

              fs.outputJsonSync(
                path.join(
                  blockstates_directory,
                  path.format({ name: blockstate.name, ext: ".json" })
                ),
                blockstate.json,
                json_options
              );
            });
          }
        }

        LOG.elementBuilt(element, parent, output_filepath);
      } catch (error) {
        return LOG.modelForElementNotFound({
          mod_id: parent.mod_id,
          model: parent.name,
          model_path: parent.file_path,
          element: element.name,
        });
      }
    });
  };

  buildElements = (callback) => {
    // clean build folder
    fs.remove(this.getAssetsDir(), (err) => {
      //if (!err) throw err;

      LOG.buildCleaned(this.getAssetsDir());

      // build
      this.elements.forEach((element) => this.buildElement(element));

      // callback
      if (typeof callback === "function") {
        callback(this.elements);
      }
    });
  };

  buildArchive = (name, callback) => {
    const output_filepath = `${path.join(this.build_directory, name)}.zip`;

    // remove build archive if present
    fs.remove(output_filepath, (err) => {
      if (err) throw err;

      LOG.buildCleaned(output_filepath);

      // build
      zipLocal.zip(this.build_pack_directory, (err, archive) => {
        if (!err) {
          archive.save(output_filepath, (err) => {
            if (!err && typeof callback === "function") {
              callback(output_filepath);
            }
          });
        }
      });
    });
  };
}

const UTIL = {
  readdirSyncDeep: (dir) => {
    let results = [];

    fs.readdirSync(dir).forEach((file) => {
      file = path.join(dir, file);

      let stat = fs.statSync(file);

      if (stat && stat.isDirectory()) {
        results = results.concat(UTIL.readdirSyncDeep(file));
      } else {
        results.push(file);
      }
    });

    return results;
  },
};

// logging
export const title = chalk.bgGreen(chalk.black(" Edgy Foliage "));
export const LOG = {
  console: console.log,
  info: (str) => {
    if (str.length) {
      console.log(`${title}${chalk.bgGray(chalk.black(" INFO "))}`, str);
    }
  },
  error: (str) => {
    if (str.length) {
      console.error(`${title}${chalk.bgRed(chalk.black(" ERR# "))}`, str);
    }
  },
  buildCleaned: (clean_path) => {
    try {
      let stats = fs.statSync(clean_path);
      console.log(
        title,
        `Build ${stats.isFile() ? "file" : "directory"} ${chalk.green(
          `"${clean_path}"`
        )} all cleaned up`
      );
    } catch (error) {}
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
      );
    } catch (error) {
      throw error;
    }
  },
  modelForElementNotFound: (data = {}, options = { skipping: true }) => {
    try {
      console.warn(
        title,
        options.skipping ? chalk.gray("WARNING:") : chalk.red("ERROR:"),
        `Model ${chalk.yellow(`"${data.model}"`)} from Mod ${chalk.magenta(
          `"${data.mod_id}"`
        )} in Element ${chalk.cyan(
          `"${data.element}"`
        )} not found in Path ${chalk.green(`"${data.model_path}"`)}`,
        options.skipping ? chalk.gray("(skipping)") : chalk.red("(aborting)")
      );
    } catch (error) {
      throw error;
    }
  },
};
