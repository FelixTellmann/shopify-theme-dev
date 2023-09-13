import fs from "fs";
import path from "path";

export const initAppExtensionFolders = (folder: string) => {
  /*= =============== Root Folder ================ */
  if (!fs.existsSync(path.join(process.cwd(), "extensions"))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions"), { recursive: true });
  }

  if (!fs.existsSync(path.join(process.cwd(), "extensions", folder))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions", folder), { recursive: true });
  }

  /*= =============== Theme ================ */

  if (!fs.existsSync(path.join(process.cwd(), "extensions", folder, "assets"))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions", folder, "assets"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), "extensions", folder, "locales"))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions", folder, "locales"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), "extensions", folder, "blocks"))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions", folder, "blocks"), { recursive: true });
  }
  if (!fs.existsSync(path.join(process.cwd(), "extensions", folder, "snippets"))) {
    fs.mkdirSync(path.join(process.cwd(), "extensions", folder, "snippets"), { recursive: true });
  }
};
