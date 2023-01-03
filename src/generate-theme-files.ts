import chalk from "chalk";
import fs from "fs";
import path from "path";
import { toCamelCase } from "./../utils/to-camel-case";
import { getAllFiles, getSectionSchemas, getSourcePaths } from "./index";
import { writeCompareFile } from "./generate-sections";
import { toSnakeCase } from "./../utils/to-snake-case";
import { ShopifySection } from "types/shopify";
import { toKebabCase } from "./../utils/to-kebab-case";

export const sectionToLiquid_WithLocalization = (
  { name, disabled_block_files, ...section }: ShopifySection,
  key
) => {
  const sectionName = toSnakeCase(name);

  let paragraphCount = 1;
  let headerCount = 1;

  const localizedSection = {
    name: `t:sections.${sectionName}.name`,
    ...section,
    settings: section?.settings?.map((setting) => {
      const settingsBase = `t:sections.${sectionName}.settings`;
      if (setting.type === "paragraph") {
        return {
          ...setting,
          content:
            "content" in setting
              ? `${settingsBase}.paragraph__${paragraphCount++}.content`
              : undefined,
        };
      }
      if (setting.type === "header") {
        return {
          ...setting,
          content:
            "content" in setting ? `${settingsBase}.header__${headerCount++}.content` : undefined,
        };
      }
      return {
        ...setting,
        label: "label" in setting ? `${settingsBase}.${setting.id}.label` : undefined,
        info: "info" in setting ? `${settingsBase}.${setting.id}.info` : undefined,
        placeholder:
          "placeholder" in setting ? `${settingsBase}.${setting.id}.placeholder` : undefined,
        options:
          "options" in setting
            ? setting.options.map((option, index) => ({
                ...option,
                label: `${settingsBase}.${setting.id}.options__${index + 1}.label`,
              }))
            : undefined,
      };
    }),
    blocks: section.blocks?.map(({ name, ...block }) => {
      let paragraphCount = 1;
      let headerCount = 1;

      if (block.type === "@app") return { name, ...block };

      return {
        name: `t:sections.${sectionName}.blocks.${toSnakeCase(name)}.name`,
        ...block,
        settings: block?.settings?.map((setting) => {
          const settingsBase = `t:sections.${sectionName}.blocks.${toSnakeCase(name)}.settings`;

          if (setting.type === "paragraph") {
            return {
              ...setting,
              content:
                "content" in setting
                  ? `${settingsBase}.paragraph__${paragraphCount++}.content`
                  : undefined,
            };
          }
          if (setting.type === "header") {
            return {
              ...setting,
              content:
                "content" in setting
                  ? `${settingsBase}.header__${headerCount++}.content`
                  : undefined,
            };
          }
          return {
            ...setting,
            label: "label" in setting ? `${settingsBase}.${setting.id}.label` : undefined,
            info: "info" in setting ? `${settingsBase}.${setting.id}.info` : undefined,
            placeholder:
              "placeholder" in setting ? `${settingsBase}.${setting.id}.placeholder` : undefined,
            options:
              "options" in setting
                ? setting.options.map((option, index) => ({
                    ...option,
                    label: `${settingsBase}.${setting.id}.options__${index + 1}.label`,
                  }))
                : undefined,
          };
        }),
      };
    }),
    presets: section.presets?.map(({ name, ...preset }) => {
      return {
        name: `t:sections.${sectionName}.presets.${toSnakeCase(name)}.name`,
        ...preset,
      };
    }),
  };

  return `{% schema %}
${JSON.stringify(localizedSection, undefined, 2)}
{% endschema %}
`;
};

export const generateThemeFiles = (folder) => {
  const sectionsSchemas = getSectionSchemas();
  const { snippets, layouts, sections } = getSourcePaths();
  const translations: any = {};

  for (const key in sectionsSchemas) {
    const section = sectionsSchemas[key];
    const sectionName = `${toKebabCase(key)}.liquid`;
    const sectionPath = path.join(process.cwd(), folder, "sections", sectionName);

    const translationArray = [];
    if (process.env.SHOPIFY_SECTIONS_BEFORE_RENDER) {
      translationArray.push(process.env.SHOPIFY_SECTIONS_BEFORE_RENDER);
    }

    const rawContent = fs.readFileSync(
      path.join(process.cwd(), "sections", toKebabCase(key), `${toKebabCase(key)}.liquid`),
      {
        encoding: "utf-8",
      }
    );

    if (rawContent) {
      const translatedContent = rawContent.replace(
        /<t(\s+[^>]*)*>((.|\r|\n)*?)<\/t>/gi,
        (str, group1, group2) => {
          const group = toSnakeCase(sectionPath.split("\\").at(-1).split(".").at(0)).trim();
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

          return group2;
        }
      );
      translationArray.push(translatedContent);
    }

    if (process.env.SHOPIFY_SECTIONS_AFTER_RENDER) {
      translationArray.push(process.env.SHOPIFY_SECTIONS_AFTER_RENDER);
    }

    translationArray.push(sectionToLiquid_WithLocalization(section, key));

    writeCompareFile(sectionPath, translationArray.join("\n"));
  }

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    const snippetName = snippet.split("\\").at(-1);
    const snippetPath = path.join(process.cwd(), folder, "snippets", snippetName);

    const returnArr = [];

    const rawContent = fs.readFileSync(snippet, {
      encoding: "utf-8",
    });

    if (rawContent) {
      const translatedContent = rawContent.replace(
        /<t(\s+[^>]*)*>((.|\r|\n)*?)<\/t>/gi,
        (str, group1, group2) => {
          const group = toSnakeCase(snippet.split("\\").at(-1).split(".").at(0)).trim();
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

          return group2;
        }
      );
      returnArr.push(translatedContent);
    }

    writeCompareFile(snippetPath, returnArr.join("\n"));
  }

  for (let i = 0; i < layouts.length; i++) {
    const layout = layouts[i];
    const layoutName = layout.split("\\").at(-1);
    const layoutPath = path.join(process.cwd(), folder, "layout", layoutName);

    const returnArr = [];

    const rawContent = fs.readFileSync(layout, {
      encoding: "utf-8",
    });

    if (rawContent) {
      const translatedContent = rawContent.replace(
        /<t(\s+[^>]*)*>((.|\r|\n)*?)<\/t>/gi,
        (str, group1, group2) => {
          const group = toSnakeCase(layout.split("\\").at(-1).split(".").at(0)).trim();
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

          return group2;
        }
      );
      returnArr.push(translatedContent);
    }

    writeCompareFile(layoutPath, returnArr.join("\n"));
  }

  const translationsPath = path.join(process.cwd(), folder, "locales", "en.default.json");
  writeCompareFile(translationsPath, JSON.stringify(translations, undefined, 2));

  const target = getAllFiles(folder);

  for (let i = 0; i < target.length; i++) {
    if (/snippets\\[^\\]*\.liquid$/gi.test(target[i])) {
      const fileName = target[i].split("\\").at(-1);
      const targetFile = snippets.find((sourcePath) => sourcePath.includes(`\\${fileName}`));
      if (!targetFile) {
        console.log(
          `[${chalk.gray(new Date().toLocaleTimeString())}]: ${chalk.redBright(
            `Deleted: ${target[i]}`
          )}`
        );
        fs.unlinkSync(path.join(process.cwd(), target[i]));
      }
    }

    if (/sections\\[^\\]*\.liquid$/gi.test(target[i])) {
      const fileName = target[i].split("\\").at(-1);
      const targetFile = sections.find((sourcePath) => sourcePath.includes(`\\${fileName}`));
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
      const targetFile = layouts.find((sourcePath) => sourcePath.includes(`\\${fileName}`));
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
