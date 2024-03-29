import fs from "fs";
import path from "path";
import { RestClient } from "shopify-typed-node-api/dist/clients/rest";
import { Asset } from "shopify-typed-node-api/dist/clients/rest/dataTypes";
import { ShopifySettings, ShopifySettingsInput } from "types/shopify";
import { getSettingsType } from "./generate-sections";

export const getSettings = async (api: RestClient, SHOPIFY_CMS_THEME_ID: string) => {
  const themeSettings = await api.get<Asset.GetById>({
    path: `themes/${SHOPIFY_CMS_THEME_ID}/assets`,
    query: { "asset[key]": `config/settings_schema.json` },
  });

  const settingsSchema = JSON.parse(themeSettings.body?.asset?.value) as ShopifySettings;

  const settings = settingsSchema.reduce((acc: ShopifySettingsInput[], group) => {
    if (!("settings" in group)) return acc;

    return [
      ...acc,
      ...((group.settings as any)
        .filter((s) => s.type !== "header" && s.type !== "paragraph")
        .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0)) as ShopifySettingsInput[]),
    ];
  }, []);

  const localTypes = [];
  const analyseSetting = (setting) => {
    if (setting.type === "article") {
      if (localTypes.includes("_Article_liquid")) return;
      localTypes.push("_Article_liquid");
    }
    if (setting.type === "blog") {
      if (localTypes.includes("_Blog_liquid")) return;
      localTypes.push("_Blog_liquid");
    }
    if (setting.type === "collection" && !setting.id.includes("__handle_only")) {
      if (localTypes.includes("_Collection_liquid")) return;
      localTypes.push("_Collection_liquid");
    }
    if (setting.type === "collection_list" && !setting.id.includes("__handle_only")) {
      if (localTypes.includes("_Collection_liquid")) return;
      localTypes.push("_Collection_liquid");
    }
    if (setting.type === "color") {
      if (localTypes.includes("_Color_liquid")) return;
      localTypes.push("_Color_liquid");
    }
    if (setting.type === "image_picker") {
      if (localTypes.includes("_Image_liquid")) return;
      localTypes.push("_Image_liquid");
    }
    if (setting.type === "font_picker") {
      if (localTypes.includes("_Font_liquid")) return;
      localTypes.push("_Font_liquid");
    }
    if (setting.type === "link_list") {
      if (localTypes.includes("_Linklist_liquid")) return;
      localTypes.push("_Linklist_liquid");
    }
    if (setting.type === "page") {
      if (localTypes.includes("_Page_liquid")) return;
      localTypes.push("_Page_liquid");
    }
    if (setting.type === "product" && !setting.id.includes("__handle_only")) {
      if (localTypes.includes("_Product_liquid")) return;
      localTypes.push("_Product_liquid");
    }
    if (setting.type === "product_list" && !setting.id.includes("__handle_only")) {
      if (localTypes.includes("_Product_liquid")) return;
      localTypes.push("_Product_liquid");
    }
  };

  settings.forEach(analyseSetting);
  const arr = [];
  if (settings.length) {
    arr.push(`export type SettingsSchema = {`);

    arr.push(
      settings
        .map(
          (setting) =>
            `  /** Input type: ${setting.type} */\n  ` +
            `${/[^\w_]/gi.test(setting.id) ? `"${setting.id}"` : `${setting.id}`}${getSettingsType(
              setting
            )};`
        )
        .sort((a, b) => {
          const aX = a.split("\n")[1];
          const bX = b.split("\n")[1];
          if (aX.includes("?") && !bX.includes("?")) {
            return 1;
          } else if (!aX.includes("?") && bX.includes("?")) {
            return -1;
          } else if (aX > bX) {
            return 1;
          } else if (aX < bX) {
            return -1;
          } else {
            return 0;
          }
        })
        .join("\n")
    );
    arr.push(`};`);
  }

  const typesContent = `import { ${localTypes.join(", ")} } from "./shopify";\n\n${arr.join(
    "\n"
  )}\n`;

  if (!fs.existsSync(path.join(process.cwd(), ".shopify-typed-settings", "types", "settings.ts"))) {
    fs.writeFileSync(
      path.join(process.cwd(), ".shopify-typed-settings", "types", "settings.ts"),
      typesContent
    );
    return;
  }

  const indexContentVerification = fs.readFileSync(
    path.join(process.cwd(), ".shopify-typed-settings", "types", "settings.ts"),
    {
      encoding: "utf-8",
    }
  );

  if (indexContentVerification !== typesContent) {
    fs.writeFileSync(
      path.join(process.cwd(), ".shopify-typed-settings", "types", "settings.ts"),
      typesContent
    );
  }

  const schemaContent = JSON.stringify(settingsSchema, undefined, 2);
  if (
    !fs.existsSync(
      path.join(process.cwd(), ".shopify-typed-settings", "theme", "config", "settings_schema.json")
    )
  ) {
    fs.writeFileSync(
      path.join(
        process.cwd(),
        ".shopify-typed-settings",
        "theme",
        "config",
        "settings_schema.json"
      ),
      schemaContent
    );
  }

  const contentVerification = fs.readFileSync(
    path.join(process.cwd(), ".shopify-typed-settings", "theme", "config", "settings_schema.json"),
    {
      encoding: "utf-8",
    }
  );

  if (contentVerification !== schemaContent) {
    fs.writeFileSync(
      path.join(
        process.cwd(),
        ".shopify-typed-settings",
        "theme",
        "config",
        "settings_schema.json"
      ),
      schemaContent
    );
  }
};
