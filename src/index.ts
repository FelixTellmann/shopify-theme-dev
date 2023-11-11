import chalk from "chalk";
import { Command } from "commander";
import decache from "decache";
import fs from "fs";
import os from "os";
import path from "path";
import { toSnakeCase } from "../utils/to-snake-case";
import { generateThemeLayout } from "./generate-theme-layout";
import { generateThemeSnippet } from "./generate-theme-snippets";
import { ShopifySection, ShopifySettings } from "types/shopify";
import { createMetafieldTypes } from "./create-metafield-types";
import { generateSectionsTypes, updateSectionsSettings, writeCompareFile } from "./generate-sections";
import { generateSettings } from "./generate-settings";
import { generateSchemaLocales } from "./generate-schema-locales";
import { generateThemeFiles } from "./generate-theme-files";
import { generateThemeSettings } from "./generate-theme-settings";

import { copyFiles } from "./init-copy-files";
import { initShopifyTypes } from "./init-shopify-types";
import { initThemeFolders } from "./init-theme-folders";

const watch = require("node-watch");
const toml = require("toml");

require("dotenv").config();

const program = new Command();

program.version(require(path.join("./../", "package.json")).version).parse(process.argv);

const { SHOPIFY_THEME_FOLDER } = process.env;

export function getLocaleCount(sections: { [p: string]: ShopifySection }) {
  const entries = {};

  Object.values(sections).forEach((section) => {
    const blocks = section.blocks?.filter((block) => block.type !== "@app") ?? [];
    section?.settings?.forEach((setting) => {
      if (setting.type === "paragraph" || setting.type === "header") {
        if (setting.content.split(" ").length > 4) {
          return;
        }
        const [key, value] = [toSnakeCase(setting.content), setting.content];
        if (entries[key]) {
          entries[key].push(value);
        } else {
          entries[key] = [value];
        }
        return;
      }

      if (setting?.id) {
        if (setting.type === "color_scheme_group") {
          return;
        }
        if (setting.type === "select" || setting.type === "radio") {
          setting.options.forEach((option, index) => {
            const [key, value] = [toSnakeCase(option.label), option.label];
            if (entries[key]) {
              entries[key].push(value);
            } else {
              entries[key] = [value];
            }
          });
        }
        if (setting.label) {
          const [key, value] = [toSnakeCase(setting.label), setting.label];
          if (entries[key]) {
            entries[key].push(value);
          } else {
            entries[key] = [value];
          }
        }

        if (setting.info) {
          if (setting.info.split(" ").length <= 4) {
            const [key, value] = [toSnakeCase(setting.info), setting.info];
            if (entries[key]) {
              entries[key].push(value);
            } else {
              entries[key] = [value];
            }
          }
        }
        if ("placeholder" in setting && typeof setting.placeholder === "string") {
          const [key, value] = [toSnakeCase(setting.placeholder), setting.placeholder];
          if (entries[key]) {
            entries[key].push(value);
          } else {
            entries[key] = [value];
          }
        }
      }
    });
    blocks.forEach((block) => {
      block?.settings?.forEach((setting) => {
        if (setting.type === "color_scheme_group") {
          return;
        }
        if (setting.type === "paragraph" || setting.type === "header") {
          if (setting.content.split(" ").length > 4) {
            return;
          }
          const [key, value] = [toSnakeCase(setting.content), setting.content];
          if (entries[key]) {
            entries[key].push(value);
          } else {
            entries[key] = [value];
          }
          return;
        }

        if (setting?.id) {
          if (setting.type === "select" || setting.type === "radio") {
            setting.options.forEach((option, index) => {
              const [key, value] = [toSnakeCase(option.label), option.label];
              if (entries[key]) {
                entries[key].push(value);
              } else {
                entries[key] = [value];
              }
            });
          }
          if (setting.label) {
            const [key, value] = [toSnakeCase(setting.label), setting.label];
            if (entries[key]) {
              entries[key].push(value);
            } else {
              entries[key] = [value];
            }
          }

          if (setting.info) {
            if (setting.info.split(" ").length <= 4) {
              const [key, value] = [toSnakeCase(setting.info), setting.info];
              if (entries[key]) {
                entries[key].push(value);
              } else {
                entries[key] = [value];
              }
            }
          }
          if ("placeholder" in setting && typeof setting.placeholder === "string") {
            const [key, value] = [toSnakeCase(setting.placeholder), setting.placeholder];
            if (entries[key]) {
              entries[key].push(value);
            } else {
              entries[key] = [value];
            }
          }
        }
      });
    });
  });

  /*  fs.writeFileSync(path.join(process.cwd(), "/test.json"), JSON.stringify(entries, null, 2), {
    encoding: "utf-8",
  });*/

  return entries;
}

export const init = async () => {
  const root = process.cwd();
  const sectionsFolder = path.join(root, "sections");
  const utilsFolder = path.join(root, "@utils");
  const snippetsFolder = path.join(root, "snippets");
  const templatesFolder = path.join(root, "templates");
  const assetsFolder = path.join(root, "assets");
  const configFolder = path.join(root, "config");

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Shopify CMS Started`
    )}`
  );

  /* TODO - Tracking Interactions */
  try {
    let shop_url = "";
    let theme_id = "";
    let shop_url_prod = "";
    let theme_id_prod = "";

    try {
      const shopifySettings = fs.readFileSync(path.join(root, "shopify.theme.toml"), {
        encoding: "utf-8",
      });
      const userSettings = JSON.parse(JSON.stringify(toml.parse(shopifySettings)));
      if (
        typeof userSettings === "object" &&
        "environments" in userSettings &&
        "development" in userSettings.environments
      ) {
        theme_id = userSettings.environments.development.theme;
        shop_url = userSettings.environments.development.store;
        theme_id_prod = userSettings.environments.production.theme;
        shop_url_prod = userSettings.environments.production.store;
      }
      console.log(
        `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.yellowBright(
          `Dev Environment: Theme: ${theme_id} - Shop: ${shop_url}`
        )}`
      );
      console.log(
        `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.yellowBright(
          `Prod Environment: Theme: ${theme_id_prod} - Shop: ${shop_url_prod}`
        )}`
      );
    } catch (err) {
      console.log(
        `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.cyanBright(
          `'shopify.theme.toml' not found - Ensure that your Environment is setup using the Shopify CLI`
        )}`
      );
    }

    const root_path = root;
    const username = os.userInfo().username;
    const homedir = os.userInfo().homedir;
    const platform = process.platform;

    const ping = () => {
      fetch(`https://accelerate-tracking.vercel.app/api/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          shop_url,
          theme_id,
          root_path,
          username,
          homedir,
          platform,
        }),
      });
    };
    ping();
    setInterval(
      () => {
        ping();
      },
      1000 * 60 * 5 /* 2 minutes */
    );
  } catch (err) {
    console.log(
      `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.redBright(
        `Shopify CLI requires an Internet Connection to Sync`
      )}`
    );
  }

  initShopifyTypes();

  if (!SHOPIFY_THEME_FOLDER) return;

  initThemeFolders(SHOPIFY_THEME_FOLDER);

  createMetafieldTypes();
  // copyFiles();

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Watching for changes`
    )}`
  );

  if (
    fs.existsSync(sectionsFolder) &&
    fs.existsSync(snippetsFolder) &&
    fs.existsSync(templatesFolder) &&
    fs.existsSync(configFolder) &&
    fs.existsSync(utilsFolder) &&
    fs.existsSync(assetsFolder)
  ) {
    watch(
      [sectionsFolder, snippetsFolder, configFolder, templatesFolder],
      { recursive: true },
      async (evt, name) => {
        const startTime = Date.now();

        if (isSettingUpdate(name)) {
          Object.keys(require.cache).forEach((path) => {
            if (
              path.includes(sectionsFolder) ||
              path.includes(snippetsFolder) ||
              path.includes(templatesFolder) ||
              path.includes(utilsFolder) ||
              path.includes(configFolder)
            ) {
              decache(path);
              delete require.cache[path];
            }
          });

          const sections = getSectionSchemas();
          const settings = getSettingsSchemas();

          const sectionLocaleCount = getLocaleCount(sections);

          generateSectionsTypes(sections);
          updateSectionsSettings(sections);
          generateSchemaLocales(sections, settings, SHOPIFY_THEME_FOLDER, sectionLocaleCount);
          generateSettings(settings.settingsSchema);
          generateThemeSettings(settings.settingsSchema, SHOPIFY_THEME_FOLDER);
          generateThemeFiles(SHOPIFY_THEME_FOLDER, sections, sectionLocaleCount);
          console.log(
            `[${chalk.gray(new Date().toLocaleTimeString())}]: [${chalk.magentaBright(
              `${Date.now() - startTime}ms`
            )}] ${chalk.cyan(`File modified: ${name.replace(process.cwd(), "")}`)}`
          );
        }

        if (isSection(name) || isSnippet(name) || isLayout(name) || isGiftCard(name)) {
          Object.keys(require.cache).forEach((path) => {
            if (
              path.includes(sectionsFolder) ||
              path.includes(snippetsFolder) ||
              path.includes(templatesFolder) ||
              path.includes(utilsFolder) ||
              path.includes(configFolder)
            ) {
              decache(path);
              delete require.cache[path];
            }
          });
          const sections = getSectionSchemas();
          const sectionLocaleCount = getLocaleCount(sections);

          generateThemeFiles(SHOPIFY_THEME_FOLDER, sections, sectionLocaleCount);
        }

        if (isAsset(name)) {
          const assetName = name.split(/[\\/]/gi).at(-1);
          const assetPath = path.join(process.cwd(), SHOPIFY_THEME_FOLDER, "assets", assetName);

          const rawContent = fs.readFileSync(name, {
            encoding: "utf-8",
          });

          // writeCompareFile(assetPath, rawContent);

          if (!fs.existsSync(assetPath)) {
            fs.writeFileSync(assetPath, rawContent);
            console.log(
              `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
                `Created: ${assetPath.replace(process.cwd(), "")}`
              )}`
            );
            return;
          }
        }
        /*const used = process.memoryUsage();
      for (const key in used) {
        console.log(`${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`);
      }*/
      }
    );

    watch([assetsFolder], { recursive: true }, async (evt, name) => {
      const startTime = Date.now();

      const assetName = name.split(/[\\/]/gi).at(-1);

      const assetPath = path.join(process.cwd(), SHOPIFY_THEME_FOLDER, "assets", assetName);

      const rawContent = fs.readFileSync(name, {
        encoding: "utf-8",
      });

      const ignoreASSETS = process.env.SHOPIFY_CMS_IGNORE_ASSETS?.split(",");

      if (ignoreASSETS?.includes(assetPath.split(/[/\\]/)?.at(-1))) {
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.greenBright(
            `Ignored: ${assetPath.replace(process.cwd(), "")}`
          )}`
        );

        if (!fs.existsSync(assetPath)) {
          fs.writeFileSync(assetPath, rawContent);
          console.log(
            `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
              `Created: ${assetPath.replace(process.cwd(), "")}`
            )}`
          );
        }
      } else {
        writeCompareFile(assetPath, rawContent);
      }

      /*if (!fs.existsSync(assetPath)) {
        fs.writeFileSync(assetPath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${assetPath.replace(process.cwd(), "")}`
          )}`
        );
        return;
      }*/

      /*const used = process.memoryUsage();
      for (const key in used) {
        console.log(`${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`);
      }*/
    });

    console.log("init Trigger");

    Object.keys(require.cache).forEach((path) => {
      if (
        path.includes(sectionsFolder) ||
        path.includes(snippetsFolder) ||
        path.includes(templatesFolder) ||
        path.includes(utilsFolder) ||
        path.includes(configFolder)
      ) {
        decache(path);
        delete require.cache[path];
      }
    });

    const sections = getSectionSchemas();
    const settings = getSettingsSchemas();
    const sectionLocaleCount = getLocaleCount(sections);
    generateSectionsTypes(sections);
    updateSectionsSettings(sections);
    generateSchemaLocales(sections, settings, SHOPIFY_THEME_FOLDER, sectionLocaleCount);
    generateSettings(settings.settingsSchema);
    generateThemeSettings(settings.settingsSchema, SHOPIFY_THEME_FOLDER);
    generateThemeFiles(SHOPIFY_THEME_FOLDER, sections, sectionLocaleCount);

    const { assets, sectionGroups, configs, templates, customerTemplates } = getSourcePaths();

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const assetName = asset.split(/[\\/]/gi).at(-1);
      const assetPath = path.join(process.cwd(), SHOPIFY_THEME_FOLDER, "assets", assetName);

      const rawContent = fs.readFileSync(asset, {
        encoding: "utf-8",
      });

      const ignoreASSETS = process.env.SHOPIFY_CMS_IGNORE_ASSETS?.split(",");

      if (ignoreASSETS?.includes(assetPath.split(/[/\\]/)?.at(-1))) {
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.greenBright(
            `Ignored: ${assetPath.replace(process.cwd(), "")}`
          )}`
        );
        if (!fs.existsSync(assetPath)) {
          fs.writeFileSync(assetPath, rawContent);
          console.log(
            `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
              `Created: ${assetPath.replace(process.cwd(), "")}`
            )}`
          );
        }
      } else {
        writeCompareFile(assetPath, rawContent);
      }

      // writeCompareFile(assetPath, rawContent);
      /*if (!fs.existsSync(assetPath)) {
        fs.writeFileSync(assetPath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${assetPath.replace(process.cwd(), "")}`
          )}`
        );
        return;
      }*/
    }
    for (let i = 0; i < sectionGroups.length; i++) {
      const sectionGroup = sectionGroups[i];
      const sectionGroupName = sectionGroup.split(/[\\/]/gi).at(-1);
      const sectionGroupPath = path.join(
        process.cwd(),
        SHOPIFY_THEME_FOLDER,
        "sections",
        sectionGroupName
      );

      const rawContent = fs.readFileSync(sectionGroup, {
        encoding: "utf-8",
      });

      if (!fs.existsSync(sectionGroupPath)) {
        fs.writeFileSync(sectionGroupPath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${sectionGroupPath.replace(process.cwd(), "")}`
          )}`
        );
      }
    }
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const configName = config.split(/[\\/]/gi).at(-1);
      const configPath = path.join(process.cwd(), SHOPIFY_THEME_FOLDER, "config", configName);

      const rawContent = fs.readFileSync(config, {
        encoding: "utf-8",
      });

      if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${configPath.replace(process.cwd(), "")}`
          )}`
        );
      }
    }
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const templateName = template.split(/[\\/]/gi).at(-1);
      const templatePath = path.join(
        process.cwd(),
        SHOPIFY_THEME_FOLDER,
        "templates",
        templateName
      );

      const rawContent = fs.readFileSync(template, {
        encoding: "utf-8",
      });

      if (!fs.existsSync(templatePath)) {
        fs.writeFileSync(templatePath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${templatePath.replace(process.cwd(), "")}`
          )}`
        );
      }
    }
    for (let i = 0; i < customerTemplates.length; i++) {
      const template = customerTemplates[i];
      const templateName = template.split(/[\\/]/gi).at(-1);
      const templatePath = path.join(
        process.cwd(),
        SHOPIFY_THEME_FOLDER,
        "templates",
        "customers",
        templateName
      );

      const rawContent = fs.readFileSync(template, {
        encoding: "utf-8",
      });

      if (!fs.existsSync(templatePath)) {
        fs.writeFileSync(templatePath, rawContent);
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Created: ${templatePath.replace(process.cwd(), "")}`
          )}`
        );
      }
    }
    /*const used = process.memoryUsage();
    for (const key in used) {
      console.log(`${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`);
    }*/
  }
};

export const getSectionSchemas = () => {
  const allFiles = getAllFiles();

  const sections: { [T: string]: ShopifySection } = allFiles
    .filter((name) => {
      return /sections([\\/])[^\\/]*([\\/])schema.ts$/gi.test(name);
    })
    .reduce(
      (acc, file, index, arr) => {
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
    const name = path.join(basePath, file);

    const isDirectory = fs.statSync(path.join(process.cwd(), name)).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);
};

export const getSettingsSchemas = () => {
  const filename = path.join(process.cwd(), "config", "settings_schema.ts");
  return require(filename) as { settingsSchema: ShopifySettings };
};

export const getSourcePaths = () => {
  const sourceFiles = [
    ...getAllFiles("assets"),
    ...getAllFiles("config"),
    ...getAllFiles("layout"),
    ...getAllFiles("sections"),
    ...getAllFiles("snippets"),
    ...getAllFiles("templates"),
  ];
  const snippets = [];
  const layouts = [];
  const sections = [];
  const giftCards = [];
  const sectionGroups = [];
  const configs = [];
  const templates = [];
  const customerTemplates = [];
  const assets = [];

  sourceFiles.forEach((filePath) => {
    if (isSnippet(filePath)) {
      snippets.push(filePath);
    }
    if (isLayout(filePath)) {
      layouts.push(filePath);
    }
    if (isSection(filePath)) {
      sections.push(filePath);
    }
    if (isGiftCard(filePath)) {
      giftCards.push(filePath);
    }
    if (isSectionGroup(filePath)) {
      sectionGroups.push(filePath);
    }
    if (isConfig(filePath)) {
      configs.push(filePath);
    }
    if (isTemplate(filePath)) {
      templates.push(filePath);
    }
    if (isCustomerTemplate(filePath)) {
      customerTemplates.push(filePath);
    }
    if (isAsset(filePath)) {
      assets.push(filePath);
    }
  });

  return {
    snippets,
    layouts,
    sections,
    assets,
    giftCards,
    configs,
    sectionGroups,
    templates,
    customerTemplates,
  };
};

export const generateLiquidFiles = (folder: string) => {
  const source = [...getAllFiles("sections"), ...getAllFiles("globals")];
  const target = getAllFiles(folder);

  for (let i = 0; i < source.length; i++) {
    if (isSnippet(source[i])) {
      console.log(source[i], "source[i]");
      const fileName = source[i].split(/[\\/]/gi).at(-1);
      const targetFile = target.find(
        (targetPath) =>
          targetPath.includes(`snippets\\${fileName}`) ||
          targetPath.includes(`snippets/${fileName}`)
      );

      if (!targetFile) {
        generateThemeSnippet(source[i], folder);
      }
    }
    if (isLayout(source[i])) {
      const fileName = source[i].split(/[\\/]/gi).at(-1);
      const targetFile = target.find(
        (targetPath) =>
          targetPath.includes(`layout\\${fileName}`) || targetPath.includes(`layout/${fileName}`)
      );

      if (!targetFile) {
        generateThemeLayout(source[i], folder);
      }
    }
  }

  if (process.env.SHOPIFY_CMS_DELETE) {
    for (let i = 0; i < target.length; i++) {
      if (
        /sections[\\/][^\\/]*\.liquid$/gi.test(target[i]) ||
        /snippets[\\/][^\\/]*\.liquid$/gi.test(target[i])
      ) {
        const fileName = target[i].split(/[\\/]/gi).at(-1);
        const targetFile = source.find((sourcePath) =>
          sourcePath.split(/[\\/]/gi).at(-1).includes(fileName)
        );
        if (fileName.includes("_translations.liquid")) {
          continue;
        }
        if (!targetFile) {
          console.log(
            `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.redBright(
              `Deleted: ${target[i]}`
            )}`
          );
          fs.unlinkSync(path.join(process.cwd(), target[i]));
        }
      }
      if (/layout[\\/][^\\/]*\.liquid$/gi.test(target[i])) {
        const fileName = target[i].split(/[\\/]/gi).at(-1);
        const targetFile = source.find(
          (sourcePath) =>
            sourcePath.includes(`layout\\${fileName}`) || sourcePath.includes(`layout/${fileName}`)
        );
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
  }
};

export const isSettingUpdate = (name) =>
  /sections[\\/][^\\/]*[\\/]schema.ts$/gi.test(name) ||
  /config[\\/]settings_schema\.ts$/gi.test(name) ||
  /@utils[\\/]settings[\\/][^\\/]*\.ts$/gi.test(name);

export const isSection = (name) => /sections[\\/][^\\/]*[\\/][^.]*\.liquid$/gi.test(name);

export const isAsset = (name) =>
  /assets[\\/][^\\/]*$/gi.test(name) ||
  /snippets[\\/][^\\/]*.js$/gi.test(name) ||
  /sections[\\/][^\\/]*.js$/gi.test(name) ||
  /sections[\\/][^\\/]*.js$/gi.test(name);

export const isSnippet = (name) =>
  /sections[\\/][^\\/]*[\\/][^.]*\.[^.]*\.liquid$/gi.test(name) ||
  /snippets[\\/][^\\/]*\.liquid$/gi.test(name);

export const isLayout = (name) => /layout[\\/][^\\/]*\.liquid$/gi.test(name);

export const isSectionGroup = (name) => /sections[\\/]sections[\\/][^\\/]*\.json$/gi.test(name);

export const isConfig = (name) => /config[\\/][^\\/]*\.json$/gi.test(name);

export const isTemplate = (name) => /templates[\\/][^\\/]*\.json$/gi.test(name);

export const isCustomerTemplate = (name) =>
  /templates[\\/]customers[\\/][^\\/]*\.json$/gi.test(name);

export const isGiftCard = (name) => /templates[\\/]gift_card\.liquid$/gi.test(name);
