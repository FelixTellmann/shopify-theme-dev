import chalk from "chalk";
import fs from "fs";
import path from "path";
import { writeCompareFile } from "./generate-sections";
import { toSnakeCase } from "./../utils/to-snake-case";
import { ShopifySection } from "types/shopify";
import { toKebabCase } from "./../utils/to-kebab-case";

export const sectionToLiquid_WithLocalization = ({ name, ...section }, key) => {
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

  const returnArr = [];
  if (process.env.SHOPIFY_SECTIONS_BEFORE_RENDER) {
    returnArr.push(process.env.SHOPIFY_SECTIONS_BEFORE_RENDER);
  }
  const content = fs.readFileSync(
    path.join(process.cwd(), "sections", toKebabCase(key), `${toKebabCase(key)}.liquid`),
    {
      encoding: "utf-8",
    }
  );
  if (content) {
    returnArr.push(content);
  }

  if (process.env.SHOPIFY_SECTIONS_AFTER_RENDER) {
    returnArr.push(process.env.SHOPIFY_SECTIONS_AFTER_RENDER);
  }

  returnArr.push("{% schema %}");
  returnArr.push(JSON.stringify(localizedSection, undefined, 2));
  returnArr.push("{% endschema %}");
  returnArr.push("");
  return returnArr.join("\n");
};

export const generateThemeSections = (sections: { [p: string]: ShopifySection }, folder) => {
  for (const key in sections) {
    generateThemeSection(sections[key], key, folder);
  }
};

export const generateThemeSection = (section: ShopifySection, key: string, folder) => {
  const sectionName = `${toKebabCase(key)}.liquid`;
  const sectionPath = path.join(process.cwd(), folder, "sections", sectionName);
  const sectionSchemaAndContent = sectionToLiquid_WithLocalization(section, key);

  writeCompareFile(sectionPath, sectionSchemaAndContent);
};
