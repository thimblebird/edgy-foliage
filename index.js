import Edgy, { LOG } from "./edgy.js";

import fs from "fs-extra";
import chalk from "chalk";

const pkg = fs.readJsonSync("./package.json");
const buildName = `${pkg.name}-${pkg.version}-${pkg.config.minecraft_version}`;

const processor = new Edgy({
  build_directory: "./build/",
  build_pack_directory: `./build/resourcepacks/${buildName}/`,
  elements_directory: "./src/elements/",
});

processor.buildElements((_elements) => {
  // todo: overwrite block models support
  fs.copySync(
    "./src/blocks/cactus.json",
    processor.getAssetsDir(`minecraft/models/block/cactus.json`),
  );

  fs.copySync("./src/pack.mcmeta", processor.getPackDir("pack.mcmeta"));
  fs.copySync("./src/pack.png", processor.getPackDir("pack.png"));

  // Respackopts support
  // @see https://mods.jfronny.dev/Respackopts/
  fs.copySync(
    "./src/respackopts.json5",
    processor.getPackDir("respackopts.json5"),
  );
  fs.copySync("./src/respackopts/", processor.getPackDir("/assets/"));

  processor.buildArchive(buildName, (output_filepath) => {
    LOG.console();
    LOG.info(`🎁 Archive output: ${chalk.green(output_filepath)}`);
    LOG.console();
  });
});
