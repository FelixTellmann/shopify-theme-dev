import chalk from "chalk";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { generateThemeLayout } from "./generate-theme-layout";
import { generateThemeSnippet } from "./generate-theme-snippets";
import { ShopifySection, ShopifySettings } from "types/shopify";
import { createMetafieldTypes } from "./create-metafield-types";
import { generateSectionsTypes, updateSectionsSettings } from "./generate-sections";
import { generateSettings } from "./generate-settings";
import { generateThemeLocales } from "./generate-theme-locales";
import { generateThemeSections } from "./generate-theme-sections";
import { generateThemeSettings } from "./generate-theme-settings";

import { copyFiles } from "./init-copy-files";
import { initFolders } from "./init-folders";
import { initThemeFolders } from "./init-theme-folders";

const watch = require("node-watch");

require("dotenv").config();

const program = new Command();

program.version(require("./../package.json").version).parse(process.argv);

const { SHOPIFY_SETTINGS_FOLDER, SHOPIFY_THEME_FOLDER } = process.env;

export const init = async () => {
  const root = process.cwd();
  const sectionsFolder = path.join(root, "sections");
  const globalsFolder = path.join(root, "globals");

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Shopify CMS Started`
    )}`
  );
  initFolders();

  if (!SHOPIFY_THEME_FOLDER) return;

  initThemeFolders(SHOPIFY_THEME_FOLDER);

  createMetafieldTypes();
  // copyFiles();

  if (!SHOPIFY_SETTINGS_FOLDER) return;

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Watching for changes`
    )}`
  );

  if (fs.existsSync(sectionsFolder) && fs.existsSync(globalsFolder)) {
    watch([sectionsFolder, globalsFolder], { recursive: true }, async (evt, name) => {
      const startTime = Date.now();

      const isSettingUpdate =
        /sections\\[^\\]*\\schema.ts$/gi.test(name) ||
        /globals\\settings_schema\.ts$/gi.test(name) ||
        /globals\\settings\\[^\\]*\.ts$/gi.test(name);

      if (isSettingUpdate) {
        // const files = fs.readdirSync(sectionsFolder);
        const sections = getSectionSchemas();
        const settings = getSettingsSchemas();

        generateSectionsTypes(sections);
        updateSectionsSettings(sections);
        generateThemeLocales(sections, settings, SHOPIFY_THEME_FOLDER);
        generateSettings(settings.settingsSchema);
        generateThemeSettings(settings.settingsSchema, SHOPIFY_THEME_FOLDER);

        Object.keys(require.cache).forEach((path) => {
          if (path.includes(sectionsFolder) || path.includes(globalsFolder)) {
            delete require.cache[path];
          }
        });

        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: [${chalk.magentaBright(
            `${Date.now() - startTime}ms`
          )}] ${chalk.cyan(`File modified: ${name.replace(process.cwd(), "")}`)}`
        );
      }
      if (/sections\\[^\\]*\\[^.]*\.liquid$/gi.test(name)) {
        const sections = getSectionSchemas();
        generateThemeSections(sections, SHOPIFY_THEME_FOLDER);
      }
      if (/sections\\[^\\]*\\[^.]*\.[^.]*\.liquid$/gi.test(name)) {
        generateThemeSnippet(name, SHOPIFY_THEME_FOLDER);
      }
      if (/globals\\layout[^\\]*\.liquid$/gi.test(name)) {
        generateThemeLayout(name, SHOPIFY_THEME_FOLDER);
      }
      if (/globals\\snippets\\[^\\]*\.liquid$/gi.test(name)) {
        generateThemeSnippet(name, SHOPIFY_THEME_FOLDER);
      }

      compareDeleteSectionsAndSnippets(SHOPIFY_THEME_FOLDER);
    });
  }
};

export const getSectionSchemas = () => {
  const allFiles = getAllFiles();

  const sections: { [T: string]: ShopifySection } = allFiles
    .filter((name) => /sections\\[^\\]*\\schema.ts$/gi.test(name))
    .reduce(
      (acc, file) => {
        try {
          const filename = path.join(process.cwd(), file);
          const data = require(filename);
          return { ...acc, ...data };
        } catch (err) {
          console.log(chalk.redBright(err.message));
          return acc;
        }
      },
      {} as { [T: string]: ShopifySection }
    );

  return sections;
};

export const getAllFiles = (basePath = "sections") => {
  return fs.readdirSync(path.join(process.cwd(), basePath)).reduce((files, file) => {
    const name = `${basePath}\\${file}`;
    const isDirectory = fs.statSync(path.join(process.cwd(), name)).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);
};

export const getSettingsSchemas = () => {
  const filename = path.join(process.cwd(), "globals", "settings_schema.ts");
  return require(filename) as { settingsSchema: ShopifySettings };
};

export const compareDeleteSectionsAndSnippets = (folder: string) => {
  const source = [...getAllFiles("sections"), ...getAllFiles("globals")];
  const target = getAllFiles(folder);

  for (let i = 0; i < source.length; i++) {
    if (
      /sections\\[^\\]*\\[^.]*\.[^.]*\.liquid$/gi.test(source[i]) ||
      /globals\\snippets\\[^\\]*\.liquid$/gi.test(source[i])
    ) {
      const fileName = source[i].split("\\").at(-1);
      const targetFile = target.find((targetPath) => targetPath.includes(`snippets\\${fileName}`));

      if (!targetFile) {
        generateThemeSnippet(source[i], folder);
      }
    }
    if (/globals\\layout\\[^\\]*\.liquid$/gi.test(source[i])) {
      const fileName = source[i].split("\\").at(-1);
      const targetFile = target.find((targetPath) => targetPath.includes(`layout\\${fileName}`));

      if (!targetFile) {
        generateThemeLayout(source[i], folder);
      }
    }
  }

  for (let i = 0; i < target.length; i++) {
    if (
      /sections\\[^\\]*\.liquid$/gi.test(target[i]) ||
      /snippets\\[^\\]*\.liquid$/gi.test(target[i])
    ) {
      const fileName = target[i].split("\\").at(-1);
      const targetFile = source.find((sourcePath) => sourcePath.includes(`\\${fileName}`));
      if (!targetFile) {
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.redBright(
            `Deleted: ${target[i]}`
          )}`
        );
        fs.unlinkSync(path.join(process.cwd(), target[i]));
      }
    }
    if (/layout\\[^\\]*\.liquid$/gi.test(target[i])) {
      const fileName = target[i].split("\\").at(-1);
      const targetFile = source.find((sourcePath) => sourcePath.includes(`\\layout\\${fileName}`));
      if (!targetFile) {
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.redBright(
            `Deleted: ${target[i]}`
          )}`
        );
        fs.unlinkSync(path.join(process.cwd(), target[i]));
      }
    }
  }
};
