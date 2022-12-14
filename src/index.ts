import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { generateThemeLocales } from "./generate-theme-locales";
import { generateThemeSections } from "./generate-theme-sections";
import { generateThemeSettings } from "./generate-theme-settings";
import { initThemeFolders } from "./init-theme-folders";
import { createMetafieldTypes } from "./create-metafield-types";
import { ShopifySection, ShopifySettings } from "types/shopify";
import { generateSections } from "./generate-sections";
import { generateSettings } from "./generate-settings";
import { copyFiles } from "./init-copy-files";
import { initFolders } from "./init-folders";

const watch = require("node-watch");

require("dotenv").config();

const program = new Command();

program.version(require("./package.json").version).parse(process.argv);

const { SHOPIFY_SETTINGS_FOLDER, SHOPIFY_THEME_FOLDER } = process.env;

export const init = async () => {
  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Shopify CMS Started`
    )}`
  );
  initFolders();

  if (SHOPIFY_THEME_FOLDER) {
    initThemeFolders(SHOPIFY_THEME_FOLDER);
  }

  createMetafieldTypes();
  copyFiles();

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(`Checking Theme`)}`
  );

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(`Theme Checked`)}`
  );

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(`Metafields Checked`)}`
  );

  if (!SHOPIFY_SETTINGS_FOLDER) return;

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Watching for changes in /${SHOPIFY_SETTINGS_FOLDER}/`
    )}`
  );

  if (fs.existsSync(path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER))) {
    watch(
      path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER),
      { recursive: true },
      async (evt, name) => {
        if (!name.match(/\.(ts|tsx)$/)) return;
        if (name.match(/^index\.ts.$/)) return;
        if (name.match(/^_/)) return;

        const files = fs.readdirSync(path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER));
        const startTime = Date.now();

        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.cyan(
            `File modified: ${name}`
          )}`
        );

        const sections: { [T: string]: ShopifySection } = files
          .filter((name) => {
            if (!name.match(/\.(ts|tsx)$/)) return false;
            if (name.match(/^index\.ts.$/)) return false;
            if (name.match(/^_/)) return false;
            if (name.match("settings_schema")) return false;
            const isDirectory = fs
              .statSync(path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER, name))
              .isDirectory();
            if (isDirectory) return false;
            return true;
          })
          .reduce(
            (acc, file) => {
              try {
                const filename = path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER, file);
                const data = require(filename);
                delete require.cache[filename];
                return { ...acc, ...data };
              } catch (err) {
                console.log(chalk.redBright(err.message));
                return acc;
              }
            },
            {} as { [T: string]: ShopifySection }
          );

        await generateSections(sections);

        if (SHOPIFY_THEME_FOLDER) {
          generateThemeSections(sections, SHOPIFY_THEME_FOLDER);
          generateThemeLocales(SHOPIFY_SETTINGS_FOLDER, SHOPIFY_THEME_FOLDER);
        }

        const settingsFilename = files.find((name) => name.match("settings_schema"));

        if (settingsFilename) {
          try {
            const filename = path.join(process.cwd(), SHOPIFY_SETTINGS_FOLDER, settingsFilename);
            const settings = require(filename);
            delete require.cache[filename];
            await generateSettings(Object.values(settings)[0] as ShopifySettings);
            if (SHOPIFY_THEME_FOLDER) {
              generateThemeSettings(
                Object.values(settings)[0] as ShopifySettings,
                SHOPIFY_THEME_FOLDER
              );
            }
          } catch (err) {
            console.log(chalk.redBright(err.message));
          }
        }

        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: [${chalk.magentaBright(
            `${Date.now() - startTime}ms`
          )}] ${chalk.cyan(`File modified: ${name}`)}`
        );
      }
    );
  }
};
