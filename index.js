import Edgy, { LOG } from "./edgy.js";

import fs from "fs-extra";
import chalk from "chalk";
import { Jimp, ResizeStrategy } from "jimp";

const pkg = fs.readJsonSync("./package.json");
const buildName = `${pkg.name}-${pkg.version}-${pkg.config.minecraft_version}`;

const processor = new Edgy({
  build_directory: "./build/",
  build_pack_directory: `./build/resourcepacks/${buildName}/`,
  elements_directory: "./src/elements/"
});

processor.buildElements((_elements) => {
  // todo: overwrite block models support
  fs.copySync(
    "./src/blocks/cactus.json",
    processor.getAssetsDir(`minecraft/models/block/cactus.json`)
  );

  fs.copySync("./src/pack.mcmeta", processor.getPackDir("pack.mcmeta"));
  fs.copySync("./src/pack.png", processor.getPackDir("pack.png"));

  // Respackopts support
  // @see https://mods.jfronny.dev/Respackopts/
  fs.copySync(
    "./src/respackopts.json5",
    processor.getPackDir("respackopts.json5")
  );
  fs.copySync("./src/respackopts/", processor.getPackDir("/assets/"));

  processor.buildArchive(buildName, (output_filepath) => {
    LOG.console();
    LOG.info(`🎁 Archive output: ${chalk.green(output_filepath)}`);
    LOG.console();
  });

  // build higher resolution images from pack icon
  const image_sizes = [400];

  image_sizes.forEach((image_size) => {
    const image_output_filepath = `${processor.build_directory}icon-${image_size}x${image_size}.png`;

    Jimp.read(processor.getPackDir("pack.png"))
      .then((icon) => {
        return icon
          .resize({
            w: image_size,
            h: image_size,
            mode: ResizeStrategy.NEAREST_NEIGHBOR
          })
          .write(image_output_filepath);
      })
      .then(() => {
        LOG.console();
        LOG.info(
          `🎨 Project image output: ${chalk.green(image_output_filepath)}`
        );
      })
      .catch((err) => {
        LOG.error(err);
      });
  });
});
