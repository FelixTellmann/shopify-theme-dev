import fs from "fs";
import path from "path";
import { toSnakeCase } from "./../utils/to-snake-case";
import { ShopifySettings } from "types/shopify";

export const generateThemeSettings = (settingsSchema: ShopifySettings, folder) => {
  const noLocales = !!process.env.SHOPIFY_CMS_NO_LOCALIZAZTION;

  const localizedSettings = settingsSchema.map(({ name, ...settingsBlock }) => {
    if ("theme_author" in settingsBlock) return { name, ...settingsBlock };
    const settingsName = toSnakeCase(name);
    let paragraphCount = 1;
    let headerCount = 1;

    return {
      name: noLocales ? name : `t:settings_schema.${settingsName}.name`,
      ...settingsBlock,
      settings: settingsBlock.settings?.map((setting) => {
        const settingsBase = `t:settings_schema.${settingsName}.settings`;
        if (setting.type === "paragraph") {
          return {
            ...setting,
            content:
              "content" in setting
                ? noLocales && !setting.content.includes(" ")
                  ? setting.content
                  : `${settingsBase}.paragraph__${paragraphCount++}.content`
                : undefined,
          };
        }
        if (setting.type === "header") {
          return {
            ...setting,
            content:
              "content" in setting
                ? noLocales && !setting.content.includes(" ")
                  ? setting.content
                  : `${settingsBase}.header__${headerCount++}.content`
                : undefined,
          };
        }
        return {
          ...setting,
          label:
            "label" in setting
              ? noLocales
                ? setting.label
                : `${settingsBase}.${setting.id}.label`
              : undefined,
          info:
            "info" in setting
              ? noLocales
                ? setting.info
                : `${settingsBase}.${setting.id}.info`
              : undefined,
          placeholder:
            "placeholder" in setting
              ? noLocales
                ? setting.placeholder
                : `${settingsBase}.${setting.id}.placeholder`
              : undefined,
          options:
            "options" in setting
              ? noLocales
                ? setting.options
                : setting.options.map((option, index) => ({
                    ...option,
                    label: `${settingsBase}.${setting.id}.options__${index + 1}.label`,
                  }))
              : undefined,
        };
      }),
    };
  });

  const schemaContent = JSON.stringify(localizedSettings, undefined, 2);

  if (!fs.existsSync(path.join(process.cwd(), folder, "config", "settings_schema.json"))) {
    fs.writeFileSync(
      path.join(process.cwd(), folder, "config", "settings_schema.json"),
      schemaContent
    );
  }

  const contentVerification = fs.readFileSync(
    path.join(process.cwd(), folder, "config", "settings_schema.json"),
    {
      encoding: "utf-8",
    }
  );

  if (contentVerification !== schemaContent) {
    fs.writeFileSync(
      path.join(process.cwd(), folder, "config", "settings_schema.json"),
      schemaContent
    );
  }
};
