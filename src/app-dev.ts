import chalk from "chalk";
import { Command } from "commander";
import decache from "decache";
import fs from "fs";
import produce from "immer";
import path from "path";
import { generateSettings } from "src/generate-settings";
import { generateThemeFiles } from "src/generate-theme-files";
import { generateThemeSettings } from "src/generate-theme-settings";
import { generateSectionSettings } from "./generate-schema-locales";
import { toKebabCase } from "./../utils/to-kebab-case";
import { toSnakeCase } from "./../utils/to-snake-case";
import { generateSectionsTypes, getImports, RESERVED_VARIABLES, sectionToTypes, updateSectionsSettings, writeCompareFile } from "./generate-sections";
import { capitalize } from "./../utils/capitalize";
import { initAppExtensionFolders } from "./init-app-extension-folders";
import { initShopifyTypes } from "./init-shopify-types";
import { ShopifyAppBlock, ShopifySection, ShopifySettings } from "types/shopify";
import { createMetafieldTypes } from "./create-metafield-types";
import { getAllFiles, getLocaleCount, getSectionSchemas, getSettingsSchemas, isGiftCard, isLayout, isSection, isSettingUpdate } from "./index";

const watch = require("node-watch");

require("dotenv").config();

const program = new Command();
program.version(require(path.join("./../", "package.json")).version).parse(process.argv);

const {
  SHOPIFY_APP_EXTENSION_OUT_FOLDER,
  SHOPIFY_APP_EXTENSION_SRC,
  SHOPIFY_APP_CHECKOUT_EXTENSION_SRC,
} = process.env;

export const appDev = async () => {
  const root = process.cwd();
  const assetsFolder = path.join(root, SHOPIFY_APP_EXTENSION_SRC, "assets");
  const blocksFolder = path.join(root, SHOPIFY_APP_EXTENSION_SRC, "blocks");
  const snippetsFolder = path.join(root, SHOPIFY_APP_EXTENSION_SRC, "snippets");
  const checkoutExtensionsFolder = path.join(root, SHOPIFY_APP_CHECKOUT_EXTENSION_SRC);

  console.log(
    `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.magentaBright(
      `Shopify APP DEV Started`
    )}`
  );
  initShopifyTypes();

  if (!SHOPIFY_APP_EXTENSION_OUT_FOLDER) return;

  initAppExtensionFolders(SHOPIFY_APP_EXTENSION_OUT_FOLDER);
  createMetafieldTypes();

  if (fs.existsSync(checkoutExtensionsFolder)) {
    const sectionRegex = new RegExp(
      `${SHOPIFY_APP_CHECKOUT_EXTENSION_SRC}([\\\\/])[^\\\\/]*([\\\\/])schema.ts$`,
      "gi"
    );
    watch([checkoutExtensionsFolder], { recursive: true }, async (evt, name) => {
      const startTime = Date.now();

      if (!sectionRegex.test(name)) return;

      Object.keys(require.cache).forEach((path) => {
        if (path.includes(checkoutExtensionsFolder)) {
          decache(path);
          delete require.cache[path];
        }
      });

      const allFiles = getAllFiles(SHOPIFY_APP_CHECKOUT_EXTENSION_SRC);

      const sections: { [T: string]: ShopifySection } = allFiles
        .filter((name) => {
          return name.toLowerCase().includes("schema.ts");
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

      generateSectionsTypes(sections);
      console.log(
        `[${chalk.gray(new Date().toLocaleTimeString())}]: [${chalk.magentaBright(
          `${Date.now() - startTime}ms`
        )}] ${chalk.cyan(`File modified: ${name.replace(process.cwd(), "")}`)}`
      );
    });
  }

  if (fs.existsSync(blocksFolder) && fs.existsSync(snippetsFolder)) {
    watch([blocksFolder, snippetsFolder], { recursive: true }, async (evt, name) => {
      const startTime = Date.now();

      /* De-cache Settings */
      if (isAppBlockSchema(name)) {
        Object.keys(require.cache).forEach((path) => {
          if (path.includes(blocksFolder) || path.includes(snippetsFolder)) {
            decache(path);
            delete require.cache[path];
          }
        });

        const appBlockSchemas = getAppBlockSchemas();

        generateAppBlockTypes(appBlockSchemas);
        const blockLocaleCount = getLocaleCount(appBlockSchemas);
        updateAppBlockSettings(appBlockSchemas);
        generateSchemaLocales(appBlockSchemas, SHOPIFY_APP_EXTENSION_OUT_FOLDER, blockLocaleCount);
        generateAppFiles(
          SHOPIFY_APP_EXTENSION_SRC,
          SHOPIFY_APP_EXTENSION_OUT_FOLDER,
          appBlockSchemas,
          blockLocaleCount
        );

        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: [${chalk.magentaBright(
            `${Date.now() - startTime}ms`
          )}] ${chalk.cyan(`File modified: ${name.replace(process.cwd(), "")}`)}`
        );
      }

      if (isAppBlock(name) || isSnippet(name)) {
        Object.keys(require.cache).forEach((path) => {
          if (path.includes(blocksFolder) || path.includes(snippetsFolder)) {
            decache(path);
            delete require.cache[path];
          }
        });
        const appBlockSchemas = getAppBlockSchemas();
        const blockLocaleCount = getLocaleCount(appBlockSchemas);

        generateAppFiles(
          SHOPIFY_APP_EXTENSION_SRC,
          SHOPIFY_APP_EXTENSION_OUT_FOLDER,
          appBlockSchemas,
          blockLocaleCount
        );
      }

      /* Copy Assets */
      if (isAsset(name)) {
        const assetName = name.split(/[\\/]/gi).at(-1);
        const assetPath = path.join(
          process.cwd(),
          "extensions",
          SHOPIFY_APP_EXTENSION_OUT_FOLDER,
          "assets",
          assetName
        );

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
    });

    console.log("init Trigger");

    Object.keys(require.cache).forEach((path) => {
      if (path.includes(blocksFolder) || path.includes(snippetsFolder)) {
        decache(path);
        delete require.cache[path];
      }
    });

    const appBlockSchemas = getAppBlockSchemas();

    generateAppBlockTypes(appBlockSchemas);
    const blockLocaleCount = getLocaleCount(appBlockSchemas);
    updateAppBlockSettings(appBlockSchemas);
    generateSchemaLocales(appBlockSchemas, SHOPIFY_APP_EXTENSION_OUT_FOLDER, blockLocaleCount);
    generateAppFiles(
      SHOPIFY_APP_EXTENSION_SRC,
      SHOPIFY_APP_EXTENSION_OUT_FOLDER,
      appBlockSchemas,
      blockLocaleCount
    );

    const { assets } = getSourcePaths();

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const assetName = asset.split(/[\\/]/gi).at(-1);
      const assetPath = path.join(
        process.cwd(),
        "extensions",
        SHOPIFY_APP_EXTENSION_OUT_FOLDER,
        "assets",
        assetName
      );

      const rawContent = fs.readFileSync(asset, {
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
  }
};

export const isAppBlockSchema = (name) => /blocks[\\/][^\\/]*\\schema.ts$/gi.test(name);

export const getAppBlockSchemas = () => {
  const allFiles = getAllAppFiles();

  const schemas: { [T: string]: ShopifyAppBlock } = allFiles
    .filter((name) => {
      return /blocks([\\/])[^\\/]*([\\/])schema.ts$/gi.test(name);
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
      {} as { [T: string]: ShopifyAppBlock }
    );

  return schemas;
};

export const getAllAppFiles = (basePath = path.join(SHOPIFY_APP_EXTENSION_SRC)) => {
  return fs.readdirSync(path.join(process.cwd(), basePath)).reduce((files, file) => {
    const name = path.join(basePath, file);

    const isDirectory = fs.statSync(path.join(process.cwd(), name)).isDirectory();
    return isDirectory ? [...files, ...getAllAppFiles(name)] : [...files, name];
  }, []);
};

export const generateAppBlockTypes = (appBlocks: { [T: string]: ShopifyAppBlock }) => {
  const appBlockTypes = path.join(process.cwd(), "@types", "app-blocks.ts");

  const imports = getImports(appBlocks);
  let sectionUnionType = "export type AppBlocks =";
  let typeContent = "";
  for (const key in appBlocks) {
    const appBlock = appBlocks[key] as ShopifyAppBlock;

    typeContent += `${sectionToTypes(appBlock, key)}\n`;
    sectionUnionType += `\n  | ${capitalize(key)}Section`;
  }

  if (!typeContent) return;

  const finalContent = `${imports + typeContent + sectionUnionType};\n`;

  writeCompareFile(appBlockTypes, finalContent);
};

export const updateAppBlockSettings = (appBlocks: { [T: string]: ShopifyAppBlock }) => {
  for (const key in appBlocks) {
    const appBlock = appBlocks[key];

    const appBlockPath = path.join(
      process.cwd(),
      SHOPIFY_APP_EXTENSION_SRC,
      "blocks",
      toKebabCase(key),
      `${toKebabCase(key)}.liquid`
    );

    const start = "{%- comment -%} Auto Generated Variables start {%- endcomment -%}";
    const end = "{%- comment -%} Auto Generated Variables end {%- endcomment -%}";

    const sectionVariables = [start];
    sectionVariables.push("{%- liquid");

    appBlock.settings?.forEach((setting) => {
      if (setting.type === "header" || setting.type === "paragraph") return;
      sectionVariables.push(
        `  assign ${
          RESERVED_VARIABLES.includes(setting.id) ? `_${setting.id}` : setting.id
        } = block.settings.${setting.id}`
      );
    });

    sectionVariables.push("-%}");
    sectionVariables.push(end);
    sectionVariables.push("");
    sectionVariables.push("");

    const variableContent =
      appBlock.settings && appBlock.settings.length ? sectionVariables.join("\n") : "";

    if (!fs.existsSync(appBlockPath)) {
      console.log(
        `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
          `Created: ${appBlockPath.replace(process.cwd(), "")}`
        )}`
      );
      fs.writeFileSync(appBlockPath, appBlock.settings ? sectionVariables.join("\n") : "");
    }

    if (fs.existsSync(appBlockPath)) {
      const sectionContent = fs.readFileSync(appBlockPath, {
        encoding: "utf-8",
      });

      if (sectionContent.includes(start) && sectionContent.includes(end)) {
        const newContent = sectionContent.replace(
          // eslint-disable-next-line max-len
          /({%- comment -%} Auto Generated Variables start {%- endcomment -%})(.|\n|\r)*({%- comment -%} Auto Generated Variables end {%- endcomment -%})(\r|\n|\s)*/gim,
          variableContent
        );

        if (sectionContent !== newContent) {
          console.log(
            `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
              `Updated: ${appBlockPath.replace(process.cwd(), "")}`
            )}`
          );
          fs.writeFileSync(appBlockPath, newContent);
        }
      }

      if (!sectionContent.includes(start) && !sectionContent.includes(end) && variableContent) {
        const newContent = variableContent + sectionContent;

        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.blueBright(
            `Updated: ${appBlockPath.replace(process.cwd(), "")}`
          )}`
        );
        fs.writeFileSync(appBlockPath, newContent);
      }
    }
  }
};

export const generateSchemaLocales = (
  sections: { [T: string]: ShopifyAppBlock },
  folder: string,
  sectionLocaleCount: { [T: string]: string[] }
) => {
  let returnObject = {
    blocks: {
      all: {},
    },
  };

  returnObject = produce(returnObject, (current) => {
    Object.entries(sectionLocaleCount).forEach(([key, value]) => {
      if (value.length > 1) {
        current.blocks["all"][key] = value[0];
      }
    });
  });

  Object.values(sections).forEach((section) => {
    returnObject = produce(returnObject, (current) => {
      current.blocks[toSnakeCase(section.name)] = {
        name: section.name,
        settings: generateSectionSettings(section.settings, sectionLocaleCount),
      };
    });
  });

  const schemaPath = path.join(
    process.cwd(),
    "extensions",
    folder,
    "locales",
    "en.default.schema.json"
  );

  writeCompareFile(schemaPath, JSON.stringify(returnObject, null, 2));
};

export const isAppBlock = (name) => /blocks[\\/][^\\/]*[\\/][^.]*\.liquid$/gi.test(name);

export const isAsset = (name) => /assets[\\/][^\\/]*$/gi.test(name);

export const isSnippet = (name) =>
  /blocks[\\/][^\\/]*[\\/][^.]*\.[^.]*\.liquid$/gi.test(name) ||
  /snippets[\\/][^\\/]*\.liquid$/gi.test(name);

export const getSourcePaths = () => {
  const sourceFiles = getAllAppFiles();
  const snippets = [];

  const blocks = [];
  const assets = [];

  sourceFiles.forEach((filePath) => {
    if (isSnippet(filePath)) {
      snippets.push(filePath);
    }
    if (isAppBlock(filePath)) {
      blocks.push(filePath);
    }
    if (isAsset(filePath)) {
      assets.push(filePath);
    }
  });

  return { snippets, blocks, assets };
};

export const generateAppFiles = (srcFolder, outFolder, appBlockSchemas, sectionLocaleCount) => {
  const { snippets, blocks } = getSourcePaths();
  const translations: any = {};

  for (const key in appBlockSchemas) {
    const appBlock = appBlockSchemas[key];
    const appBlockName = `${toKebabCase(key)}.liquid`;
    const appBlockPath = path.join(process.cwd(), "extensions", outFolder, "blocks", appBlockName);

    const translationArray = [];
    if (process.env.SHOPIFY_SECTIONS_BEFORE_RENDER) {
      translationArray.push(process.env.SHOPIFY_SECTIONS_BEFORE_RENDER);
    }

    const sourceContent = fs.readFileSync(
      path.join(process.cwd(), srcFolder, "blocks", toKebabCase(key), `${toKebabCase(key)}.liquid`),
      {
        encoding: "utf-8",
      }
    );

    const classNameRegex = /class([=:][_\w$]*)(["'`])([^"'`]+)\2/g;
    const classNameWithClsxRegex = /class([=:][_\w$]*)\((.*?)\)([},])/g;

    const result = sourceContent.replace(classNameRegex, (match, p1, p2, p3) => {
      const liquid = [];
      const nonLiquid = p3.replace(/(\{[{%]-?[^}]*-?[%}]})/gi, (m, g1) => {
        liquid.push(g1);
        return "";
      });
      const classNames = nonLiquid.replace(/\s+/gi, " ").split(" ");
      const prefixedClassNames = classNames.map((className) => {
        if (className.includes(":")) {
          return className
            .split(":")
            .map((str, index, arr) => {
              if ((str.match(/\[/g) || []).length !== (str.match(/]/g) || []).length) {
                return str;
              }
              if (
                str &&
                index === arr.length - 1 &&
                !str.startsWith("tw-") &&
                !str.startsWith("!tw-")
              ) {
                if (/^!/gi.test(str)) {
                  return `!tw-${str.replace(/^!/gi, "")}`;
                }
                return `tw-${str}`;
              }
              return str;
            })
            .join(":");
        }
        if (className) {
          if (className.startsWith("tw-") || className.startsWith("!tw-")) {
            return className;
          } else {
            if (/^!/gi.test(className)) {
              return `!tw-${className.replace(/^!/gi, "")}`;
            }
            return `tw-${className}`;
          }
        }
      });
      return `class${p1}${p2}${prefixedClassNames.join(" ")}${liquid.join(" ")}${p2}`;
    });

    const rawContent = result.replace(classNameWithClsxRegex, (match, p1, p2, p3) => {
      return `class${p1}(${p2.replace(/(["'`])([^"'`]+)\1/g, (match, p1, p2) => {
        const classNames = p2.replace(/\s+/gi, " ").split(" ");
        const prefixedClassNames = classNames.map((className) => {
          if (className.includes(":")) {
            return className
              .split(":")
              .map((str, index, arr) => {
                if ((str.match(/\[/g) || []).length !== (str.match(/]/g) || []).length) {
                  return str;
                }
                if (index === arr.length - 1 && !str.startsWith("tw-") && !str.startsWith("!tw-")) {
                  if (/^!/gi.test(str)) {
                    return `!tw-${str.replace(/^!/gi, "")}`;
                  }
                  return `tw-${str}`;
                }
                return str;
              })
              .join(":");
          }
          if (className.startsWith("tw-") || className.startsWith("!tw-")) {
            return className;
          } else {
            if (/^!/gi.test(className)) {
              return `!tw-${className.replace(/^!/gi, "")}`;
            }
            return `tw-${className}`;
          }
        });
        return `${p1}${prefixedClassNames.join(" ")}${p1}`;
      })})${p3}`;
    });

    if (rawContent) {
      const translatedContent = rawContent.replace(
        /<t(\s+[^>]*)*>((.|\r|\n)*?)<\/t>/gi,
        (str, group1, group2) => {
          const group = toSnakeCase(appBlockPath.split(/[\\/]/gi).at(-1).split(".").at(0)).trim();
          const content = toSnakeCase(group2?.split(" ")?.slice(0, 2)?.join("_") ?? "").trim();
          const backupContent = toSnakeCase(group2).trim();
          const id = toSnakeCase(group1?.replace(/id="(.*)"/gi, "$1") ?? "").trim();

          if (!(group in translations)) {
            translations[group] = {};
          }

          if (id && !(id in translations[group])) {
            translations[group][id] = group2;
            return `{{ "${group}.${id}" | t }}`;
          }

          if (!(content in translations[group])) {
            translations[group][content] = group2;
            return `{{ "${group}.${content}" | t }}`;
          }

          if (translations[group][content] !== group2) {
            if (!(backupContent in translations[group])) {
              translations[group][backupContent] = group2;
              return `{{ "${group}.${backupContent}" | t }}`;
            }
            if (translations[group][backupContent] !== group2) {
              translations[group][`${content}_2`] = group2;
              return `{{ "${group}.${content}_2" | t }}`;
            }
          }

          if (translations[group][content] === group2) {
            return `{{ "${group}.${content}" | t }}`;
          }

          return group2;
        }
      );
      translationArray.push(translatedContent);
    }
    if (process.env.SHOPIFY_SECTIONS_AFTER_RENDER) {
      translationArray.push(process.env.SHOPIFY_SECTIONS_AFTER_RENDER);
    }
    translationArray.push(appBlockToLiquid_WithLocalization(appBlock, key, sectionLocaleCount));
    writeCompareFile(appBlockPath, translationArray.join("\n"));
  }

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    const snippetName = snippet.split(/[\\/]/gi).at(-1);

    const snippetPath = path.join(process.cwd(), "extensions", outFolder, "snippets", snippetName);

    const returnArr = [];

    const rawContent = fs.readFileSync(snippet, {
      encoding: "utf-8",
    });

    if (rawContent) {
      const translatedContent = rawContent.replace(
        /<t(\s+[^>]*)*>((.|\r|\n)*?)<\/t>/gi,
        (str, group1, group2) => {
          const group = toSnakeCase(snippet.split(/[\\/]/gi).at(-1).split(".").at(0)).trim();
          const content = toSnakeCase(group2?.split(" ")?.slice(0, 2)?.join("_") ?? "").trim();
          const backupContent = toSnakeCase(group2).trim();
          const id = toSnakeCase(group1?.replace(/id="(.*)"/gi, "$1") ?? "").trim();

          if (!(group in translations)) {
            translations[group] = {};
          }

          if (id && !(id in translations[group])) {
            translations[group][id] = group2;
            return `{{ "${group}.${id}" | t }}`;
          }

          if (!(content in translations[group])) {
            translations[group][content] = group2;
            return `{{ "${group}.${content}" | t }}`;
          }

          if (translations[group][content] !== group2) {
            if (!(backupContent in translations[group])) {
              translations[group][backupContent] = group2;
              return `{{ "${group}.${backupContent}" | t }}`;
            }
            if (translations[group][backupContent] !== group2) {
              translations[group][`${content}_2`] = group2;
              return `{{ "${group}.${content}_2" | t }}`;
            }
          }

          if (translations[group][content] === group2) {
            return `{{ "${group}.${content}" | t }}`;
          }

          return group2;
        }
      );
      returnArr.push(translatedContent);
    }

    writeCompareFile(snippetPath, returnArr.join("\n"));
  }

  const translationsPath = path.join(
    process.cwd(),
    "extensions",
    outFolder,
    "locales",
    "en.default.json"
  );
  writeCompareFile(translationsPath, JSON.stringify(translations, undefined, 2));

  const target = getAllAppFiles(path.join("extensions", outFolder));

  if (process.env.SHOPIFY_CMS_DELETE) {
    for (let i = 0; i < target.length; i++) {
      if (/snippets[\\/][^\\/]*\.liquid$/gi.test(target[i])) {
        const fileName = target[i].split(/[\\/]/gi).at(-1);
        const targetFile = snippets.find((sourcePath) =>
          sourcePath.split(/[\\/]/gi).at(-1).includes(fileName)
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

      if (/blocks[\\/][^\\/]*\.liquid$/gi.test(target[i])) {
        const fileName = target[i].split(/[\\/]/gi).at(-1);
        const targetFile = blocks.find((sourcePath) =>
          sourcePath.split(/[\\/]/gi).at(-1).includes(fileName)
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

export const appBlockToLiquid_WithLocalization = (
  { name, disabled_block_files, generate_block_files, ...section }: ShopifySection,
  key,
  sectionLocaleCount: { [T: string]: string[] }
) => {
  const sectionName = toSnakeCase(name);

  let paragraphCount = 1;
  let headerCount = 1;

  const localizedSection = {
    name: `t:blocks.${sectionName}.name`,
    ...section,
    settings: section?.settings?.map((setting) => {
      const settingsBase = `t:blocks.${sectionName}.settings`;
      if (setting.type === "paragraph") {
        return {
          ...setting,
          content:
            "content" in setting
              ? sectionLocaleCount[toSnakeCase(setting.content)]?.length > 1
                ? `t:blocks.all.${toSnakeCase(setting.content)}`
                : `${settingsBase}.paragraph__${paragraphCount++}.content`
              : undefined,
        };
      }
      if (setting.type === "header") {
        return {
          ...setting,
          content:
            "content" in setting
              ? sectionLocaleCount[toSnakeCase(setting.content)]?.length > 1
                ? `t:blocks.all.${toSnakeCase(setting.content)}`
                : `${settingsBase}.header__${headerCount++}.content`
              : undefined,
        };
      }
      return {
        ...setting,
        label:
          "label" in setting
            ? sectionLocaleCount[toSnakeCase(setting.label)]?.length > 1
              ? `t:blocks.all.${toSnakeCase(setting.label)}`
              : `${settingsBase}.${setting.id}.label`
            : undefined,
        info:
          "info" in setting
            ? sectionLocaleCount[toSnakeCase(setting.info)]?.length > 1
              ? `t:blocks.all.${toSnakeCase(setting.info)}`
              : `${settingsBase}.${setting.id}.info`
            : undefined,
        placeholder:
          "placeholder" in setting && typeof setting.placeholder === "string"
            ? sectionLocaleCount[toSnakeCase(setting.placeholder)]?.length > 1
              ? `t:blocks.all.${toSnakeCase(setting.placeholder)}`
              : `${settingsBase}.${setting.id}.placeholder`
            : undefined,
        options:
          "options" in setting
            ? setting.options.map((option, index) => ({
                ...option,
                label:
                  sectionLocaleCount[toSnakeCase(option.label)]?.length > 1
                    ? `t:blocks.all.${toSnakeCase(option.label)}`
                    : `${settingsBase}.${setting.id}.options__${index + 1}.label`,
              }))
            : undefined,
      };
    }),
    blocks: section.blocks?.map(({ name, ...block }) => {
      let paragraphCount = 1;
      let headerCount = 1;

      if (block.type === "@app") return { name, ...block };

      return {
        name: `t:blocks.${sectionName}.blocks.${toSnakeCase(name)}.name`,
        ...block,
        settings: block?.settings?.map((setting) => {
          const settingsBase = `t:blocks.${sectionName}.blocks.${toSnakeCase(name)}.settings`;

          if (setting.type === "paragraph") {
            return {
              ...setting,
              content:
                "content" in setting
                  ? sectionLocaleCount[toSnakeCase(setting.content)]?.length > 1
                    ? `t:blocks.all.${toSnakeCase(setting.content)}`
                    : `${settingsBase}.paragraph__${paragraphCount++}.content`
                  : undefined,
            };
          }
          if (setting.type === "header") {
            return {
              ...setting,
              content:
                "content" in setting
                  ? sectionLocaleCount[toSnakeCase(setting.content)]?.length > 1
                    ? `t:blocks.all.${toSnakeCase(setting.content)}`
                    : `${settingsBase}.header__${headerCount++}.content`
                  : undefined,
            };
          }
          return {
            ...setting,
            label:
              "label" in setting
                ? sectionLocaleCount[toSnakeCase(setting.label)]?.length > 1
                  ? `t:blocks.all.${toSnakeCase(setting.label)}`
                  : `${settingsBase}.${setting.id}.label`
                : undefined,
            info:
              "info" in setting
                ? sectionLocaleCount[toSnakeCase(setting.info)]?.length > 1
                  ? `t:blocks.all.${toSnakeCase(setting.info)}`
                  : `${settingsBase}.${setting.id}.info`
                : undefined,
            placeholder:
              "placeholder" in setting && typeof setting.placeholder === "string"
                ? sectionLocaleCount[toSnakeCase(setting.placeholder)]?.length > 1
                  ? `t:blocks.all.${toSnakeCase(setting.placeholder)}`
                  : `${settingsBase}.${setting.id}.placeholder`
                : undefined,
            options:
              "options" in setting
                ? setting.options.map((option, index) => ({
                    ...option,
                    label:
                      sectionLocaleCount[toSnakeCase(option.label)]?.length > 1
                        ? `t:blocks.all.${toSnakeCase(option.label)}`
                        : `${settingsBase}.${setting.id}.options__${index + 1}.label`,
                  }))
                : undefined,
          };
        }),
      };
    }),
    presets: section.presets?.map(({ name, ...preset }) => {
      return {
        name: `t:blocks.${sectionName}.presets.${toSnakeCase(name)}.name`,
        ...preset,
      };
    }),
  };

  return `{% schema %}
${JSON.stringify(localizedSection, undefined, 2)}
{% endschema %}
`;
};
